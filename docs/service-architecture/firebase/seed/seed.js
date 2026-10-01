// Sample data for the local Firebase emulators, shaped exactly like FIRESTORE_SCHEMA.md.
//
//   npm install            (once, in docs/service-architecture/firebase)
//   npm run emulators      (in one terminal)
//   npm run seed           (in another)
//
// It only ever writes to the emulators: it refuses to run without them. Every price in here is a
// made-up sample, not Wafra's real price table.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp, GeoPoint } = require('firebase-admin/firestore');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Refusing to run: start the emulators and use `npm run seed`.');
  process.exit(1);
}

const app = initializeApp({ projectId: 'demo-wafra' });
const auth = getAuth(app);
const db = getFirestore(app);
const now = Date.now();
const day = 24 * 3600 * 1000;
const at = (offsetDays) => Timestamp.fromMillis(now + offsetDays * day);

// A rough square around a centre point, about `ha` hectares.
function square(lat, lon, ha) {
  const side = Math.sqrt(ha * 10000);
  const dLat = side / 2 / 111320;
  const dLon = side / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat - dLat, lon: lon - dLon }, { lat: lat - dLat, lon: lon + dLon },
    { lat: lat + dLat, lon: lon + dLon }, { lat: lat + dLat, lon: lon - dLon },
  ];
}

// ---- people ---------------------------------------------------------------------------------------
// Sign in with these phone numbers in the app. The emulator shows the SMS code in its log and UI.
const PEOPLE = [
  { uid: 'owner-amina', phone: '+15555550101', firstName: 'Amina', lastName: 'Haddad' },
  { uid: 'coowner-khalid', phone: '+15555550102', firstName: 'Khalid', lastName: 'Nasser' },
  { uid: 'supervisor-omar', phone: '+15555550103', firstName: 'Omar', lastName: 'Saleh' },
];
// +15555550104 has no account yet: sign up with it to try the contract flow (contractFarms below).

// Non-app logins, to try the rules from their side.
const SERVICE_LOGINS = [
  { uid: 'mmc-server', email: 'mmc@example.com', password: 'mmc-emulator-only', claims: { mmc: true } },
  { uid: 'wafra-staff', email: 'staff@example.com', password: 'staff-emulator-only', claims: { admin: true } },
];

// ---- sample price table (made-up numbers, same shape as the real one) -------------------------------
function samplePricing() {
  const band = (n, unit, size, adv, pro) => ({
    band: `${unit}${String(n).padStart(2, '0')}`, upTo: n * size,
    advanced: { month: (adv * n).toFixed(2), year: (adv * n * 10).toFixed(2) },
    professional: { month: (pro * n).toFixed(2), year: (pro * n * 10).toFixed(2) },
  });
  const steps = [];
  for (let s = 1, v = 10; v <= 2000; s += 1, v += v < 500 ? 10 : 50) {
    steps.push({ step: s, month: v.toFixed(2), year: v * 10 <= 8000 ? (v * 10).toFixed(2) : null });
  }
  return {
    version: 'sample', currency: 'USD', pricesAre: 'before VAT', sample: true,
    vat: { AE: '0.05', AZ: '0.18' },
    inApp: { maxFarms: 10, maxHaPerFarm: 25, maxTreesPerFarm: 1000, maxPaymentBeforeVat: '8000' },
    crop: { bandSize: 1, bands: Array.from({ length: 25 }, (_, i) => band(i + 1, 'C', 1, 10, 17)) },
    trees: { bandSize: 40, bands: Array.from({ length: 25 }, (_, i) => band(i + 1, 'T', 40, 14, 20)) },
    steps,
    productIds: { monthly: 'wafra_{tier}_m_{step}', yearly: 'wafra_{tier}_y_{step}', tiers: { advanced: 'adv', professional: 'pro' } },
  };
}

// ---- farms ----------------------------------------------------------------------------------------
const FARMS = [
  { id: 'farm-wadi-rum', name: 'Wadi Rum Alfalfa', type: 'crops', country: 'JO', region: "Wadi Rum, Ma'an Governorate",
    lat: 29.58, lon: 35.42, ha: 12.3, cropAreaHa: 12.3, treeCount: 0, mmcFarmId: 'mmc-7f3a9c2e', createdDaysAgo: 200 },
  { id: 'farm-kharj-south', name: 'Al Kharj South', type: 'mixed', country: 'SA', region: 'Al Kharj, Riyadh Province',
    lat: 24.12, lon: 47.31, ha: 9, cropAreaHa: 7, treeCount: 350, mmcFarmId: 'mmc-1b8e44d0', createdDaysAgo: 40 },
  { id: 'farm-buraydah', name: 'Buraydah Home Farm', type: 'crops', country: 'SA', region: 'Buraydah, Al Qassim',
    lat: 26.33, lon: 43.97, ha: 4, createdDaysAgo: 1 }, // drawn, not surveyed yet: no size, not on activeFarms
];

async function main() {
  for (const p of PEOPLE) {
    await auth.createUser({ uid: p.uid, phoneNumber: p.phone, displayName: `${p.firstName} ${p.lastName}` }).catch(ignoreExists);
    await db.doc(`users/${p.uid}`).set({
      firstName: p.firstName, lastName: p.lastName, phone: p.phone,
      preferences: { lang: 'en', areaUnit: 'hectare', timeFormat: '24h', numerals: 'western', quietHours: { from: '21:00', to: '05:00' } },
      createdAt: at(-200), updatedAt: at(-1),
    });
  }
  for (const s of SERVICE_LOGINS) {
    await auth.createUser({ uid: s.uid, email: s.email, password: s.password }).catch(ignoreExists);
    await auth.setCustomUserClaims(s.uid, s.claims);
  }

  await db.doc('pricing/current').set({ ...samplePricing(), updatedAt: at(0) });

  for (const f of FARMS) {
    const surveyed = Boolean(f.mmcFarmId);
    await db.doc(`farms/${f.id}`).set({
      ownerUid: 'owner-amina', name: f.name, type: f.type, country: f.country, region: f.region,
      location: new GeoPoint(f.lat, f.lon),
      boundary: { points: square(f.lat, f.lon, f.ha), areaHa: f.ha, version: 1, updatedAt: at(-f.createdDaysAgo), updatedBy: 'owner-amina' },
      contractId: null,
      adviceRules: { irrigation: { sendTo: ['contact-ali'], auto: false }, protection: { sendTo: [], auto: false } },
      status: 'active', createdAt: at(-f.createdDaysAgo), updatedAt: at(-1),
      ...(surveyed
        ? { mmcFarmId: f.mmcFarmId, surveyStatus: 'done', surveyedBoundaryVersion: 1,
            cropAreaHa: f.cropAreaHa, treeCount: f.treeCount, sizeUpdatedAt: at(-f.createdDaysAgo) }
        : { surveyStatus: 'none' }),
    });
  }
  await db.doc('farms/farm-wadi-rum/contacts/contact-ali').set({
    name: 'Ali', phone: '+15555550199', channel: 'whatsapp', language: 'ar', role: 'worker', active: true,
  });

  await db.doc('farmAccess/coowner-khalid_farm-wadi-rum').set({
    uid: 'coowner-khalid', farmId: 'farm-wadi-rum', ownerUid: 'owner-amina', role: 'co-owner', status: 'active',
    grantedBy: 'owner-amina', grantedAt: at(-30), revokedAt: null,
  });
  await db.doc('farmAccess/supervisor-omar_farm-kharj-south').set({
    uid: 'supervisor-omar', farmId: 'farm-kharj-south', ownerUid: 'owner-amina', role: 'supervisor', status: 'active',
    grantedBy: 'owner-amina', grantedAt: at(-20), revokedAt: null,
  });
  await db.doc('invites/482913').set({
    farmId: 'farm-wadi-rum', ownerUid: 'owner-amina', role: 'supervisor', createdBy: 'owner-amina',
    createdAt: at(-1), expiresAt: at(6), usedBy: null, usedAt: null,
  });

  // What keepActiveFarms would write: Wadi Rum is covered; Al Kharj South is in its 14 days of grace.
  await db.doc('activeFarms/farm-wadi-rum').set({ mmcFarmId: 'mmc-7f3a9c2e', tier: 'advanced', since: at(-200), graceUntil: null, updatedAt: at(-1) });
  await db.doc('activeFarms/farm-kharj-south').set({ mmcFarmId: 'mmc-1b8e44d0', tier: 'advanced', since: at(-40), graceUntil: at(10), updatedAt: at(-4) });

  // A simplified copy of what RevenueCat's extension writes (the real document has more fields).
  await db.doc('customers/owner-amina').set({
    entitlements: { advanced: { product_identifier: 'wafra_adv_m_013', purchase_date: at(-200), expires_date: at(25) } },
    subscriptions: { wafra_adv_m_013: { period_type: 'normal', store: 'test_store', purchase_date: at(-5), expires_date: at(25) } },
  });

  await db.doc('contracts/contract-demo-7b2f').set({
    clientName: 'Demo Ministry of Agriculture', tier: 'professional', additionalUsers: 3,
    startsAt: at(-60), endsAt: at(305), status: 'active', updatedAt: at(-60),
  });
  await db.doc('contracts/contract-demo-7b2f/private/terms').set({
    kind: 'government', country: 'AE', contact: { name: 'Demo contact', email: 'demo@example.com', phone: '+15555550198' },
    farmCount: 25000, price: { usd: '0.00', vatRate: '0.05', period: 'year' }, invoiceRef: 'DEMO-0001', paid: true, createdAt: at(-60),
  });
  await db.doc('contractFarms/+15555550104').set({
    contractId: 'contract-demo-7b2f', addedAt: at(-60),
    farms: [{ name: 'Sohar Date Gardens', location: { lat: 24.36, lon: 56.75 }, boundary: square(24.36, 56.75, 5), areaHa: 5, treeCount: 600 }],
  });

  await db.doc('suggestions/sug-irrigation-1').set({
    farmId: 'farm-wadi-rum', plotIds: ['mmc-plot-11'], plotNames: ['North pivot'], type: 'irrigation', severity: 'urgent',
    headline: 'Soil moisture is low on the north pivot', action: 'Increase to 693 m³/ha this week',
    activeIngredient: null, ruleVersion: 'irr-2026.7.3', mmcAdviceId: 'mmc-adv-501', issuedAt: at(-1), supersededBy: null,
    status: 'open', seenAt: null, deferredUntil: null, completedAt: null, completedBy: null, assignedTo: null,
    shareCount: 1, lastSharedAt: at(-1),
  });
  await db.doc('suggestions/sug-irrigation-1/shares/share-1').set({
    farmId: 'farm-wadi-rum', kind: 'share', byUid: 'owner-amina', auto: false,
    recipient: { type: 'contact', id: 'contact-ali', name: 'Ali' }, channel: 'whatsapp', delivery: 'delivered',
    at: at(-1), deliveryUpdatedAt: at(-1),
  });

  console.log('Seeded the emulators. Open http://127.0.0.1:4000 to look around.');
}

function ignoreExists(e) {
  if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists' && e.code !== 'auth/phone-number-already-exists') throw e;
}

main().catch((e) => { console.error(e); process.exit(1); });
