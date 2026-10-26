# Firestore schema

*Part of the [service architecture](README.md). Status: live. Firestore has no tables to create: each
collection appears when the app first writes to it. The rules ([`firebase/firestore.rules`](firebase/firestore.rules))
and indexes are deployed on staging and production, and enforce what is described here.*

Wafra's Firestore holds **all client data**: people, farms, roles, contacts, purchases (as a copy),
contracts and prices. The analytics provider (today MMC) holds its own farm IDs, shapes and results. It has
no login here: Wafra's functions push it farm changes and receive its survey results, and a person's farm
pass tells it which farms that person may see. Nothing about people reaches it.

Both projects (`wafra-farm-staging` and `wafra-farm-production`) use the `(default)` database, Standard
edition, in `me-central1` (Doha). Everything else that holds or reads client data (the Cloud Functions,
the signing key, the secret) is in the same region. Dammam (`me-central2`) needs Invoiced Billing, which
Wafra does not have.

## Conventions

- **Writers.** Every collection says who writes it:
  - **app**: the app, through the rules;
  - **functions**: Wafra's Cloud Functions ([`firebase/functions/`](firebase/functions/)), with the Admin
    SDK: `keepActiveFarms`, and the provider link, which writes what the provider measured;
  - **revenuecat**: Wafra's function `revenueCatWebhook`, which RevenueCat calls on every purchase event;
  - **staff**: Wafra staff (`admin` claim), from the Firebase console or an admin page.
- **Readers outside the app: none.** The provider has no login. What it gets is pushed to it (see
  the [README](README.md#6-the-provider-link)): farm records without people, and short farm passes.
- `uid` is the Firebase Auth UID from phone sign-in. It is also the RevenueCat app user ID. It never
  leaves Wafra; the provider knows a person only by a code name.
- **Provider-neutral names.** No field is named after the provider. `provider` says which one
  (`mmc`), and `providerFarmId`, `providerAdviceId`, `providerPlotIds` hold its IDs.
- **Our words.** Levels are `basic` and `premium`; services are `crops` and `trees`.
- Timestamps are Firestore `Timestamp`; enums are lower-case strings; prices are decimal strings in USD,
  before VAT.
- **No nested arrays** (Firestore rejects them). A polygon is an array of `{ lat, lon }` maps (WGS84).
- **`farmService` is the one place that says "is this farm paid?"**, and only `keepActiveFarms` writes it.

---

## `users/{uid}` — app
A person who can sign in.

| Field | Type | Notes |
|---|---|---|
| firstName, lastName | string | |
| email | string | optional |
| phone | string | E.164; must be the Auth phone number |
| preferences | map | `lang`, `areaUnit` (`hectare` or `dunum`), `timeFormat` (`12h` or `24h`), `numerals` (`western` or `eastern`), `quietHours` (`{ from, to }`) |
| createdAt, updatedAt | timestamp | |

Sub-collection `users/{uid}/devices/{deviceId}` (app): `fcmToken`, `platform` (`ios` or `android`),
`appVersion`, `lastSeenAt`. Push notifications go to these tokens.

## `farms/{farmId}` — app
A holding. `ownerUid` is its owner: the payer, unless the farm is on a contract. The owner has full rights
without a `farmAccess` record.

| Field | Type | Writer | Notes |
|---|---|---|---|
| ownerUid | string | app | set at creation to the creator; changes only by transfer (Wafra staff) |
| name, nameAr | string | app | |
| type | string | app | `crops`, `trees` or `mixed` |
| country, region | string | app | |
| location | geopoint | app | the farm's centre |
| boundary | map | app | `{ points: [{lat, lon}, …], areaHa, version, updatedAt, updatedBy }`; `version` is 1 at creation and goes up by exactly 1 with each new drawing |
| contractId | string | app | set only at creation, and only to the contract in the creator's own `contractFarms` entry; otherwise null |
| adviceRules | map | app | where each type of advice goes, and whether it is sent automatically |
| status | string | app | `active` or `archived` |
| createdAt, updatedAt | timestamp | app | |
| surveyRequestId | string | functions | the last survey asked of the provider, for this boundary version |
| provider | string | functions, from the provider | `mmc` |
| providerFarmId | string | functions, from the provider | the provider's farm ID, from the first survey |
| surveyStatus | string | functions | `none`, `running`, `done` or `failed` |
| surveyedBoundaryVersion | number | functions, from the provider | the boundary version the provider measured |
| cropAreaHa | number | functions, from the provider | the crop hectares measured; the price uses it |
| treeCount | number | functions, from the provider | the trees counted; the price uses it |
| sizeUpdatedAt | timestamp | functions | when `cropAreaHa` or `treeCount` last changed |

The size changes only after a survey: when the farm is created, or its boundary changes. Never on each new
satellite image, so the price does not jump between bands on its own.

**Only the functions write what the provider measured.** A new farm or a new boundary version makes
`onFarmWritten` send a survey request to the provider; the provider sends the result to
`providerSurveyResult`, which checks it is for the current boundary version and writes it. The app cannot
write these fields: the price comes from them, and the farm pass trusts `providerFarmId`.

Sub-collection `farms/{farmId}/contacts/{contactId}` (app; owner and co-owners). The people advice is sent to
(B10). They cannot sign in. Fields: `name`, `phone`, `channel` (`whatsapp`, `sms` or `telegram`),
`language`, `role` (`supervisor` or `worker`), `active`.

## `farmAccess/{uid}_{farmId}` — app
A co-owner's or supervisor's role on one farm. The document ID must be `uid + "_" + farmId`, because the
rules look it up by that name. The owner has none.

Fields: `uid`, `farmId`, `ownerUid`, `role` (`co-owner` or `supervisor`), `status` (`active` or `revoked`),
`inviteCode`, `grantedBy`, `grantedAt`, `revokedAt`. The person invited creates it with an open invitation
code for that farm and role. The owner or a co-owner may change `status` to `revoked`.

## `invites/{code}` — app
An invitation to join a farm, valid until `expiresAt` and usable once. The owner or a co-owner creates it;
anyone signed in can look it up by its code; the person joining sets `usedBy` and `usedAt`.

Fields: `farmId`, `ownerUid`, `role`, `createdBy`, `createdAt`, `expiresAt`, `usedBy`, `usedAt`.

## `farmService/{farmId}` — functions (keepActiveFarms)
**The centre of the system.** One record per farm the provider has measured. The app reads it to show a farm
active or read-only. Each change is pushed to the provider, which computes only `active` farms. The record
is never deleted, and it is written only when something in it changes, so every write is a real change.

| Field | Type | Notes |
|---|---|---|
| provider | string | `mmc` |
| providerFarmId | string | the provider's farm ID |
| status | string | `active` (paid or on a contract, or in grace: the provider computes it), `readonly` (not paid: old results stay, nothing new is computed) or `removed` (archived) |
| level | string | `basic` or `premium`; the last level when read-only |
| services | array<string> | `crops` if `cropAreaHa` > 0, `trees` if `treeCount` > 0: what the provider computes follows what is on the farm |
| boundaryVersion | number | the boundary version the provider measured |
| version | number | goes up by 1 with each change; the provider keeps the highest it has seen |
| since | timestamp | when the farm last became active |
| graceUntil | timestamp | set while the paid band does not cover this farm; null otherwise |
| updatedAt | timestamp | |

No UID, phone or name. Readers: the farm's owner and team (`get` only), and Wafra staff. A trial farm is
simply `active`: the provider charges Wafra the same for it.

## `customers/{uid}` — revenuecat
RevenueCat's copy of one buyer's purchases, in RevenueCat's own format (the v1 API's `subscriber` object):
active entitlements (`basic` or `premium`), the active product (its ID gives the paid band), trial, purchase
and expiry dates. `revenueCatWebhook` asks RevenueCat for the current state on every purchase event and
replaces the document with it; `requestDateMs` (when RevenueCat answered) keeps a slower, older answer from
overwriting a newer one. Readers: the buyer, and `keepActiveFarms`.

## `pricing/current` — staff
The price table the app shows. **Final prices only**, never supplier rates or markup. Its content is in
Wafra's private price sheet, not in this repository. Anyone signed in can read it, so it holds **no rate**:
with the rates, anyone could compare them with the provider's and work out Wafra's margin. The rates are in
`pricing/rates`; the app asks `quotePrice` for its band.

Two levels, Basic and Premium. **Crops are priced per hectare and trees per tree**; trees are never counted
as hectares. For all the owner's farms together: monthly total = the cost of the crop hectares (`crop`) + the
cost of the trees (`trees`), each worked out **row by row, like tax brackets**: the hectares up to the first
row's `upTo` at that row's rate, the next ones at the next row's rate, and so on. So the total never goes down
when land or trees are added. The total is **always rounded down** to a band: the highest band whose
`month` price is at or below it. A total below the first band pays the first band (the minimum bill). A total
above the top band has no band: the owner needs a contract (never the top band). The rules are in [`firebase/functions/pricing.js`](firebase/functions/pricing.js).

| Field | Type | Notes |
|---|---|---|
| version | string | e.g. `2026-10`; the same in `pricing/rates` |
| currency | string | `USD` |
| vat | map | per country (ISO alpha-2) |
| inApp | map | `{ maxFarms, maxHaPerFarm, maxTreesPerFarm }`; a bigger owner needs a contract |
| bands | array<map> | sorted by `month`: `{ band, month, year }`; `year` is null when there is no yearly product |
| productIds | map | the product ID pattern: `wafra_{level}_{m or y}_{band, 3 digits}`, e.g. `wafra_premium_m_012`; on Google Play, RevenueCat adds the base plan (`wafra_premium_m_012:monthly`) |

## `pricing/rates` — staff
The rest of the price table: what makes the monthly total. **Staff only**: the app never reads it. Only the
functions do: `keepActiveFarms`, to check which farms the paid band covers, and `quotePrice`, to answer the
app with a band. While either price document is missing, `keepActiveFarms` writes nothing for an owner who
pays in the app, and `quotePrice` answers "unavailable". Rates are Wafra's selling rates, without VAT.

| Field | Type | Notes |
|---|---|---|
| version | string | the same as in `pricing/current` |
| minimum | map | `{ cropHa, trees }`: a holding with crops pays for at least `cropHa` hectares, one with trees for at least `trees` trees |
| crop | array<map> | USD per hectare per month for the hectares in each row (row by row): `{ upTo, basic, premium }`, sorted by `upTo`; `upTo` is null on the open last row |
| trees | array<map> | USD per tree per month for the trees in each row (row by row): `{ upTo, basic, premium }`, sorted by `upTo`; `upTo` is null on the open last row |

`quotePrice` (callable, App Check) takes `{ add: [{ cropAreaHa, treeCount }] }`: the farms being drawn, not
measured yet (at most 10). It adds the caller's farms paid in the app (measured, active, not on a contract)
and answers `{ version, currency, needsContract, levels }`, where `levels.basic` and `levels.premium` are
`{ needsContract: false, band, month, year, productIds: { m, y } }`, or `{ needsContract: true }` when that
level's total is above the top band. The top `needsContract` is true when no level can be bought: the farms
are outside `inApp` (then `levels` is null), or both levels are above the top band. It never answers with a
rate or a dollar total.

## `contracts/{contractId}` — staff
A deal paid by invoice: a government, a company, or an owner outside the in-app limits. Anyone signed in can
fetch one by its random ID, to show "Covered by …". Nobody can list them.

| Field | Type | Notes |
|---|---|---|
| clientName | string | shown as "Covered by …" |
| level | string | `basic` or `premium` |
| additionalUsers | number | seats per owner, or null for the level's default |
| startsAt, endsAt | timestamp | |
| status | string | `draft`, `active`, `ended` or `suspended`; staff suspend it if the invoice is not paid |
| updatedAt | timestamp | |

Sub-document `contracts/{contractId}/private/terms`, staff only: `kind` (`government`, `company`,
`cooperative`, `ngo` or `owner`), `country`, `contact` (`{ name, email, phone }`), `farmCount`, `price`
(`{ usd, vatRate, period }` as invoiced), `invoiceRef`, `paid`, `createdAt`.

## `contractFarms/{phone}` — staff
The farms a contract covers, keyed by the owner's phone number in E.164. It is how the app finds a contract
owner's farms at sign-up. A person can read only the entry for their own verified phone number; nobody can
list the collection.

Fields: `contractId`, `farms` (an array of `{ name, location: {lat, lon}, boundary: [{lat, lon}, …],
areaHa, treeCount }`), `addedAt`.

## `suggestions/{suggestionId}` — app
A log of every advice the provider's engine makes for a farm, written by the app when it receives it. Never
deleted; when replaced, marked `superseded`. The fields are Wafra's own format, whatever the provider.

| Field | Type | Writer | Notes |
|---|---|---|---|
| farmId | string | app | Wafra's farm ID |
| provider | string | app, from the provider | `mmc` |
| providerPlotIds, plotNames | array<string> | app, from the provider | the provider's plot IDs, and the plot names at the time |
| type | string | app, from the provider | `irrigation`, `nutrition`, `protection` or `weather` |
| severity | string | app, from the provider | `monitor` or `urgent` |
| headline, action | string | app, from the provider | a short English summary |
| activeIngredient | string | app, from the provider | for `protection` only (no product names in V1) |
| ruleVersion, providerAdviceId | string | app, from the provider | the rule or model version that made it |
| issuedAt | timestamp | app, from the provider | |
| supersededBy | string | app, from the provider | |
| status | string | app | `open`, `deferred`, `completed` or `superseded` |
| seenAt, deferredUntil, completedAt | timestamp | app | |
| completedBy | string | app | a uid, or `contact:<id>` |
| assignedTo | map | app | `{ type: user or contact, id, name }`, or null |
| shareCount, lastSharedAt | number, timestamp | app | |

Sub-collection `suggestions/{suggestionId}/shares/{shareId}` (app, append-only): one record every time
an advice is sent to someone. Fields: `farmId`, `kind` (`share` or `assign`), `byUid`, `auto`, `recipient`
(`{ type: user or contact, id, name }`), `channel` (`app`, `whatsapp`, `sms`, `telegram` or `email`),
`delivery` (`queued`, `sent`, `delivered`, `read` or `failed`), `at`, `deliveryUpdatedAt`.

## `feedback/{feedbackId}` — app, handled by staff
Fields: `uid`, `farmId` (optional), `type` (`bug`, `idea` or `question`), `message` (1–4000 characters),
`appVersion`, `platform`, `lang`, `status`, `createdAt`. The app creates it with `status: new`. Staff add
`assigneeUid`, `resolution` and `updatedAt`, and move `status` through `assigned` to `resolved`.

## Not in Firestore
- **Purchases and receipts:** in RevenueCat (copied into `customers`) and in Wafra's accounting tool.
- **The provider's data:** plots, crop cycles, imagery, indices, health, weather, reports, the full advice
  text. Its copy of the farm list (from the push), keyed by its own farm IDs.
- **Settings and secrets of the functions:** the KMS signing key, the code-name secret and the provider's
  addresses (see the [README](README.md#7-setting-up-a-project)).
- **Device-only data:** the offline queue, the cache, GPS.
