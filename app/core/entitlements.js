/* ---------------------------------------------------------------------------
   entitlements.js — chapter 9.

   WF9.036: the app asks what the user MAY DO, never derives capability from a
   plan name or a farm type. So the rest of the app only ever calls
   `has('irrigation.schedule', farm)`. The level → feature-key expansion below
   is the only place plan names appear, standing in for the server's
   resolution.

   OCT 2026: TWO PLANS, ONE SET OF SIZE BANDS, DECIDED WITH WAFRA. There used
   to be six plans — Crop, Tree and Combined, each Basic or Premium — and an
   account holding both kinds of farm was moved to Combined (WF4.106), with a
   farm of the other type kept and locked until it was (WF4.109). All of that
   went. The farmer buys ONE of two plans, Basic or Premium, monthly or yearly,
   and what a farm gets follows what is on it:

     * a farm has the `crops` service if it has a crop area, and the `trees`
       service if it has trees — a mixed farm has both;
     * the features on a farm = the plan level's features for the services on
       that farm.

   So the entitlement question is asked PER FARM. A screen with no farm in hand
   asks about the farm it is showing (`currentFarm()` in data/selectors.js).
   What the plan costs is not this file's business: it is one band from the
   owner's total size, in core/pricing.js.

   WF9.002: no plan the farmer can see is called Advanced, Professional or
   Enterprise. The level ids are `basic` and `premium`.

   WF9.005 deliberately keeps the supplier's own tier vocabulary OUT of this
   file. The same level carries different names on the two sides — a Wafra
   Basic is bought as the supplier's Professional — and reconciling that is
   server configuration. An app that held the mapping would be one release
   behind the day it changed.

   WF9.033: a feature outside the plan is visible and LOCKED, never hidden.
   Screens call `lock('irrigation.schedule')` to get the copy for the upgrade
   sheet in one step, so the sheet is identical everywhere (WF9.034).
   --------------------------------------------------------------------------- */

import { state } from './store.js';

/* -- crops (§9.3) ---------------------------------------------------------
   The four lists in this file are per SERVICE and per LEVEL. They are the
   lists the six plans used to be built from; only the way they combine has
   changed — see FEATURES below. */

const CROP_BASIC = [
  'satellite.10m', 'satellite.base', 'farm.add', 'farm.search',
  'weather.current', 'weather.forecast.14', 'et.data',
  'diary', 'dashboard.advanced', 'scouting', 'progress.1y',
  'report.weekly', 'soil.rootzone',
  'fertiliser.insights', 'disease.directory', 'disease.forecasting',
  'maps.basic', 'maps.advanced', 'maps.compare',
  'advisory.operations', 'soil.nutrients',
  // The near-term pest alert follows from the disease forecast above it, which
  // this tier already carries, so it cannot sit a tier higher than its own
  // input (13/09 catalogue round, feature 706).
  'pest.alerts',
  'guide', 'tickets', 'multiuser', 'languages', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi',
];
const CROP_PRO = [
  ...CROP_BASIC,
  'satellite.1m', 'satellite.highres', 'satellite.cloudfree', 'cadastral.import',
  'weather.alerts.custom', 'growthstage', 'report.monthly',
  'anomaly', 'compare.5y', 'soil.3m', 'irrigation.schedule', 'disease.photo',
  // 13/09 catalogue round: the irrigation map (603) and the fertigation plan
  // (602) are Professional in the supplier's catalogue, and the crop plans had
  // neither — `irrigation.efficiency` existed only on the tree side, where the
  // same feature was already sold.
  'irrigation.efficiency', 'fertigation',
  'measure.ndre', 'measure.evi',
  // Oct 2026: the crop planner (B7) is the "Personalized crop planner" F6
  // sells in Premium only (the supplier's 504, Professional). It had no key,
  // so Basic got it too; B7 and its B1 shortcut are locked on it now.
  'crop.planner',
];

/* -- trees (§9.4) ---------------------------------------------------------
   WF9.006 cuts everything that exists only in the supplier's Advanced tree
   tier: yield estimation, orchard yield optimisation, plot-level harvest
   planning, personalised advisory, canopy structure per tree, hyper-local plot
   weather, custom weather alerts, higher-resolution satellites and the detailed
   monthly report. None of them appear below at either level, and WF9.008 goes
   further — the app does not estimate yield at all.

   WF9.007 makes the exclusion tier-specific rather than feature-specific: the
   three of those that also sit behind Wafra Premium on the crop side survive
   there, which is why CROP_PRO above still carries them.                   */

const TREE_BASIC = [
  'tree.mapping', 'tree.count', 'tree.draw', 'tree.health.basic',
  'tree.canopy.basic', 'tree.status', 'tree.list', 'tree.dashboard',
  'tree.disease.directory', 'orchard.planner',
  'satellite.base', 'satellite.10m', 'weather.current', 'weather.forecast.7',
  'farm.add', 'maps.basic', 'diary', 'scouting', 'guide',
  'multiuser', 'languages', 'offline', 'contact',
  'measure.ndvi', 'measure.ndwi',
];
const TREE_PRO = [
  ...TREE_BASIC,
  'tree.gap.detect', 'tree.density', 'tree.health.full',
  'tree.stress.early', 'tree.water', 'tree.canopy.full', 'soil.nutrients',
  'tree.perTree', 'tree.disease.forecast', 'tree.dashboard.health',
  'ripeness', 'harvest.alerts', 'harvest.queue', 'pest.alerts',
  'satellite.cloudfree', 'weather.forecast.15', 'et.data',
  'irrigation.schedule.tree', 'irrigation.efficiency',
  'compare.plots', 'report.weekly', 'tickets',
  'measure.ndre', 'measure.evi',
];

/* What each level includes, per service. A mixed farm gets the union of its
   two services at the account's level — one plan, one price, one renewal date
   (WF4.107), whatever the farms hold. */
const FEATURES = {
  crops: { basic: CROP_BASIC, premium: CROP_PRO },
  trees: { basic: TREE_BASIC, premium: TREE_PRO },
};

/* WF9.032 — the trial ends in read-only, not in a locked-out account, and
   read-only is the same on every farm whatever grows on it. */
const READ_ONLY = ['farm.view.readonly', 'guide', 'contact', 'languages'];

/* The two levels, in the order they are shown. Neither is "the recommended
   one" (WF4.101). */
export const LEVELS = ['basic', 'premium'];

/* What `session.plan` can hold: one of the two levels, or the expired trial.
   `label` is the English the harness reads; `nameKey` is the translation key
   the farmer's screens name it by — `plan.pro` for Premium because that is
   the key the translations already carry, from when the level id was `pro`.
   `additionalUsers` is how many people besides the owner the plan lets in. */
export const PLANS = {
  basic:         { level: 'basic',   label: 'Basic',   nameKey: 'plan.basic', additionalUsers: 1 },
  premium:       { level: 'premium', label: 'Premium', nameKey: 'plan.pro',   additionalUsers: 2 },
  trial_expired: { level: null, label: 'Trial expired (read-only)', nameKey: 'plan.name.trial_expired', additionalUsers: 0 },
};

/** The level the account is on — `basic` or `premium` — or null once the
    trial has expired. The price and the plan screens read it; a screen
    deciding what to SHOW never does, it asks has(). */
export function planLevel() {
  return PLANS[state.session.plan]?.level ?? null;
}

export function planLabel() {
  return PLANS[state.session.plan]?.label ?? '—';
}

const farmRecord = (farm) => (typeof farm === 'string'
  ? state.db.farms.find((f) => f.id === farm)
  : farm) ?? null;

/**
 * The services a farm has, from what is on it: `crops` if it has a crop area,
 * `trees` if it has trees, both on a mixed farm. Read off its plots, which
 * carry their own kind; a farm with no plots yet falls back on the type it was
 * made with.
 */
export function farmServices(farm) {
  const record = farmRecord(farm);
  if (!record) return [];
  const plots = state.db.plots.filter((p) => p.farmId === record.id);
  const crops = plots.length ? plots.some((p) => p.kind !== 'trees') : record.type !== 'trees';
  const trees = plots.length ? plots.some((p) => p.kind === 'trees') : record.type !== 'crops';
  return [crops && 'crops', trees && 'trees'].filter(Boolean);
}

/** Every feature key the account's plan gives on one farm. */
export function featuresOn(farm) {
  if (state.session.plan === 'trial_expired') return new Set(READ_ONLY);
  const level = planLevel();
  if (!level) return new Set();
  return new Set(farmServices(farm).flatMap((service) => FEATURES[service][level]));
}

/** WF9.036 — the only entitlement question the app asks. `farm` is a farm
    record or its id: what may be used depends on what is on the farm. */
export function has(featureKey, farm) {
  return featuresOn(farm).has(featureKey);
}

export function additionalUserLimit() {
  return PLANS[state.session.plan]?.additionalUsers ?? 0;
}

export function isReadOnly() {
  return state.session.plan === 'trial_expired';  // WF9.032
}

/* WF9.035 — the upgrade sheet names the plan required and describes the benefit
   in one sentence of plain language. It never shows a technical feature name.
   That copy lives here, keyed by feature, so it cannot drift between screens.
   Since Oct 2026 the plan it names is "Premium" or "Basic", never a crop, tree
   or combined plan. */
const LOCK_COPY = {
  'irrigation.schedule':      ['Premium', 'Irrigation scheduling', 'Get a weekly irrigation plan for every plot, based on your crop, your soil and the weather.'],
  'irrigation.schedule.tree': ['Premium', 'Tree irrigation scheduling', 'Get a watering plan for your trees, based on canopy, stress and the weather.'],
  'irrigation.efficiency':    ['Premium', 'Irrigation efficiency', 'See how much of the water you apply is reaching the trees.'],
  'disease.photo':            ['Premium', 'Plant diagnosis', 'Photograph a plant and find out if it is a pest, a disease, or too much or too little water.'],
  'weather.alerts.custom':    ['Premium', 'Custom weather alerts', 'Set your own thresholds for wind, heat and rain and be told when they are crossed.'],
  'weather.forecast.14':      ['Premium', 'The 14-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'weather.forecast.15':      ['Premium', 'The 15-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'compare.5y':               ['Premium', 'Comparing with previous years', 'Put this week beside the same week in up to five earlier seasons.'],
  'compare.plots':            ['Premium', 'Comparing plots over time', 'Put two plots side by side and see which is pulling ahead.'],
  'satellite.1m':             ['Premium', '1 m imagery', 'See detail down to a single metre, enough to pick out individual problem areas.'],
  'satellite.cloudfree':      ['Premium', 'Cloud-free readings', 'Keep getting a reading through cloud, instead of waiting for a clear day.'],
  'report.monthly':           ['Premium', 'The detailed monthly report', 'A fuller month-by-month record of health, water and work done.'],
  'report.weekly':            ['Premium', 'The weekly farm report', 'A weekly summary of tree health, stress and work done.'],
  'anomaly':                  ['Premium', 'Anomaly detection', 'Be told when a plot behaves unlike the rest of the farm.'],
  'growthstage':              ['Premium', 'Growth stage modelling', 'See which stage your crop has reached and what is due next.'],
  'ripeness':                 ['Premium', 'Ripeness tracking', 'See what proportion of your trees are ready to pick.'],
  'harvest.alerts':           ['Premium', 'Harvest alerts', 'Be told when a plot crosses the ripeness you pick at.'],
  'harvest.queue':            ['Premium', 'The harvest alert queue', 'Keep every ripeness alert in one place, in the order they need picking.'],
  'pest.alerts':              ['Premium', 'Pest and disease alerts', 'Be warned when conditions turn in favour of the pests that affect your trees.'],
  'tree.health.full':         ['Premium', 'Full tree health', 'See chlorophyll, water content and photosynthesis for every tree.'],
  'tree.gap.detect':          ['Premium', 'Planting gap inspection', 'Find the gaps in your planting, so replanting goes where it is needed.'],
  'tree.density':             ['Premium', 'Planting density mapping', 'See where your trees stand too close together and where too far apart.'],
  // Basic on a crop farm, Premium on a tree farm: the only farm it can be
  // locked on while the trial runs is a tree farm on Basic.
  'soil.nutrients':           ['Premium', 'Soil nutrient content', 'See where the ground is short of nitrogen, phosphorus and potassium.'],
  'tree.water':               ['Premium', 'Water stress per tree', 'Find the individual trees running short of water.'],
  'tree.perTree':             ['Premium', 'Per-tree detail', 'Open any single tree and see its own chlorophyll and water content.'],
  'tree.disease.forecast':    ['Premium', 'Disease forecasting', 'Know several days ahead when conditions will favour the pests that affect your trees.'],
  'tree.dashboard.health':    ['Premium', 'The health dashboard', 'One place showing how the whole orchard is holding up, with its alerts.'],
  'tree.canopy.full':         ['Premium', 'Full canopy readings', 'See average chlorophyll, not only canopy density.'],
  // It opened the upgrade to Combined until Oct 2026. Trees now come with the
  // farm, not the plan: a farm with no tree field has no tree features at
  // either level, so the copy says what would open them.
  'tree.list':                ['Basic', 'Tree reports', 'Draw a tree field on this farm and both plans cover its trees.'],
  'et.data':                  ['Premium', 'Water use data', 'See how much water your trees are using each day.'],
  'measure.ndre':             ['Premium', 'Nutrition status', 'See where nutrition is below target before the crop shows it.'],
  'measure.evi':              ['Premium', 'Growth and vigour', 'Track how strongly the crop is growing week to week.'],
  'crop.planner':             ['Premium', 'Crop planner', 'See every operation your crop needs, month by month, from planting to harvest.'],
  'maps.compare':             ['Basic', 'Comparing dates','Put two dates side by side and see exactly what changed.'],
  'tickets':                  ['Premium', 'Support tickets', 'Raise a written ticket and follow it to an answer.'],
  'cadastral.import':         ['Premium', 'Cadastral import', 'Bring in registered parcel boundaries instead of tracing them.'],
  'soil.3m':                  ['Premium', 'Deep soil readings', 'See soil moisture and temperature to three metres, not one.'],
};

/**
 * The copy a screen needs to render a locked control and, on tap, the single
 * consistent upgrade sheet of WF9.034. WHETHER it is locked is has(key, farm);
 * the copy is the same on every farm.
 */
export function lock(featureKey) {
  const [plan, name, benefit] = LOCK_COPY[featureKey] ?? ['Premium', 'This feature', 'Upgrade to see this.'];
  return { featureKey, plan, name, benefit };
}
