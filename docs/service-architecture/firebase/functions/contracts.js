// Contract farms: Wafra links them to their owner, not the app.
//
// Staff add a contract's farms in contractFarms/{phone}, by the owner's phone number. As soon as
// that person has an account (or as soon as the entry is added, if they already have one), the
// farms are created for them on the contract. Each farm's document ID comes from the contract
// and the entry, so running this twice creates nothing twice.
//
// How a contract farm is measured depends on the contract. An entry with a `providerFarmId` was
// surveyed apart (by the provider, for that client): its size is taken as given, and no survey
// is sent. Without one, the farm is surveyed like any other.
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { logger } = require('firebase-functions/v2');
const provider = require('./providers/mmc');

const isPoint = (p) => p && typeof p.lat === 'number' && typeof p.lon === 'number';
const isRing = (r) => Array.isArray(r) && r.length >= 3 && r.every(isPoint);

// An entry's farm as a farms/{farmId} document. Its fields are the entry's fields, or the whole
// outline as one field when the client gave none.
function farmFrom(entry, f, ownerUid) {
  const fields = Array.isArray(f.fields) && f.fields.length
    ? f.fields.map((x, i) => ({ id: x.id || `f${i + 1}`, number: i + 1, kind: x.kind, crop: x.crop || null, points: x.points }))
    : [{ id: 'f1', number: 1, kind: (f.treeCount || 0) > 0 ? 'trees' : 'crops', crop: null, points: f.boundary }];
  const kinds = new Set(fields.map((x) => x.kind));
  const farm = {
    ownerUid,
    name: f.name,
    nameAr: f.nameAr || null,
    type: kinds.size > 1 ? 'mixed' : [...kinds][0],
    country: f.country || null,
    region: f.region || null,
    location: f.location || null,
    boundary: { points: f.boundary, fields, areaHa: f.areaHa || null, version: 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'contract' },
    fieldNames: {},
    contractId: entry.contractId,
    adviceRules: { auto: false, byType: {} },
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (f.providerFarmId) {
    Object.assign(farm, {
      provider: provider.name,
      providerFarmId: f.providerFarmId,
      surveyStatus: 'done',
      surveyedBoundaryVersion: 1,
      cropAreaHa: f.cropAreaHa || 0,
      treeCount: f.treeCount || 0,
      sizeUpdatedAt: FieldValue.serverTimestamp(),
    });
  }
  return farm;
}

// Creates the farms of one contractFarms entry for its owner, if they have an account.
async function linkContractFarms(phone) {
  const db = getFirestore();
  const snap = await db.doc(`contractFarms/${phone}`).get();
  if (!snap.exists) return;
  const entry = snap.data();
  let ownerUid;
  try {
    ownerUid = (await getAuth().getUserByPhoneNumber(phone)).uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') return; // linked when they sign up
    throw err;
  }
  const farms = Array.isArray(entry.farms) ? entry.farms : [];
  let created = 0;
  for (const [i, f] of farms.entries()) {
    if (!f || !f.name || !isRing(f.boundary)) {
      logger.error('contract farm skipped: needs a name and a boundary', { contractId: entry.contractId, index: i });
      continue;
    }
    const ref = db.doc(`farms/c_${entry.contractId}_${f.id || i + 1}`);
    try {
      await ref.create(farmFrom(entry, f, ownerUid));
      created += 1;
    } catch (err) {
      if (err.code !== 6) throw err; // ALREADY_EXISTS: linked before
    }
  }
  logger.info('contract farms linked', { contractId: entry.contractId, farms: farms.length, created });
}

module.exports = { farmFrom, linkContractFarms };
