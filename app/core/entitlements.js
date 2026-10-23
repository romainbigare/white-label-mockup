/* ---------------------------------------------------------------------------
   entitlements.js — chapter 9.

   WF9.036: the app asks what the user MAY DO, never derives capability from a
   plan name or a farm type. So the rest of the app only ever calls
   `has('irrigation.schedule')`. The level → feature-key expansion below
   is the only place plan names appear, standing in for the server's
   resolution.

   OCT 2026: TWO PLANS, DECIDED WITH WAFRA. There used
   to be six plans — Crop, Tree and Combined, each Basic or Premium — and an
   account holding both kinds of farm was moved to Combined (WF4.106), with a
   farm of the other type kept and locked until it was (WF4.109). All of that
   went. The farmer buys ONE of two plans, Basic or Premium, monthly or yearly.
   A plan gives the same features on every farm, whatever grows on it: there
   is one list per level below, and no list per crop or tree farm.

   A FEATURE FOR TREES IS NOT A TREE PLAN. Some features only mean something
   where there are trees (the per-tree report) or crops (the crop planner);
   the screen that shows them is only reached on such a field. Where the crop
   and the tree version of a feature sit in different plans on F6, they are
   two keys: `irrigation.efficiency` (the crop report, Premium) and
   `irrigation.efficiency.tree` (the tree rating, Basic); `measure.ndre` (the
   C1 layer, Basic) and `tree.nutrition` (a tree field's nutrition, Premium).

   What the plan costs is not this file's business: crop hectares plus trees,
   each rounded down to a price band, in core/pricing.js. The bands change the
   price, never the features.

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

/* -- Basic ----------------------------------------------------------------
   Oct 2026, the plan sheet: what F6 sells in Basic, and every feature that
   neither F6 nor the plan sheet puts in Premium. */
const BASIC = [
  // The farm, its maps and its imagery.
  'farm.add', 'farm.search', 'dashboard.advanced', 'progress.1y', 'diary', 'scouting',
  'maps.basic', 'maps.advanced', 'maps.compare',
  'satellite.base', 'satellite.10m', 'satellite.1m', 'satellite.highres', 'satellite.cloudfree',
  'cadastral.import', 'anomaly', 'compare.5y',
  // Weather.
  'weather.current', 'weather.forecast.15', 'weather.alerts.custom', 'et.data',
  // Reports.
  'report.weekly', 'report.monthly',
  // Advice, alerts and the disease directory. The near-term pest alert
  // follows from the disease forecast, so it cannot sit a tier higher than its
  // own input (13/09 catalogue round, feature 706).
  'advisory.operations', 'fertiliser.insights', 'disease.directory', 'disease.forecasting', 'pest.alerts',
  // The scorecard, all five (on a tree field the nutrition row is
  // `tree.nutrition`, Premium), the growth stage, soil and irrigation.
  'measure.ndvi', 'measure.ndwi', 'measure.ndre', 'measure.evi', 'soil.rootzone', 'soil.3m',
  'growthstage', 'irrigation.schedule', 'irrigation.schedule.tree', 'irrigation.efficiency.tree',
  // Trees: Tree Advisory on F6 sells almost everything in Basic.
  'tree.mapping', 'tree.count', 'tree.draw', 'tree.status', 'tree.list', 'tree.dashboard',
  'tree.health.basic', 'tree.canopy.basic', 'tree.perTree', 'tree.stress.early',
  'tree.disease.directory', 'tree.disease.forecast', 'ripeness', 'harvest.alerts', 'orchard.planner',
  // B6's "Canopy structure" row, and keys no screen asks for yet.
  'tree.health.full', 'tree.density', 'tree.water', 'tree.canopy.full',
  'tree.dashboard.health', 'harvest.queue', 'compare.plots',
  // The app itself.
  'guide', 'multiuser', 'languages', 'offline', 'contact',
];

/* -- Premium ----------------------------------------------------------------
   PREMIUM IS WHAT F6 OR THE PLAN SHEET SAYS IS NOT IN BASIC, AND NOTHING ELSE
   (Oct 2026). */
const PREMIUM = [
  ...BASIC,
  // The crop irrigation efficiency report: B1's efficiency score on a farm
  // with crops, a field's irrigation trend and the F3 report.
  'irrigation.efficiency',
  // The fertilisation schedule: "Fertilisers needed" on a plot and on B12.
  'fertigation',
  // The "Personalized crop planner": B7 and its B1 shortcut.
  'crop.planner',
  // "Nutrient reports and analysis" (the F3 report) and the yield forecast
  // (B3).
  'soil.nutrients', 'yield.forecast',
  // Nutrition status of a tree field: its scorecard row, its map and status,
  // and B6's "Nutrient content".
  'tree.nutrition',
  // Not on F6. The sheet says Premium.
  'disease.photo', 'tickets', 'tree.gap.detect',
];

const FEATURES = { basic: BASIC, premium: PREMIUM };

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

/** Every feature key the account's plan gives. */
export function features() {
  if (state.session.plan === 'trial_expired') return new Set(READ_ONLY);
  return new Set(FEATURES[planLevel()] ?? []);
}

/** WF9.036 — the only entitlement question the app asks. The answer is the
    same on every farm: the plan is the account's, not the farm's. */
export function has(featureKey) {
  return features().has(featureKey);
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

   THE PLAN IT NAMES IS NOT WRITTEN HERE (Oct 2026). It is the lowest level
   whose list carries the key — see lock() below — so moving a key between
   the lists above can never leave a sheet asking for the wrong plan. */
const LOCK_COPY = {
  // Both plans give advice; the inbox is only locked once the trial is over.
  'advisory.operations':      ['Advice', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind each recommendation.'],
  'irrigation.schedule':      ['Irrigation scheduling', 'Get a weekly irrigation plan for every plot, based on your crop, your soil and the weather.'],
  'irrigation.schedule.tree': ['Tree irrigation scheduling', 'Get a watering plan for your trees, based on canopy, stress and the weather.'],
  'irrigation.efficiency':    ['Irrigation efficiency', 'See how much of the water you apply reaches the roots, week by week.'],
  'irrigation.efficiency.tree': ['Tree irrigation efficiency', 'See how much of the water you give your trees reaches the roots, week by week.'],
  'fertigation':              ['Fertilisation schedule', 'See which fertiliser goes in with the water, how much per hectare, and on which irrigations.'],
  'disease.photo':            ['Plant diagnosis', 'Photograph a plant and find out if it is a pest, a disease, or too much or too little water.'],
  'weather.alerts.custom':    ['Custom weather alerts', 'Set your own thresholds for wind, heat and rain and be told when they are crossed.'],
  'weather.forecast.15':      ['The 15-day forecast', 'Plan spraying and irrigation two weeks ahead instead of one.'],
  'compare.5y':               ['Comparing with previous years', 'Put this week beside the same week in up to five earlier seasons.'],
  'compare.plots':            ['Comparing plots over time', 'Put two plots side by side and see which is pulling ahead.'],
  'satellite.1m':             ['1 m imagery', 'See detail down to a single metre, enough to pick out individual problem areas.'],
  'satellite.cloudfree':      ['Cloud-free readings', 'Keep getting a reading through cloud, instead of waiting for a clear day.'],
  'report.monthly':           ['The detailed monthly report', 'A fuller month-by-month record of health, water and work done.'],
  'report.weekly':            ['The weekly farm report', 'A weekly summary of health, water and work done.'],
  'anomaly':                  ['Anomaly detection', 'Be told when a plot behaves unlike the rest of the farm.'],
  'growthstage':              ['Growth stage modelling', 'See which stage your crop has reached and what is due next.'],
  'yield.forecast':           ['Yield forecast', 'See the harvest the season is heading for, as a range that narrows as the crop fills.'],
  'ripeness':                 ['Ripeness tracking', 'See what proportion of your trees are ready to pick.'],
  'harvest.alerts':           ['Harvest alerts', 'Be told when a plot crosses the ripeness you pick at.'],
  'harvest.queue':            ['The harvest alert queue', 'Keep every ripeness alert in one place, in the order they need picking.'],
  'pest.alerts':              ['Pest and disease alerts', 'Be warned when conditions turn in favour of the pests that affect your trees.'],
  'tree.health.full':         ['Full tree health', 'See chlorophyll, water content and photosynthesis for every tree.'],
  'tree.gap.detect':          ['Planting gap inspection', 'Find the gaps in your planting, so replanting goes where it is needed.'],
  'tree.density':             ['Planting density mapping', 'See where your trees stand too close together and where too far apart.'],
  'soil.nutrients':           ['Nutrient reports and analysis', 'See where the ground is short of nitrogen, phosphorus and potassium.'],
  'tree.water':               ['Water stress per tree', 'Find the individual trees running short of water.'],
  'tree.perTree':             ['Per-tree detail', 'Open any single tree and see its own chlorophyll and water content.'],
  'tree.disease.forecast':    ['Disease forecasting', 'Know several days ahead when conditions will favour the pests that affect your trees.'],
  'tree.dashboard.health':    ['The health dashboard', 'One place showing how the whole orchard is holding up, with its alerts.'],
  'tree.canopy.full':         ['Full canopy readings', 'See average chlorophyll, not only canopy density.'],
  'et.data':                  ['Water use data', 'See how much water your trees are using each day.'],
  'tree.nutrition':           ['Nutrition status', 'See where your trees are short of nutrients before they show it.'],
  'measure.evi':              ['Growth and vigour', 'Track how strongly the crop is growing week to week.'],
  'crop.planner':             ['Crop planner', 'See every operation your crop needs, month by month, from planting to harvest.'],
  'maps.compare':             ['Comparing dates', 'Put two dates side by side and see exactly what changed.'],
  'tickets':                  ['Support tickets', 'Raise a written ticket and follow it to an answer.'],
  'cadastral.import':         ['Cadastral import', 'Bring in registered parcel boundaries instead of tracing them.'],
  'soil.3m':                  ['Deep soil readings', 'See soil moisture and temperature to three metres, not one.'],
};

/** The plan an upgrade sheet names: the lowest level that gives the key. A
    key on no list is named Premium. */
function lowestLevel(featureKey) {
  return LEVELS.find((level) => FEATURES[level].includes(featureKey)) ?? 'premium';
}

/**
 * The copy a screen needs to render a locked control and, on tap, the single
 * consistent upgrade sheet of WF9.034. WHETHER it is locked is has(key).
 */
export function lock(featureKey) {
  const [name, benefit] = LOCK_COPY[featureKey] ?? ['This feature', 'Upgrade to see this.'];
  return { featureKey, plan: PLANS[lowestLevel(featureKey)].label, name, benefit };
}
