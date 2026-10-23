// Wafra's Cloud Functions.
//
// keepActiveFarms keeps `farmService` right: one record per measured farm, saying whether it is
// active (paid), read-only or removed, at which level. It runs whenever a purchase, a farm, a
// contract or the price table changes, and once a day. The logic is in keeper.js; the pricing
// rules in pricing.js.
//
// The provider link tells the analytics provider which farms to compute (provider-sync.js) and
// which farms a person may see (the farm pass, pass.js), with nothing about people. All that is
// particular to the provider is in providers/.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { recomputeOwner, recomputeOwners, markRemoved, allOwners } = require('./keeper');
const { jwks, makePass } = require('./pass');
const sync = require('./provider-sync');
const provider = require('./providers/mmc');

// The functions run as their own service account, with only the rights they need (see README).
// Written as `name@`: the Firebase CLI adds the project's domain. A literal, not a deploy-time
// setting, because Cloud Scheduler needs it too and the CLI does not pass a setting on to it.
const SERVICE_ACCOUNT = 'wafra-functions@';
// KMS key versions of the farm pass, comma-separated: the first one signs, all are published.
const PASS_KEYS = defineString('PASS_KMS_KEYS', { description: 'KMS key versions for the farm pass; the first one signs' });
// `iss` of the farm pass: wafra-staging or wafra-production, so a pass never crosses projects.
const PASS_ISSUER = defineString('PASS_ISSUER', { description: 'wafra-staging or wafra-production' });

// Doha, the region of the Firestore databases. The app's callable functions must name it too.
setGlobalOptions({ region: 'me-central1', maxInstances: 5, serviceAccount: SERVICE_ACCOUNT });
initializeApp();

const passKeys = () => PASS_KEYS.value().split(',').map((k) => k.trim()).filter(Boolean);

// -- keepActiveFarms ------------------------------------------------------------

// A purchase, renewal, cancellation or trial, copied in by RevenueCat's extension.
exports.onCustomerWritten = onDocumentWritten('customers/{uid}', (event) => recomputeOwner(event.params.uid));

// A farm created, measured, archived, transferred or put on a contract; a new boundary is sent
// to the provider to survey.
exports.onFarmWritten = onDocumentWritten({ document: 'farms/{farmId}', retry: true }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) await markRemoved(event.params.farmId);
  await recomputeOwners([before && before.ownerUid, after && after.ownerUid].filter(Boolean));
  await sync.requestSurvey(event, before, after);
});

// A contract started, ended, suspended or changed level.
exports.onContractWritten = onDocumentWritten('contracts/{contractId}', async (event) => {
  const snap = await getFirestore().collection('farms').where('contractId', '==', event.params.contractId).select('ownerUid').get();
  await recomputeOwners(snap.docs.map((d) => d.get('ownerUid')));
});

// New prices change which farms a paid band covers.
exports.onPricingWritten = onDocumentWritten('pricing/current', async () => recomputeOwners(await allOwners()));

// Every day: plans, trials, contracts and grace periods that ended overnight.
exports.daily = onSchedule({ schedule: '30 0 * * *', timeZone: 'Etc/UTC' }, async () => recomputeOwners(await allOwners()));

// -- provider link --------------------------------------------------------------

// The app asks for a farm pass, and sends it with each call to the provider.
exports.getProviderPass = onCall({ enforceAppCheck: true, secrets: [provider.subSecret] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const only = req.data && Array.isArray(req.data.farmIds) ? req.data.farmIds : null;
  return makePass({
    uid: req.auth.uid,
    only,
    issuer: PASS_ISSUER.value(),
    keyVersion: passKeys()[0],
    subSecret: provider.subSecret.value(),
    now: Date.now(),
  });
});

// Wafra's public keys (JWKS), for the provider to check passes.
exports.providerKeys = onRequest(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(await jwks(passKeys()));
});

// Each farmService change goes to the provider.
exports.onFarmServiceWritten = onDocumentWritten({ document: 'farmService/{farmId}', retry: true }, sync.pushFarmChange);

// Once a day, after `daily`, the full list, which repairs any lost message.
exports.providerReconcile = onSchedule({ schedule: '0 1 * * *', timeZone: 'Etc/UTC' }, sync.sendFullList);

// The provider sends survey results here; only the provider's service account is let in.
exports.providerSurveyResult = onRequest(sync.receiveSurveyResult);

// Optional: the provider confirms farms before a costly job.
exports.checkFarms = onRequest(sync.checkFarms);
