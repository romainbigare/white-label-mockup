// Wafra's pricing rules, in one place. The app uses the same rules to show prices;
// keepActiveFarms uses them to decide which farms the owner's paid band covers.
// Every number comes from Firestore pricing/current; nothing is hard-coded here.
//
// Two levels (basic, premium), one list of bands. A farm's size score is its hectares plus its
// trees counted as hectares; the owner's farms are added up and the total is ROUNDED DOWN to a
// band. A total below the first band pays the first band (the minimum bill).

const LEVELS = ['basic', 'premium'];

// Size score of one farm.
function farmScore(pricing, farm) {
  const ha = Number(farm.cropAreaHa) || 0;
  const trees = Number(farm.treeCount) || 0;
  return ha + trees / Number(pricing.size.treesPerHectare);
}

// Size score of several farms, added up.
function sizeScore(pricing, farms) {
  return farms.reduce((total, farm) => total + farmScore(pricing, farm), 0);
}

// The band a score is billed at: the highest band whose `from` is at or below the score.
// `bands` is sorted by `from`; below the first band, the first band.
function bandFor(pricing, score) {
  let band = pricing.bands[0];
  for (const b of pricing.bands) if (Number(b.from) <= score + 1e-9) band = b;
  return band.band;
}

// Whether one farm fits the in-app limits. A farm that does not needs a contract.
function fitsInApp(pricing, farm) {
  const limits = pricing.inApp;
  return (Number(farm.cropAreaHa) || 0) <= limits.maxHaPerFarm
    && (Number(farm.treeCount) || 0) <= limits.maxTreesPerFarm;
}

// The price of a band at a level, for a period ('month' or 'year'); null when there is none.
function bandPrice(pricing, band, level, period) {
  const b = pricing.bands.find((x) => x.band === band);
  const price = b && b[level] && b[level][period];
  return price == null ? null : Number(price);
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

module.exports = { LEVELS, farmScore, sizeScore, bandFor, fitsInApp, bandPrice, parseProductId, productId };
