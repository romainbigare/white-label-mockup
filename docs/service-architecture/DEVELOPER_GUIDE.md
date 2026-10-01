# Developer guide — connecting the app to Firebase and RevenueCat

*Part of the [service architecture](README.md). Audience: the developers building the app. Status: ready to
start.*

This is the place to start. It explains what is already set up, how to run everything on your own computer,
and which collection each part of the app reads and writes. The rest of this folder has the details.

## 1. What is ready

| | Status |
|---|---|
| Firestore rules and indexes | deployed to staging and production |
| Price table (`pricing/current`) | in staging |
| iOS and Android apps | registered in both projects; Wafra sends you the config files |
| Local emulators with sample data | in [`firebase/`](firebase/), see section 2 |
| RevenueCat | Test Store app, entitlements `advanced` and `professional`, all price-level products, offering `wafra` |
| Cloud Functions (`keepActiveFarms`, `surveyFarm`, `redeemInvite`, `notify`) | **not built yet**, see [`CLOUD_FUNCTIONS.md`](CLOUD_FUNCTIONS.md) |

Until the Cloud Functions exist, nothing fills in `activeFarms` or a farm's measured size on a real project.
The emulator's sample data includes both, so you can build every screen now.

## 2. Run everything on your computer

You need Node 20 or later, and Java 21 (the Firestore emulator runs on Java).

```bash
cd docs/service-architecture/firebase
```

```bash
npm install
```

```bash
npm run emulators
```

In a second terminal, from the same folder:

```bash
npm run seed
```

The emulator UI is at http://127.0.0.1:4000. The emulators use the same rules as production, so what works
here works there. The project ID is `demo-wafra`: it never touches a real project.

**Sample sign-ins.** The emulator shows each SMS code in its log and in the UI.

| Sign in with | Who | What they see |
|---|---|---|
| +15555550101 | Amina, an owner paying in the app | 3 farms: Wadi Rum (active), Al Kharj South (active, in its 14 days of grace), Buraydah (drawn, not measured yet) |
| +15555550102 | Khalid, co-owner | Wadi Rum |
| +15555550103 | Omar, supervisor | Al Kharj South |
| +15555550104 | nobody yet | sign up to try the contract flow: a farm is waiting in `contractFarms` |
| mmc@example.com / `mmc-emulator-only` | MMC's server login | can read `activeFarms`, nothing else |
| staff@example.com / `staff-emulator-only` | Wafra staff | can read everything |

**Connecting the app to the emulators** (web SDK; the native SDKs have the same calls):

```js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-wafra', apiKey: 'demo-key' });
connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099');
connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
```

The sample prices are made up. Staging has the real price table.

## 3. Staging

- **Config files:** Wafra sends you `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) for
  staging. Please keep them out of the repository: it is public.
- **Test phone numbers:** +15555550101 to +15555550103, code `123456`. No SMS is sent.
- **Data:** only the price table for now. Farms you create in staging stay unmeasured and read-only until the
  Cloud Functions are deployed.

## 4. What each part of the app reads and writes

Keep the names of the mockup's selectors and actions (`app/data/selectors.js`, `app/data/actions.js`, see the
main README §8.1), and replace what is inside them with these calls.

| Part of the app | Reads | Writes |
|---|---|---|
| Sign-in, profile, settings | `users/{uid}` | `users/{uid}`, `users/{uid}/devices/{deviceId}` |
| My farms | `farms` where `ownerUid` = me; `farmAccess` where `uid` = me and `status` = `active`, then those farms | – |
| Is this farm active? (the payment gate) | `activeFarms/{farmId}`: present = active at its tier, missing = read-only | – |
| Add or redraw a farm | – | `farms/{farmId}` (the app's fields only), then call `surveyFarm` |
| Team and invitations | `farmAccess` | `invites/{code}`; revoke a `farmAccess`; call `redeemInvite` to join |
| Contacts | `farms/{farmId}/contacts` | the same (owner and co-owners) |
| Advice | `suggestions` where `farmId` = the farm | status fields only (`seenAt`, `deferredUntil`, `completedAt`, …); call `notify` to send |
| Feedback | – | `feedback` |
| Prices and paywall | `pricing/current`; `customers/{uid}` (your own) | – (purchases go through RevenueCat) |
| Contract sign-up | `contractFarms/{your phone}`, `contracts/{contractId}` | `farms/{farmId}` with that `contractId` |

Every field, and who may write it, is in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md). The rules are in
[`firebase/firestore.rules`](firebase/firestore.rules).

## 5. RevenueCat

- **SDK key** (Test Store, made to ship inside the app): `test_BRqnAvveSWEAudrQjVJmTQVkqPR`.
- **Sign in first:** call `Purchases.logIn(firebaseUid)` before showing any paywall.
- **Entitlements:** `advanced` and `professional`.
- **Products:** one per price level, tier and period: `wafra_adv_m_032` is Advanced, monthly, level 32. The
  app works out the level from the owner's farms (same pricing code as the functions, see
  [`PRICING_AND_PAYMENT.md`](PRICING_AND_PAYMENT.md)), then fetches just two products:
  `Purchases.getProducts(['wafra_adv_m_032', 'wafra_adv_y_032'])`. Yearly products exist up to level 61.
- **Offering `wafra`:** the lowest level of each tier. It is a fallback the SDK expects; the app does not
  build its paywall from it.
- The real App Store and Google Play products will use the same IDs.

## 6. Next steps

1. The shared pricing code (bands, total, price level), used by the app and the functions.
2. The app's data layer, against the emulators.
3. The four Cloud Functions ([`CLOUD_FUNCTIONS.md`](CLOUD_FUNCTIONS.md)). Wafra switches the projects to
   Firebase's Blaze plan before they are deployed.
4. With MMC's backend team: the survey API, the analytics API and the events ([`MMC_INTERFACE.md`](MMC_INTERFACE.md)).
