// Wafra's side of the link with the analytics provider, apart from the farm pass (pass.js).
//
// Out: one message per farmService change, the full list once a day (messages can get lost), and
// survey requests when a farm is new or its boundary changes. In: survey results, and an
// optional status check. Nothing about people goes out: no UID, no phone, no name, and not
// Wafra's own farm IDs. The provider identifies farms by its own ID.
const crypto = require('crypto');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions/v2');
const { GoogleAuth, OAuth2Client } = require('google-auth-library');
const provider = require('./providers/mmc');

const PAGE = 500;
const IN_LIMIT = 30; // Firestore's limit for an `in` query
// A message that still fails after a day is dropped: the daily full list repairs the gap.
const MAX_EVENT_AGE = 24 * 3600 * 1000;

let auth;
// POSTs one message to the provider with a Google ID token of Wafra's service account (audience:
// the provider's address). A failure throws, so the trigger retries.
async function send(message) {
  const url = provider.webhookUrl.value();
  auth ??= new GoogleAuth();
  const client = await auth.getIdTokenClient(url);
  await client.request({ url, method: 'POST', data: { ...message, sentAt: new Date().toISOString() } });
}

// What the provider gets of a farmService record.
function farmMessage(r) {
  return {
    providerFarmId: r.providerFarmId,
    status: r.status,
    level: r.level,
    services: r.services || [],
    boundaryVersion: r.boundaryVersion ?? null,
    version: r.version || 0,
  };
}

function eventType(before, after) {
  if (after.status === 'removed') return 'farm.removed';
  if (after.status === 'active' && (!before || before.status !== 'active')) return 'farm.activated';
  if (after.status !== 'active' && before && before.status === 'active') return 'farm.deactivated';
  return 'farm.updated';
}

function tooOld(event) {
  if (Date.now() - Date.parse(event.time) <= MAX_EVENT_AGE) return false;
  logger.error('provider push gave up', { id: event.id, document: event.document });
  return true;
}

// onFarmServiceWritten: the event ID lets the provider ignore a copy; `version` lets it ignore
// an older message.
async function pushFarmChange(event) {
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.provider !== provider.name || tooOld(event)) return;
  const before = event.data.before.exists ? event.data.before.data() : null;
  await send({ id: event.id, type: eventType(before, after), farm: farmMessage(after) });
}

// providerReconcile: every farmService record of this provider, in pages, under one snapshot ID.
// The provider replaces its list with the snapshot once the page marked `last` has arrived.
async function sendFullList() {
  const db = getFirestore();
  const snapshotId = crypto.randomUUID();
  let cursor = null;
  for (let page = 0; ; page += 1) {
    let query = db.collection('farmService').where('provider', '==', provider.name)
      .orderBy(FieldPath.documentId()).limit(PAGE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    const last = snap.size < PAGE;
    await send({
      id: `${snapshotId}-${page}`,
      type: 'farms.snapshot',
      snapshot: { id: snapshotId, page, last },
      farms: snap.docs.map((d) => farmMessage(d.data())),
    });
    if (last) return;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

// From onFarmWritten: a new farm, or a new boundary version, is sent to the provider to survey.
// The request ID comes from the event ID, so a retried event sends the same request again.
async function requestSurvey(event, before, after) {
  if (!after || after.status !== 'active' || !after.boundary) return;
  const version = after.boundary.version;
  if (before && before.boundary && before.boundary.version === version) return;
  if (tooOld(event)) return;
  const requestId = crypto.createHash('sha256').update(event.id).digest('hex').slice(0, 32);
  await getFirestore().doc(`farms/${event.params.farmId}`).update({ surveyRequestId: requestId, surveyStatus: 'running' });
  await send({
    id: `survey-${requestId}`,
    type: 'survey.requested',
    survey: {
      requestId,
      providerFarmId: after.providerFarmId || null,
      farmType: after.type,
      boundary: { version, points: after.boundary.points },
    },
  });
}

const verifier = new OAuth2Client();
// Calls from the provider carry a Google ID token of the provider's own service account, with
// this Firebase project's ID as the audience. Anything else is refused.
async function fromProvider(req) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) return false;
  try {
    const ticket = await verifier.verifyIdToken({ idToken: m[1], audience: process.env.GCLOUD_PROJECT });
    const payload = ticket.getPayload();
    return payload.email_verified === true && payload.email === provider.callerServiceAccount.value();
  } catch (err) {
    return false;
  }
}

const isCount = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;

// providerSurveyResult: the only way measured fields reach `farms`. The app cannot write them,
// because the price is computed from them and the farm pass trusts providerFarmId.
// Body: { requestId, providerFarmId, boundaryVersion, status: 'done' | 'failed', cropAreaHa, treeCount }
async function receiveSurveyResult(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await fromProvider(req))) return res.status(403).end();
  const r = req.body || {};
  if (typeof r.requestId !== 'string' || typeof r.providerFarmId !== 'string' || !r.providerFarmId
    || !Number.isInteger(r.boundaryVersion) || !['done', 'failed'].includes(r.status)
    || (r.status === 'done' && !(isCount(r.cropAreaHa) && Number.isInteger(r.treeCount) && r.treeCount >= 0))) {
    return res.status(400).json({ error: 'Expected requestId, providerFarmId, boundaryVersion, status, and for done: cropAreaHa, treeCount.' });
  }
  const snap = await getFirestore().collection('farms').where('surveyRequestId', '==', r.requestId).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Unknown requestId.' });
  const ref = snap.docs[0].ref;
  const farm = snap.docs[0].data();
  if (!farm.boundary || farm.boundary.version !== r.boundaryVersion) {
    return res.status(409).json({ error: 'The boundary changed since this request; a new survey was requested.' });
  }
  if (farm.providerFarmId && farm.providerFarmId !== r.providerFarmId) {
    return res.status(409).json({ error: 'This farm already has another providerFarmId.' });
  }
  if (r.status === 'failed') {
    await ref.update({ surveyStatus: 'failed' });
    return res.status(204).end();
  }
  const update = {
    providerFarmId: r.providerFarmId,
    provider: provider.name,
    surveyStatus: 'done',
    surveyedBoundaryVersion: r.boundaryVersion,
    cropAreaHa: r.cropAreaHa,
    treeCount: r.treeCount,
  };
  // The size, and so the price, changes only after a survey.
  if (r.cropAreaHa !== farm.cropAreaHa || r.treeCount !== farm.treeCount) update.sizeUpdatedAt = FieldValue.serverTimestamp();
  await ref.update(update);
  return res.status(204).end();
}

// checkFarms (optional): for costly jobs, the provider confirms farms before it starts.
// Body: { farmIds: [providerFarmId, …] } (at most 500). Unknown IDs come back as `unknown`.
async function checkFarms(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await fromProvider(req))) return res.status(403).end();
  const ids = req.body && req.body.farmIds;
  if (!Array.isArray(ids) || ids.length > PAGE || !ids.every((id) => typeof id === 'string')) {
    return res.status(400).json({ error: `Expected farmIds: up to ${PAGE} strings.` });
  }
  const found = new Map();
  for (let i = 0; i < ids.length; i += IN_LIMIT) {
    const snap = await getFirestore().collection('farmService').where('provider', '==', provider.name)
      .where('providerFarmId', 'in', ids.slice(i, i + IN_LIMIT)).get();
    for (const d of snap.docs) found.set(d.get('providerFarmId'), farmMessage(d.data()));
  }
  return res.json({ farms: ids.map((id) => found.get(id) || { providerFarmId: id, status: 'unknown' }) });
}

module.exports = { farmMessage, eventType, pushFarmChange, sendFullList, requestSurvey, receiveSurveyResult, checkFarms };
