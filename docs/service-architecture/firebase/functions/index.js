// keepActiveFarms — Wafra's only Cloud Function.
//
// It keeps `activeFarms` right: one record per farm that is paid for, read by the app (active or
// read-only) and by MMC (which farms to analyse). It runs whenever a purchase, a farm, a contract or the
// price table changes, and once a day for plans, contracts and grace periods that end.
// The logic is in keeper.js; the pricing rules in pricing.js.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { recomputeOwner, recomputeOwners, allOwners } = require('./keeper');

setGlobalOptions({ region: 'me-central2', maxInstances: 5 });
initializeApp();

// A purchase, renewal, cancellation or trial, copied in by RevenueCat's extension.
exports.onCustomerWritten = onDocumentWritten('customers/{uid}', (event) => recomputeOwner(event.params.uid));

// A farm created, measured, archived, transferred or put on a contract.
exports.onFarmWritten = onDocumentWritten('farms/{farmId}', async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) await getFirestore().doc(`activeFarms/${event.params.farmId}`).delete();
  await recomputeOwners([before && before.ownerUid, after && after.ownerUid].filter(Boolean));
});

// A contract started, ended, suspended or changed tier.
exports.onContractWritten = onDocumentWritten('contracts/{contractId}', async (event) => {
  const snap = await getFirestore().collection('farms').where('contractId', '==', event.params.contractId).select('ownerUid').get();
  await recomputeOwners(snap.docs.map((d) => d.get('ownerUid')));
});

// New prices change which farms a paid level covers.
exports.onPricingWritten = onDocumentWritten('pricing/current', async () => recomputeOwners(await allOwners()));

// Every day: plans, trials, contracts and grace periods that ended overnight.
exports.daily = onSchedule({ schedule: '30 0 * * *', timeZone: 'Etc/UTC' }, async () => recomputeOwners(await allOwners()));
