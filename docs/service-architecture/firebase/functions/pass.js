// The farm pass: a short token, signed by Wafra, that tells the provider which farms one person
// may use. The app asks for it (getProviderPass) and sends it with each call to the provider.
// The provider checks it with Wafra's public keys (providerKeys) and needs nothing else: no
// Firebase token, no user ID, no phone number.
//
// It is a JWT signed with RS256 by a Cloud KMS key; the private key never leaves KMS.
const crypto = require('crypto');
const { getFirestore } = require('firebase-admin/firestore');
const { KeyManagementServiceClient } = require('@google-cloud/kms');
const provider = require('./providers/mmc');

const PASS_SECONDS = 15 * 60;
const MAX_FARMS = 50;

// What each role may do at the provider. Every role may view and edit today (edit = redraw a
// boundary, correct a tree, send a plant photo); the field is there so a view-only role can come
// later without changing the provider. Paying, inviting and sending advice stay with Wafra.
const ACCESS = { owner: 'edit', 'co-owner': 'edit', supervisor: 'edit' };

let kms;
const client = () => (kms ??= new KeyManagementServiceClient());

const b64url = (data) => Buffer.from(data).toString('base64url');

// The person's code name at this provider: the same every time, different at each provider, and
// not the UID. Wafra can work it out again for anyone (for support); nothing is stored.
function codeName(uid, secret) {
  return 'p_' + crypto.createHmac('sha256', secret).update(uid).digest('base64url').slice(0, 22);
}

// A farm's code name at this provider (`farmRef`), made the same way from Wafra's farm ID. It lets
// the provider see that two survey requests are for the same farm before it has given the farm its
// own ID. The "farm:" label keeps a farm's code from ever matching a person's.
function farmCode(farmId, secret) {
  return 'f_' + crypto.createHmac('sha256', secret).update(`farm:${farmId}`).digest('base64url').slice(0, 22);
}

// "projects/…/cryptoKeys/farm-pass/cryptoKeyVersions/3" -> "farm-pass-3"
function kidOf(keyVersion) {
  const m = /cryptoKeys\/([^/]+)\/cryptoKeyVersions\/(\d+)$/.exec(keyVersion);
  if (!m) throw new Error(`Not a KMS key version: ${keyVersion}`);
  return `${m[1]}-${m[2]}`;
}

async function sign(keyVersion, claims) {
  const header = { alg: 'RS256', typ: 'JWT', kid: kidOf(keyVersion) };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const digest = crypto.createHash('sha256').update(input).digest();
  const [result] = await client().asymmetricSign({ name: keyVersion, digest: { sha256: digest } });
  return `${input}.${b64url(result.signature)}`;
}

// Wafra's public keys as a JWKS: every key version in use, so passes signed just before a key
// change still check.
async function jwks(keyVersions) {
  const keys = await Promise.all(keyVersions.map(async (name) => {
    const [publicKey] = await client().getPublicKey({ name });
    const jwk = crypto.createPublicKey(publicKey.pem).export({ format: 'jwk' });
    return { ...jwk, kid: kidOf(name), alg: 'RS256', use: 'sig' };
  }));
  return { keys };
}

// The farms one person may use, with their role: the farms they own, and those shared with them.
async function rolesOf(uid) {
  const db = getFirestore();
  const [owned, shared] = await Promise.all([
    db.collection('farms').where('ownerUid', '==', uid).where('status', '==', 'active').select().get(),
    db.collection('farmAccess').where('uid', '==', uid).where('status', '==', 'active').get(),
  ]);
  const roles = new Map(owned.docs.map((d) => [d.id, 'owner']));
  for (const d of shared.docs) if (!roles.has(d.get('farmId'))) roles.set(d.get('farmId'), d.get('role'));
  return roles;
}

// One person's pass. `only` (Wafra farm IDs, optional) limits it to the farms on screen; it is
// needed past MAX_FARMS farms, and `more` says so. Farms the provider has not measured, and
// removed farms, are left out; read-only farms are in, so their old results still show.
async function makePass({ uid, only, issuer, keyVersion, subSecret, now }) {
  const roles = await rolesOf(uid);
  const ids = [...roles.keys()].filter((id) => !Array.isArray(only) || only.includes(id));
  const db = getFirestore();
  const records = ids.length ? await db.getAll(...ids.map((id) => db.doc(`farmService/${id}`))) : [];
  const usable = records.filter((s) => s.exists && s.get('provider') === provider.name && s.get('status') !== 'removed');
  const farms = usable.slice(0, MAX_FARMS).map((s) => ({
    id: s.get('providerFarmId'),
    access: ACCESS[roles.get(s.id)] || 'view',
    status: s.get('status'),
    level: s.get('level'),
    services: s.get('services') || [],
    version: s.get('version') || 0,
  }));
  const iat = Math.floor(now / 1000);
  const claims = { iss: issuer, aud: provider.audience, sub: codeName(uid, subSecret), iat, exp: iat + PASS_SECONDS, farms };
  return { pass: await sign(keyVersion, claims), expiresAt: claims.exp * 1000, more: usable.length > MAX_FARMS };
}

module.exports = { codeName, farmCode, kidOf, jwks, makePass };
