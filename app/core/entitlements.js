/* ---------------------------------------------------------------------------
   entitlements.js — chapter 9.

   WF9.036: the app asks what the user MAY DO, never derives capability from a
   plan name or a farm type. So the rest of the app only ever calls
   `has('irrigation.schedule')`. The plan → feature-key expansion below is the
   only place plan names appear, standing in for the server's resolution.

   WF9.001: two levels, Basic and Pro, in three services — crops, trees, and the
   combined service an account holding both is sold. There is no third level.
   WF9.002: no plan the farmer can see is called Advanced, Professional or
   Enterprise.

   WF9.005 deliberately keeps the supplier's own tier vocabulary OUT of this
   file. The same level carries different names on the two sides — a Wafra Crop
   Basic is bought as the supplier's Professional — and reconciling that is
   server configuration. An app that held the mapping would be one release
   behind the day it changed.

   WF9.033: a feature outside the plan is visible and LOCKED, never hidden.
   Screens call `lock('irrigation.schedule')` to get the copy for the upgrade
   sheet in one step, so the sheet is identical everywhere (WF9.034).
   --------------------------------------------------------------------------- */

import { state } from './store.js';

/* -- crops (§9.3) --------------------------------------------------------- */

const CROP_BASIC = [
  'satellite.10m', 'satellite.base', 'farm.add', 'farm.search',
  'weather.current', 'weather.forecast.14', 'weather.historical', 'et.data',
  'diary', 'dashboard.advanced', 'scouting', 'progress.1y',
  'report.weekly', 'report.delivery.sla', 'soil.rootzone',
  'fertiliser.insights', 'disease.directory', 'disease.forecasting',
  'maps.basic', 'maps.advanced', 'maps.compare',
  'advisory.operations', 'expert.opinion', 'timeseries',
  'guide', 'tickets', 'multiuser', 'languages', 'tasks', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi',
];
const CROP_PRO = [
  ...CROP_BASIC,
  'satellite.1m', 'satellite.highres', 'satellite.cloudfree', 'cadastral.import',
  'weather.alerts.custom', 'gis.advanced', 'growthstage', 'report.monthly',
  'anomaly', 'compare.5y', 'soil.3m', 'irrigation.schedule', 'disease.photo',
  'vra.maps', 'irrigation.map', 'agrodoctor',
  'measure.ndre', 'measure.evi', 'measure.msavi', 'measure.photosynthesis',
];

/* -- trees (§9.4) ---------------------------------------------------------
   WF9.006 cuts everything that exists only in the supplier's Advanced tree
   tier: yield estimation, orchard yield optimisation, plot-level harvest
   planning, personalised advisory, canopy structure per tree, hyper-local plot
   weather, custom weather alerts, higher-resolution satellites and the detailed
   monthly report. None of them appear below at either level, and WF9.008 goes
   further — the app does not estimate yield at all.

   WF9.007 makes the exclusion tier-specific rather than feature-specific: the
   three of those that also sit behind Wafra Pro on the crop side survive there,
   which is why CROP_PRO above still carries them.                          */

const TREE_BASIC = [
  'tree.mapping', 'tree.count', 'tree.draw', 'tree.health.basic',
  'tree.canopy.basic', 'tree.status', 'tree.list', 'tree.dashboard',
  'tree.disease.directory', 'orchard.planner',
  'satellite.base', 'satellite.10m', 'weather.current', 'weather.forecast.7',
  'farm.add', 'maps.basic', 'diary', 'scouting', 'guide',
  'multiuser', 'languages', 'tasks', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi',
];
const TREE_PRO = [
  ...TREE_BASIC,
  'tree.species.id', 'tree.gap.detect', 'tree.density', 'tree.health.full',
  'tree.stress.early', 'tree.chlorophyll', 'tree.water', 'tree.canopy.full',
  'tree.perTree', 'tree.disease.forecast', 'tree.dashboard.health',
  'ripeness', 'harvest.alerts', 'harvest.queue', 'pest.alerts',
  'satellite.cloudfree', 'weather.forecast.15', 'et.data',
  'irrigation.schedule.tree', 'irrigation.efficiency',
  'compare.plots', 'agrodoctor', 'vra.maps', 'report.weekly', 'tickets',
  'measure.ndre', 'measure.evi', 'measure.msavi', 'measure.photosynthesis',
];

/* WF4.107 — a combined holding is ONE product at ONE price on ONE renewal
   date, not two subscriptions shown together. */
const both = (a, b) => [...new Set([...a, ...b])];

export const PLANS = {
  crop_basic:     { family: 'crop',     tier: 'Basic', label: 'Crop Basic',     keys: CROP_BASIC },
  crop_pro:       { family: 'crop',     tier: 'Pro',   label: 'Crop Pro',       keys: CROP_PRO },
  tree_basic:     { family: 'tree',     tier: 'Basic', label: 'Tree Basic',     keys: TREE_BASIC },
  tree_pro:       { family: 'tree',     tier: 'Pro',   label: 'Tree Pro',       keys: TREE_PRO },
  combined_basic: { family: 'combined', tier: 'Basic', label: 'Combined Basic', keys: both(CROP_BASIC, TREE_BASIC) },
  combined_pro:   { family: 'combined', tier: 'Pro',   label: 'Combined Pro',   keys: both(CROP_PRO, TREE_PRO) },
  // WF9.032 — the trial ends in read-only, not in a locked-out account.
  trial_expired:  { family: 'none',     tier: 'Expired', label: 'Trial expired (read-only)',
                    keys: ['farm.view.readonly', 'guide', 'contact', 'languages'] },
};

/** WF9.036 — the only entitlement question the app asks. */
export function has(featureKey) {
  const plan = PLANS[state.session.plan];
  return !!plan && plan.keys.includes(featureKey);
}

export function planLabel() {
  return PLANS[state.session.plan]?.label ?? '—';
}

export function planFamily() {
  return PLANS[state.session.plan]?.family ?? 'crop';
}

export function planTier() {
  return PLANS[state.session.plan]?.tier ?? 'Basic';
}

export function isReadOnly() {
  return state.session.plan === 'trial_expired';  // WF9.032
}

/* WF9.035 — the upgrade sheet names the plan required and describes the benefit
   in one sentence of plain language. It never shows a technical feature name.
   That copy lives here, keyed by feature, so it cannot drift between screens. */
const LOCK_COPY = {
  'irrigation.schedule':      ['Crop Pro', 'Irrigation scheduling', 'Get a weekly irrigation plan for every plot, based on your crop, your soil and the weather.'],
  'irrigation.schedule.tree': ['Tree Pro', 'Tree irrigation scheduling', 'Get a watering plan for your trees, based on canopy, stress and the weather.'],
  'irrigation.efficiency':    ['Tree Pro', 'Irrigation efficiency', 'See how much of the water you apply is reaching the trees.'],
  'disease.photo':            ['Crop Pro', 'Photo disease checking', 'Photograph a leaf and get an identification back, with a confidence level.'],
  'weather.alerts.custom':    ['Crop Pro', 'Custom weather alerts', 'Set your own thresholds for wind, heat and rain and be told when they are crossed.'],
  'weather.forecast.14':      ['Crop Pro', 'The 14-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'weather.forecast.15':      ['Tree Pro', 'The 15-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'compare.5y':               ['Crop Pro', 'Comparing with previous years', 'Put this week beside the same week in up to five earlier seasons.'],
  'compare.plots':            ['Tree Pro', 'Comparing plots over time', 'Put two plots side by side and see which is pulling ahead.'],
  'satellite.1m':             ['Crop Pro', '1 m imagery', 'See detail down to a single metre, enough to pick out individual problem areas.'],
  'satellite.cloudfree':      ['Pro', 'Cloud-free readings', 'Keep getting a reading through cloud, instead of waiting for a clear day.'],
  'vra.maps':                 ['Pro', 'Variable rate maps', 'Get sowing, nitrogen and P&K maps you can load into your machinery.'],
  'gis.advanced':             ['Crop Pro', 'Advanced map layers', 'Add soil type, land use and testing-lab layers to your map.'],
  'irrigation.map':           ['Crop Pro', 'The irrigation map', 'See how evenly water is reaching every part of a plot.'],
  'agrodoctor':               ['Pro', 'Agro Doctor', 'Send a question and a photograph to an agronomist and get an answer back.'],
  'expert.opinion':           ['Crop Basic', 'Expert opinion', 'Ask an agronomist to look at a plot and tell you what they see.'],
  'report.monthly':           ['Crop Pro', 'The detailed monthly report', 'A fuller month-by-month record of health, water and work done.'],
  'report.weekly':            ['Tree Pro', 'The weekly farm report', 'A weekly summary of tree health, stress and work done.'],
  'anomaly':                  ['Crop Pro', 'Anomaly detection', 'Be told when a plot behaves unlike the rest of the farm.'],
  'growthstage':              ['Crop Pro', 'Growth stage modelling', 'See which stage your crop has reached and what is due next.'],
  'ripeness':                 ['Tree Pro', 'Ripeness tracking', 'See what proportion of your trees are ready to pick.'],
  'harvest.alerts':           ['Tree Pro', 'Harvest alerts', 'Be told when a plot crosses the ripeness you pick at.'],
  'harvest.queue':            ['Tree Pro', 'The harvest alert queue', 'Keep every ripeness alert in one place, in the order they need picking.'],
  'pest.alerts':              ['Tree Pro', 'Pest and disease alerts', 'Be warned when conditions turn in favour of the pests that affect your trees.'],
  'tree.health.full':         ['Tree Pro', 'Full tree health', 'See chlorophyll, water content and photosynthesis for every tree.'],
  'tree.species.id':          ['Tree Pro', 'Species identification', 'Have the survey tell you which species each tree is, not just where it stands.'],
  'tree.gap.detect':          ['Tree Pro', 'Planting gap detection', 'Find the gaps in your planting, so replanting goes where it is needed.'],
  'tree.density':             ['Tree Pro', 'Plant density mapping', 'See where your trees stand too close together and where too far apart.'],
  'tree.chlorophyll':         ['Tree Pro', 'Chlorophyll per tree', 'See nutrient content tree by tree, not just as a plot average.'],
  'tree.water':               ['Tree Pro', 'Water stress per tree', 'Find the individual trees running short of water.'],
  'tree.perTree':             ['Tree Pro', 'Per-tree detail', 'Open any single tree and see its own chlorophyll and water content.'],
  'tree.disease.forecast':    ['Tree Pro', 'Disease forecasting', 'Know several days ahead when conditions will favour the pests that affect your trees.'],
  'tree.dashboard.health':    ['Tree Pro', 'The health dashboard', 'One place showing how the whole orchard is holding up, with its alerts.'],
  'tree.canopy.full':         ['Tree Pro', 'Full canopy readings', 'See average chlorophyll and canopy water content, not only density.'],
  // WF4.109 — a farm of the other type is kept and locked until the account
  // moves to the combined service. The banner on B2 opens this one.
  'tree.list':                ['Combined', 'Your tree farms', 'One subscription covering the crops and the trees, on a single renewal date.'],
  'timeseries':               ['Crop Basic', 'The time series viewer', 'Track any measure over time and see when it turned.'],
  'et.data':                  ['Tree Pro', 'Water use data', 'See how much water your trees are using each day.'],
  'measure.ndre':             ['Pro', 'Nutrition status', 'See where nutrition is below target before the crop shows it.'],
  'measure.evi':              ['Pro', 'Growth and vigour', 'Track how strongly the crop is growing week to week.'],
  'measure.msavi':            ['Pro', 'Soil-corrected health', 'Get a reading that is not thrown off by bare soil between rows.'],
  'measure.photosynthesis':   ['Pro', 'Photosynthesis', 'See how actively the crop is working, not just how green it is.'],
  'maps.compare':             ['Crop Basic', 'Comparing dates', 'Put two dates side by side and see exactly what changed.'],
  'tickets':                  ['Tree Pro', 'Support tickets', 'Raise a written ticket and follow it to an answer.'],
  'cadastral.import':         ['Crop Pro', 'Cadastral import', 'Bring in registered parcel boundaries instead of tracing them.'],
  'soil.3m':                  ['Crop Pro', 'Deep soil readings', 'See soil moisture and temperature to three metres, not one.'],
};

/**
 * One call gives a screen everything it needs to render a locked control and,
 * on tap, the single consistent upgrade sheet of WF9.034.
 */
export function lock(featureKey) {
  const [plan, name, benefit] = LOCK_COPY[featureKey] ?? ['Pro', 'This feature', 'Upgrade to see this.'];
  return { featureKey, plan, name, benefit, locked: !has(featureKey) };
}

/**
 * WF4.106 — the service offered is DERIVED from the account's farms, never
 * chosen by the user. An account holding both is offered the combined service
 * only, not two separate ones.
 */
export function offeredFamily(farms) {
  const hasCrop = farms.some((f) => f.type === 'crops' || f.type === 'mixed');
  const hasTree = farms.some((f) => f.type === 'trees' || f.type === 'mixed');
  if (hasCrop && hasTree) return 'combined';
  if (hasTree) return 'tree';
  return 'crop';
}

/** WF4.109 — a farm of the other type is visible, its boundary kept, and its
    analytics locked behind the upgrade to Combined. */
export function farmIsPending(farm) {
  const family = planFamily();
  if (family === 'combined') return false;
  if (family === 'crop') return farm.type === 'trees';
  if (family === 'tree') return farm.type === 'crops';
  return false;
}
