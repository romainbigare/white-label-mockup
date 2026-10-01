// Wafra's pricing rules, in one place. The app uses the same code to show prices;
// keepActiveFarms uses it to decide which farms the owner's paid level covers.
// Every number comes from Firestore pricing/current; nothing is hard-coded here.

const num = (x) => Number(x);

// The band a value falls in: the first band whose `upTo` is at least the value.
function bandFor(bands, value) {
  return bands.find((b) => value <= b.upTo) || null;
}

// Monthly price of one farm at a tier ('advanced' or 'professional'), or Infinity when the farm is
// bigger than the in-app bands allow (it then needs a contract).
function farmMonthlyPrice(pricing, farm, tier) {
  let total = 0;
  if (farm.cropAreaHa > 0) {
    const b = bandFor(pricing.crop.bands, farm.cropAreaHa);
    if (!b) return Infinity;
    total += num(b[tier].month);
  }
  if (farm.treeCount > 0) {
    const b = bandFor(pricing.trees.bands, farm.treeCount);
    if (!b) return Infinity;
    total += num(b[tier].month);
  }
  return total;
}

// The price level (product) a monthly total needs: the cheapest level at or above it, or null.
function levelFor(pricing, monthlyTotal) {
  const s = pricing.steps.find((x) => num(x.month) >= monthlyTotal - 1e-9);
  return s ? s.step : null;
}

function levelMonthlyPrice(pricing, level) {
  const s = pricing.steps.find((x) => x.step === level);
  return s ? num(s.month) : 0;
}

// Store product IDs look like wafra_adv_m_032: tier, period (m/y), level.
function parseProductId(id) {
  const m = /^wafra_(adv|pro)_([my])_(\d{3})$/.exec(id || '');
  if (!m) return null;
  return { tier: m[1] === 'adv' ? 'advanced' : 'professional', period: m[2], level: Number(m[3]) };
}

function productId(tier, period, level) {
  return `wafra_${tier === 'advanced' ? 'adv' : 'pro'}_${period}_${String(level).padStart(3, '0')}`;
}

module.exports = { bandFor, farmMonthlyPrice, levelFor, levelMonthlyPrice, parseProductId, productId };
