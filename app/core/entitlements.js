/* ---------------------------------------------------------------------------
   entitlements.js — chapter 9.

   WF4.073 / WF9.016: the app asks what the user MAY DO, never derives capability
   from a plan name or a farm type. So the rest of the app only ever calls
   `has('irrigation.schedule')`. The plan → feature-key expansion below is the
   only place plan names appear, standing in for the server's resolution.

   WF9.013/WF9.014: a feature outside the plan is visible and LOCKED, never hidden.
   Screens call `lock('irrigation.schedule')` to get the copy for the upgrade
   sheet in one step, so the sheet is identical everywhere (WF9.014).
   --------------------------------------------------------------------------- */

import { state } from './store.js';

/* Feature keys, grouped by the plan that first grants them (§9.3, §9.4). */
const CROP_BASIC = [
  'satellite.10m', 'farm.add', 'weather.current', 'weather.forecast.7',
  'diary', 'scouting', 'dashboard.basic', 'progress.1y', 'report.weekly',
  'disease.directory', 'maps.basic', 'soil.rootzone', 'guide', 'tickets',
  'multiuser', 'languages', 'tasks', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi',
];
const CROP_PRO = [
  ...CROP_BASIC, 'satellite.3m', 'farm.search', 'weather.forecast.14',
  'weather.historical', 'et.data', 'dashboard.advanced', 'report.delivery.sla',
  'soil.1m', 'fertiliser.insights', 'disease.forecasting', 'maps.advanced',
  'maps.compare', 'advisory.operations', 'expert.opinion', 'timeseries',
  'measure.ndre', 'measure.evi',
];
const CROP_ADVANCED = [
  ...CROP_PRO, 'satellite.1m', 'satellite.cloudfree', 'cadastral.import',
  'weather.alerts.custom', 'gis.advanced', 'growthstage', 'report.monthly',
  'anomaly', 'compare.5y', 'soil.3m', 'irrigation.schedule',
  'disease.photo', 'vra.maps', 'irrigation.map', 'agrodoctor',
  'measure.msavi', 'measure.photosynthesis',
];
const TREE_BASIC = [
  'tree.mapping', 'tree.count', 'tree.draw', 'tree.health.basic',
  'satellite.10m', 'weather.current', 'weather.forecast.7',
  'tree.disease.directory', 'tree.canopy.basic', 'tree.list', 'tree.dashboard',
  'orchard.planner', 'diary', 'scouting', 'guide',
  'multiuser', 'languages', 'tasks', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi', 'farm.add', 'report.weekly', 'maps.basic',
];
const TREE_PRO = [
  ...TREE_BASIC, 'tree.species.id', 'tree.gap.detect', 'tree.density',
  'tree.health.full', 'tree.stress.early', 'tree.chlorophyll', 'tree.water',
  'satellite.cloudfree', 'tree.disease.forecast', 'ripeness', 'harvest.alerts',
  'vra.maps', 'weather.forecast.14', 'et.data',
  'irrigation.schedule.tree', 'irrigation.efficiency', 'compare.plots',
  'agrodoctor', 'harvest.queue', 'pest.alerts', 'tree.dashboard.health',
  'report.orchard.weekly', 'tickets', 'satellite.1m', 'measure.msavi',
  'measure.ndre', 'measure.evi', 'measure.photosynthesis',
  'yield.estimate', 'yield.optimise', 'harvest.planning', 'advisory.personalised',
  'scouting.workflows', 'weather.hyperlocal', 'weather.alerts.custom',
  'report.monthly', 'maps.advanced', 'maps.compare', 'timeseries',
  'expert.opinion', 'disease.forecasting', 'fertiliser.insights',
  'advisory.operations', 'dashboard.advanced',
];

export const PLANS = {
  crop_basic:      { family: 'crop',     tier: 'Basic',    label: 'Crop · Basic',        keys: CROP_BASIC },
  crop_pro:        { family: 'crop',     tier: 'Pro',      label: 'Crop · Pro',          keys: CROP_PRO },
  crop_advanced:   { family: 'crop',     tier: 'Advanced', label: 'Crop · Advanced',     keys: CROP_ADVANCED },
  tree_basic:      { family: 'tree',     tier: 'Basic',    label: 'Trees · Basic',       keys: TREE_BASIC },
  tree_pro:        { family: 'tree',     tier: 'Pro',      label: 'Trees · Pro',         keys: TREE_PRO },
  complete_basic:  { family: 'complete', tier: 'Basic',    label: 'Complete · Basic',    keys: [...new Set([...CROP_BASIC, ...TREE_BASIC])] },
  complete_pro:    { family: 'complete', tier: 'Pro',      label: 'Complete · Pro',      keys: [...new Set([...CROP_PRO, ...TREE_PRO])] },
  complete_adv:    { family: 'complete', tier: 'Advanced', label: 'Complete · Advanced', keys: [...new Set([...CROP_ADVANCED, ...TREE_PRO])] },
  trial_expired:   { family: 'none',     tier: 'Expired',  label: 'Trial expired (read-only)', keys: ['farm.view.readonly', 'guide', 'contact', 'languages'] },
};

/* WF9.003 — plan → underlying supplier tier is server configuration, shown here
   so the mapping lives in exactly one place and never leaks into a screen. */
export const SUPPLIER_TIER = {
  crop_basic: 'Crop "Basic"',
  crop_pro: 'Crop "Advanced"',
  crop_advanced: 'Crop "Professional"',
  tree_basic: 'Tree "Basic"',
  tree_pro: 'Tree "Advanced"',
  complete_basic: 'Crop "Basic" + Tree "Basic"',
  complete_pro: 'Crop "Advanced" + Tree "Advanced"',
  complete_adv: 'Crop "Professional" + Tree "Advanced"',
};

/** WF4.073 — the only entitlement question the app asks. */
export function has(featureKey) {
  if (state.session.demo) return true;            // WF4.091 — everything unlocked in demo
  const plan = PLANS[state.session.plan];
  return !!plan && plan.keys.includes(featureKey);
}

export function planLabel() {
  return PLANS[state.session.plan]?.label ?? '—';
}

export function planFamily() {
  return PLANS[state.session.plan]?.family ?? 'crop';
}

export function isReadOnly() {
  return state.session.plan === 'trial_expired';  // WF9.012
}

/* WF9.015 — the upgrade sheet names the plan required and describes the benefit
   in one sentence of plain language. It never shows a technical feature name.
   That copy lives here, keyed by feature, so it cannot drift between screens. */
const LOCK_COPY = {
  'irrigation.schedule':  ['Advanced', 'Irrigation scheduling', 'Get a weekly irrigation plan for every plot, based on your crop, your soil and the weather.'],
  'irrigation.schedule.tree': ['Trees Pro', 'Orchard irrigation scheduling', 'Get a watering plan for each orchard block, based on tree age, canopy and the weather.'],
  'fertiliser.insights':  ['Pro', 'Fertiliser insights', 'See where nutrition is below target and how much to apply, plot by plot.'],
  'disease.forecasting':  ['Pro', 'Disease forecasting', 'Know several days ahead when conditions will favour the pests that affect your crop.'],
  'disease.photo':        ['Advanced', 'Photo disease checking', 'Photograph a leaf and get an identification back, with a confidence level.'],
  'weather.forecast.14':  ['Pro', 'The 14-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'weather.alerts.custom':['Advanced', 'Custom weather alerts', 'Set your own thresholds for wind, heat and rain and be told when they are crossed.'],
  'compare.5y':           ['Advanced', 'Comparing with previous years', 'Put this week beside the same week in up to five earlier seasons.'],
  'satellite.1m':         ['Advanced', '1 m imagery', 'See detail down to a single metre, enough to pick out individual problem areas.'],
  'vra.maps':             ['Advanced', 'Variable rate maps', 'Get sowing, nitrogen and P&K maps you can load into your machinery.'],
  'gis.advanced':         ['Advanced', 'Advanced map layers', 'Add soil type, land use and testing-lab layers to your map.'],
  'irrigation.map':       ['Advanced', 'The irrigation map', 'See how evenly water is reaching every part of a plot.'],
  'agrodoctor':           ['Advanced', 'Agro Doctor', 'Send a question and a photograph to an agronomist and get an answer back.'],
  'expert.opinion':       ['Pro', 'Expert opinion', 'Ask an agronomist to look at a plot and tell you what they see.'],
  'report.monthly':       ['Advanced', 'The detailed monthly report', 'A fuller month-by-month record of health, water and work done.'],
  'anomaly':              ['Advanced', 'Anomaly detection', 'Be told when a plot behaves unlike the rest of the farm.'],
  'growthstage':          ['Advanced', 'Growth stage modelling', 'See which stage your crop has reached and what is due next.'],
  'ripeness':             ['Trees Pro', 'Ripeness tracking', 'See what proportion of your trees are ready to pick, block by block.'],
  'harvest.planning':     ['Trees Pro', 'Harvest planning', 'Get a pick order for your plots with an estimated window and tonnage for each.'],
  'yield.estimate':       ['Trees Pro', 'Yield estimation', 'See what your orchard is likely to produce this season, with a confidence range.'],
  'tree.health.full':     ['Trees Pro', 'Full tree health', 'See chlorophyll, water content and canopy structure for every tree.'],
  'advisory.personalised':['Trees Pro', 'Advice from your own history', 'Get advice built from your own seasons, not from general thresholds.'],
  'timeseries':           ['Pro', 'The time series viewer', 'Track any measure over time and see when it turned.'],
  'et.data':              ['Pro', 'Water use data', 'See how much water your crop is using each day.'],
  'measure.ndre':         ['Pro', 'Nutrition status', 'See where nutrition is below target before the crop shows it.'],
  'measure.evi':          ['Pro', 'Growth and vigour', 'Track how strongly the crop is growing week to week.'],
  'measure.msavi':        ['Advanced', 'Soil-corrected health', 'Get a reading that is not thrown off by bare soil between rows.'],
  'measure.photosynthesis':['Advanced', 'Photosynthesis', 'See how actively the crop is working, not just how green it is.'],
  'maps.compare':         ['Pro', 'Comparing dates', 'Put two dates side by side and see exactly what changed.'],
  'report.orchard.weekly':['Trees Pro', 'The weekly orchard report', 'A weekly summary of tree health, stress and work done.'],
};

/**
 * One call gives a screen everything it needs to render a locked control and,
 * on tap, the single consistent upgrade sheet of WF9.014.
 */
export function lock(featureKey) {
  const [plan, name, benefit] = LOCK_COPY[featureKey] ?? ['Pro', 'This feature', 'Upgrade to see this.'];
  return { featureKey, plan, name, benefit, locked: !has(featureKey) };
}

/**
 * WF9.005 — the plan family offered is DERIVED from the account's farms, never
 * chosen by the user.
 */
export function offeredFamily(farms) {
  const hasCrop = farms.some((f) => f.type === 'crops' || f.type === 'mixed');
  const hasTree = farms.some((f) => f.type === 'trees' || f.type === 'mixed');
  if (hasCrop && hasTree) return 'complete';
  if (hasTree) return 'tree';
  return 'crop';
}

/** WF9.006 — a farm of the other type is visible but its analytics are locked. */
export function farmIsPending(farm) {
  if (state.session.demo) return false;
  const family = planFamily();
  if (family === 'complete') return false;
  if (family === 'crop') return farm.type === 'trees';
  if (family === 'tree') return farm.type === 'crops';
  return false;
}
