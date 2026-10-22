/* ---------------------------------------------------------------------------
   actions.js — the write layer.

   Everything that changes data goes through here, which is what lets three
   cross-cutting behaviours be implemented once:

     WF2.016 / WF5.153  every offline-capable action confirms locally and
                      immediately, then queues.
     WF11.004           an action that CANNOT be done offline says what is needed,
                      calmly and by name — it is never a dead control.
   --------------------------------------------------------------------------- */

import { state, commit, toast } from '../core/store.js';
import { t } from '../core/i18n.js';
import { NOW, digits } from '../core/format.js';
import { openModal } from '../core/router.js';
import { rawAdvice, rawPlot, rawFarm, supervisorOf, personById } from './selectors.js';
import { rng, treeGrid } from './fixtures.js';
import { additionalUserLimit } from '../core/entitlements.js';

let seq = 100;
const uuid = () => `local-${(seq += 1)}`;

export function createFarmInvitation(farmId, role = 'co-owner') {
  const active = (state.db.farmAccess ?? []).filter((a) => a.status === 'active' && a.accountId !== state.session.userId);
  const pending = (state.db.farmInvitations ?? []).filter((i) => i.status === 'active');
  if (active.length + pending.length >= additionalUserLimit()) {
    openModal('UPGRADE', { featureKey: 'multiuser' });
    return null;
  }
  const invite = { id: `invite-${(state.db.farmInvitations?.length ?? 0) + 1}`, farmId, role, code: '482193', qrToken: `invite-${farmId}-token`, status: 'active', expiresAt: '2026-09-18T12:00:00Z', createdBy: state.session.userId };
  state.db.farmInvitations ??= [];
  state.db.farmInvitations.push(invite);
  commit('invitation');
  return invite;
}

export function cancelFarmInvitation(id) {
  const invite = state.db.farmInvitations?.find((i) => i.id === id);
  if (!invite) return false;
  invite.status = 'revoked'; commit('invitation'); return true;
}

export function redeemFarmInvitation(code, account = {}) {
  const invite = state.db.farmInvitations?.find((i) => i.code === code && i.status === 'active' && new Date(i.expiresAt) > NOW);
  if (!invite) return null;
  const accountId = account.id ?? `user-${(state.db.accounts?.length ?? 0) + 1}`;
  state.db.accounts ??= [];
  if (!state.db.accounts.some((a) => a.id === accountId)) state.db.accounts.push({ id: accountId, email: account.email ?? '', phone: account.phone ?? '', credentialsCreated: true, name: account.name ?? 'New farm user' });
  state.db.farmAccess ??= [];
  state.db.farmAccess.push({ farmId: invite.farmId, accountId, role: invite.role, status: 'active' });
  invite.status = 'used'; invite.usedBy = accountId; invite.usedAt = NOW.toISOString();
  state.session.userId = accountId; state.session.role = invite.role;
  commit('invitation');
  return invite;
}

/** WF11.005 — every offline record carries a client UUID and an idempotency key.
    `label` is the English it was queued with; `ref` names the record it is
    about ({ adviceId }), so F10 can print that record in the reader's
    language rather than the English copied here. */
function queue(kind, label, ref = {}) {
  state.db.syncQueue.push({ id: uuid(), kind, label, ...ref, at: NOW.toISOString(), idempotencyKey: uuid() });
  state.session.pendingSync = state.db.syncQueue.length;
}

function offline() {
  return state.session.connectivity === 'offline';
}

/**
 * WF11.004 — guard for the actions §11.3 says cannot be done offline.
 * Returns true when the caller should stop.
 */
export function requiresConnection(whatKey, whatEn) {
  if (!offline()) return false;
  openModal('NEEDS_CONNECTION', { what: t(whatKey, whatEn) });
  return true;
}

function confirmLocally(message) {
  if (offline()) {
    toast(`${message} · ${t('offline.willsend', 'will send when you have signal')}`);
    return;
  }
  toast(message);
}

/* -- advice --------------------------------------------------------------- */

export function markAdviceSeen(id) {
  // Drawing an advice card counts as reading it, which is what clears the tab
  // badge (WF3.003). The harness screen grid draws every card in the app at once
  // without anyone reading anything, so it renders under a preview flag and the
  // badge survives being looked at.
  if (state.ui.preview) return;
  state.db.seenAdvice.add(id);
}

/** WF5.103 — advice is done once the work against it has been recorded. */
export function markAdviceDone(id) {
  const advice = state.db.advice.find((a) => a.id === id);
  if (advice) advice.status = 'completed';
}

/**
 * WF5.097 / WF5.098 — Ignore and "remind me tomorrow" are the same mechanism
 * said two ways: the item leaves the inbox and comes back TOMORROW if the
 * condition still holds. There is no interval menu, so there is no interval
 * argument here either — the only option is tomorrow.
 *
 * Nothing is deleted. The item keeps its place in the advisory log (§6.3),
 * which is what lets a deferred recommendation be reconstructed later.
 */
export function deferAdvice(id, { asReminder = false } = {}) {
  const advice = state.db.advice.find((a) => a.id === id);
  if (!advice) return;
  advice.deferredUntil = 'tomorrow';
  advice.status = 'deferred';
  // If it was already out with the supervisor, calling it off takes it back:
  // a deferred item still claiming to be waiting on somebody is a lie about
  // where the work is, and it would come back tomorrow already "sent".
  advice.sentAt = null;
  advice.sentTo = null;
  if (asReminder) logActivity('advice', advice.farmId, 'log.advice.reminder', 'Set a reminder for "{action}"', { adviceId: advice.id, action: advice.action });
  else logActivity('advice', advice.farmId, 'log.advice.ignored', 'Ignored "{action}"', { adviceId: advice.id, action: advice.action });
  confirmLocally(asReminder
    ? t('advice.remind.confirm', 'We will show this again tomorrow')
    : t('advice.ignore.confirm', 'Hidden until tomorrow'));
  commit('advice');
}

/** Put a deferred item back by hand, from the All tab. */
export function restoreAdvice(id) {
  const advice = state.db.advice.find((a) => a.id === id);
  if (!advice) return;
  advice.deferredUntil = null;
  advice.status = 'open';
  commit('advice');
}

/* CLOSING AN ADVICE.

   One button, no form. The app used to ask how much was actually applied,
   against which of three outcomes, with a reason if the answer was "I did not
   do this" — a record that existed because an advice used to be assigned to
   somebody and somebody had to be answerable for it. Sharing replaced assigning
   and the account went with it, so what is left is the farmer saying he is done
   with the item and wants it off his list. */
export function completeAdvice(id) {
  const advice = rawAdvice(id);
  if (!advice) return;
  advice.status = 'completed';
  advice.completedAt = NOW.toISOString();
  logActivity('input', advice.farmId, 'log.advice.completed', 'Marked "{action}" completed', { adviceId: advice.id, action: advice.action });
  if (offline()) queue('input.log', advice.action, { adviceId: advice.id });
  confirmLocally(t('advice.completed.confirm', 'Marked completed'));
  commit('advice');
}

/* SHARING AN ADVICE WITH SOMEBODY ON THE TEAM.

   This is what assignment became. The message goes out by WhatsApp or SMS
   carrying the job, and that is the end of the app's involvement: nothing is
   tracked back, nobody is accountable in a database, and the advice stays on
   the owner's list until he closes it himself. A farm where the owner rings the
   man who cannot read is not a farm that will keep a ledger.

   The delivery is pretended, visibly. What is real is the state it leaves
   behind: `sentAt`, `sentTo`, and a line on the card saying who has it. */

export function sendAdvice(id, personId) {
  if (requiresConnection('offline.need.send', 'a connection to send this')) return null;
  const advice = rawAdvice(id);
  if (!advice) return null;
  const who = personById(personId) ?? supervisorOf(advice.farmId);
  advice.sentAt = NOW.toISOString();
  advice.sentTo = who?.id ?? null;
  if (who) logActivity('advice', advice.farmId, 'log.advice.sent', 'Sent "{action}" to {who}', { adviceId: advice.id, action: advice.action, who: who.name });
  else logActivity('advice', advice.farmId, 'log.advice.sentteam', 'Sent "{action}" to the team', { adviceId: advice.id, action: advice.action });
  confirmLocally(t('advice.shared.confirm', 'Shared with {who}', { who: (who?.name ?? '').split(' ')[0] }));
  commit('advice');
  return advice;
}

/** Everything waiting, out in one message. WF5.096's bulk case. */
export function sendAllAdvice(list, personId) {
  if (requiresConnection('offline.need.send', 'a connection to send this')) return 0;
  let sent = 0;
  for (const a of list) if (sendAdviceQuietly(a.id, personId)) sent += 1;
  commit('advice');
  return sent;
}

function sendAdviceQuietly(id, personId) {
  const advice = rawAdvice(id);
  if (!advice || advice.sentAt) return false;
  const who = personById(personId) ?? supervisorOf(advice.farmId);
  advice.sentAt = NOW.toISOString();
  advice.sentTo = who?.id ?? null;
  return true;
}

/* -- the workforce, B10 ---------------------------------------------------
   Three writes and nothing else. A person is a name, a number and the app he
   reads; there is no account behind him and nothing to grant him. */

export function addTeamMember(farmId, { name, phone, channel, supervisor }) {
  const id = `user-${state.db.team.length + 1}-${Date.now().toString(36)}`;
  const parts = name.trim().split(/\s+/);
  state.db.team.push({
    id,
    name: name.trim(),
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    initials: parts.map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join(''),
    email: '',
    company: '',
    role: supervisor ? 'supervisor' : 'worker',
    phone: phone.trim(),
    channel: channel ?? 'whatsapp',
    language: '',
    farmIds: [farmId],
    lastActive: '',
    isYou: false,
  });
  logActivity('member', farmId, 'log.team.added', 'Added {who} to the workforce', { who: name.trim() });
  confirmLocally(t('b14.added', '{who} added', { who: parts[0] ?? name }));
  commit('team');
}

export function updateTeamMember(id, { name, phone, channel, supervisor }) {
  const m = state.db.team.find((p) => p.id === id);
  if (!m) return;
  const parts = name.trim().split(/\s+/);
  Object.assign(m, {
    name: name.trim(),
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    initials: parts.map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join(''),
    phone: phone.trim(),
    channel,
    role: supervisor ? 'supervisor' : 'worker',
  });
  confirmLocally(t('b14.saved', 'Saved'));
  commit('team');
}

/* Removing somebody takes them off THIS farm, and off the app only when that
   was their last one. A man who works two holdings is one record. */
export function removeTeamMember(id, farmId) {
  const m = state.db.team.find((p) => p.id === id);
  if (!m) return;
  m.farmIds = m.farmIds.filter((f) => f !== farmId);
  if (!m.farmIds.length) state.db.team = state.db.team.filter((p) => p.id !== id);
  // Anything routed to him stops being routed to him, on every farm, because a
  // standing rule pointing at a man who is gone is a message that never sends.
  const dist = state.session.distribution;
  if (dist) {
    for (const type of Object.keys(dist)) {
      for (const ch of Object.keys(dist[type])) {
        dist[type][ch] = dist[type][ch].filter((p) => p !== id);
      }
    }
  }
  if (state.session.autoSendTo === id) { state.session.autoSendTo = null; state.session.autoSend = false; }
  logActivity('member', farmId, 'log.team.removed', 'Removed {who} from the workforce', { who: m.name });
  confirmLocally(t('b14.removed', '{who} removed', { who: m.firstName || m.name }));
  commit('team');
}

/* THE REMINDER THE SATELLITE CANNOT WRITE ITSELF.

   It reads a canopy, so it can tell that the tomatoes came off and it cannot
   tell what went in after them for about three weeks. Until the farmer says,
   the plot has no current crop and every recommendation about it is a guess.
   So the plot carries the date the harvest was seen, the plot list says so in
   red, and this is what clears it. */

/* Review 22/09 folded the old `declareCrop` into this. That one took a crop off
   a picker sheet and invented a planting date of today; B1's red prompt opens
   B4 now — "it needs to direct us to screen B4, instead of a drawer" — and B4
   asks for the crop AND the day it went in, which is the pair a farmer has in
   his head at the same moment.

   WHY THIS IS AN ACTION AND NOT TWO LINES IN B4. Screens hold the LOCALISED
   plot, which is a copy: `cropCycles` is shared by reference, so pushing a
   cycle from a screen happens to work, and clearing `harvestDetectedOn` from
   one writes to the copy and is lost on the next render. The three fields that
   have to move with a new cycle therefore move here, against the raw record. */
export function startCycle(plotId, cycle) {
  const plot = rawPlot(plotId);
  if (!plot) return;
  plot.cropCycles.unshift({
    id: uuid(), plotId, state: 'current',
    expectedHarvest: null, actualHarvest: null,
    targetYield: null, actualYield: null, notes: '',
    cutsDone: null, cutsMonitor: null, yieldSoFar: null, detectedCropName: null,
    ...cycle,
  });
  // The plot's crop is whatever cycle is running on it, and a field the
  // satellite watched being cleared stops asking the moment one is.
  plot.cropId = cycle.cropId;
  plot.cropName = cycle.cropName;
  plot.harvestDetectedOn = null;
  logActivity('cycle', plot.farmId, 'log.cycle.planted', 'Recorded a new planting of {crop}', { crop: cycle.cropName });
  commit('cycle');
}

/* THE OBSERVATION CAPTURE PATH IS GONE, with E6 and E7.

   It let somebody photograph a leaf, name what they saw and file it. Nothing in
   the app ever read one back: no screen listed them, no advice consumed them,
   no report counted them. A form whose output nothing consumes is a promise the
   build cannot keep, and the review took it out rather than leave it looking
   like a feature. The fixtures keep the records they already hold, because the
   activity log refers to them.
*/

/* -- farms, fields, and the tree count ----------------------------------- */

/* Roughly a date palm at 8 × 8 m spacing: what a tree field is ESTIMATED at
   before its trees are counted, and what the mockup's count comes to. */
export const TREES_PER_HA = 118;

/* A FARM IS THE FIELDS ITS FARMER DREW, since v1.7.4. There is no farm
   boundary to trace and no whole-farm survey any more: the farm is made, when
   its plan is paid for, out of the fields drawn on A13 — each with its crop,
   or marked as trees. The tree fields are COUNTED from then on (farm.count),
   and the price is confirmed again when the count is in. */
export function addFarm(draft) {
  const index = state.db.farms.length;
  const farm = {
    // Farms sit on a grid in the shared drawing space so that "all farms" on
    // the map shows them side by side; a farm created at runtime needs its
    // origin for the same reason a fixture one does.
    origin: [(index % 2) * 1250, Math.floor(index / 2) * 1250],
    id: uuid(), name: draft.name, nameAr: draft.name, type: draft.type,
    country: draft.country ?? 'SA', region: draft.region ?? '', timezone: 'Asia/Riyadh',
    areaHa: draft.areaHa ?? 12.4, treeCount: 0,
    plotCount: 0, status: 'nodata',
    headline: t('farm.new.headline', 'Waiting for your first images'),
    imageryDate: NOW.toISOString().slice(0, 10), imageryAgeHours: 0,
    imageryBlockedReason: t('farm.new.imagery', 'First imagery expected within 48 hours'),
    lat: 24.7, lon: 46.7, adviceCount: 0, soil: 'Sandy loam', soilSource: 'survey',
    weather: state.db.farms[0].weather, createdAt: NOW.toISOString().slice(0, 10),
    planPending: false, imageryDates: state.db.farms[0].imageryDates,
  };
  state.db.farms.push(farm);
  addFields(farm, draft.plots ?? []);
  logActivity('boundary', farm.id, 'log.farm.created2', 'Created farm "{farm}" with {n} fields', { farm: farm.name, n: farm.plotCount });
  commit('farm');
  return farm;
}

/** Fields drawn on B9 ("Add fields"), added to a farm that already exists. */
export function addFieldsToFarm(farmId, fields) {
  const farm = rawFarm(farmId);
  const kept = fields.filter((f) => f.included !== false);
  addFields(farm, kept);
  logActivity('boundary', farm.id, 'log.fields.added', 'Added {n} fields to "{farm}"', { farm: farm.name, n: kept.length });
  commit('farm');
  return kept.length;
}

/* Each drawn field becomes a plot record, numbered after the farm's last.
   A tree field arrives COUNTING: no tree count, no trees drawn, a shimmer on
   the map and on My Farm until the count is in (markCountReady()). */
function addFields(farm, fields) {
  const start = state.db.plots.filter((p) => p.farmId === farm.id).length;
  fields.filter((f) => f.included !== false).forEach((f, i) => {
    const trees = f.kind === 'trees';
    const points = f.points ?? [];
    state.db.plots.push({
      id: `${farm.id}-p${start + i + 1}`, farmId: farm.id,
      name: `Plot ${start + i + 1}`,
      kind: trees ? 'trees' : 'crops',
      cropId: trees ? 'date-palm' : f.cropId,
      cropName: trees ? 'Date palm' : (f.cropName ?? 'Not planted yet'),
      secondaryCropId: null, secondaryCropName: null,
      areaHa: f.areaHa ?? 0, treeCount: trees ? null : 0, treeSpacing: '',
      counting: trees,
      status: 'nodata', statusLine: t('plot.awaiting', 'Waiting for the first image'),
      interpretation: '', plantedOn: null,
      irrigationEfficiencyPct: 85,
      measures: {}, healthRows: {}, lat: farm.lat, lon: farm.lon,
      geometry: points, centroid: centroidOf(points), shape: f.shape ?? 'polygon',
      grid: null, treePoints: [], series: {}, yearComparison: [],
      irrigationRecord: [], cropCycles: [], boundaryHistory: [], parcels: 1,
    });
    if (trees) farm.count = { state: 'counting', requestedAt: NOW.toISOString().slice(0, 10) };
  });
  farm.plotCount = state.db.plots.filter((p) => p.farmId === farm.id).length;
}

function centroidOf(points) {
  if (!points.length) return [0, 0];
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}

/* THE TREE COUNT, which is all that is left of the survey.

   counting   the tree fields are drawn and paid for; MMC is counting.
   ready      the count is in — every tree field has its number, its trees on
              the map — and the price waits to be confirmed (A16 → A17).
   confirmed  the farmer has seen the number and confirmed his plan.

   In the mockup the count is the field's area at date-palm spacing, and
   nothing has to wait for it: My Farm's "See the result now" calls this. */
export function markCountReady(farmId) {
  const farm = rawFarm(farmId);
  if (farm.count?.state !== 'counting') return;
  for (const plot of state.db.plots.filter((p) => p.farmId === farmId && p.counting)) {
    plot.counting = false;
    plot.treeCount = Math.max(1, Math.round((plot.areaHa ?? 0) * TREES_PER_HA));
    plot.treePoints = treeGrid(
      gridOf(plot.geometry),
      Math.min(plot.treeCount, 400), rng(`${plot.id}-count`), plot.geometry,
    );
  }
  farm.count.state = 'ready';
  farm.count.readyAt = NOW.toISOString().slice(0, 10);
  farm.headline = t('farm.count.ready', 'Your trees are counted — confirm your plan');
  logActivity('boundary', farm.id, 'log.count.ready', 'Finished counting the trees on "{farm}"', { farm: farm.name });
  commit('count');
}

/** The farmer has seen the count and confirmed the plan at its price. */
export function confirmCount(farmId) {
  const farm = rawFarm(farmId);
  if (!farm.count) return;
  farm.count.state = 'confirmed';
  farm.count.confirmedAt = NOW.toISOString().slice(0, 10);
  farm.treeCount = state.db.plots.filter((p) => p.farmId === farmId && p.kind === 'trees')
    .reduce((s, p) => s + (p.treeCount ?? 0), 0);
  farm.headline = t('farm.new.headline', 'Waiting for your first images');
  logActivity('boundary', farm.id, 'log.count.confirmed', 'Confirmed the plan for "{farm}"', { farm: farm.name });
  commit('count');
}

/* The planting grid of a drawn field: its bounding box, which treeGrid()
   fills and then clips to the field's own outline. */
function gridOf(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2, per: 20 };
}

/** WF5.074 — a boundary change is a versioned event, not an overwrite. */
export function saveBoundary(view, geometry, actorName = 'Khaled Al-Amri') {
  const plot = rawPlot(view.id);
  plot.boundaryHistory = plot.boundaryHistory ?? [];
  plot.boundaryHistory.unshift({ at: NOW.toISOString(), by: actorName, previous: plot.geometry });
  plot.geometry = geometry;
  logActivity('boundary', plot.farmId, 'log.boundary.plot', 'Changed the boundary of {plot}', { plotId: plot.id, plot: plot.name });
  confirmLocally(t('boundary.saved', 'Boundary saved'));
  commit('boundary');
}

/* -- crop cycles, WF5.028 / WF5.029 ---------------------------------------- */

export function closeCropCycle(cycle, harvestDate, yieldText) {
  cycle.state = 'closed';
  cycle.actualHarvest = harvestDate;
  cycle.actualYield = yieldText || null;
  logActivity('cropcycle', null, 'log.cycle.closed', 'Closed the {crop} cycle', { crop: cycle.cropName });
  commit('cropcycle');
}

export function addCropCycle(view, draft) {
  if (requiresConnection('offline.need.cycle', 'a connection to add a crop cycle')) return null;
  const plot = rawPlot(view.id);
  const open = plot.cropCycles.find((c) => c.state === 'current');
  if (open) return { blockedBy: open };            // WF5.028 — never silently overwrite
  const cycle = {
    id: uuid(), plotId: plot.id, state: 'current',
    cropId: draft.cropId, cropName: draft.cropName,
    startDate: draft.startDate, expectedHarvest: draft.expectedHarvest ?? null,
    actualHarvest: null, targetYield: draft.targetYield ?? null, actualYield: null,
    notes: draft.notes ?? '',
    cutsDone: null, cutsMonitor: null, yieldSoFar: null,
  };
  plot.cropCycles.unshift(cycle);
  logActivity('cropcycle', plot.farmId, 'log.cycle.started', 'Started a {crop} cycle on {plot}', { crop: cycle.cropName, plotId: plot.id, plot: plot.name });
  confirmLocally(t('cycle.saved', 'Crop cycle saved'));
  commit('cropcycle');
  return cycle;
}

/* -- activity log, WF5.149 / WF5.150 (append-only) -------------------------

   An entry is written once and read later, in whatever language the reader
   has by then, so it keeps the line's key, its English and its facts — the
   same three things t() takes — and never a finished sentence. lLog() in
   localise.js puts it into words at render time. An advice or a plot is
   referred to by id as well as by the name it had, so the reader sees the
   name in his own language while the record exists. */
export function logActivity(category, farmId, key, en, vars = {}) {
  state.db.activityLog.unshift({
    id: uuid(), at: NOW.toISOString(),
    actorId: state.session.userId, actorName: 'Khaled Al-Amri',
    farmId: farmId ?? state.db.farms[0].id, category, line: { key, en, vars },
  });
}

/* -- sync ----------------------------------------------------------------- */

export function syncNow() {
  if (offline()) {
    toast(t('sync.nosignal', 'Still no signal — we will keep trying'), 'warn');
    return;
  }
  state.db.syncQueue = [];
  state.session.pendingSync = 0;
  state.session.connectivity = 'online';
  toast(t('sync.done', 'Everything is up to date'));
  commit('sync');
}

export function clearCache() {
  toast(t('cache.cleared', 'Cached imagery cleared'));
  commit('cache');
}
