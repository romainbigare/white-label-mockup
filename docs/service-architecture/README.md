# Service architecture

*How the Wafra Farm App's services fit together, and how data moves between them. This folder is the
reference for what Wafra and MMC agree: there is no separate build specification. Wafra owns the Firebase
projects and the database rules. Everything runs in Doha (`me-central1`): Firestore, its rules and indexes,
and the Cloud Functions. `revenueCatWebhook` works once the RevenueCat steps in
[section 7](#7-setting-up-a-project) are done.*

![Service architecture](architecture.svg)

## 1. The four pieces

| Piece | What it does | Run by |
|---|---|---|
| **The app** | what farmers use on their phones | built by MMC's engineers, owned by Wafra |
| **Wafra's Firebase** | sign-in, the database, Wafra's Cloud Functions | Wafra |
| **RevenueCat** | in-app payments through Apple and Google | Wafra |
| **The analytics provider** (MMC) | measures farms from satellite images, maps, advice | MMC |

**Where data lives.** Everything about people stays in Wafra's Firebase: names, phone numbers, user IDs,
farms, roles, contacts, payments (a copy), contracts and prices. The provider keeps farms only: its own farm
ID, the farm's shape and its results. It has no login to Wafra's Firebase, and it never sees a user ID, a
phone number or a Firebase token.

## 2. How data moves

1. **Sign in.** Phone number and SMS code (Firebase Auth). The person's user ID is also their RevenueCat ID.
2. **Add a farm.** The farmer draws fields. The app works out the farm's outline (the shape around all the
   fields, plus 20 m) and saves both in Firebase (`farms`, `boundary`), under one version number. A field
   more than 1 km from every other field means two farms: the app says so and saves nothing. Wafra's function sends the outline and the fields to the
   provider to survey; the provider measures inside the fields only, and sends back what it measured (its
   farm ID, hectares and tree count) to another Wafra function, which saves it. A new drawing does the
   same. With no answer after 3 hours the request is sent again, up to 3 times; then the survey is
   `failed` and staff are alerted. A farm not measured has no maps, no advice and no price.
3. **Pay.** The app works out the price (section 3) and the farmer pays through Apple or Google. RevenueCat
   calls Wafra's `revenueCatWebhook`, which asks RevenueCat for the buyer's current purchases and saves them
   in Firebase (`customers/{userId}`). It replaces RevenueCat's Firebase extension: Firebase Extensions
   close on 31 March 2027.
4. **The farm list.** `keepActiveFarms` keeps `farmService` up to date: one record per measured farm, saying
   `active`, `readonly` or `removed`, its level and its services. It runs whenever a purchase, a farm, a
   contract or the prices change, and once a day.
5. **The provider's copy.** Each change in `farmService` is pushed to the provider, and the full list once a
   day. The provider computes only `active` farms, for their level and services.
6. **Use the farm.** The app checks `farmService/{farmId}`: `active` farms are active, the rest read-only.
   To show maps and advice, the app gets a **farm pass** from Wafra and calls the provider with it.
7. **Contracts** (governments, big clients). Wafra adds the contract and its farm list (by owner's phone
   number). When the owner signs up, or at once if they already have an account, Wafra's functions create
   their farms on the contract. They never see a payment screen. How the farms are measured depends on the
   contract: farms the provider surveyed apart for the client come with their provider farm ID and size,
   and are not surveyed again; the others are surveyed like any farm.
8. **Advice.** The provider sends each advice and weather warning to Wafra's `providerEvents`. Wafra's
   functions save it (`suggestions`), send a push notification to the farm's people, and queue it for the
   farm's contacts by the farm's rules. It works while the app is closed; the app never writes advice.
9. **Team.** An owner or co-owner creates an invitation code. The person invited enters it, and the app adds
   them to the farm (`farmAccess`). Their farm pass then lists that farm.

## 3. Prices

The numbers are in Firebase: `pricing/current` (bands, VAT, limits; anyone signed in can read it) and
`pricing/rates` (the rates; staff only). The app never sees a rate: otherwise anyone could compare our
rates with the provider's and work out our margin. The rules are:

- **Two plans:** Basic and Premium, each monthly or yearly. What a farm gets follows what is on it: crop
  features if it has crops, tree features if it has trees.
- **Crops are priced per hectare, trees per tree,** inside the fields only (never the outline's margin).
  Trees are never counted as hectares. For all the
  owner's farms together: monthly total = crop hectares × the rate per hectare + trees × the rate per tree,
  with one rate per plan for each, the same at any size. Minimums: 1 hectare of crops, 100 trees.
- **One list of price bands.** The total is **always rounded up** to a band: the cheapest band whose
  monthly price is at or above it. A total above the top band needs a contract: it is never charged the top
  band.
- **Each band is one store product** per level and period: `wafra_premium_m_012` is Premium, monthly, band 12
  (`basic` for Basic, `y` for yearly).
- **Every plan starts with a 30-day free trial** (the stores' introductory offer). On Apple, all products sit
  in one subscription group; on Google Play the offer is for people who never had a subscription in the app.
  So moving between levels or bands never gives a second trial.
- **In the app:** up to 10 farms, 25 ha and 1,000 trees per farm, and a total no higher than the top band.
  Bigger clients get a contract and an invoice. The app reads these limits from `pricing/current.inApp`;
  they are never written in its code.
- **The farmer sees prices, never band names or numbers.**
- **Store prices.** Each band is one product per level and period in both stores, priced in USD at the
  band's price. Each store makes every other country's price from it, and adds that country's VAT on top
  (VAT is never inside a band price). Wafra sets a country by hand only where it must (for example the UAE
  on Google Play, if Wafra handles that VAT itself); Apple then never changes that country again. Apple
  never follows exchange rates later; on Google Play, staff press "refresh" when they choose.
- **Every band price is an Apple price step:** $0.50 up to $50, $1 up to $200, $5 up to $500, $10 above.
  Google Play takes any price, so the same list works in both stores. `onPricingWritten` alerts staff
  about a band price Apple would refuse; `nearestStorePrice` in `pricing.js` gives the nearest valid one.
  (Apple publishes these steps for in-app purchases; staff check them for subscriptions when creating the
  products.)
- **The app shows the store's price**, RevenueCat's localised price string for the product
  (`product.priceString`), never the USD band price: a Saudi farmer sees the SAR amount the payment sheet
  will show. The app converts nothing.
- **If a farm grows** past the band the owner pays for (a bigger drawing, or more trees counted after
  payment), it stays active for 14 days, then becomes read-only until the owner confirms the new band in
  the store, or moves to a contract if the total is now above the top band. Bands are compared, not dollar
  sums, because of the rounding up. When the count is lower, the app offers the lower band; the store
  applies it at the next payment. The farmer cannot change a count: Contact Wafra asks the provider to
  check it, and a new count comes as a new survey result.
- **Read-only farms** keep their old results; nothing new is computed. Every role keeps read-only access.
  After 12 months read-only, the farm is archived (`farm.removed` for the provider).
- **Contracts:** only an active contract covers a farm. When it ends or is suspended, its farms are
  read-only at once: no grace.
- **RevenueCat:** entitlements `basic` and `premium`; offering `wafra` (a fallback the SDK expects; the app
  picks the product by band, from `quotePrice`).

`firebase/functions/pricing.js` has these rules as code. The app does not apply them: on its plan screens it
calls `quotePrice` with the farms being drawn, and gets back, for each level, the band, its prices and its
product IDs. The function adds the person's farms already paid in the app, and answers only within the
in-app limits.

## 4. Roles

| | Owner | Co-owner | Supervisor |
|---|---|---|---|
| Sees the farm, maps and advice | yes | yes | yes |
| Edits the farm | yes | yes | redraws boundaries only |
| Invites people, sends advice on | yes | yes | no |
| Pays | yes | no | no |

A role belongs to a person on one farm. A supervisor can work on several farms, of one owner or of many.
At the provider every role has `edit` access today (redraw a boundary, correct a tree, send a plant photo);
paying, inviting and sending advice never involve the provider.

## 5. Firebase

| | Staging | Production |
|---|---|---|
| Project | `wafra-farm-staging` | `wafra-farm-production` |
| Use | testing | real farmers |
| Test phone numbers | +15555550101 to +15555550103, code `123456` | none |

The files are in [`firebase/`](firebase/): the database rules (`firestore.rules`), the indexes, and the
functions (`functions/`). The fields of every collection are in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md).

| Function | Starts when | What it does |
|---|---|---|
| `onCustomerWritten`, `onFarmWritten`, `onContractWritten`, `onPricingWritten`, `daily` | a purchase, farm, contract, price or rate changes; 00:30 UTC | `keepActiveFarms`: keeps `farmService` right. `onFarmWritten` also asks the provider to survey a new boundary; `daily` first archives farms read-only for 12 months. |
| `onUserCreated`, `onContractFarmsWritten` | a person signs up; staff change a `contractFarms` entry | creates the contract's farms for their owner |
| `watchSurveys` | every 30 minutes | sends a survey again after 3 hours with no answer, up to 3 times; then `failed`, and a staff alert |
| `quotePrice` | the app calls it | the band and price for the person's farms and the ones being drawn; never a rate |
| `getProviderPass` | the app calls it | gives the signed-in person a 15-minute farm pass |
| `providerKeys` | the provider reads it | Wafra's public keys (JWKS) to check farm passes |
| `onFarmServiceWritten` | a `farmService` record changes | pushes the change to the provider |
| `providerReconcile` | 01:00 UTC | pushes the full list to the provider |
| `providerSurveyResult` | the provider calls it | saves a survey result in `farms` |
| `checkFarms` | the provider calls it (optional) | confirms farms' status before a costly job |
| `providerEvents` | the provider calls it | saves an advice or weather warning in `suggestions` |
| `onSuggestionCreated` | a new suggestion | push notifications to the farm's people; queues it for the farm's contacts |
| `revenueCatWebhook` | RevenueCat calls it on every purchase event | saves the buyer's current purchases in `customers/{uid}` |

To deploy (from the repository root, after `npx firebase-tools login`):

```bash
npx firebase-tools deploy --project staging --config docs/service-architecture/firebase/firebase.json
```

Staging first, then the same command with `--project production`. The functions need Firebase's Blaze plan,
and the setup in section 7.

**Never in the repository:** service-account keys, app config files, secrets, and Wafra's price sheet
(`private/`).

## 6. The provider link

![The app, Wafra's Firebase and the provider](provider-link.svg)

Two questions, two paths:

| Question | Who asks | Answer |
|---|---|---|
| Who may **see** this farm? | the app, when a person opens a farm | the farm pass |
| Should the provider **compute** this farm? | the provider's jobs, with no person | the provider's copy of `farmService`, kept up to date by push |

**The farm pass.** The app calls `getProviderPass` (Firebase login, App Check). The function reads the
person's farms (owned, and `farmAccess` with `status: active`) and their `farmService` records, and returns a
JWT signed with RS256 by a Cloud KMS key, valid 15 minutes:

```json
{
  "iss": "wafra-staging",
  "aud": "mmc",
  "sub": "p_Qk2v…",
  "iat": 1792700000,
  "exp": 1792700900,
  "farms": [
    { "id": "<provider farm ID>", "access": "edit", "status": "active",
      "level": "premium", "services": ["crops"], "version": 12 }
  ]
}
```

- `sub` is a code name: an HMAC of the user ID with a secret per provider. It is stable, it is not the user
  ID, and Wafra can work it out again for support. Nothing is stored.
- `status: readonly` farms are in the pass: the provider shows their old results but computes nothing new.
  Removed farms and farms not yet measured are not.
- At most 50 farms. The app can ask for some farms only (`{ farmIds: [...] }`); `more: true` in the answer
  says there were more.
- The provider checks the signature with the keys at `providerKeys` (by `kid`), and checks `iss`, `aud` and
  `exp`. When the pass has a higher `version` for a farm than the provider's copy, the provider may update its
  copy from the pass.

**Messages to the provider** (`POST` to its webhook, with a Google ID token of Wafra's service account whose
audience is the webhook address):

| `type` | When | Body |
|---|---|---|
| `farm.activated`, `farm.updated`, `farm.deactivated`, `farm.removed` | a `farmService` record changes | `{ id, type, sentAt, farm }` |
| `farms.snapshot` | every day at 01:00 UTC, in pages of 500 | `{ id, type, sentAt, snapshot: { id, page, last }, farms: [...] }` |
| `survey.requested` | a new farm, a new boundary version, or a repeat after 3 hours | `{ id, type, sentAt, survey: { requestId, attempt, farmRef, providerFarmId, farmType, boundary: { version, points, fields: [{ id, number, kind, crop, points }] } } }` |

`farmRef` is the farm's code name: an HMAC of Wafra's farm ID with the same secret as `sub`, stable
when the boundary changes, and never Wafra's farm ID. A new farm has no `providerFarmId` yet, so
`farmRef` is how the provider sees that two requests are for the same farm; it answers the highest
boundary version. A result for an older version is refused (409).

`boundary.points` is the farm's outline: the shape around all the fields, plus 20 m. `fields` are what the
farmer drew (`kind`: `crops` or `trees`; `crop` for crop fields); the provider measures inside them only,
and names them by their `id` in advice. A repeat has the same `requestId` and `attempt` + 1.

`farm` is `{ providerFarmId, status, level, services, boundaryVersion, version }`. The provider ignores a
message whose `id` it has seen, and a farm whose `version` is lower than its copy's. A failed message is
retried for up to a day; after that the daily snapshot repairs it. The provider replaces its list with a
snapshot once the page marked `last` has arrived.

**Calls from the provider** carry a Google ID token of the provider's own service account, with the Firebase
project ID as the audience. Any other caller is refused.

- `providerSurveyResult`: `{ requestId, providerFarmId, boundaryVersion, status: "done" | "failed",
  cropAreaHa, treeCount }`. Refused (409) if the boundary has changed since the request.
- `checkFarms` (optional): `{ farmIds: [providerFarmId, …] }`, at most 500; answers each farm's message, or
  `status: "unknown"`.
- `providerEvents`: one advice or weather warning, with the message's own `id`, `type` and `sentAt`.
  - `advice.created`: `advice: { providerAdviceId, providerFarmId, fieldIds, type (irrigation, nutrition or
    protection), severity (monitor or urgent), headline, action, activeIngredient (protection only),
    ruleVersion, issuedAt, supersedes (an older providerAdviceId) }`. Advice is per field: three fields
    with the same crop get three advice (the app may group them under the crop).
  - `weather.warning`: `warning: { providerWarningId, providerFarmId, severity, headline, action, issuedAt,
    startsAt, endsAt }`.

  Answers 201 (saved), 200 (already saved), 202 (the farm is not active: dropped), 404 (unknown farm),
  409 (a field ID not on the farm's current boundary). Headline and action are short English text.

**Removed farms.** On `farm.removed` the provider stops all work on the farm and hides its data, then
erases it after 90 days.

All that is particular to the provider is in `firebase/functions/providers/mmc.js`. Messages and passes use
Wafra's words (`basic`, `premium`, `crops`, `trees`); the provider maps them to its own products.

## 7. Setting up a project

Do each step in `wafra-farm-staging`, then in `wafra-farm-production`. The functions' settings are asked
for at the first deploy and saved in `functions/.env.<project>` (not committed).

1. **Blaze plan.**
2. **A service account for the functions**, `wafra-functions@<project>.iam.gserviceaccount.com`, with
   only: Cloud Datastore User (Firestore), Eventarc Event Receiver (the Firestore triggers), Logs Writer,
   Cloud Run Invoker (Eventarc and Cloud Scheduler call the functions as it), Firebase Cloud Messaging API
   Admin (push notifications for new advice), Firebase Authentication Viewer (finds a contract owner by
   phone number), and the rights in steps 3 and 4. Its name is fixed in the code: `wafra-functions`.
3. **The signing key.** In Cloud KMS, a key ring in `me-central1` and a key `farm-pass`, purpose
   "asymmetric sign", algorithm `RSA_SIGN_PKCS1_2048_SHA256`. Give the functions' service account
   "Cloud KMS CryptoKey Signer" and "Cloud KMS CryptoKey Public Key Viewer" on that key only. Setting:
   `PASS_KMS_KEYS` = the full name of the key version (`projects/…/cryptoKeyVersions/1`). The key ring is
   `wafra` in both projects. **A new key once a year**, and at once if a key may be leaked:
   1. `gcloud kms keys versions create --key farm-pass --keyring wafra --location me-central1 --project <project>`
   2. In `functions/.env.<project>`, put the new version first in `PASS_KMS_KEYS`, then the old one,
      separated by a comma, and deploy the functions. `providerKeys` now lists both.
   3. At least 24 hours later, remove the old version, deploy again, and disable it:
      `gcloud kms keys versions disable <n> --key farm-pass --keyring wafra --location me-central1 --project <project>`.

   The provider finds a key by `kid`, keeps the list up to 1 hour, and fetches it again for an unknown
   `kid`, so nothing breaks on the day.
4. **The code-name secret.** In Secret Manager, `PASS_SUB_SECRET_MMC` = 32 random bytes, stored in
   `me-central1` only (user-managed replication). Give the functions' service account "Secret Manager Secret
   Accessor" on it. It makes the code names of people (`sub`) and farms (`farmRef`). Never change it: code
   names would change.
5. **Settings:** `PASS_ISSUER` (`wafra-staging` or `wafra-production`), `MMC_WEBHOOK_URL` (from MMC),
   `MMC_SERVICE_ACCOUNT` (the email of MMC's Google service account, from MMC).
6. **App Check** in the app (App Attest on iPhone, Play Integrity on Android): `getProviderPass` and
   `quotePrice` refuse calls without it. The app calls the functions in `me-central1` (for example
   `getFunctions(app, 'me-central1')`).
7. **RevenueCat.** In RevenueCat, make a secret API key for **API v1** (Project settings → API keys). In
   Secret Manager, store it as `REVENUECAT_API_KEY`, and a random password as `REVENUECAT_WEBHOOK_AUTH`,
   both in `me-central1` only, each with "Secret Manager Secret Accessor" for the functions' service
   account. After the deploy, in RevenueCat → Integrations → Webhooks, add `revenueCatWebhook`'s address,
   with the Authorization header set to exactly the `REVENUECAT_WEBHOOK_AUTH` value. Both projects share
   one RevenueCat project, with two webhooks: production's gets the **Production** environment only,
   staging's the **Sandbox** environment only. In App Store Connect and the Google Play Console, each
   band's products (`wafra_{level}_{m|y}_{band}`) get the band's USD price, and the stores make the other
   countries' prices. Band numbers are never reused for another price once the stores have products, so
   they can have gaps: a band dropped from the table has no products.
8. **Deploy** rules, indexes and functions (section 5). Give MMC: the `providerKeys` address, the
   `providerSurveyResult`, `providerEvents` and `checkFarms` addresses, the issuer, and the project ID (the
   audience of its calls).
9. **Staff alerts.** In Cloud Monitoring, the log-based alert policy "Wafra staff alert" fires on any log
   entry with `jsonPayload.alert` (a survey that failed or got no answer). Add the staff's email as its
   notification channel.
10. **The price table.** In the Firestore console, create `pricing/current` and `pricing/rates` with the fields
   in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md), from Wafra's private price sheet (staging gets made-up
   numbers only). Until both exist, nobody can be quoted and paid farms are not checked. The rules hide
   `pricing/rates` from the app, but not from anyone with a role on the Google Cloud project (Viewer,
   Editor…): in production, give roles to Wafra people only.

**Changing the price table.** Prices change in four places, in this order (staging first, then production):
1. **Keep the old table.** Copy `pricing/current` and `pricing/rates` into `pricingHistory/{version}`
   (see the schema), so a change can be undone.
2. **Write both documents in one batch,** with the same new `version`. `onPricingWritten` then checks the
   bands (every price on an Apple price step, strictly rising) and alerts staff about a bad one, and
   `keepActiveFarms` runs again for every owner. Staging keeps made-up rates: only its bands and `version`
   change.
3. **Test the quote.** Load both documents and run `quote()` from `pricing.js` on a few farms: the bands
   and the biggest holding must be what the price sheet says.
4. **RevenueCat and the stores.** Every band is one product per level and period. While there are no
   stores, RevenueCat's Test Store holds them: set each product's USD price (API v2:
   `PATCH /projects/{id}/products/{id}/prices/USD`, `amount_micros`; yearly = 10 × monthly) and archive
   the products of bands no longer in the table (`POST .../actions/archive`; they can be unarchived).
   RevenueCat limits these calls to 60 a minute. The same project serves staging and production. Once the
   stores exist, set the prices there too.
