// Advice and weather warnings from the provider, saved and delivered by Wafra.
//
// providerEvents: the provider POSTs `advice.created` and `weather.warning` here, signed like its
// survey results. Each one is saved as a suggestion (Wafra's own format, whatever the provider);
// the app no longer writes advice itself. A new suggestion starts onSuggestionCreated, which sends
// the push notification to the farm's people and queues the farm's automatic messages to its
// contacts, so advice reaches people while the app is closed.
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { logger } = require('firebase-functions/v2');
const provider = require('./providers/mmc');
const { fromProvider } = require('./provider-sync');

const ADVICE_TYPES = ['irrigation', 'nutrition', 'protection'];
const SEVERITIES = ['monitor', 'urgent'];
const isText = (x, max = 500) => typeof x === 'string' && x.length > 0 && x.length <= max;
const isId = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(x);
const isTime = (x) => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const time = (x) => (x ? Timestamp.fromDate(new Date(x)) : null);

// What the provider sends, checked; the error says what is wrong, or null.
//   advice.created:  { id, type, sentAt, advice: { providerAdviceId, providerFarmId, fieldIds, type,
//                      severity, headline, action, activeIngredient?, ruleVersion, issuedAt, supersedes? } }
//   weather.warning: { id, type, sentAt, warning: { providerWarningId, providerFarmId, severity,
//                      headline, action, issuedAt, startsAt?, endsAt? } }
function problem(m) {
  if (m.type === 'advice.created') {
    const a = m.advice || {};
    if (!isId(a.providerAdviceId) || !isText(a.providerFarmId, 200)) return 'advice: providerAdviceId and providerFarmId';
    if (!Array.isArray(a.fieldIds) || a.fieldIds.length === 0 || !a.fieldIds.every(isId)) return 'advice.fieldIds: one or more field IDs';
    if (!ADVICE_TYPES.includes(a.type) || !SEVERITIES.includes(a.severity)) return 'advice.type and advice.severity';
    if (!isText(a.headline) || !isText(a.action, 2000) || !isText(a.ruleVersion, 100) || !isTime(a.issuedAt)) return 'advice: headline, action, ruleVersion, issuedAt';
    if (a.activeIngredient != null && (a.type !== 'protection' || !isText(a.activeIngredient, 200))) return 'advice.activeIngredient: protection only';
    if (a.supersedes != null && !isId(a.supersedes)) return 'advice.supersedes: a providerAdviceId';
    return null;
  }
  if (m.type === 'weather.warning') {
    const w = m.warning || {};
    if (!isId(w.providerWarningId) || !isText(w.providerFarmId, 200)) return 'warning: providerWarningId and providerFarmId';
    if (!SEVERITIES.includes(w.severity) || !isText(w.headline) || !isText(w.action, 2000) || !isTime(w.issuedAt)) return 'warning: severity, headline, action, issuedAt';
    if ((w.startsAt != null && !isTime(w.startsAt)) || (w.endsAt != null && !isTime(w.endsAt))) return 'warning: startsAt and endsAt are ISO dates';
    return null;
  }
  return 'type: advice.created or weather.warning';
}

// The names the farmer gives the fields, at the time of the advice: "Field 3" until renamed.
function namesOf(farm, fieldIds) {
  const fields = (farm.boundary && farm.boundary.fields) || [];
  return fieldIds.map((id) => {
    const named = farm.fieldNames && farm.fieldNames[id];
    const field = fields.find((f) => f.id === id);
    return named || (field ? `Field ${field.number}` : null);
  });
}

// One suggestion per provider advice: the document ID comes from the provider's ID, so a message
// sent twice is saved once.
async function receiveEvent(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await fromProvider(req))) return res.status(403).end();
  const m = req.body || {};
  const wrong = problem(m);
  if (wrong) return res.status(400).json({ error: `Expected ${wrong}.` });

  const body = m.type === 'advice.created' ? m.advice : m.warning;
  const db = getFirestore();
  const farms = await db.collection('farms').where('provider', '==', provider.name)
    .where('providerFarmId', '==', body.providerFarmId).limit(1).get();
  if (farms.empty) return res.status(404).json({ error: 'Unknown providerFarmId.' });
  const farmDoc = farms.docs[0];
  const farm = farmDoc.data();
  // Only active farms are computed; anything else is late, and dropped.
  const service = await db.doc(`farmService/${farmDoc.id}`).get();
  if (!service.exists || service.get('status') !== 'active') return res.status(202).json({ ignored: 'farm not active' });

  const advice = m.type === 'advice.created';
  const providerId = advice ? body.providerAdviceId : body.providerWarningId;
  const ref = db.doc(`suggestions/${provider.name}_${advice ? 'a' : 'w'}_${providerId}`);
  const fieldIds = advice ? body.fieldIds : [];
  const known = new Set(((farm.boundary && farm.boundary.fields) || []).map((f) => f.id));
  if (!fieldIds.every((id) => known.has(id))) return res.status(409).json({ error: 'A field ID is not on the farm\'s current boundary.' });

  const suggestion = {
    farmId: farmDoc.id,
    provider: provider.name,
    providerAdviceId: providerId,
    fieldIds,
    fieldNames: namesOf(farm, fieldIds),
    type: advice ? body.type : 'weather',
    severity: body.severity,
    headline: body.headline,
    action: body.action,
    activeIngredient: (advice && body.activeIngredient) || null,
    ruleVersion: (advice && body.ruleVersion) || null,
    issuedAt: time(body.issuedAt),
    startsAt: advice ? null : time(body.startsAt),
    endsAt: advice ? null : time(body.endsAt),
    supersededBy: null,
    status: 'open',
    shareCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  };
  try {
    await ref.create(suggestion);
  } catch (err) {
    if (err.code === 6) return res.status(200).json({ duplicate: true }); // ALREADY_EXISTS
    throw err;
  }
  if (advice && body.supersedes) {
    const old = db.doc(`suggestions/${provider.name}_a_${body.supersedes}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(old);
      if (snap.exists && snap.get('farmId') === farmDoc.id && ['open', 'deferred'].includes(snap.get('status'))) {
        tx.update(old, { status: 'superseded', supersededBy: ref.id });
      }
    });
  }
  return res.status(201).json({ suggestionId: ref.id });
}

// The farm's people with the app: the owner and the active co-owners and supervisors.
async function peopleOf(farmId, farm) {
  const db = getFirestore();
  const access = await db.collection('farmAccess').where('farmId', '==', farmId).where('status', '==', 'active').get();
  return [...new Set([farm.ownerUid, ...access.docs.map((d) => d.get('uid'))])];
}

const GONE = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

// Push notifications to every device of the farm's people. Tokens the phone no longer has are
// deleted. Quiet hours are left to the phone: an urgent advice still shows.
async function notify(farmId, farm, s, suggestionId) {
  const db = getFirestore();
  const devices = (await Promise.all((await peopleOf(farmId, farm))
    .map((uid) => db.collection(`users/${uid}/devices`).get())))
    .flatMap((snap) => snap.docs.filter((d) => d.get('fcmToken')));
  if (devices.length === 0) return;
  const title = [farm.name, ...s.fieldNames.filter(Boolean)].join(' · ');
  for (let i = 0; i < devices.length; i += 500) {
    const batch = devices.slice(i, i + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: batch.map((d) => d.get('fcmToken')),
      notification: { title, body: s.headline },
      data: { suggestionId, farmId, type: s.type, severity: s.severity },
      android: { priority: s.severity === 'urgent' ? 'high' : 'normal' },
    });
    await Promise.all(result.responses.map((r, k) => (
      !r.success && r.error && GONE.has(r.error.code) ? batch[k].ref.delete() : null)));
  }
}

// The farm's rules (B10 contacts, F9): `adviceRules` = { auto, byType: { irrigation: [contactId…],
// nutrition, protection, weather } }. With `auto` on, each new suggestion is queued for the
// contacts its type goes to, on each contact's own channel. A messaging gateway sends what is
// queued and updates `delivery`.
async function queueForContacts(farmId, farm, s, suggestionRef) {
  const rules = farm.adviceRules || {};
  const ids = (rules.auto && rules.byType && rules.byType[s.type]) || [];
  if (ids.length === 0) return;
  const db = getFirestore();
  const contacts = (await Promise.all(ids.map((id) => db.doc(`farms/${farmId}/contacts/${id}`).get())))
    .filter((c) => c.exists && c.get('active') !== false);
  if (contacts.length === 0) return;
  const batch = db.batch();
  for (const c of contacts) {
    // One share per contact and suggestion: a retried trigger writes the same records again.
    batch.set(suggestionRef.collection('shares').doc(`auto_${c.id}`), {
      farmId,
      kind: 'share',
      byUid: null,
      auto: true,
      recipient: { type: 'contact', id: c.id, name: c.get('name') || null },
      channel: c.get('channel'),
      delivery: 'queued',
      at: FieldValue.serverTimestamp(),
      deliveryUpdatedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(suggestionRef, { shareCount: contacts.length, lastSharedAt: FieldValue.serverTimestamp() });
  await batch.commit();
}

// onSuggestionCreated.
async function deliver(event) {
  const snap = event.data;
  if (!snap) return;
  const s = snap.data();
  const farmSnap = await getFirestore().doc(`farms/${s.farmId}`).get();
  if (!farmSnap.exists) return;
  const farm = farmSnap.data();
  await queueForContacts(s.farmId, farm, s, snap.ref);
  await notify(s.farmId, farm, s, snap.id);
  logger.info('suggestion delivered', { suggestionId: snap.id, farmId: s.farmId, type: s.type });
}

module.exports = { problem, namesOf, receiveEvent, deliver };
