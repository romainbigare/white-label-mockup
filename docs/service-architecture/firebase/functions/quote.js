// quotePrice: the band and price the app shows on its plan screens, for the caller's own farms.
//
// The app never sees the rates (pricing/rates is staff only): with them, anyone could work out
// Wafra's margin over the provider's rates. So the app sends what only it knows, the farms the
// person is drawing and that nobody has measured yet, and this adds the farms they already pay for
// in the app, as keepActiveFarms counts them. The answer is the band per level, never a rate or a
// dollar total, and only within the in-app limits.
const { getFirestore } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { loadPricing, quote } = require('./pricing');
const { inAppFarms } = require('./keeper');

const MAX_DRAFTS = 10;

// The farms not made yet, from the app: [{ cropAreaHa, treeCount }], both numbers at or above 0.
function draftFarms(add) {
  if (add == null) return [];
  if (!Array.isArray(add) || add.length > MAX_DRAFTS) {
    throw new HttpsError('invalid-argument', `"add" is a list of at most ${MAX_DRAFTS} farms.`);
  }
  return add.map((f) => {
    const farm = f && typeof f === 'object' ? { cropAreaHa: Number(f.cropAreaHa ?? 0), treeCount: Number(f.treeCount ?? 0) } : {};
    if (!(farm.cropAreaHa >= 0 && farm.treeCount >= 0 && Number.isFinite(farm.cropAreaHa + farm.treeCount))) {
      throw new HttpsError('invalid-argument', 'Each farm needs cropAreaHa and treeCount, 0 or more.');
    }
    return farm;
  });
}

async function quotePrice(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const drafts = draftFarms(req.data && req.data.add);
  const db = getFirestore();
  const [pricing, farmsSnap] = await Promise.all([
    loadPricing(db),
    db.collection('farms').where('ownerUid', '==', req.auth.uid).get(),
  ]);
  if (!pricing) throw new HttpsError('unavailable', 'Prices are not ready. Try again later.');
  const own = inAppFarms(farmsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  return quote(pricing, [...own, ...drafts]);
}

module.exports = { draftFarms, quotePrice };
