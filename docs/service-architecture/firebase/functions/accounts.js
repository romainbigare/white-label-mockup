// Closing an account: deleteAccount (the app) and purgeClosedAccounts (every day).
//
// Two steps, so a mistake can be undone:
//   1. deleteAccount, at once: the person can no longer sign in (Auth disabled, sessions revoked),
//      their farms are archived (the provider gets farm.removed and hides them), and
//      accountDeletions/{uid} records the request. Their data stays, for 30 days.
//   2. purgeClosedAccounts, 30 days later: their roles are revoked, their open invitations
//      cancelled, their profile, devices and purchases copy deleted, the RevenueCat customer deleted,
//      their feedback made anonymous, the provider told (`user.deleted`, by code name), and last the
//      sign-in account deleted. What is left: accountDeletions/{uid} with the dates only.
// Before step 2, Wafra staff can restore the account (docs/runbooks/accounts.md).
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const provider = require('./providers/mmc');
const { codeName } = require('./pass');
const { sendNew, alertStaff } = require('./provider-sync');
const revenuecat = require('./revenuecat');

const DAY = 24 * 3600 * 1000;
const KEEP_DAYS = 30;
// The person must have proved their phone number (SMS code) this recently.
const RECENT_LOGIN_SECONDS = 5 * 60;

// deleteAccount({ confirm: true }) -> { ok: true, deleteAfter }
async function deleteAccount(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!req.data || req.data.confirm !== true) throw new HttpsError('invalid-argument', 'confirm: true is needed.');
  const authTime = Number(req.auth.token.auth_time) || 0;
  if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) throw new HttpsError('failed-precondition', 'recent-login-required');
  const uid = req.auth.uid;
  const db = getFirestore();
  const deleteAfter = Timestamp.fromMillis(Date.now() + KEEP_DAYS * DAY);

  await db.doc(`accountDeletions/${uid}`).set({
    status: 'closed', requestedAt: FieldValue.serverTimestamp(), deleteAfter, archivedFarms: [],
  });
  await getAuth().updateUser(uid, { disabled: true });
  await getAuth().revokeRefreshTokens(uid);

  const farms = await db.collection('farms').where('ownerUid', '==', uid).where('status', '==', 'active').get();
  for (const f of farms.docs) {
    await f.ref.update({ status: 'archived', archivedAt: FieldValue.serverTimestamp(), archivedReason: 'account-closed' });
    if (f.get('contractId')) alertStaff('contract-owner-closed-account', { farmId: f.id, contractId: f.get('contractId') });
  }
  await db.doc(`accountDeletions/${uid}`).update({ archivedFarms: farms.docs.map((d) => d.id) });
  logger.info('account closed', { farms: farms.size });
  return { ok: true, deleteAfter: deleteAfter.toMillis() };
}

async function deleteAll(query) {
  const snap = await query.get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = getFirestore().batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// RevenueCat forgets the customer (API v1, the key the webhook uses). Not found is fine.
async function deleteRevenueCatCustomer(uid) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${revenuecat.API_KEY.value()}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`RevenueCat answered ${res.status} to a delete`);
}

// Step 2 for one person. Each part can run again safely.
async function purgeOne(uid) {
  const db = getFirestore();
  const access = await db.collection('farmAccess').where('uid', '==', uid).where('status', '==', 'active').get();
  for (const a of access.docs) await a.ref.update({ status: 'revoked', revokedAt: FieldValue.serverTimestamp() });
  const invites = await db.collection('invites').where('createdBy', '==', uid).where('status', '==', 'open').get();
  for (const i of invites.docs) await i.ref.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
  const feedback = await db.collection('feedback').where('uid', '==', uid).get();
  for (const f of feedback.docs) await f.ref.update({ uid: null });
  await deleteAll(db.collection(`users/${uid}/devices`));
  await deleteAll(db.collection(`users/${uid}/heldPush`));
  await db.doc(`users/${uid}`).delete();
  await deleteAll(db.collection(`customers/${uid}`));
  await db.doc(`customers/${uid}`).delete();
  await deleteRevenueCatCustomer(uid);
  await sendNew({ id: `user-deleted-${codeName(uid, provider.subSecret.value())}`, type: 'user.deleted',
    user: { sub: codeName(uid, provider.subSecret.value()) } });
  await getAuth().deleteUser(uid).catch((err) => { if (err.code !== 'auth/user-not-found') throw err; });
  await db.doc(`accountDeletions/${uid}`).set({ status: 'deleted', deletedAt: FieldValue.serverTimestamp(), archivedFarms: FieldValue.delete() }, { merge: true });
}

// Every day: accounts closed 30 days ago are deleted. A failure alerts staff and is tried again
// the next day.
async function purgeClosedAccounts() {
  const db = getFirestore();
  const due = await db.collection('accountDeletions').where('status', '==', 'closed')
    .where('deleteAfter', '<=', Timestamp.now()).get();
  for (const d of due.docs) {
    try {
      await purgeOne(d.id);
      logger.info('account deleted');
    } catch (err) {
      alertStaff('account-delete-failed', { accountDeletion: d.id, err: err.message });
    }
  }
}

module.exports = { deleteAccount, purgeClosedAccounts, purgeOne, KEEP_DAYS };
