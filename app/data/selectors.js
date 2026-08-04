/* ---------------------------------------------------------------------------
   selectors.js — the read layer.

   Screens never filter `state.db` themselves. Two reasons that matters here:
     * WF8.004 scopes access per farm, so every list has to be intersected with
       farmsFor(role) — doing that in one place is the difference between a
       capability model and sixty chances to forget.
     * WF5.007/WF5.076/WF5.108 all specify severity-first ordering. Sorting lives
       with the query, not with the renderer.
   --------------------------------------------------------------------------- */

import { state } from '../core/store.js';
import { farmsFor } from '../core/capabilities.js';
import { bySeverity, worstStatus } from '../core/status.js';
import { NOW } from '../core/format.js';
import { workerId } from '../screens/badges.js';
import { lAdvice, lTask, lFarm, lPlot, lTree, lObservation, lLog } from './localise.js';

/* -- farms ---------------------------------------------------------------- */

export function visibleFarms() {
  // WF5.007 — severity first, then most recently viewed.
  return [...farmsFor()].sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name)).map(lFarm);
}

export function farmById(id) {
  return lFarm(rawFarm(id));
}

export function plotsOf(farmId) {
  return state.db.plots.filter((p) => p.farmId === farmId).map(lPlot);
}

export function plotById(id) {
  return lPlot(rawPlot(id));
}

/* -- raw lookups, for the write layer only -------------------------------- */

export function rawFarm(id) {
  return state.db.farms.find((f) => f.id === id) ?? state.db.farms[0];
}

export function rawPlot(id) {
  return state.db.plots.find((p) => p.id === id) ?? state.db.plots[0];
}

export function rawTask(id) {
  return state.db.tasks.find((x) => x.id === id) ?? state.db.tasks[0];
}

export function rawAdvice(id) {
  return state.db.advice.find((a) => a.id === id);
}

export function blocksOf(farm) {
  return farm.blocks ?? [];
}

export function treesOf(farmId) {
  return state.db.trees.filter((tr) => tr.farmId === farmId).map(lTree);
}

export function treeById(id) {
  return lTree(state.db.trees.find((tr) => tr.id === id) ?? state.db.trees[0]);
}

/** WF5.001 — a farm's status is its worst plot, never an average. */
export function farmStatus(farm) {
  const plots = state.db.plots.filter((p) => p.farmId === farm.id);
  return plots.length ? worstStatus(plots) : farm.status;
}

export function allVisiblePlots() {
  const ids = new Set(visibleFarms().map((f) => f.id));
  return state.db.plots.filter((p) => ids.has(p.farmId)).map(lPlot);
}

/* -- advice --------------------------------------------------------------- */

export function adviceFor({ farmId = 'all', status = 'open', type = 'all', plotId = null } = {}) {
  const scope = new Set(visibleFarms().map((f) => f.id));
  return state.db.advice
    .filter((a) => scope.has(a.farmId))
    .filter((a) => (farmId === 'all' ? true : a.farmId === farmId))
    .filter((a) => (plotId ? a.plotIds.includes(plotId) : true))
    .filter((a) => (type === 'all' ? true : a.type === type))
    .filter((a) => {
      if (status === 'all') return a.status !== 'superseded' || true;
      if (status === 'done') return a.status === 'done';
      return a.status === 'open';
    })
    .sort((a, b) => bySeverity(a, b, (x) => severityToStatus(x.severity)))
    .map(lAdvice);
}

export function adviceById(id) {
  const found = rawAdvice(id);
  return found ? lAdvice(found) : undefined;
}

export function adviceForPlot(plotId) {
  return state.db.advice.filter((a) => a.status === 'open' && a.plotIds.includes(plotId))
    .sort((a, b) => bySeverity(a, b, (x) => severityToStatus(x.severity)))
    .map(lAdvice);
}

export function severityToStatus(severity) {
  return severity === 'urgent' ? 'urgent' : severity === 'action' ? 'action' : 'watch';
}

/** WF5.076 — Today / This week / Later, severity-ordered within each group. */
export function groupedAdvice(list) {
  return [
    { id: 'today', label: 'Today', items: list.filter((a) => a.bucket === 'today') },
    { id: 'week', label: 'This week', items: list.filter((a) => a.bucket === 'week') },
    { id: 'later', label: 'Later', items: list.filter((a) => a.bucket === 'later') },
  ].filter((g) => g.items.length);
}

/* -- tasks ---------------------------------------------------------------- */

export function tasksFor({ farmId = 'all', mine = false } = {}) {
  const scope = new Set(visibleFarms().map((f) => f.id));
  const me = workerId();
  return state.db.tasks
    .filter((task) => scope.has(task.farmId))
    .filter((task) => (farmId === 'all' ? true : task.farmId === farmId))
    // WF4.005 / capability task.view.own — a Worker sees only their own tasks.
    .filter((task) => (mine || state.session.role === 'worker' ? task.assigneeId === me : true))
    .map(lTask);
}

export function taskById(id) {
  return lTask(rawTask(id));
}

export function isOverdue(task) {
  return ['open', 'in_progress'].includes(task.state) && new Date(task.dueAt) < startOfToday();
}

export function isToday(task) {
  const d = new Date(task.dueAt);
  return d >= startOfToday() && d <= endOfToday();
}

export function startOfToday() {
  return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));
}

export function endOfToday() {
  return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate(), 23, 59, 59));
}

/** WF5.108 — overdue always first, always visually distinct. */
export function groupedTasks(list, tab) {
  const open = list.filter((task) => ['open', 'in_progress'].includes(task.state));
  if (tab === 'done') {
    return [{ id: 'done', label: 'Done', items: list.filter((task) => ['done', 'cancelled'].includes(task.state)) }];
  }
  if (tab === 'upcoming') {
    return [{ id: 'upcoming', label: 'Upcoming', items: open.filter((task) => new Date(task.dueAt) > endOfToday()) }]
      .filter((g) => g.items.length);
  }
  return [
    { id: 'overdue', label: 'Overdue', items: open.filter(isOverdue) },
    { id: 'today', label: 'Today', items: open.filter(isToday) },
  ].filter((g) => g.items.length);
}

/* -- team ----------------------------------------------------------------- */

export function membersOf(farmId) {
  return state.db.team.filter((m) => m.farmIds.includes(farmId));
}

export function memberById(id) {
  return state.db.team.find((m) => m.id === id);
}

export function me() {
  return memberById(workerId()) ?? state.db.team[0];
}

/* -- content -------------------------------------------------------------- */

export function measures() {
  return state.db.measures;
}

export function measureByKey(key) {
  return state.db.measures.find((m) => m.key === key) ?? state.db.measures[0];
}

export function cropById(id) {
  return state.db.crops.find((c) => c.id === id);
}

export function observationsOf(plotId) {
  return state.db.observations.filter((o) => o.plotId === plotId).map(lObservation);
}

export function activityFor(farmId = 'all') {
  return state.db.activityLog.filter((e) => farmId === 'all' || e.farmId === farmId).map(lLog);
}

/** The plot activity feed of B4 — tasks, inputs and observations, merged. */
export function plotActivity(plotId) {
  const entries = [];
  for (const task of state.db.tasks) {
    if (task.plotIds.includes(plotId) && task.state === 'done') {
      entries.push({ kind: 'task', at: task.completedAt ?? task.dueAt, icon: 'check', text: task.title, detail: task.completedQuantity ?? task.quantity });
    }
  }
  for (const obs of observationsOf(plotId)) {
    entries.push({ kind: 'observation', at: obs.at, icon: 'camera', text: 'Observation', detail: obs.note });
  }
  const plot = rawPlot(plotId);
  for (const rec of plot.irrigationRecord.slice(-3)) {
    if (rec.appliedM3) entries.push({ kind: 'input', at: `${rec.dateFrom}T07:00:00Z`, icon: 'droplet', text: 'Irrigation logged', detail: `${rec.appliedM3} m³` });
  }
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at));
}
