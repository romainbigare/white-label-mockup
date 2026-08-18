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
import { workerId } from '../screens/badges.js';
import { rawTask, rawAdvice, rawPlot, rawFarm, accountForNumber } from './selectors.js';
import { surveyTotals, typeFromTotals, ensureSurvey } from './survey.js';

let seq = 100;
const uuid = () => `local-${(seq += 1)}`;

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

/* -- tasks ---------------------------------------------------------------- */

export function completeTask(view, { quantity, note, photoCount = 0 } = {}) {
  const task = rawTask(view.id);
  task.state = 'done';
  task.completedAt = NOW.toISOString();
  task.completedQuantity = quantity || null;
  task.completedNote = note || null;
  task.photoCount = photoCount;
  if (task.fromAdviceId) markAdviceDone(task.fromAdviceId);   // WF5.080
  if (offline()) queue('task.complete', task.title);
  confirmLocally(t('task.done.confirm', 'Marked as done'));
  commit('task');
}

export function startTask(view) {
  const task = rawTask(view.id);
  task.state = 'in_progress';
  confirmLocally(t('task.started', 'Marked as in progress'));
  commit('task');
}

export function blockTask(view, reason) {
  const task = rawTask(view.id);
  task.state = 'cancelled';
  task.blockedReason = reason;
  if (offline()) queue('task.blocked', task.title);
  // WF5.119 — the task creator is notified immediately.
  confirmLocally(t('task.blocked.confirm', 'We have told the person who set this task'));
  commit('task');
}

export function createTask(draft) {
  // WF11.004 — task creation is not an offline action.
  if (requiresConnection('offline.need.task', 'a connection to assign a task')) return null;
  const task = {
    id: uuid(),
    title: draft.title,
    description: draft.description ?? '',
    type: draft.type ?? 'other',
    farmId: draft.farmId,
    plotIds: draft.plotIds ?? [],
    treeIds: draft.treeIds ?? [],
    treeCount: draft.treeCount ?? 0,
    assigneeId: draft.assigneeId,
    createdById: state.session.userId,
    dueAt: draft.dueAt,
    priority: draft.priority ?? 'normal',
    state: 'open',
    fromAdviceId: draft.fromAdviceId ?? null,
    quantity: draft.quantity ?? null,
    completedAt: null, completedQuantity: null, completedNote: null,
    photoCount: 0, blockedReason: null,
  };
  state.db.tasks.unshift(task);
  logActivity('task', `Created task "${task.title}"`, task.farmId);
  confirmLocally(t('task.created', 'Task created and sent'));
  commit('task');
  return task;
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

/** WF5.103 — advice is done when an action is recorded or its task completes. */
export function markAdviceDone(id) {
  const advice = state.db.advice.find((a) => a.id === id);
  if (advice) advice.status = 'done';
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

/**
 * D7 — recording what was actually done about a piece of advice.
 *
 * It is reached from the TASK the advice was assigned to (see E2), because
 * completing work is a task action; so closing the advice has to close that
 * task too, or the job stays open on somebody's phone with nothing left to do
 * about it.
 */
export function recordAction(view, outcome) {
  const advice = rawAdvice(view.id) ?? view;
  advice.status = 'done';
  const task = state.db.tasks.find((x) => x.fromAdviceId === advice.id
    && ['open', 'in_progress'].includes(x.state));
  if (task) {
    task.state = outcome.kind === 'not-done' ? 'cancelled' : 'done';
    task.completedAt = NOW.toISOString();
    task.completedQuantity = outcome.amount ? `${outcome.amount} ${outcome.unit ?? ''}`.trim() : null;
    task.completedNote = outcome.note ?? null;
    task.blockedReason = outcome.kind === 'not-done' ? (outcome.reason ?? null) : null;
  }
  advice.recorded = {
    outcome: outcome.kind,             // full | different | not-done
    amount: outcome.amount ?? null,
    unit: outcome.unit ?? null,
    reason: outcome.reason ?? null,
    note: outcome.note ?? null,
    at: NOW.toISOString(),
    by: state.session.userId,
  };
  // WF5.100 — writes to the plot's activity history and the farm diary.
  logActivity('input', `Recorded ${outcome.kind === 'not-done' ? 'no action' : 'action'} against ${advice.action}`, advice.farmId);
  if (offline()) queue('input.log', advice.action);       // WF5.102 — works offline
  confirmLocally(t('advice.recorded', 'Recorded'));
  commit('advice');
}

/**
 * Turn every waiting piece of advice into a task for one person.
 *
 * It goes through createTask so that nothing about a bulk assignment differs
 * from one made by hand: the same record, the same offline refusal (WF11.004),
 * the same activity log entry. The only thing this adds is that the farmer did
 * not have to open fourteen forms to say the same thing fourteen times.
 */
export function assignAllAdvice(list, assigneeId) {
  if (requiresConnection('offline.need.task', 'a connection to assign a task')) return 0;
  let sent = 0;
  for (const a of list) {
    const due = new Date(NOW.getTime() + (a.severity === 'urgent' ? 0 : a.bucket === 'week' ? 3 : 1) * 86400000);
    due.setUTCHours(16, 0, 0, 0);
    const task = createTask({
      title: a.action,
      description: `${a.amount ?? ''}${a.amount ? '. ' : ''}${a.reason}`,
      type: ({ irrigation: 'irrigation', nutrition: 'fertiliser', protection: 'spraying', harvest: 'harvest', weather: 'other' })[a.type] ?? 'other',
      farmId: a.farmId,
      plotIds: a.plotIds,
      assigneeId,
      dueAt: due.toISOString(),
      priority: a.severity === 'urgent' ? 'high' : 'normal',
      quantity: a.amount ?? null,
      fromAdviceId: a.id,
    });
    if (task) sent += 1;
  }
  commit('advice');
  return sent;
}

/* -- observations, WF5.122 / WF5.125 (fully offline) ------------------------ */

export function addObservation(draft) {
  const obs = {
    id: uuid(),
    farmId: draft.farmId,
    plotId: draft.plotId,
    category: draft.category,
    severity: draft.severity ?? 'medium',
    note: draft.note ?? '',
    at: NOW.toISOString(),
    byId: workerId(),
    photoCount: draft.photoCount ?? 0,
    lat: draft.lat ?? null,
    lon: draft.lon ?? null,
    aiIdentification: draft.aiIdentification ?? null,
    queued: offline(),
  };
  state.db.observations.unshift(obs);
  if (offline()) queue('observation', draft.note || 'Observation');
  logActivity('input', 'Recorded a field observation', draft.farmId);
  confirmLocally(t('obs.saved', 'Observation saved'));
  commit('observation');
  return obs;
}

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
    lat: 24.7, lon: 46.7, adviceCount: 0, openTaskCount: 0,
    weather: state.db.farms[0].weather, createdAt: NOW.toISOString().slice(0, 10),
    planPending: false, imageryDates: state.db.farms[0].imageryDates,
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
 * A plot the farmer traced by hand on A9D. It carries HIS name for the field
 * where he gave one and a farm-relative number where he did not — and no crop,
 * because A9D no longer asks and the imagery answers within a fortnight.
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

/* -- the land use survey, WF4.044 … WF4.057 -------------------------------
   Requesting one costs nothing and needs no card on file: the whole point is
   that a farmer can find out what he has before deciding what to pay for. */

export function requestSurvey(farmId) {
  const farm = rawFarm(farmId);
  farm.survey = { state: 'surveying', requestedAt: NOW.toISOString().slice(0, 10) };
  logActivity('boundary', `Requested a land survey for "${farm.name}"`, farm.id);
  commit('survey');
}

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
    cutsDone: null, cutsPlanned: null, yieldSoFar: null,
  };
  plot.cropCycles.unshift(cycle);
  logActivity('cropcycle', `Started a ${cycle.cropName} cycle on ${plot.name}`, plot.farmId);
  confirmLocally(t('cycle.saved', 'Crop cycle saved'));
  commit('cropcycle');
  return cycle;
}

/* -- workforce, §5.6 -------------------------------------------------------
   A worker record is NOT an account. WF5.064: creating one sends no invitation
   and installs nothing — the person is reachable by SMS or WhatsApp and that is
   the whole mechanism. So none of this goes near invitations or roles, and it
   is deliberately in a different part of this file from the team functions
   below, which do create accounts. */

export function saveWorker(draft) {
  const existing = draft.id ? state.db.workers.find((w) => w.id === draft.id) : null;
  // WF5.065 — SMS and WhatsApp are independent per person, and at least one
  // must be on, because a worker record with neither can never be sent work.
  const sms = draft.sms ?? false;
  const whatsapp = draft.whatsapp ?? !sms;
  const dial = draft.dial ?? '+966';
  const phone = (draft.phone ?? '').replace(/[\s-]/g, '').replace(/^0+/, '');
  // The number IS the identity. If it already belongs to an account, this
  // record is that person — not a second one with the same phone. G2 has
  // already named the account holder and had the owner confirm; this is where
  // the two halves become one record.
  const patch = {
    farmId: draft.farmId,
    name: draft.name.trim(),
    nameAr: draft.nameAr ?? draft.name.trim(),
    dial,
    phone,
    title: draft.title ?? '',
    lang: draft.lang ?? 'ar',
    accountId: accountForNumber(dial, phone)?.id ?? null,
    sms, whatsapp,
  };
  if (existing) {
    Object.assign(existing, patch);
    logActivity('member', `Updated the worker record for ${existing.name}`, existing.farmId);
    confirmLocally(t('worker.saved', 'Worker saved'));
    commit('worker');
    return existing;
  }
  const worker = { id: uuid(), active: true, openTasks: 0, ...patch };
  state.db.workers.unshift(worker);
  logActivity('member', `Added ${worker.name} to the workforce`, worker.farmId);
  confirmLocally(t('worker.added', 'Worker added'));
  commit('worker');
  return worker;
}

/** WF5.070 — deactivating keeps their completed work attributed to them. */
export function setWorkerActive(id, active) {
  const worker = state.db.workers.find((w) => w.id === id);
  if (!worker) return;
  worker.active = active;
  logActivity('member', `${active ? 'Reactivated' : 'Deactivated'} ${worker.name}`, worker.farmId);
  confirmLocally(active
    ? t('worker.reactivated', 'Back on the list')
    : t('worker.deactivated', 'Deactivated. Their finished work stays on record.'));
  commit('worker');
}

/** The second stage of one identity: this person gets the app. */
export function inviteWorkerToApp(id) {
  const worker = state.db.workers.find((w) => w.id === id);
  if (!worker) return null;
  if (requiresConnection('offline.need.invite', 'a connection to invite someone')) return null;
  // The code is BOUND to the person record, which is what makes redeeming it an
  // ATTACHMENT rather than a registration. An invitation with nothing to attach
  // to would create a second, empty identity for somebody the owner has already
  // described, and the two would then drift apart.
  const invite = createInvitation({
    phone: `${worker.dial} ${worker.phone}`,
    role: 'worker',
    farmIds: [worker.farmId],
    workerId: worker.id,
  });
  worker.invited = true;
  confirmLocally(t('worker.invited', 'Invitation sent. Their finished work will follow them.'));
  return invite;
}

/**
 * Redeeming the invitation, or registering later with the same number. Either
 * way the account joins the record that already exists: the language, the
 * notification preferences and everything finished stay put, and the only thing
 * that changes is the pipe work goes down.
 *
 * In the real product this happens server-side, on the number. Here it is one
 * function so that the mockup cannot accidentally show two of the same person.
 */
export function attachAccount(workerId, accountId) {
  const worker = state.db.workers.find((w) => w.id === workerId);
  if (!worker || worker.accountId) return null;
  worker.accountId = accountId;
  worker.invited = false;
  state.db.invitations = state.db.invitations.filter((i) => i.workerId !== workerId);
  logActivity('member', `${worker.name} now has the app`, worker.farmId);
  confirmLocally(t('worker.attached', 'They have the app now. Work goes to their phone.'));
  commit('worker');
  return worker;
}

/* -- team, WF5.168 / WF5.173 ------------------------------------------------ */

export function revokeInvitation(id) {
  state.db.invitations = state.db.invitations.filter((i) => i.id !== id);
  logActivity('member', 'Cancelled a pending invitation', null);
  confirmLocally(t('invite.cancelled', 'Invitation cancelled'));
  commit('team');
}

export function createInvitation(draft) {
  if (requiresConnection('offline.need.invite', 'a connection to invite someone')) return null;
  const invite = {
    id: uuid(), phone: draft.phone, role: draft.role, farmIds: draft.farmIds,
    workerId: draft.workerId ?? null,
    sentAgo: 'just now', expiresIn: '7 days',
    code: Array.from({ length: 6 }, (_, i) => 'K7M2QPX9RJ4T'[(i * 5) % 12]).join(''),
  };
  state.db.invitations.unshift(invite);
  logActivity('member', `Invited ${draft.phone} as ${draft.role}`, draft.farmIds[0]);
  commit('team');
  return invite;
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
