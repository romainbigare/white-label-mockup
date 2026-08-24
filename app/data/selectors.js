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
import { lAdvice, lFarm, lPlot, lTree, lObservation, lLog } from './localise.js';

/* -- farms ---------------------------------------------------------------- */

export function visibleFarms() {
  // WF5.009 — severity first, then most recently viewed. The severity is the
  // farm's WORST PLOT (WF5.001), not the `status` field on the record: that
  // field only means anything for a farm with no plots at all, so sorting on it
  // put every farm that had data into one undifferentiated block.
  return [...farmsFor()]
    .sort((a, b) => bySeverity(a, b, farmStatus) || a.name.localeCompare(b.name))
    .map(lFarm);
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

export function rawAdvice(id) {
  return state.db.advice.find((a) => a.id === id);
}

/* -- people, §5.6 ----------------------------------------------------------
   THE WORKFORCE IS GONE, and with it the person records, the invitations and
   the delivery pipes. A farm runs on an owner and one trusted supervisor who
   has been there twenty years; the app knows both, and the supervisor closes a
   job by tapping a link in a message rather than by holding an account.

   Which is why the only question left about people is this one. */

/** The one person work on this farm is sent to. */
export function supervisorOf(farmId) {
  return state.db.team.find((m) => m.role === 'supervisor' && (m.farmIds ?? []).includes(farmId))
    ?? state.db.team.find((m) => m.role === 'supervisor')
    ?? null;
}

/** The display name of whoever an advice was sent to. */
export function personName(id) {
  return state.db.team.find((m) => m.id === id)?.name ?? null;
}

export function personById(id) {
  return state.db.team.find((m) => m.id === id) ?? null;
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

/** The farms a filter value selects: `all`, or one farm id. */
export function farmsForFilter(value) {
  if (!value || value === 'all') return visibleFarms();
  const one = visibleFarms().find((f) => f.id === value);
  return one ? [one] : visibleFarms();
}

/** What a filter value is called on screen. */
export function farmFilterLabel(value) {
  if (!value || value === 'all') return null;
  return farmsForFilter(value)[0]?.name ?? null;
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

/* WHAT "SENT" MEANS, AND WHY IT IS NOT A SECOND OBJECT.

   The build used to materialise a TASK the moment an advice was assigned, and
   the two then had to be kept in step — a task completed closed its advice, an
   advice ignored orphaned its task, and every screen that showed one had to
   know about the other. The review deleted the task: an advice is the unit of
   work, and sending it to the supervisor is a state on the advice.

   So an open advice is in one of two states, and `sentAt` is the whole of the
   difference: waiting for the farmer to decide, or out with the supervisor and
   waiting to be closed. */

export function isSent(advice) {
  return advice.status === 'open' && !!advice.sentAt;
}

/** Open advice nobody has been told about yet — what "send them all" acts on. */
export function unsentAdvice({ farmId = 'all' } = {}) {
  return adviceFor({ farmId, status: 'open' }).filter((a) => !a.sentAt);
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

/* -- team ----------------------------------------------------------------- */

export function membersOf(farmId) {
  return state.db.team.filter((m) => m.farmIds.includes(farmId));
}

export function memberById(id) {
  return state.db.team.find((m) => m.id === id);
}

export function me() {
  return state.db.team.find((m) => m.role === state.session.role) ?? state.db.team[0];
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

/** The plot activity feed of B4 — advice acted on, inputs and observations. */
export function plotActivity(plotId) {
  const entries = [];
  for (const a of state.db.advice) {
    if (a.plotIds.includes(plotId) && a.status === 'done') {
      const done = lAdvice(a);
      entries.push({ kind: 'advice', at: a.recorded?.at ?? a.issuedAt, icon: 'check', text: done.action, detail: done.recorded?.amount ? `${done.recorded.amount} ${done.recorded.unit ?? ''}`.trim() : done.amount });
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
