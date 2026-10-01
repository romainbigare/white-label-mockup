// The logic behind keepActiveFarms (see index.js), kept apart so it can be tested on its own.
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions/v2');
const { farmMonthlyPrice, levelMonthlyPrice, parseProductId } = require('./pricing');

const DAY = 24 * 3600 * 1000;
const GRACE_DAYS = 14;

// Dates arrive as Firestore Timestamps, ISO strings or milliseconds, depending on who wrote them.
function ms(value) {
  if (value == null) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// The owner's active in-app purchase, from RevenueCat's copy in customers/{uid}:
// { tier, level, changedAt } or null. RevenueCat's extension writes dates as ISO strings, an
// `entitlements` map keyed by entitlement and a `subscriptions` map keyed by product ID.
// Professional wins if both are somehow active.
function activePurchase(customer, now) {
  if (!customer) return null;
  const live = (x) => {
    const expires = ms(x.expires_date);
    return expires === null || Math.max(expires, ms(x.grace_period_expires_date) || 0) > now;
  };
  const entitlements = customer.entitlements || {};
  const subscriptions = Object.entries(customer.subscriptions || {})
    .map(([id, sub]) => ({ product: parseProductId(id), sub }))
    .filter((x) => x.product && live(x.sub));
  for (const tier of ['professional', 'advanced']) {
    const e = entitlements[tier];
    if (!e || !live(e)) continue;
    const named = parseProductId(e.product_identifier);
    const sub = subscriptions.find((x) => x.product.tier === tier && (!named || x.product.level === named.level));
    const product = named || (sub && sub.product);
    if (!product) continue;
    return { tier, level: product.level, changedAt: ms((sub && sub.sub.purchase_date) || e.purchase_date) || 0 };
  }
  return null;
}

function contractActive(contract, now) {
  if (!contract || contract.status !== 'active') return false;
  const starts = ms(contract.startsAt);
  const ends = ms(contract.endsAt);
  return (starts === null || starts <= now) && (ends === null || ends > now);
}

async function recomputeOwner(ownerUid) {
  if (!ownerUid) return;
  const db = getFirestore();
  const now = Date.now();
  const [farmsSnap, customerSnap, pricingSnap] = await Promise.all([
    db.collection('farms').where('ownerUid', '==', ownerUid).get(),
    db.doc(`customers/${ownerUid}`).get(),
    db.doc('pricing/current').get(),
  ]);
  const farms = farmsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const live = farms.filter((f) => f.status === 'active' && f.mmcFarmId);
  const decided = new Map(); // farmId -> { tier, graceUntil }

  // 1. Contract farms.
  const contractIds = [...new Set(live.map((f) => f.contractId).filter(Boolean))];
  const contracts = new Map(await Promise.all(
    contractIds.map(async (id) => [id, (await db.doc(`contracts/${id}`).get()).data()])));
  for (const f of live) {
    if (f.contractId && contractActive(contracts.get(f.contractId), now)) {
      decided.set(f.id, { tier: contracts.get(f.contractId).tier, graceUntil: null });
    }
  }

  // 2. Farms paid in the app: covered oldest first, up to the paid level's price.
  const purchase = activePurchase(customerSnap.exists ? customerSnap.data() : null, now);
  if (purchase && pricingSnap.exists) {
    const pricing = pricingSnap.data();
    const own = live.filter((f) => !f.contractId).sort((a, b) => (ms(a.createdAt) || 0) - (ms(b.createdAt) || 0));
    const paid = levelMonthlyPrice(pricing, purchase.level);
    const graceStart = Math.max(purchase.changedAt, ...own.map((f) => ms(f.sizeUpdatedAt) || 0));
    let total = 0;
    for (const f of own) {
      total += farmMonthlyPrice(pricing, f, purchase.tier);
      const covered = total <= paid + 1e-9;
      decided.set(f.id, { tier: purchase.tier, graceUntil: covered ? null : graceStart + GRACE_DAYS * DAY });
    }
  }

  // 3. Write the list: on for farms that are paid (or still in grace), off for every other farm.
  const existing = new Map((await Promise.all(farms.map((f) => db.doc(`activeFarms/${f.id}`).get())))
    .map((s) => [s.id, s]));
  const batch = db.batch();
  let on = 0;
  for (const f of farms) {
    const d = decided.get(f.id);
    const ref = db.doc(`activeFarms/${f.id}`);
    if (d && (d.graceUntil === null || d.graceUntil > now)) {
      const before = existing.get(f.id);
      batch.set(ref, {
        mmcFarmId: f.mmcFarmId,
        tier: d.tier,
        since: before.exists ? before.get('since') : FieldValue.serverTimestamp(),
        graceUntil: d.graceUntil === null ? null : Timestamp.fromMillis(d.graceUntil),
        updatedAt: FieldValue.serverTimestamp(),
      });
      on += 1;
    } else if (existing.get(f.id).exists) {
      batch.delete(ref);
    }
  }
  await batch.commit();
  logger.info('keepActiveFarms', { ownerUid, farms: farms.length, active: on });
}

async function recomputeOwners(ownerUids) {
  for (const uid of new Set(ownerUids)) await recomputeOwner(uid);
}

async function allOwners() {
  const db = getFirestore();
  const snap = await db.collection('farms').select('ownerUid').get();
  return snap.docs.map((d) => d.get('ownerUid'));
}

module.exports = { ms, activePurchase, contractActive, recomputeOwner, recomputeOwners, allOwners };
