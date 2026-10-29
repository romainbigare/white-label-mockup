// Wafra's Cloud Functions.
//
// keepActiveFarms keeps `farmService` right: one record per measured farm, saying whether it is
// active (paid), read-only or removed, at which level. It runs whenever a purchase, a farm, a
// contract or the price table changes, and once a day. The logic is in keeper.js; the pricing
// rules in pricing.js. quotePrice (quote.js) tells the app which band to sell, so that the rates
// never leave the server.
//
// The provider link tells the analytics provider which farms to compute (provider-sync.js) and
// which farms a person may see (the farm pass, pass.js), with nothing about people. All that is
// particular to the provider is in providers/.
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { recomputeOwner, recomputeOwners, markRemoved, allOwners, archiveStaleReadonly } = require('./keeper');
const { jwks, makePass } = require('./pass');
const sync = require('./provider-sync');
const advice = require('./advice');
const { linkContractFarms } = require('./contracts');
const revenuecat = require('./revenuecat');
const { quotePrice } = require('./quote');
const { storePriceProblems } = require('./pricing');
const provider = require('./providers/mmc');

// The functions run as their own service account, with only the rights they need (see README).
// The full email, built from the project the CLI deploys to (it sets GCLOUD_PROJECT and
// FIREBASE_CONFIG while it reads this file, and the runtime sets them too). Not a deploy-time
// setting: the CLI does not pass one on to Cloud Scheduler. Not the `name@` short form either:
// the CLI's secret step does not complete it.
const PROJECT = process.env.GCLOUD_PROJECT || JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId;
if (!PROJECT) throw new Error('No project ID: deploy with the Firebase CLI (--project staging or production).');
const SERVICE_ACCOUNT = `wafra-functions@${PROJECT}.iam.gserviceaccount.com`;
// KMS key versions of the farm pass, comma-separated: the first one signs, all are published.
const PASS_KEYS = defineString('PASS_KMS_KEYS', { description: 'KMS key versions for the farm pass; the first one signs' });
// `iss` of the farm pass: wafra-staging or wafra-production, so a pass never crosses projects.
const PASS_ISSUER = defineString('PASS_ISSUER', { description: 'wafra-staging or wafra-production' });

// Doha, the region of the Firestore databases. The app's callable functions must name it too.
setGlobalOptions({ region: 'me-central1', maxInstances: 5, serviceAccount: SERVICE_ACCOUNT });
initializeApp();

// The functions called from outside check their caller themselves (Firebase sign-in and App Check,
// the RevenueCat password, the provider's Google ID token), so Cloud Run lets everyone reach them.
// Said on each one so that every deploy sets it, not only the one that creates the function.
const PUBLIC = 'public';

const passKeys = () => PASS_KEYS.value().split(',').map((k) => k.trim()).filter(Boolean);

// -- keepActiveFarms ------------------------------------------------------------

// A purchase, renewal, cancellation or trial, saved by revenueCatWebhook.
exports.onCustomerWritten = onDocumentWritten('customers/{uid}', (event) => recomputeOwner(event.params.uid));

// A farm created, measured, archived, transferred or put on a contract; a new boundary is sent
// to the provider to survey.
exports.onFarmWritten = onDocumentWritten({ document: 'farms/{farmId}', retry: true, secrets: [provider.subSecret] }, async (event) => {
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

// New prices or rates change which farms a paid band covers.
// A band price the stores would refuse alerts staff.
exports.onPricingWritten = onDocumentWritten('pricing/{doc}', async (event) => {
  if (event.params.doc === 'current' && event.data.after.exists) {
    const problems = storePriceProblems(event.data.after.data());
    if (problems.length) sync.alertStaff('pricing-store-prices', { problems: problems.slice(0, 20), count: problems.length });
  }
  await recomputeOwners(await allOwners());
});

// Every day: farms read-only for 12 months are archived; then plans, trials, contracts and grace
// periods that ended overnight.
exports.daily = onSchedule({ schedule: '30 0 * * *', timeZone: 'Etc/UTC' }, async () => {
  await archiveStaleReadonly();
  await recomputeOwners(await allOwners());
});

// RevenueCat calls this on every purchase event; it saves the buyer's purchases in customers/{uid}.
exports.revenueCatWebhook = onRequest({ invoker: PUBLIC, secrets: [revenuecat.API_KEY, revenuecat.WEBHOOK_AUTH] }, revenuecat.receiveWebhook);

// Contract farms are created for their owner by Wafra: when the person signs up, or when staff
// add the farms of someone who already has an account.
exports.onUserCreated = onDocumentCreated('users/{uid}', async (event) => {
  const phone = event.data && event.data.get('phone');
  if (phone) await linkContractFarms(phone);
});
exports.onContractFarmsWritten = onDocumentWritten('contractFarms/{phone}', (event) => linkContractFarms(event.params.phone));

// The app's plan screens: the band and price for the caller's farms, plus any being drawn.
exports.quotePrice = onCall({ invoker: PUBLIC, enforceAppCheck: true }, quotePrice);

// -- provider link --------------------------------------------------------------

// The app asks for a farm pass, and sends it with each call to the provider.
exports.getProviderPass = onCall({ invoker: PUBLIC, enforceAppCheck: true, secrets: [provider.subSecret] }, async (req) => {
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
exports.providerKeys = onRequest({ invoker: PUBLIC }, async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(await jwks(passKeys()));
});

// Each farmService change goes to the provider.
exports.onFarmServiceWritten = onDocumentWritten({ document: 'farmService/{farmId}', retry: true }, sync.pushFarmChange);

// Once a day, after `daily`, the full list, which repairs any lost message.
exports.providerReconcile = onSchedule({ schedule: '0 1 * * *', timeZone: 'Etc/UTC' }, sync.sendFullList);

// The provider sends survey results here; only the provider's service account is let in.
exports.providerSurveyResult = onRequest({ invoker: PUBLIC }, sync.receiveSurveyResult);

// Every 30 minutes: surveys with no answer for 3 hours are sent again, then marked failed.
exports.watchSurveys = onSchedule({ schedule: '*/30 * * * *', timeZone: 'Etc/UTC', secrets: [provider.subSecret] }, sync.watchSurveys);

// The provider sends advice and weather warnings here; only its service account is let in.
exports.providerEvents = onRequest({ invoker: PUBLIC }, advice.receiveEvent);

// Each new advice or warning: push notifications, and the farm's automatic messages to contacts.
exports.onSuggestionCreated = onDocumentCreated('suggestions/{suggestionId}', advice.deliver);

// Optional: the provider confirms farms before a costly job.
exports.checkFarms = onRequest({ invoker: PUBLIC }, sync.checkFarms);
