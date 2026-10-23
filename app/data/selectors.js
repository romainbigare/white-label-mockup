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
import { isWatched } from '../core/trees.js';
import { measureScore, metricScore, bandOf, METRIC_ORDER } from '../core/health.js';
import { has } from '../core/entitlements.js';
import { lAdvice, lFarm, lPlot, lTree, lObservation, lLog, lDisease } from './localise.js';

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

/* EVERY LIST OF PLOTS IS A LIST OF WATCHED ONES (v1.7.3). A species with
   fewer than forty trees is counted and never listed as a tree group — see
   core/trees.js — so the four functions that hand a screen a farm's plots
   leave it out here, once, and no screen has to remember the rule. */
const watched = (p) => isWatched(p);

/* AND EVERY LIST IS IN PLOT ORDER (v1.7.4): by number — 1, 2 … 10, never 10
   before 2 — tree fields included, since they are numbered too. One
   comparator, in the read layer, so B1, B11, the planner and every sheet
   agree without each sorting for itself. */
const plotNumber = (p) => Number(/^Plot (\d+)$/.exec(p.name ?? '')?.[1] ?? Infinity);
function byPlotOrder(a, b) {
  return plotNumber(a) - plotNumber(b) || (a.name ?? '').localeCompare(b.name ?? '');
}

export function plotsOf(farmId) {
  return state.db.plots.filter((p) => p.farmId === farmId && watched(p)).sort(byPlotOrder).map(lPlot);
}

/** Trees counted on a farm that are too few to be a tree group: species and count. */
export function smallTreesOf(farmId) {
  return state.db.plots.filter((p) => p.farmId === farmId && !watched(p)).map(lPlot);
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

/* THE THREE FARM-LEVEL MEASURES ON MY FARM (B1), since v1.7.3: irrigation
   efficiency, plant health and growth and vigour. Each is the AVERAGE of the
   farm's plots and tree groups — "not the worst plot" — because this is the
   farm's standing, and the plot that is behind is named in its own row. A
   plot with no reading is left out of the average rather than counted as 0. */
export function farmMeasures(farmId) {
  const plots = state.db.plots.filter((p) => p.farmId === farmId && watched(p) && p.status !== 'nodata');
  const mean = (values) => {
    const known = values.filter((v) => v != null && Number.isFinite(v));
    return known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : null;
  };
  const metric = (key) => mean(plots.map((p) => metricScore(key, measureScore({ key, ...(p.measures?.[key] ?? {}) }))));
  return {
    efficiency: mean(plots.map((p) => p.irrigationEfficiencyPct)),
    ndvi: metric('ndvi'),
    evi: metric('evi'),
  };
}

/* WHAT A FARM IS PRICED ON, read off its own fields (v1.7.4): the hectares
   of its crop fields, and the trees counted in its tree fields — every tree,
   a field under forty included, because every tree was counted. */
export function farmTotals(farmId) {
  const plots = state.db.plots.filter((p) => p.farmId === farmId);
  const round1 = (n) => Math.round(n * 10) / 10;
  const crops = plots.filter((p) => p.kind !== 'trees');
  const trees = plots.filter((p) => p.kind === 'trees');
  return {
    cropHa: round1(crops.reduce((s, p) => s + (p.areaHa ?? 0), 0)),
    treeHa: round1(trees.reduce((s, p) => s + (p.areaHa ?? 0), 0)),
    treeCount: trees.reduce((s, p) => s + (p.treeCount ?? 0), 0),
  };
}

/* THE OWNER'S WHOLE HOLDING, one entry per farm (Oct 2026): the price is one
   band from the size of every farm the owner holds, added up (core/pricing.js),
   so the quote is the owner's even when a supervisor is looking. */
export function ownerFarmTotals() {
  return farmsFor('owner').map((f) => farmTotals(f.id));
}

/* A PLOT'S STATUS IS ITS WORST INDICATOR (v1.7.4). The five metrics of the
   plot page's scorecard — plant health, soil moisture, growth and vigour,
   nutrition status, water stress — each read as good, monitor or urgent from
   their band (core/health.js), and the plot takes the worst of them: amber if
   any one is amber, red if any one is red. Only the metrics in the farmer's
   plan count, because a plot cannot be red for a reason he cannot open. */
export function plotIndicators(plot) {
  return METRIC_ORDER.map((key) => {
    const measure = state.db.measures.find((m) => m.key === key);
    if (!measure || !has(measure.featureKey)) return null;
    const band = bandOf(key, measureScore({ key, ...(plot.measures?.[key] ?? {}) }));
    return band ? { key, status: band.status } : null;
  }).filter(Boolean);
}

/** good | monitor | urgent — or nodata for a plot with no reading yet. */
export function plotHealth(plot) {
  if (plot.counting || plot.status === 'nodata') return 'nodata';
  return worstStatus(plotIndicators(plot));
}

/** WF5.001 — a farm's status is its worst plot, never an average. */
export function farmStatus(farm) {
  const plots = state.db.plots.filter((p) => p.farmId === farm.id && watched(p));
  return plots.length ? worstStatus(plots) : farm.status;
}

/** The farms a filter value selects: `all`, or one farm id. */
export function farmsForFilter(value) {
  if (!value || value === 'all') return visibleFarms();
  const one = visibleFarms().find((f) => f.id === value);
  return one ? [one] : visibleFarms();
}

/** The farm a screen is about when it has none in hand — the one the farm
    filter names, or the first the user can see. */
export function currentFarm() {
  return farmsForFilter(state.ui.farmFilter)[0] ?? null;
}

/** What a filter value is called on screen. */
export function farmFilterLabel(value) {
  if (!value || value === 'all') return null;
  return farmsForFilter(value)[0]?.name ?? null;
}

export function plotsForFilter(value) {
  const ids = new Set(farmsForFilter(value).map((f) => f.id));
  return state.db.plots.filter((p) => ids.has(p.farmId) && watched(p)).sort(byPlotOrder).map(lPlot);
}

export function allVisiblePlots() {
  const ids = new Set(visibleFarms().map((f) => f.id));
  return state.db.plots.filter((p) => ids.has(p.farmId) && watched(p)).sort(byPlotOrder).map(lPlot);
}

/* -- advice --------------------------------------------------------------- */

/* WEATHER IS NOT ADVICE, AND SINCE THE MONDAY REVIEW IT IS NOT IN THE LIST.

   "I don't think there are any actions related to weather. In the features from
   MMC there are urgent notifications relating to bad weather, but it's a
   notification, not an advice." — "Yeah, let's remove it."

   An advice tells a farmer to do something; a forecast tells him what is
   coming. The records are still here, because the farm's weather strip and F4
   read them, but nothing that lists work to be done does: not the inbox, not
   the plot, not the count of things nobody has been told about. */
function isAdvice(a) {
  return a.type !== 'weather';
}

/* AND A SUPERSEDED ADVICE IS NOT IN THE INBOX EITHER.

   WF5.104 asks that a recommendation replaced by a newer one be marked as such
   and linked to its replacement, and the build used to do that with a card in
   the list: the old advice, greyed, with a line pointing at the new one. In a
   mockup that reads as a bug — two cards about the same plot, one of them
   struck through — and in the product it is a card the farmer can do nothing
   with taking the place of one he can.

   So the inbox holds live work only. The record is not deleted and the
   requirement is not dropped: an old link still opens the advice, and the
   detail screen is where it says it has been replaced and hands over. */
function isLive(a) {
  return a.status !== 'superseded';
}

export function adviceFor({ farmId = 'all', status = 'open', type = 'all', plotId = null } = {}) {
  const scope = new Set(visibleFarms().map((f) => f.id));
  const wanted = new Set(farmsForFilter(farmId).map((f) => f.id));
  return state.db.advice
    .filter(isAdvice)
    .filter(isLive)
    .filter((a) => scope.has(a.farmId))
    .filter((a) => (farmId === 'all' ? true : wanted.has(a.farmId)))
    .filter((a) => (plotId ? a.plotIds.includes(plotId) : true))
    .filter((a) => (type === 'all' ? true : a.type === type))
    .filter((a) => {
      // WF5.098 — an ignored item leaves the inbox and comes back tomorrow. It
      // is not deleted, so the All tab still carries it; only the working list
      // hides it, which is the whole difference between deferring and losing.
      if (status === 'all') return true;
      if (status === 'completed') return a.status === 'completed';
      return a.status === 'open';
    })
    .sort((a, b) => bySeverity(a, b, (x) => severityToStatus(x.severity)))
    .map(lAdvice);
}

export function adviceById(id) {
  const found = rawAdvice(id);
  return found ? lAdvice(found) : undefined;
}

/**
 * Advice raised on one plot. Open by default — that is what a red row and a
 * "see what to do" button are asking for. `includeDone` is B2's "recent
 * suggestions": on a quiet plot the ones already dealt with are what say what
 * kind of season this has been, and an empty list there says nothing at all.
 */
export function adviceForPlot(plotId, { includeDone = false } = {}) {
  return state.db.advice
    .filter(isAdvice)
    .filter((a) => a.plotIds.includes(plotId))
    .filter((a) => (includeDone ? a.status !== 'deferred' : a.status === 'open'))
    .sort((a, b) => (includeDone ? new Date(b.issuedAt) - new Date(a.issuedAt) : 0)
      || bySeverity(a, b, (x) => severityToStatus(x.severity)))
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
  return severity === 'urgent' ? 'urgent' : 'monitor';
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
  return state.db.accounts?.find((m) => m.id === state.session.userId)
    ?? state.db.team.find((m) => m.id === state.session.userId)
    ?? state.db.team[0];
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

/** One entry of the disease and pest directory, in the reader's language. */
export function diseaseById(id) {
  return lDisease(state.db.diseases.find((d) => d.id === id));
}

export function observationsOf(plotId) {
  return state.db.observations.filter((o) => o.plotId === plotId).map(lObservation);
}

export function activityFor(farmId = 'all') {
  return state.db.activityLog.filter((e) => farmId === 'all' || e.farmId === farmId).map(lLog);
}

/** The plot activity feed of B2 — advice acted on, inputs and observations. */
export function plotActivity(plotId) {
  const entries = [];
  for (const a of state.db.advice) {
    if (a.plotIds.includes(plotId) && a.status === 'completed') {
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
