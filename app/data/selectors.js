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
import { langMeta } from '../core/i18n.js';
import { farmsFor } from '../core/capabilities.js';
import { bySeverity, worstStatus } from '../core/status.js';
import { NOW } from '../core/format.js';
import { workerId } from '../screens/badges.js';
import { lAdvice, lTask, lFarm, lPlot, lTree, lObservation, lLog, lWorker } from './localise.js';

/* -- farms ---------------------------------------------------------------- */

export function visibleFarms() {
  // WF5.007 — severity first, then most recently viewed.
  return [...farmsFor()].sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name)).map(lFarm);
}

/**
 * Farms that share a fence. An owner with three adjoining holdings wants to see
 * them as ONE estate — "show me all the plots together for my 3 farms, because
 * they're neighbouring" — which is a different request from "show me all my
 * farms", and it is the narrower one that is actually asked for.
 */
export function estateOf(farmId) {
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const next of rawFarm(id)?.adjoins ?? []) walk(next);
  };
  walk(farmId);
  return visibleFarms().filter((f) => seen.has(f.id));
}

/** Every estate on the account that has more than one farm in it. */
export function estates() {
  const done = new Set();
  const out = [];
  for (const farm of visibleFarms()) {
    if (done.has(farm.id)) continue;
    const group = estateOf(farm.id);
    for (const f of group) done.add(f.id);
    if (group.length > 1) out.push(group);
  }
  return out;
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

/* -- workforce, §5.6 -------------------------------------------------------
   Worker records are people, not accounts, so they are kept apart from
   state.db.team — the two lists answer different questions and F2 must never
   show someone who has nothing to log into. */

export function workersOf(farmId, { includeInactive = false } = {}) {
  return state.db.workers
    .filter((w) => (farmId ? w.farmId === farmId : true))
    .filter((w) => includeInactive || w.active)
    .map(lWorker);
}

export function workerById(id) {
  const raw = state.db.workers.find((w) => w.id === id);
  return raw ? lWorker(raw) : null;
}

export function rawWorker(id) {
  return state.db.workers.find((w) => w.id === id);
}

/** Everyone a task may be assigned to: app users, plus §5.6 worker records. */
export function assignees(farmId) {
  // The two records name a language differently — a team member carries it
  // spelled out ("Arabic"), a worker record carries the code — so this is where
  // they are reconciled. WF5.100 makes the language the part of "who will get
  // this" most worth getting right, and langMeta(undefined) silently answers
  // with the VIEWER's language, which is the one answer that is always wrong.
  const members = state.db.team
    .filter((m) => !farmId || (m.farmIds ?? []).includes(farmId))
    .map((m) => ({ id: m.id, name: m.name, role: m.role, language: m.language, openTasks: m.openTasks ?? 0, kind: 'member' }));
  const workers = workersOf(farmId)
    .map((w) => ({ id: w.id, name: w.name, role: 'worker', language: langMeta(w.lang).english, openTasks: w.openTasks, kind: 'worker' }));
  return [...members, ...workers];
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

/**
 * The farms a filter value selects. `all`, one id, or `estate:<id>` for a group
 * of adjoining holdings — see estateOf().
 */
export function farmsForFilter(value) {
  if (!value || value === 'all') return visibleFarms();
  if (String(value).startsWith('estate:')) return estateOf(String(value).slice(7));
  const one = visibleFarms().find((f) => f.id === value);
  return one ? [one] : visibleFarms();
}

/** What a filter value is called on screen. */
export function farmFilterLabel(value) {
  if (!value || value === 'all') return null;
  const group = farmsForFilter(value);
  if (String(value).startsWith('estate:')) return group[0]?.name ?? null;
  return group[0]?.name ?? null;
}

export function plotsForFilter(value) {
  const ids = new Set(farmsForFilter(value).map((f) => f.id));
  return state.db.plots.filter((p) => ids.has(p.farmId)).map(lPlot);
}

export function allVisiblePlots() {
  const ids = new Set(visibleFarms().map((f) => f.id));
  return state.db.plots.filter((p) => ids.has(p.farmId)).map(lPlot);
}

/* -- advice --------------------------------------------------------------- */

export function adviceFor({ farmId = 'all', status = 'open', type = 'all', plotId = null } = {}) {
  const scope = new Set(visibleFarms().map((f) => f.id));
  const wanted = new Set(farmsForFilter(farmId).map((f) => f.id));
  return state.db.advice
    .filter((a) => scope.has(a.farmId))
    .filter((a) => (farmId === 'all' ? true : wanted.has(a.farmId)))
    .filter((a) => (plotId ? a.plotIds.includes(plotId) : true))
    .filter((a) => (type === 'all' ? true : a.type === type))
    .filter((a) => {
      // WF5.098 — an ignored item leaves the inbox and comes back tomorrow. It
      // is not deleted, so the All tab still carries it; only the working list
      // hides it, which is the whole difference between deferring and losing.
      if (status === 'all') return true;
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

/** WF5.094 — Today / This week / Later, severity-ordered within each group. */
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
  const wanted = new Set(farmsForFilter(farmId).map((f) => f.id));
  const me = workerId();
  return state.db.tasks
    .filter((task) => scope.has(task.farmId))
    .filter((task) => (farmId === 'all' ? true : wanted.has(task.farmId)))
    // WF4.005 / capability task.view.own — a Worker sees only their own tasks.
    .filter((task) => (mine || state.session.role === 'worker' ? task.assigneeId === me : true))
    .map(lTask);
}

/**
 * Anyone work can be sent to, resolved across both lists and shaped the same
 * either way. WF5.138 lets a task go to an app user OR a §5.6 worker record,
 * and every screen that shows an assignee has to render both without caring
 * which it got.
 */
export function personById(id) {
  const member = state.db.team.find((m) => m.id === id);
  if (member) return { ...member, kind: 'member' };
  const worker = workerById(id);
  if (!worker) return null;
  return {
    ...worker,
    kind: 'worker',
    role: 'worker',
    initials: worker.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase(),
    language: langMeta(worker.lang).english,
  };
}

/** §4.1 — the pending invitation attached to a worker record, if there is one. */
export function invitationFor(workerId) {
  return state.db.invitations.find((i) => i.workerId === workerId) ?? null;
}

/** The display name of anyone work can be sent to, app user or worker record. */
export function assigneeName(id) {
  const member = state.db.team.find((m) => m.id === id);
  if (member) return member.name;
  const worker = workerById(id);
  return worker ? worker.name : null;
}

/** Everything assigned to one person, app user or §5.6 worker record alike. */
export function tasksForAssignee(assigneeId) {
  return state.db.tasks.filter((task) => task.assigneeId === assigneeId).map(lTask);
}

/**
 * The task that was raised from a piece of advice, if one has been. This is
 * what "assigned" means for an advisory item: the farmer approved the packaged
 * task and it went to somebody. Until then there is only a suggestion.
 *
 * Completing the task is what closes the advice (WF5.080), so an advice with a
 * live task here has nothing left to assign — only to confirm as done.
 */
export function taskFromAdvice(adviceId) {
  const task = state.db.tasks.find((x) => x.fromAdviceId === adviceId
    && ['open', 'in_progress'].includes(x.state));
  return task ? lTask(task) : null;
}

/** The open work naming a particular tree — B9's third column. */
export function tasksForTree(treeId) {
  return state.db.tasks
    .filter((task) => ['open', 'in_progress'].includes(task.state))
    .filter((task) => (task.treeIds ?? []).includes(treeId))
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
/**
 * WF5.099 says every advisory item arrives PRE-PACKAGED as a task. The
 * addendum asks a sharper question: does that task exist the moment the advice
 * is generated, or only once the farmer acts on it? It changes what the task
 * list contains on a morning nobody has opened the app.
 *
 * The answer here is the first. A suggested task exists as soon as its advice
 * does, and E1 shows it — unassigned, undated, waiting for disposal. Nobody has
 * been sent anything, so it carries no badge (WF3.004 counts what is assigned
 * to YOU and due), and it disappears the moment the advice is assigned,
 * ignored or recorded as done.
 *
 * The alternative — nothing exists until the farmer taps Assign — makes the
 * task list empty on exactly the morning it should be most useful, and turns
 * "pre-packaged" into a description of a form rather than of a thing.
 */
export function suggestedTasks({ farmId = 'all' } = {}) {
  const scope = new Set(visibleFarms().map((f) => f.id));
  const taken = new Set(state.db.tasks.map((task) => task.fromAdviceId).filter(Boolean));
  return state.db.advice
    .filter((a) => a.status === 'open')
    .filter((a) => scope.has(a.farmId))
    .filter((a) => (farmId === 'all' ? true : new Set(farmsForFilter(farmId).map((f) => f.id)).has(a.farmId)))
    .filter((a) => !taken.has(a.id))
    .sort((a, b) => bySeverity(a, b, (x) => severityToStatus(x.severity)))
    .map(lAdvice)
    .map((a) => ({
      id: `suggested-${a.id}`,
      adviceId: a.id,
      title: a.action,
      quantity: a.amount,
      type: a.type,
      farmId: a.farmId,
      plotIds: a.plotIds,
      plotNames: a.plotNames,
      assigneeId: a.suggestedAssigneeId,
      dueText: a.suggestedDue,
      severity: a.severity,
      state: 'suggested',
    }));
}

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
