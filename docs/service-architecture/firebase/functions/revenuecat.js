// RevenueCat → customers/{uid}: what one buyer has bought, for keepActiveFarms to read.
//
// It replaces RevenueCat's Firebase extension: Firebase Extensions close on 31 March 2027, and no
// replacement kit exists. RevenueCat calls revenueCatWebhook on every purchase event (purchase,
// renewal, trial, cancellation, expiry, transfer…). The event is only a signal: the function asks
// RevenueCat's API for the buyer's CURRENT purchases and saves those, so an event that arrives
// late, twice or out of order cannot leave an old state behind. The document is RevenueCat's own
// v1 "subscriber" object, the format keeper.js reads (`entitlements`, `subscriptions`).
//
// The RevenueCat app user ID is the Firebase UID. Anonymous RevenueCat IDs are never written.
const crypto = require('crypto');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');

// A RevenueCat secret API key for API v1 (RevenueCat → API keys → secret key, version V1).
const API_KEY = defineSecret('REVENUECAT_API_KEY');
// The value RevenueCat sends in the webhook's Authorization header (set in RevenueCat).
const WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

const API = 'https://api.revenuecat.com/v1/subscribers/';

function sameSecret(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Every buyer an event is about: the buyer, and both sides of a transfer.
function buyersOf(event) {
  const ids = [event.app_user_id, event.original_app_user_id,
    ...(event.transferred_from || []), ...(event.transferred_to || [])];
  return [...new Set(ids.filter((id) => typeof id === 'string' && id && !id.startsWith('$RCAnonymousID:')))];
}

// The buyer's current purchases, from RevenueCat: { subscriber, requestDateMs }.
async function fetchSubscriber(uid) {
  const res = await fetch(API + encodeURIComponent(uid), {
    headers: { Authorization: `Bearer ${API_KEY.value()}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status} for a subscriber`);
  const body = await res.json();
  return { subscriber: body.subscriber || {}, requestDateMs: Number(body.request_date_ms) || Date.now() };
}

// Saves the purchases unless a newer answer from RevenueCat is already saved.
async function saveCustomer(uid, { subscriber, requestDateMs }) {
  const db = getFirestore();
  const ref = db.doc(`customers/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && (snap.get('requestDateMs') || 0) > requestDateMs) return;
    tx.set(ref, { ...subscriber, requestDateMs, updatedAt: FieldValue.serverTimestamp() });
  });
}

// revenueCatWebhook. Any answer but 200 makes RevenueCat send the event again later.
async function receiveWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!sameSecret(req.get('Authorization'), WEBHOOK_AUTH.value())) return res.status(403).end();
  const event = req.body && req.body.event;
  if (!event) return res.status(400).json({ error: 'Expected a RevenueCat webhook body with an event.' });
  const buyers = buyersOf(event);
  try {
    for (const uid of buyers) await saveCustomer(uid, await fetchSubscriber(uid));
  } catch (err) {
    logger.error('revenueCatWebhook: could not refresh a buyer', { type: event.type, id: event.id, err: err.message });
    return res.status(500).end();
  }
  logger.info('revenueCatWebhook', { type: event.type, id: event.id, buyers: buyers.length });
  return res.status(200).end();
}

module.exports = { API_KEY, WEBHOOK_AUTH, buyersOf, receiveWebhook };
