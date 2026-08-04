/* ---------------------------------------------------------------------------
   actions.js — the write layer.

   Everything that changes data goes through here, which is what lets three
   cross-cutting behaviours be implemented once:

     WF-016 / WF-308  every offline-capable action confirms locally and
                      immediately, then queues.
     WF-128 / WF-166  in a demo session the same action completes locally and
                      visibly. Controls are never disabled.
     WF-783           an action that CANNOT be done offline says what is needed,
                      calmly and by name — it is never a dead control.
   --------------------------------------------------------------------------- */

import { state, commit, toast } from '../core/store.js';
import { t } from '../core/i18n.js';
import { NOW } from '../core/format.js';
import { openModal } from '../core/router.js';
import { workerId } from '../screens/badges.js';
import { rawTask, rawAdvice, rawPlot, rawFarm } from './selectors.js';

let seq = 100;
const uuid = () => `local-${(seq += 1)}`;

/** WF-784 — every offline record carries a client UUID and an idempotency key. */
function queue(kind, label) {
  state.db.syncQueue.push({ id: uuid(), kind, label, at: NOW.toISOString(), idempotencyKey: uuid() });
  state.session.pendingSync = state.db.syncQueue.length;
}

function offline() {
  return state.session.connectivity === 'offline';
}

/**
 * WF-783 — guard for the actions §11.3 says cannot be done offline.
 * Returns true when the caller should stop.
 */
export function requiresConnection(whatKey, whatEn) {
  if (!offline()) return false;
  openModal('NEEDS_CONNECTION', { what: t(whatKey, whatEn) });
  return true;
}

function confirmLocally(message) {
  if (state.session.demo) {
    toast(t('demo.saved', 'Saved for this demo only'));
    return;
  }
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
  if (task.fromAdviceId) markAdviceDone(task.fromAdviceId);   // WF-271
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
  // WF-309 — the task creator is notified immediately.
  confirmLocally(t('task.blocked.confirm', 'We have told the person who set this task'));
  commit('task');
}

export function createTask(draft) {
  // WF-783 — task creation is not an offline action.
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
  // badge (WF-032). The harness screen grid draws every card in the app at once
  // without anyone reading anything, so it renders under a preview flag and the
  // badge survives being looked at.
  if (state.ui.preview) return;
  state.db.seenAdvice.add(id);
}

/** WF-271 — advice is done when an action is recorded or its task completes. */
export function markAdviceDone(id) {
  const advice = state.db.advice.find((a) => a.id === id);
  if (advice) advice.status = 'done';
}

/** D7 — WF-290: at most three taps from the card for the common case. */
export function recordAction(view, outcome) {
  const advice = rawAdvice(view.id) ?? view;
  advice.status = 'done';
  advice.recorded = {
    outcome: outcome.kind,             // full | different | not-done
    amount: outcome.amount ?? null,
    unit: outcome.unit ?? null,
    reason: outcome.reason ?? null,
    note: outcome.note ?? null,
    at: NOW.toISOString(),
    by: state.session.userId,
  };
  // WF-291 — writes to the plot's activity history and the farm diary.
  logActivity('input', `Recorded ${outcome.kind === 'not-done' ? 'no action' : 'action'} against ${advice.action}`, advice.farmId);
  if (offline()) queue('input.log', advice.action);       // WF-293 — works offline
  confirmLocally(t('advice.recorded', 'Recorded'));
  commit('advice');
}

/* -- observations, WF-310 / WF-313 (fully offline) ------------------------ */

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
  const farm = {
    id: uuid(), name: draft.name, nameAr: draft.name, type: draft.type,
    country: draft.country ?? 'SA', region: draft.region ?? '', timezone: 'Asia/Riyadh',
    areaHa: draft.areaHa ?? 12.4, treeCount: draft.type === 'crops' ? 0 : 640,
    plotCount: 1, status: 'nodata',
    headline: t('farm.new.headline', 'Waiting for your first images'),
    imageryDate: NOW.toISOString().slice(0, 10), imageryAgeHours: 0,
    imageryBlockedReason: t('farm.new.imagery', 'First imagery expected within 48 hours'),
    irrigation: draft.irrigation ?? 'Not sure', soil: draft.soil ?? '',
    lat: 24.7, lon: 46.7, adviceCount: 0, openTaskCount: 0, blocks: [],
    weather: state.db.farms[0].weather, createdAt: NOW.toISOString().slice(0, 10),
    planPending: false, imageryDates: state.db.farms[0].imageryDates,
  };
  state.db.farms.push(farm);
  logActivity('boundary', `Created farm "${farm.name}" and saved its boundary`, farm.id);
  commit('farm');
  return farm;
}

/** WF-265 — a boundary change is a versioned event, not an overwrite. */
export function saveBoundary(view, geometry, actorName = 'Khaled Al-Amri') {
  const plot = rawPlot(view.id);
  plot.boundaryHistory = plot.boundaryHistory ?? [];
  plot.boundaryHistory.unshift({ at: NOW.toISOString(), by: actorName, previous: plot.geometry });
  plot.geometry = geometry;
  logActivity('boundary', `Changed the boundary of ${plot.name}`, plot.farmId);
  confirmLocally(t('boundary.saved', 'Boundary saved'));
  commit('boundary');
}

/* -- crop cycles, WF-225 / WF-226 ---------------------------------------- */

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
  if (open) return { blockedBy: open };            // WF-225 — never silently overwrite
  const cycle = {
    id: uuid(), plotId: plot.id, state: 'current',
    cropId: draft.cropId, cropName: draft.cropName, variety: draft.variety ?? '',
    startDate: draft.startDate, expectedHarvest: draft.expectedHarvest ?? null,
    actualHarvest: null, targetYield: draft.targetYield ?? null, actualYield: null,
    irrigation: draft.irrigation ?? plot.irrigation, notes: draft.notes ?? '',
    cutsDone: null, cutsPlanned: null, yieldSoFar: null,
  };
  plot.cropCycles.unshift(cycle);
  logActivity('cropcycle', `Started a ${cycle.cropName} cycle on ${plot.name}`, plot.farmId);
  confirmLocally(t('cycle.saved', 'Crop cycle saved'));
  commit('cropcycle');
  return cycle;
}

/* -- team, WF-322 / WF-327 ------------------------------------------------ */

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
    sentAgo: 'just now', expiresIn: '7 days',
    code: Array.from({ length: 6 }, (_, i) => 'K7M2QPX9RJ4T'[(i * 5) % 12]).join(''),
  };
  state.db.invitations.unshift(invite);
  logActivity('member', `Invited ${draft.phone} as ${draft.role}`, draft.farmIds[0]);
  commit('team');
  return invite;
}

export function removeMember(id) {
  const member = state.db.team.find((m) => m.id === id);
  state.db.team = state.db.team.filter((m) => m.id !== id);
  // WF-327 — their history stays attributed to them; only access is removed.
  logActivity('member', `Removed ${member?.name ?? 'a member'} from the farm`, null);
  confirmLocally(t('member.removed', 'Access removed'));
  commit('team');
}

/* -- activity log, WF-338 / WF-339 (append-only) ------------------------- */

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
