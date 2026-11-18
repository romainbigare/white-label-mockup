// Invitations to a farm: createFarmInvitation, cancelFarmInvitation, redeemFarmInvitation.
//
// The owner or a co-owner invites one phone number, as co-owner or supervisor. The function gives
// back a 6-digit code (to type on A21) and a 128-bit token (for a link or a QR code); only their
// hashes are stored. The person invited must be signed in with that phone number to join. An
// invitation lasts 72 hours and works once. Only these functions write `invites` and create
// `farmAccess`: the rules refuse the app.
//
// Seats: a plan lets in so many people besides the owner (`pricing/current.inApp.additionalUsers`,
// per level), or a contract's `additionalUsers`. They are counted per owner: the different people
// with active access on any of the owner's farms, plus the open invitations.
const crypto = require('crypto');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { loadPricing } = require('./pricing');
const { contractActive } = require('./keeper');
const { alertStaff } = require('./provider-sync');

const HOURS = 3600 * 1000;
const VALID_HOURS = 72;
const ROLES = ['co-owner', 'supervisor'];
const MAX_CREATED_PER_DAY = 20;
const MAX_WRONG_PER_HOUR = 5;
const E164 = /^\+[1-9]\d{6,14}$/;

const hash = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);

function signedIn(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

async function farmOf(db, farmId) {
  if (typeof farmId !== 'string' || !farmId) throw new HttpsError('invalid-argument', 'farmId is needed.');
  const snap = await db.doc(`farms/${farmId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such farm.');
  return snap.data();
}

// The caller's role on a farm: owner, co-owner, supervisor, or null.
async function roleOn(db, uid, farmId, farm) {
  if (farm.ownerUid === uid) return 'owner';
  const access = await db.doc(`farmAccess/${uid}_${farmId}`).get();
  return access.exists && access.get('status') === 'active' ? access.get('role') : null;
}

// How many people besides the owner this farm's plan lets in, or null when the farm is not active
// (not paid, read-only or archived): then nobody new may join.
async function seatLimit(db, farmId, farm) {
  if (farm.status !== 'active') return null;
  const pricing = await loadPricing(db);
  const defaults = (pricing && pricing.inApp && pricing.inApp.additionalUsers) || null;
  if (!defaults) throw new HttpsError('unavailable', 'Seat limits are not set. Try again later.');
  if (farm.contractId) {
    const contract = (await db.doc(`contracts/${farm.contractId}`).get()).data();
    if (!contractActive(contract, Date.now())) return null;
    return contract.additionalUsers ?? defaults[contract.level] ?? null;
  }
  const service = await db.doc(`farmService/${farmId}`).get();
  if (!service.exists || service.get('status') !== 'active') return null;
  return defaults[service.get('level')] ?? null;
}

// The seats an owner uses: the people with active access on any of their farms, and the open
// invitations. `except` leaves one person out ({ uid, phone }): someone rejoining, or invited again.
async function seatsUsed(db, ownerUid, except = {}, tx = null) {
  const get = (q) => (tx ? tx.get(q) : q.get());
  const [access, open] = await Promise.all([
    get(db.collection('farmAccess').where('ownerUid', '==', ownerUid).where('status', '==', 'active')),
    get(db.collection('invites').where('ownerUid', '==', ownerUid).where('status', '==', 'open')),
  ]);
  const people = new Set(access.docs.map((d) => d.get('uid')).filter((u) => u !== except.uid));
  const now = Date.now();
  const phones = new Set(open.docs.filter((d) => ms(d.get('expiresAt')) > now && d.get('phone') !== except.phone)
    .map((d) => d.get('phone')));
  return people.size + phones.size;
}

// A 6-digit code no open invitation has.
async function newCode(db) {
  for (let i = 0; i < 10; i += 1) {
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    const taken = await db.collection('invites').where('codeHash', '==', hash(code)).where('status', '==', 'open').limit(1).get();
    if (taken.empty) return code;
  }
  throw new HttpsError('unavailable', 'Try again.');
}

// createFarmInvitation({ farmId, role, phone }) -> { inviteId, code, token, expiresAt }
async function createFarmInvitation(req) {
  const uid = signedIn(req);
  const { farmId, role, phone } = req.data || {};
  if (!ROLES.includes(role)) throw new HttpsError('invalid-argument', 'role is co-owner or supervisor.');
  if (typeof phone !== 'string' || !E164.test(phone)) throw new HttpsError('invalid-argument', 'phone is a number in E.164 form, like +9665…');
  const db = getFirestore();
  const farm = await farmOf(db, farmId);
  const mine = await roleOn(db, uid, farmId, farm);
  if (!['owner', 'co-owner'].includes(mine)) throw new HttpsError('permission-denied', 'Only the owner or a co-owner invites.');
  if (phone === req.auth.token.phone_number) throw new HttpsError('failed-precondition', 'already-member');

  const created = await db.collection('invites').where('createdBy', '==', uid)
    .where('createdAt', '>', Timestamp.fromMillis(Date.now() - 24 * HOURS)).count().get();
  if (created.data().count >= MAX_CREATED_PER_DAY) {
    alertStaff('invites-too-many', { uid });
    throw new HttpsError('resource-exhausted', 'Too many invitations today.');
  }

  const limit = await seatLimit(db, farmId, farm);
  if (limit === null) throw new HttpsError('failed-precondition', 'farm-not-active');
  if (await seatsUsed(db, farm.ownerUid, { phone }) >= limit) throw new HttpsError('resource-exhausted', 'no-seat');

  const code = await newCode(db);
  const token = crypto.randomBytes(16).toString('base64url');
  const expiresAt = Timestamp.fromMillis(Date.now() + VALID_HOURS * HOURS);
  const ref = db.collection('invites').doc();
  await ref.set({
    farmId, ownerUid: farm.ownerUid, role, phone, codeHash: hash(code), tokenHash: hash(token),
    status: 'open', createdBy: uid, createdAt: FieldValue.serverTimestamp(), expiresAt,
  });
  return { inviteId: ref.id, code, token, expiresAt: expiresAt.toMillis() };
}

// cancelFarmInvitation({ inviteId }) -> { ok: true }
async function cancelFarmInvitation(req) {
  const uid = signedIn(req);
  const inviteId = req.data && req.data.inviteId;
  if (typeof inviteId !== 'string' || !inviteId) throw new HttpsError('invalid-argument', 'inviteId is needed.');
  const db = getFirestore();
  const ref = db.doc(`invites/${inviteId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'No such invitation.');
  const invite = snap.data();
  const farm = await farmOf(db, invite.farmId);
  const mine = await roleOn(db, uid, invite.farmId, farm);
  if (invite.createdBy !== uid && !['owner', 'co-owner'].includes(mine)) throw new HttpsError('permission-denied', 'Not yours to cancel.');
  if (invite.status === 'open') await ref.update({ status: 'cancelled', cancelledBy: uid, cancelledAt: FieldValue.serverTimestamp() });
  return { ok: true };
}

// Wrong tries per person: at most MAX_WRONG_PER_HOUR an hour.
async function tooManyWrong(db, uid) {
  const snap = await db.doc(`inviteAttempts/${uid}`).get();
  return snap.exists && Date.now() - ms(snap.get('windowStart')) < HOURS && (snap.get('wrong') || 0) >= MAX_WRONG_PER_HOUR;
}

async function countWrong(db, uid) {
  const ref = db.doc(`inviteAttempts/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fresh = !snap.exists || Date.now() - ms(snap.get('windowStart')) >= HOURS;
    const wrong = fresh ? 1 : (snap.get('wrong') || 0) + 1;
    tx.set(ref, { windowStart: fresh ? Timestamp.now() : snap.get('windowStart'), wrong });
    if (wrong === MAX_WRONG_PER_HOUR) alertStaff('invite-wrong-codes', { uid });
  });
}

// redeemFarmInvitation({ code } or { token }) -> { farmId, role }
// Wrong, expired, used, cancelled, or for another phone number: one answer, `not-found`.
async function redeemFarmInvitation(req) {
  const uid = signedIn(req);
  const { code, token } = req.data || {};
  const db = getFirestore();
  if (await tooManyWrong(db, uid)) throw new HttpsError('resource-exhausted', 'Too many tries. Try again in an hour.');
  let field;
  let value;
  if (typeof code === 'string' && /^\d{6}$/.test(code)) [field, value] = ['codeHash', hash(code)];
  else if (typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)) [field, value] = ['tokenHash', hash(token)];
  else throw new HttpsError('invalid-argument', 'A 6-digit code or a token is needed.');

  const phone = req.auth.token.phone_number;
  const found = await db.collection('invites').where(field, '==', value).where('status', '==', 'open').limit(5).get();
  const match = found.docs.find((d) => d.get('phone') === phone && ms(d.get('expiresAt')) > Date.now());
  if (!match) {
    await countWrong(db, uid);
    throw new HttpsError('not-found', 'invite-not-found');
  }
  const invite = match.data();
  const farm = await farmOf(db, invite.farmId);
  if (farm.ownerUid === uid) throw new HttpsError('failed-precondition', 'already-member');
  const limit = await seatLimit(db, invite.farmId, farm);
  if (limit === null) throw new HttpsError('failed-precondition', 'farm-not-active');

  const accessRef = db.doc(`farmAccess/${uid}_${invite.farmId}`);
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(match.ref);
    if (fresh.get('status') !== 'open') throw new HttpsError('not-found', 'invite-not-found');
    // Everyone else's seats: this person's own invitation, or own access, is theirs already.
    if (await seatsUsed(db, farm.ownerUid, { phone, uid }, tx) >= limit) throw new HttpsError('failed-precondition', 'no-seat');
    // A revoked person rejoins: the same record, active again, with the new role.
    tx.set(accessRef, {
      uid, farmId: invite.farmId, ownerUid: farm.ownerUid, role: invite.role, status: 'active',
      inviteCode: match.id, grantedBy: invite.createdBy, grantedAt: FieldValue.serverTimestamp(), revokedAt: null,
    });
    tx.update(match.ref, { status: 'used', usedBy: uid, usedAt: FieldValue.serverTimestamp() });
  });
  logger.info('invitation used', { farmId: invite.farmId, role: invite.role });
  return { farmId: invite.farmId, role: invite.role };
}

module.exports = { createFarmInvitation, cancelFarmInvitation, redeemFarmInvitation, seatsUsed, hash };
