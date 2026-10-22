/* ---------------------------------------------------------------------------
   pricing.js — what a holding costs. Two rules and a name, nothing else.

   OCT 2026: TWO PLANS, ONE SET OF SIZE BANDS, DECIDED WITH WAFRA. Crops used
   to be priced per hectare and trees per tree, in bands of trees rounded down
   (billedTrees(), with RATES and TREE_BANDS in screens/onboarding.js), and
   each of the six plans had its own rate. That all went for this:

     1. SIZE SCORE. For each farm: hectares of crops + trees ÷ N, where N is the
        number of trees that count as one hectare. The owner's score is the sum
        over all of his farms — one subscription covers them all (WF4.107).
     2. BAND. The highest band whose `from` is at or below the total score —
        ALWAYS rounded down, so Wafra takes the smaller margin — except that a
        score below the first band pays the first band: the minimum bill.

   Each band has a Basic and a Premium price, monthly and yearly. The store
   sells each one as its own product, `wafra_{basic|premium}_{m|y}_{band}`,
   with the band as three digits (`wafra_premium_m_012`).

   THE NUMBERS ARE MOCK. N and the bands live in content.json → `pricing`,
   picked so the prices on screen stay near what the mockup showed before. The
   real ones are Wafra's, are private, and are never in this repository; in the
   product they come from Wafra's price table (WF4.102) and this module only
   applies the two rules to them.

   Screens do not do this arithmetic: A11, A17, A18, F5 and the plan chooser
   all ask here, so the estimate, the plan page and the bill cannot disagree.
   --------------------------------------------------------------------------- */

import { state } from './store.js';

const table = () => state.db.pricing;

/** How many trees count as one hectare. */
export function treesPerHectare() {
  return table().treesPerHectare;
}

/** Rule 1 — one farm's size: hectares of crops, plus its trees as hectares. */
export function sizeScore({ cropHa = 0, treeCount = 0 } = {}) {
  return (Number(cropHa) || 0) + (Number(treeCount) || 0) / treesPerHectare();
}

/** The owner's size: every farm he holds, added up. */
export function totalScore(holdings) {
  return holdings.reduce((sum, holding) => sum + sizeScore(holding), 0);
}

/**
 * Rule 2 — the band a total score is billed in: the highest band starting at
 * or below it, rounded down, never under the first band.
 *
 * The score is rounded to a millionth first, so that a holding which adds up
 * to exactly a band's start in arithmetic is not billed a band lower for the
 * last bit of a binary fraction.
 */
export function bandFor(score) {
  const s = Math.round((Number(score) || 0) * 1e6) / 1e6;
  const { bands } = table();
  return bands.reduce((pick, band) => (band.from <= s ? band : pick), bands[0]);
}

/** What a level costs in a band, in USD, for one billing period. */
export function bandPrice(band, level, period = 'month') {
  return band[level][period === 'year' ? 'y' : 'm'];
}

/** The store's product for a level, a period and a band. */
export function productId(level, period, band) {
  return `wafra_${level}_${period === 'year' ? 'y' : 'm'}_${String(band.band).padStart(3, '0')}`;
}

/** What a yearly plan saves against twelve monthly payments, as a fraction. */
export function annualSaving(band, level) {
  return 1 - bandPrice(band, level, 'year') / (12 * bandPrice(band, level, 'month'));
}
