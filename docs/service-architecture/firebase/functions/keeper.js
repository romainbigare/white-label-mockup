// The logic behind keepActiveFarms (see index.js), kept apart so it can be tested on its own.
//
// It keeps farmService right: one record per measured farm, saying whether it is `active`
// (paid, by contract or in the app), `readonly` (not paid) or `removed` (archived). The record
// is never deleted, and it is written only when something in it really changes: each write is
// pushed to the provider (provider-sync.js), and its `version` goes up by one.
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions/v2');
const { loadPricing, monthlyTotal, bandFor, fitsInApp, parseProductId } = require('./pricing');

const DAY = 24 * 3600 * 1000;
const GRACE_DAYS = 14;
// A farm read-only this long is archived: removed for its people, and for the provider.
const READONLY_DAYS = 365;

// Dates arrive as Firestore Timestamps, ISO strings or milliseconds, depending on who wrote them.
function ms(value) {
  if (value == null) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// The owner's active in-app purchase, from RevenueCat's copy in customers/{uid}:
// { level, band, changedAt } or null. revenueCatWebhook saves RevenueCat's v1 subscriber object: dates as ISO strings, an
// `entitlements` map keyed by entitlement and a `subscriptions` map keyed by product ID.
// Premium wins if both are somehow active. A trial is an active entitlement like any other.
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
  for (const level of ['premium', 'basic']) {
    const e = entitlements[level];
    if (!e || !live(e)) continue;
    const named = parseProductId(e.product_identifier);
    const sub = subscriptions.find((x) => x.product.level === level && (!named || x.product.band === named.band));
    const product = named || (sub && sub.product);
    if (!product) continue;
    return { level, band: product.band, changedAt: ms((sub && sub.sub.purchase_date) || e.purchase_date) || 0 };
  }
  return null;
}

function contractActive(contract, now) {
  if (!contract || contract.status !== 'active') return false;
  const starts = ms(contract.startsAt);
  const ends = ms(contract.endsAt);
  return (starts === null || starts <= now) && (ends === null || ends > now);
}

// What the provider computes for a farm follows what is on it.
function servicesOf(farm) {
  const services = [];
  if ((Number(farm.cropAreaHa) || 0) > 0) services.push('crops');
  if ((Number(farm.treeCount) || 0) > 0) services.push('trees');
  return services;
}

// The farms an owner pays for in the app, oldest first: measured by the provider, not archived,
// not on a contract. quotePrice prices the same farms, so the band it sells is the band checked here.
function inAppFarms(farms) {
  return farms.filter((f) => f.providerFarmId && f.status === 'active' && !f.contractId)
    .sort((a, b) => (ms(a.createdAt) || 0) - (ms(b.createdAt) || 0));
}

// The fields of a farmService record that, when they change, make a new version.
function sameRecord(a, b) {
  return a.providerFarmId === b.providerFarmId && a.provider === b.provider
    && a.status === b.status && a.level === b.level
    && a.services.join() === (b.services || []).join()
    && a.boundaryVersion === (b.boundaryVersion ?? null)
    && ms(a.graceUntil) === ms(b.graceUntil);
}

async function recomputeOwner(ownerUid) {
  if (!ownerUid) return;
  const db = getFirestore();
  const now = Date.now();
  const [farmsSnap, customerSnap, pricing] = await Promise.all([
    db.collection('farms').where('ownerUid', '==', ownerUid).get(),
    db.doc(`customers/${ownerUid}`).get(),
    loadPricing(db),
  ]);
  // Only farms the provider has measured have a farmService record.
  const farms = farmsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((f) => f.providerFarmId);
  const live = farms.filter((f) => f.status === 'active');
  const decided = new Map(); // farmId -> { level, graceUntil }

  // 1. Contract farms.
  const contractIds = [...new Set(live.map((f) => f.contractId).filter(Boolean))];
  const contracts = new Map(await Promise.all(
    contractIds.map(async (id) => [id, (await db.doc(`contracts/${id}`).get()).data()])));
  for (const f of live) {
    if (f.contractId && contractActive(contracts.get(f.contractId), now)) {
      decided.set(f.id, { level: contracts.get(f.contractId).level, graceUntil: null });
    }
  }

  // 2. Farms paid in the app: covered oldest first, while the band of the farms so far (crops per
  // hectare + trees per tree) is at or below the paid band. Bands round up, so the owner pays more
  // than the dollar total; comparing bands (not dollars) is what decides. Above the top band there is
  // no band: those farms need a contract.
  //
  // Without the whole price table nothing can be checked, so nothing is written: paid farms must not
  // turn read-only while staff are filling it in.
  const purchase = activePurchase(customerSnap.exists ? customerSnap.data() : null, now);
  if (purchase && !pricing) {
    logger.error('keepActiveFarms: pricing/current or pricing/rates is missing; nothing written', { ownerUid });
    return;
  }
  if (purchase) {
    const own = inAppFarms(farms);
    const graceStart = Math.max(purchase.changedAt, ...own.map((f) => ms(f.sizeUpdatedAt) || 0));
    const soFar = [];
    for (const f of own) {
      soFar.push(f);
      const band = bandFor(pricing, monthlyTotal(pricing, soFar, purchase.level));
      const covered = fitsInApp(pricing, f) && band !== null && band <= purchase.band;
      decided.set(f.id, { level: purchase.level, graceUntil: covered ? null : graceStart + GRACE_DAYS * DAY });
    }
  }

  // 3. Write farmService: active for farms that are paid (or still in grace), readonly for the
  // other measured farms, removed for archived ones. Unchanged records are not written.
  const existing = new Map((await Promise.all(farms.map((f) => db.doc(`farmService/${f.id}`).get())))
    .map((s) => [s.id, s]));
  const batch = db.batch();
  let on = 0;
  let writes = 0;
  for (const f of farms) {
    const before = existing.get(f.id);
    const old = before.exists ? before.data() : null;
    const d = decided.get(f.id);
    const active = d && (d.graceUntil === null || d.graceUntil > now);
    const record = {
      providerFarmId: f.providerFarmId,
      provider: f.provider || null,
      status: f.status !== 'active' ? 'removed' : active ? 'active' : 'readonly',
      level: (d && d.level) || (old && old.level) || null,
      services: servicesOf(f),
      boundaryVersion: f.surveyedBoundaryVersion ?? null,
      graceUntil: active && d.graceUntil !== null ? Timestamp.fromMillis(d.graceUntil) : null,
    };
    if (record.status === 'active') on += 1;
    if (old && sameRecord(record, old)) continue;
    const becameActive = record.status === 'active' && (!old || old.status !== 'active');
    const stillReadonly = record.status === 'readonly' && old && old.status === 'readonly';
    batch.set(db.doc(`farmService/${f.id}`), {
      ...record,
      since: becameActive ? FieldValue.serverTimestamp() : (old && old.since) || null,
      readonlySince: record.status !== 'readonly' ? null
        : stillReadonly && old.readonlySince ? old.readonlySince : Timestamp.fromMillis(now),
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writes += 1;
  }
  if (writes) await batch.commit();
  logger.info('keepActiveFarms', { ownerUid, farms: farms.length, active: on, written: writes });
}

// A farm that no longer exists (deleted by staff): its record stays, marked removed.
async function markRemoved(farmId) {
  const ref = getFirestore().doc(`farmService/${farmId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('status') === 'removed') return;
  await ref.set({
    status: 'removed', graceUntil: null,
    version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// Every day: farms read-only for 12 months are archived. The farm's own write then marks its
// record removed, and the provider gets farm.removed.
async function archiveStaleReadonly() {
  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - READONLY_DAYS * DAY);
  const snap = await db.collection('farmService').where('status', '==', 'readonly')
    .where('readonlySince', '<=', cutoff).get();
  for (const d of snap.docs) {
    const ref = db.doc(`farms/${d.id}`);
    const farm = await ref.get();
    if (!farm.exists || farm.get('status') !== 'active') continue;
    await ref.update({ status: 'archived', archivedAt: FieldValue.serverTimestamp(), archivedReason: 'readonly-12-months' });
    logger.info('farm archived after 12 months read-only', { farmId: d.id });
  }
}

async function recomputeOwners(ownerUids) {
  for (const uid of new Set(ownerUids)) await recomputeOwner(uid);
}

async function allOwners() {
  const db = getFirestore();
  const snap = await db.collection('farms').select('ownerUid').get();
  return snap.docs.map((d) => d.get('ownerUid'));
}

module.exports = {
  ms, activePurchase, contractActive, servicesOf, inAppFarms, recomputeOwner, recomputeOwners, markRemoved, allOwners,
  archiveStaleReadonly,
};
