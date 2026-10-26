/* ---------------------------------------------------------------------------
   pricing.js — what a holding costs. Two rules and a name, nothing else.

   OCT 2026: TWO PLANS, ONE PRICE FROM CROPS AND TREES, DECIDED WITH WAFRA.
   Crops are priced PER HECTARE and trees PER TREE — trees are never turned into
   hectares. For the owner's whole holding (one subscription covers every farm
   he has, WF4.107):

     1. THE MONTHLY TOTAL, at the plan's level (basic or premium):
          hectares of crops × the rate per hectare
        + trees              × the rate per tree,
        one rate per level for each, the same at any size. A holding with
        crops pays for at least `minimum.cropHa` hectares, one with trees for
        at least `minimum.trees` trees.
     2. THE BAND. The total is rounded UP to a price band — the cheapest band
        whose monthly price is at or above it.

   A band is one store product per level and period,
   `wafra_{basic|premium}_{m|y}_{band}`, with the band as three digits
   (`wafra_premium_m_012`), and carries its own yearly price.

   THE NUMBERS ARE MOCK. The rates and the bands live in content.json →
   `pricing`. The real ones are Wafra's, are private, and are never in this
   repository. In the product the app never sees a rate: it calls the
   `quotePrice` function, which answers with the band and its prices per
   level (docs/service-architecture/FIRESTORE_SCHEMA.md). This module stands in
   for that function, which is why the screens read only the band.

   Screens do not do this arithmetic: A11, A17, A18, F5 and the plan chooser
   all ask here, so the estimate, the plan page and the bill cannot disagree.
   --------------------------------------------------------------------------- */

import { state } from './store.js';

const table = () => state.db.pricing;

/**
 * Rule 1 — what the owner's holding costs a month at a level, before the band:
 * crops per hectare plus trees per tree.
 */
export function priceFor(holdings, level) {
  const { minimum, crop, trees } = table();
  const cropHa = holdings.reduce((sum, f) => sum + (Number(f.cropHa) || 0), 0);
  const treeCount = holdings.reduce((sum, f) => sum + (Number(f.treeCount) || 0), 0);
  const billedHa = cropHa > 0 ? Math.max(cropHa, minimum.cropHa) : 0;
  const billedTrees = treeCount > 0 ? Math.max(treeCount, minimum.trees) : 0;
  const usd = billedHa * crop[level] + billedTrees * trees[level];
  return { cropHa, treeCount, billedHa, billedTrees, usd, band: bandFor(usd) };
}

/**
 * Rule 2 — the band a monthly total is billed in: the cheapest band priced at
 * or above it, rounded up. Above the top band the product needs a contract;
 * the mockup draws no contract and bills the top band.
 *
 * The total is rounded to a millionth first, so that a holding which comes to
 * exactly a band's price in arithmetic is not billed a band higher for the
 * last bit of a binary fraction.
 */
export function bandFor(usd) {
  const total = Math.round((Number(usd) || 0) * 1e6) / 1e6;
  const { bands } = table();
  return bands.find((band) => band.m >= total) ?? bands[bands.length - 1];
}

/** What a band costs, in USD, for one billing period. */
export function bandPrice(band, period = 'month') {
  return period === 'year' ? band.y : band.m;
}

/** The store's product for a level, a period and a band. */
export function productId(level, period, band) {
  return `wafra_${level}_${period === 'year' ? 'y' : 'm'}_${String(band.band).padStart(3, '0')}`;
}

/** What a yearly plan saves against twelve monthly payments, as a fraction. */
export function annualSaving(band) {
  return 1 - band.y / (12 * band.m);
}
