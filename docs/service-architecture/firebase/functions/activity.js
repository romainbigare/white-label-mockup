// The activity log of a farm: farms/{farmId}/activity/{entryId}, shown in the app's More tab.
//
// Wafra's functions write what happens in Firestore (farm and fields, survey, team, contacts,
// advice), so the log is complete and nobody can fake it. The app adds only what happens at the
// provider, which Firestore never sees (a tree edited or reported, a crop season), through the rules.
// No English text is stored: an entry is a copy key and its values, shown in the reader's language.
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// One entry. `id` (optional) makes a retried trigger write the same entry once.
async function logActivity(farmId, { actorUid = null, actorName = null, category, key, params = {} }, id = null) {
  const col = getFirestore().collection(`farms/${farmId}/activity`);
  const ref = id ? col.doc(id) : col.doc();
  await ref.set({ at: FieldValue.serverTimestamp(), actorUid, actorName, category, key, params, by: 'wafra' });
}

const fieldCount = (farm) => ((farm && farm.boundary && farm.boundary.fields) || []).length;

// From onFarmWritten: created, redrawn, renamed fields, archived.
async function farmChanged(eventId, farmId, before, after) {
  if (!after) return;
  const by = (after.boundary && after.boundary.updatedBy) || null;
  const farm = after.name || null;
  if (!before) {
    return logActivity(farmId, { actorUid: after.ownerUid, category: 'boundary', key: 'log.farm.created2', params: { farm, n: fieldCount(after) } }, `${eventId}-c`);
  }
  if (before.status === 'active' && after.status === 'archived') {
    return logActivity(farmId, { category: 'boundary', key: 'log.farm.archived', params: { farm, reason: after.archivedReason || null } }, `${eventId}-a`);
  }
  const bv = (x) => (x.boundary && x.boundary.version) || 0;
  if (bv(after) > bv(before)) {
    await logActivity(farmId, { actorUid: by, category: 'boundary', key: 'log.fields.redrawn', params: { farm, n: fieldCount(after) } }, `${eventId}-b`);
  }
  const names = (x) => x.fieldNames || {};
  for (const [fieldId, name] of Object.entries(names(after))) {
    if (names(before)[fieldId] === name) continue;
    const field = (after.boundary.fields || []).find((f) => f.id === fieldId);
    await logActivity(farmId, { category: 'boundary', key: 'log.field.renamed', params: { n: field ? field.number : null, name } }, `${eventId}-r-${fieldId}`);
  }
  if (before.surveyStatus !== after.surveyStatus && ['done', 'failed'].includes(after.surveyStatus)) {
    const key = after.surveyStatus === 'done' ? 'log.count.ready' : 'log.survey.failed';
    await logActivity(farmId, { category: 'boundary', key, params: { farm } }, `${eventId}-s`);
  }
}

// From onFarmAccessWritten: a person joined (or rejoined) or was removed.
async function accessChanged(eventId, before, after) {
  if (!after) return;
  const joined = after.status === 'active' && (!before || before.status !== 'active');
  const removed = after.status === 'revoked' && before && before.status === 'active';
  if (!joined && !removed) return;
  const user = await getFirestore().doc(`users/${after.uid}`).get();
  const who = user.exists ? [user.get('firstName'), user.get('lastName')].filter(Boolean).join(' ') || null : null;
  await logActivity(after.farmId, {
    actorUid: joined ? after.uid : null,
    category: 'member',
    key: joined ? 'log.team.joined' : 'log.team.revoked',
    params: { who, role: after.role },
  }, `${eventId}-m`);
}

// From onContactWritten: a contact added to or removed from the workforce (B10).
async function contactChanged(eventId, farmId, before, after) {
  const was = before && before.active !== false;
  const is = after && after.active !== false;
  if (was === is) return;
  const who = (after || before).name || null;
  await logActivity(farmId, { category: 'member', key: is ? 'log.team.added' : 'log.team.removed', params: { who } }, `${eventId}-k`);
}

// From onSuggestionUpdated: what a person did with an advice.
const OUTCOME_KEYS = { completed: 'log.advice.completed', ignored: 'log.advice.ignored', deferred: 'log.advice.reminder' };
async function suggestionChanged(eventId, before, after) {
  const key = OUTCOME_KEYS[after.status];
  if (!key || before.status === after.status) return;
  const actor = typeof after.completedBy === 'string' && !after.completedBy.startsWith('contact:') ? after.completedBy : null;
  await logActivity(after.farmId, {
    actorUid: actor, category: after.status === 'completed' ? 'input' : 'advice', key,
    params: { action: after.headline || null },
  }, `${eventId}-o`);
}

// From onShareCreated: an advice sent on by a person (the automatic ones are logged when sent).
async function shareCreated(eventId, suggestion, share) {
  if (share.auto) return;
  await logActivity(share.farmId, {
    actorUid: share.byUid || null, category: 'advice', key: 'log.advice.sent',
    params: { action: suggestion ? suggestion.headline : null, who: (share.recipient && share.recipient.name) || null },
  }, `${eventId}-h`);
}

module.exports = { logActivity, farmChanged, accessChanged, contactChanged, suggestionChanged, shareCreated };
