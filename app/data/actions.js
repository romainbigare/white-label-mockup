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
import { NOW } from '../core/format.js';
import { openModal } from '../core/router.js';
import { rawAdvice, rawPlot, rawFarm, supervisorOf, personById } from './selectors.js';
import { surveyTotals, typeFromTotals, ensureSurvey, coversKind } from './survey.js';
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

/** WF11.005 — every offline record carries a client UUID and an idempotency key. */
function queue(kind, label) {
  state.db.syncQueue.push({ id: uuid(), kind, label, at: NOW.toISOString(), idempotencyKey: uuid() });
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
  logActivity('advice', `${asReminder ? 'Set a reminder for' : 'Ignored'} "${advice.action}"`, advice.farmId);
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
  logActivity('input', `Marked "${advice.action}" completed`, advice.farmId);
  if (offline()) queue('input.log', advice.action);
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
  logActivity('advice', `Sent "${advice.action}" to ${who?.name ?? 'the team'}`, advice.farmId);
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

/* -- the workforce, B14 ---------------------------------------------------
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
  logActivity('member', `Added ${name.trim()} to the workforce`, farmId);
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
  logActivity('member', `Removed ${m.name} from the workforce`, farmId);
  confirmLocally(t('b14.removed', '{who} removed', { who: m.firstName || m.name }));
  commit('team');
}

/* THE REMINDER THE SATELLITE CANNOT WRITE ITSELF.

   It reads a canopy, so it can tell that the tomatoes came off and it cannot
   tell what went in after them for about three weeks. Until the farmer says,
   the plot has no current crop and every recommendation about it is a guess.
   So the plot carries the date the harvest was seen, the plot list says so in
   red, and this is what clears it. */

export function declareCrop(plotId, crop) {
  const plot = rawPlot(plotId);
  if (!plot) return;
  plot.harvestDetectedOn = null;
  plot.cropId = crop.id;
  plot.cropName = crop.name;
  plot.variety = '';
  plot.cropCycles.unshift({
    id: uuid(), plotId, state: 'current',
    cropId: crop.id, cropName: crop.name, variety: '',
    startDate: NOW.toISOString().slice(0, 10),
    expectedHarvest: null, actualHarvest: null,
    targetYield: null, actualYield: null, notes: '',
    cutsDone: null, cutsMonitor: null, yieldSoFar: null, detectedCropName: null,
  });
  logActivity('cycle', `Recorded a new planting of ${crop.name}`, plot.farmId);
  confirmLocally(t('plot.cropset', '{crop} recorded', { crop: crop.name }));
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

/* -- farms, plots, boundaries -------------------------------------------- */

export function addFarm(draft) {
  const index = state.db.farms.length;
  const farm = {
    // Farms sit on a grid in the shared drawing space so that "all farms" on
    // the map shows them side by side; a farm created at runtime needs its
    // origin for the same reason a fixture one does.
    origin: [(index % 2) * 1250, Math.floor(index / 2) * 1250],
    id: uuid(), name: draft.name, nameAr: draft.name, type: draft.type,
    country: draft.country ?? 'SA', region: draft.region ?? '', timezone: 'Asia/Riyadh',
    areaHa: draft.areaHa ?? 12.4, treeCount: draft.type === 'crops' ? 0 : 640,
    plotCount: 1, status: 'nodata',
    headline: t('farm.new.headline', 'Waiting for your first images'),
    imageryDate: NOW.toISOString().slice(0, 10), imageryAgeHours: 0,
    imageryBlockedReason: t('farm.new.imagery', 'First imagery expected within 48 hours'),
    lat: 24.7, lon: 46.7, adviceCount: 0,
    weather: state.db.farms[0].weather, createdAt: NOW.toISOString().slice(0, 10),
    planPending: false, imageryDates: state.db.farms[0].imageryDates,
    /* THE LINE THE FARMER DREW, kept. Review 01/09 wanted A11 to show the farm
       outline "as a reference point", and the only way that can be the same
       shape he traced rather than a redrawing of it is to store it. Every map
       in the app reads it afterwards — see farmBoundary() in ui/map.js. */
    boundary: (draft.boundary ?? []).map((p) => [...p]),
  };
  if (draft.survey) {
    farm.survey = { state: draft.survey, requestedAt: NOW.toISOString().slice(0, 10) };
    farm.plotCount = 0;
    farm.headline = t('farm.surveying.headline', 'Surveying your land');
    farm.imageryBlockedReason = t('farm.surveying.imagery', 'The survey is running. We will tell you when it is ready.');
  }
  state.db.farms.push(farm);
  // The hand-drawn route arrives with its plots already traced and named, so
  // they become plot records here rather than being thrown away and re-drawn.
  (draft.plots ?? []).forEach((p, i) => addDrawnPlot(farm, p, i));
  if (draft.plots?.length) farm.plotCount = draft.plots.length;
  logActivity('boundary', draft.survey
    ? `Requested a land survey for "${farm.name}"`
    : `Created farm "${farm.name}" and saved its boundary`, farm.id);
  commit('farm');
  return farm;
}

/**
 * A plot the farmer traced by hand on A10D. It carries HIS name for the field
 * where he gave one and a farm-relative number where he did not — and no crop,
 * because A10D no longer asks and the imagery answers within a fortnight.
 */
function addDrawnPlot(farm, drawn, index) {
  state.db.plots.push({
    id: `${farm.id}-p${index + 1}`, farmId: farm.id,
    name: drawn.name || `Plot ${index + 1}`,
    cropId: null, cropName: t('plot.nocrop', 'Not planted yet'),
    variety: '', secondaryCropId: null, secondaryCropName: null,
    areaHa: drawn.areaHa ?? 0, treeCount: 0, treeSpacing: '',
    status: 'nodata', statusLine: t('plot.awaiting', 'Waiting for the first image'),
    interpretation: '', plantedOn: null, flowRateM3h: null,
    irrigationEfficiencyPct: 85, soil: 'Sandy loam',
    measures: {}, healthRows: {}, lat: farm.lat, lon: farm.lon,
    geometry: drawn.points ?? [], centroid: centroidOf(drawn.points ?? []), shape: 'polygon',
    grid: null, treePoints: [], series: {}, yearComparison: [],
    irrigationRecord: [], cropCycles: [], boundaryHistory: [],
  });
}

function centroidOf(points) {
  if (!points.length) return [0, 0];
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length,
  ];
}

/* THE SURVEY IS REQUESTED ONCE, AT REGISTRATION, AND NOWHERE ELSE.

   requestSurvey() lived here so that Farm settings could re-offer a whole-farm
   survey to a farm that had drawn its own plots. The review closed that door:
   the fork on A9 is a one-way decision — a farm surveyed whole is not
   re-drawn, and a farm drawn by hand is not re-surveyed from the app — because
   a second survey re-prices the subscription and that is a conversation, not a
   button on a settings page. What is left for land that changes is Add a plot,
   on B11.
*/


export function markSurveyReady(farmId) {
  const farm = rawFarm(farmId);
  if (!farm.survey) return;
  farm.survey.state = 'ready';
  farm.survey.readyAt = NOW.toISOString().slice(0, 10);
  // WF5.005 — the farm card says the survey is ready and opens A11.
  farm.headline = t('farm.survey.ready', 'Survey ready — confirm what we found');
  farm.imageryBlockedReason = null;
  ensureSurvey(farm);
  logActivity('boundary', `Land survey finished for "${farm.name}"`, farm.id);
  commit('survey');
}

/**
 * The farmer has said what is in scope. Every included area becomes a plot,
 * and the farm's type, area and tree count come from the ground rather than
 * from the question A7 would otherwise have asked.
 */
export function confirmSurvey(farmId) {
  const farm = rawFarm(farmId);
  const totals = surveyTotals(farm);
  const included = totals.areas.filter((a) => a.included);

  state.db.plots = state.db.plots.filter((p) => p.farmId !== farm.id);
  included.forEach((a, i) => {
    const span = Math.max(...a.geometry.map(([x]) => x)) - Math.min(...a.geometry.map(([x]) => x));
    state.db.plots.push({
      id: `${farm.id}-p${i + 1}`, farmId: farm.id,
      // The name the farmer has already seen on A11, kept, so the plot he
      // decided about is the plot he then opens.
      name: a.label,
      cropId: a.kind === 'trees' ? 'date-palm' : null,
      cropName: a.kind === 'trees' ? t('crop.datepalm', 'Date palm') : t('plot.nocrop', 'Not planted yet'),
      variety: '', secondaryCropId: null, secondaryCropName: null,
      areaHa: a.areaHa, treeCount: a.treeCount, treeSpacing: a.treeCount ? '8 × 8 m' : '',
      status: 'nodata', statusLine: t('plot.awaiting', 'Waiting for the first image'),
      interpretation: '', plantedOn: null, flowRateM3h: null,
      // WF6.020 — the assumptions a farmer may correct live on the plot.
      // Soil is an ESTIMATE until somebody corrects it on D2. It was never
      // worth asking for at setup: one answer for a whole farm, given before
      // any advice depended on it.
      irrigationEfficiencyPct: 85, soil: 'Sandy loam',
      measures: {}, healthRows: {}, lat: farm.lat, lon: farm.lon,
      geometry: a.geometry, centroid: a.centroid, shape: 'polygon',
      grid: a.treeCount ? { cx: a.centroid[0], cy: a.centroid[1], rx: span / 2, ry: span / 2, per: Math.ceil(Math.sqrt(Math.min(a.treeCount, 90))) } : null,
      treePoints: [], series: {}, yearComparison: [], irrigationRecord: [], cropCycles: [],
      boundaryHistory: [],
    });
  });

  farm.survey.state = 'confirmed';
  farm.survey.confirmedAt = NOW.toISOString().slice(0, 10);
  farm.type = typeFromTotals(totals);
  farm.areaHa = Math.round((totals.cropHa + totals.treeHa) * 10) / 10;
  farm.treeCount = totals.treeCount;
  farm.plotCount = included.length;
  farm.headline = t('farm.new.headline', 'Waiting for your first images');
  farm.imageryBlockedReason = t('farm.new.imagery', 'First imagery expected within 48 hours');
  logActivity('boundary', `Confirmed the survey of "${farm.name}": ${included.length} areas in scope`, farm.id);
  commit('survey');
  return totals;
}

/* CORRECTING THE FARM'S OWN OUTLINE, after the survey has run.

   Review 01/09 — "if the user made a mistake, he should be able to adjust the
   farm outline to remove plots. An alternative way for him to remove plots."
   The survey's areas are not recomputed: they are what the imagery found, and
   redrawing a line is not new imagery. What changes is SCOPE — an area whose
   centre now falls outside the boundary is taken off the quote, exactly as if
   the farmer had pressed Remove on its row, and putting the line back puts it
   back.

   Nothing is deleted, for the reason A11 gives on every row: the farmer is
   deciding what he is paying for, and a decision he can undo is a different
   thing from one he cannot. */
export function setFarmBoundary(farmId, points, areaHa) {
  const farm = rawFarm(farmId);
  if (!farm) return { dropped: 0 };
  farm.boundary = points.map((p) => [...p]);
  if (areaHa) farm.areaHa = Math.round(areaHa * 10) / 10;
  let dropped = 0;
  for (const a of ensureSurvey(farm)) {
    const inside = pointInRing(a.centroid, farm.boundary);
    if (a.included && !inside) dropped += 1;
    a.included = inside && coversKind(farm, a.kind);
  }
  logActivity('boundary', `Adjusted the boundary of "${farm.name}"`, farm.id);
  commit('survey');
  return { dropped };
}

/** Ray casting. The rings here are small and this runs once per save. */
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** WF5.074 — a boundary change is a versioned event, not an overwrite. */
export function saveBoundary(view, geometry, actorName = 'Khaled Al-Amri') {
  const plot = rawPlot(view.id);
  plot.boundaryHistory = plot.boundaryHistory ?? [];
  plot.boundaryHistory.unshift({ at: NOW.toISOString(), by: actorName, previous: plot.geometry });
  plot.geometry = geometry;
  logActivity('boundary', `Changed the boundary of ${plot.name}`, plot.farmId);
  confirmLocally(t('boundary.saved', 'Boundary saved'));
  commit('boundary');
}

/* -- crop cycles, WF5.028 / WF5.029 ---------------------------------------- */

export function closeCropCycle(cycle, harvestDate, yieldText) {
  cycle.state = 'closed';
  cycle.actualHarvest = harvestDate;
  cycle.actualYield = yieldText || null;
  logActivity('cropcycle', `Closed the ${cycle.cropName} cycle`, null);
  commit('cropcycle');
}

export function addCropCycle(view, draft) {
  if (requiresConnection('offline.need.cycle', 'a connection to add a crop cycle')) return null;
  const plot = rawPlot(view.id);
  const open = plot.cropCycles.find((c) => c.state === 'current');
  if (open) return { blockedBy: open };            // WF5.028 — never silently overwrite
  const cycle = {
    id: uuid(), plotId: plot.id, state: 'current',
    cropId: draft.cropId, cropName: draft.cropName, variety: draft.variety ?? '',
    startDate: draft.startDate, expectedHarvest: draft.expectedHarvest ?? null,
    actualHarvest: null, targetYield: draft.targetYield ?? null, actualYield: null,
    notes: draft.notes ?? '',
    cutsDone: null, cutsMonitor: null, yieldSoFar: null,
  };
  plot.cropCycles.unshift(cycle);
  logActivity('cropcycle', `Started a ${cycle.cropName} cycle on ${plot.name}`, plot.farmId);
  confirmLocally(t('cycle.saved', 'Crop cycle saved'));
  commit('cropcycle');
  return cycle;
}

/* -- activity log, WF5.149 / WF5.150 (append-only) ------------------------- */

export function logActivity(category, text, farmId) {
  state.db.activityLog.unshift({
    id: uuid(), at: NOW.toISOString(),
    actorId: state.session.userId, actorName: 'Khaled Al-Amri',
    farmId: farmId ?? state.db.farms[0].id, category, text,
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
