// Wafra's pricing rules, in one place. keepActiveFarms uses them to decide which farms the owner's
// paid band covers; quotePrice uses them to tell the app which band to sell. The app never applies
// them itself: it would need the rates, and the rates stay on the server.
// Every number comes from Firestore; nothing is hard-coded here. The table is in two documents:
//   pricing/current  anyone signed in: currency, VAT, in-app limits, bands, product IDs;
//   pricing/rates    staff only: the minimums and the rates (per hectare, per tree).
//
// Two levels (basic, premium). Crops are priced PER HECTARE and trees PER TREE; trees are never
// counted as hectares. For all the owner's farms together:
//   monthly total = crop hectares × the rate per hectare + trees × the rate per tree,
// with one rate per level for each, the same at any size. A holding with crops pays for at least
// `minimum.cropHa` hectares, one with trees for at least `minimum.trees` trees. The total is ROUNDED
// UP to a price band: the cheapest band at or above it. A total above the top band has no band: it
// needs a contract, never the top band. The total never goes down when land or trees are added
// (keepActiveFarms relies on that).

const LEVELS = ['basic', 'premium'];

// The whole table: pricing/current and pricing/rates in one object, or null while either is missing.
async function loadPricing(db) {
  const [current, rates] = await Promise.all([db.doc('pricing/current').get(), db.doc('pricing/rates').get()]);
  if (!current.exists || !rates.exists) return null;
  return { ...current.data(), ...rates.data() };
}

// What farms cost a month at a level, before the band: crops per hectare plus trees per tree.
function monthlyTotal(pricing, farms, level) {
  const cropHa = farms.reduce((sum, f) => sum + (Number(f.cropAreaHa) || 0), 0);
  const trees = farms.reduce((sum, f) => sum + (Number(f.treeCount) || 0), 0);
  const billedHa = cropHa > 0 ? Math.max(cropHa, Number(pricing.minimum.cropHa)) : 0;
  const billedTrees = trees > 0 ? Math.max(trees, Number(pricing.minimum.trees)) : 0;
  return billedHa * Number(pricing.crop[level]) + billedTrees * Number(pricing.trees[level]);
}

// The band a monthly total is billed in: the cheapest band whose monthly price is at or above it.
// `bands` is sorted by `month`; above the top band, null (a contract).
function bandFor(pricing, usd) {
  const band = pricing.bands.find((b) => Number(b.month) >= usd - 1e-9);
  return band ? band.band : null;
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

// Store product IDs look like wafra_premium_m_012: level, period (m/y), band. RevenueCat names a
// Google Play product by its subscription and base plan (wafra_premium_m_012:monthly); the base
// plan adds nothing, so it is ignored.
function parseProductId(id) {
  const m = /^wafra_(basic|premium)_([my])_(\d{3})(?::[\w.-]+)?$/.exec(id || '');
  if (!m) return null;
  return { level: m[1], period: m[2], band: Number(m[3]) };
}

function productId(level, period, band) {
  return `wafra_${level}_${period}_${String(band).padStart(3, '0')}`;
}

// What the app may show for a set of farms: per level, the band, its prices and its products.
// Never the rates or the dollar total. Farms outside the in-app limits need a contract instead, and
// so does a level whose total is above the top band (Premium can need one while Basic does not).
function quote(pricing, farms) {
  const answer = { version: pricing.version, currency: pricing.currency };
  if (farms.length > pricing.inApp.maxFarms || !farms.every((f) => fitsInApp(pricing, f))) {
    return { ...answer, needsContract: true, levels: null };
  }
  const levels = {};
  for (const level of LEVELS) {
    const band = bandFor(pricing, monthlyTotal(pricing, farms, level));
    if (band === null) {
      levels[level] = { needsContract: true };
      continue;
    }
    const month = bandPrice(pricing, band, 'month');
    const year = bandPrice(pricing, band, 'year');
    levels[level] = {
      needsContract: false, band, month, year,
      productIds: { m: productId(level, 'm', band), y: year === null ? null : productId(level, 'y', band) },
    };
  }
  return { ...answer, needsContract: LEVELS.every((l) => levels[l].needsContract), levels };
}

// Every band is one product in both stores, priced in USD; each store makes the other countries'
// prices from it and adds their VAT. Google Play takes any price; Apple only takes fixed steps:
// $0.50 up to $50, $1 up to $200, $5 up to $500, $10 above. So every band price is on Apple's steps,
// and the same list works in both stores.
function storeStep(usd) {
  return usd <= 50 ? 0.5 : usd <= 200 ? 1 : usd <= 500 ? 5 : 10;
}

function isStorePrice(usd) {
  const n = usd / storeStep(usd);
  return usd > 0 && Math.abs(n - Math.round(n)) < 1e-9;
}

// The nearest price on Apple's steps (half way: the one above, as bands round up).
function nearestStorePrice(usd) {
  const step = storeStep(usd);
  const below = Math.floor(usd / step + 1e-9) * step;
  const above = below + step;
  return isStorePrice(below) && usd - below < above - usd ? below : isStorePrice(above) ? above : below;
}

// What is wrong with pricing/current's bands for the stores: one line per problem, or none.
function storePriceProblems(current) {
  const problems = [];
  let last = 0;
  for (const b of current.bands || []) {
    if (!(Number(b.month) > last)) problems.push(`band ${b.band}: not dearer than the band before`);
    for (const period of ['month', 'year']) {
      if (b[period] != null && !isStorePrice(Number(b[period]))) problems.push(`band ${b.band}: ${period} $${b[period]} is not an Apple price step`);
    }
    last = Number(b.month);
  }
  return problems;
}

module.exports = {
  LEVELS, loadPricing, monthlyTotal, bandFor, fitsInApp, bandPrice, parseProductId, productId, quote,
  isStorePrice, nearestStorePrice, storePriceProblems,
};
