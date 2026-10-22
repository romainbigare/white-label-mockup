// Wafra's pricing rules, in one place. The app uses the same rules to show prices;
// keepActiveFarms uses them to decide which farms the owner's paid band covers.
// Every number comes from Firestore pricing/current; nothing is hard-coded here.
//
// Two levels (basic, premium). Crops are priced PER HECTARE and trees PER TREE; trees are never
// counted as hectares. For all the owner's farms together:
//   monthly total = crop hectares × the rate per hectare + trees × the rate per tree,
// where the rate per hectare is read from the owner's total hectares and the rate per tree from
// his total trees (volume tables). A holding with crops pays for at least `minimum.cropHa`
// hectares, one with trees for at least `minimum.trees` trees. The total is ROUNDED DOWN to a
// price band; a total below the first band pays the first band (the minimum bill).

const LEVELS = ['basic', 'premium'];

// The rate for a quantity in a volume table: the first row whose `upTo` is at or above it
// (a null `upTo` is the open last row).
function rateFor(rows, quantity, level) {
  const row = rows.find((r) => r.upTo == null || quantity <= r.upTo) || rows[rows.length - 1];
  return Number(row[level]);
}

// What farms cost a month at a level, before the band: crops per hectare plus trees per tree.
function monthlyTotal(pricing, farms, level) {
  const cropHa = farms.reduce((sum, f) => sum + (Number(f.cropAreaHa) || 0), 0);
  const trees = farms.reduce((sum, f) => sum + (Number(f.treeCount) || 0), 0);
  const billedHa = cropHa > 0 ? Math.max(cropHa, Number(pricing.minimum.cropHa)) : 0;
  const billedTrees = trees > 0 ? Math.max(trees, Number(pricing.minimum.trees)) : 0;
  return billedHa * rateFor(pricing.crop, billedHa, level) + billedTrees * rateFor(pricing.trees, billedTrees, level);
}

// The band a monthly total is billed in: the highest band whose monthly price is at or below it.
// `bands` is sorted by `month`; below the first band, the first band.
function bandFor(pricing, usd) {
  let band = pricing.bands[0];
  for (const b of pricing.bands) if (Number(b.month) <= usd + 1e-9) band = b;
  return band.band;
}

// Whether one farm fits the in-app limits. A farm that does not needs a contract.
function fitsInApp(pricing, farm) {
  const limits = pricing.inApp;
  return (Number(farm.cropAreaHa) || 0) <= limits.maxHaPerFarm
    && (Number(farm.treeCount) || 0) <= limits.maxTreesPerFarm;
}

// The price of a band for a period ('month' or 'year'); null when there is none.
function bandPrice(pricing, band, period) {
  const b = pricing.bands.find((x) => x.band === band);
  return b && b[period] != null ? Number(b[period]) : null;
}

// Store product IDs look like wafra_premium_m_012: level, period (m/y), band.
function parseProductId(id) {
  const m = /^wafra_(basic|premium)_([my])_(\d{3})$/.exec(id || '');
  if (!m) return null;
  return { level: m[1], period: m[2], band: Number(m[3]) };
}

function productId(level, period, band) {
  return `wafra_${level}_${period}_${String(band).padStart(3, '0')}`;
}

module.exports = { LEVELS, monthlyTotal, bandFor, fitsInApp, bandPrice, parseProductId, productId };
