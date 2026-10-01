# Firestore schema

*Part of the [service architecture](README.md). Status: draft, not built. The rules are in
[`firebase/firestore.rules`](../../firebase/firestore.rules).*

Wafra's Firestore holds **all client data**: people, farms, roles, contacts, purchases (as a copy),
contracts and prices. MMC holds farm IDs, shapes and its own results, and reads only `activeFarms` from here,
which is all it needs.

Both projects (`wafra-farm-staging` and `wafra-farm-production`) use the `(default)` database, Standard
edition, in `me-central2` (Dammam).

## Conventions

- **Writers.** Every collection says who writes it:
  - **app**: the app, through the rules;
  - **functions**: Wafra's Cloud Functions ([`CLOUD_FUNCTIONS.md`](CLOUD_FUNCTIONS.md)), with the Admin SDK;
  - **revenuecat**: RevenueCat's Firebase extension, installed in Wafra's Firebase (no code);
  - **staff**: Wafra staff (`admin` claim), from the Firebase console or an admin page.
- **Readers outside the app.** MMC has its own login with the claim `mmc: true`. It reads
  `activeFarms`, and nothing else, because that is all MMC needs.
- `uid` is the Firebase Auth UID from phone sign-in. It is also the RevenueCat app user ID.
- Timestamps are Firestore `Timestamp`; enums are lower-case strings; prices are decimal strings in USD,
  before VAT.
- **No nested arrays** (Firestore rejects them). A polygon is an array of `{ lat, lon }` maps (WGS84).
- **`activeFarms` is the one place that says "is this farm paid?"**, and only the functions write it.

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
`appVersion`, `lastSeenAt`. `notify` sends push to these tokens.

## `farms/{farmId}` — app, and functions for the measured fields
A holding. `ownerUid` is its owner: the payer, unless the farm is on a contract. The owner has full rights
without a `farmAccess` record.

| Field | Type | Writer | Notes |
|---|---|---|---|
| ownerUid | string | app | set at creation to the creator; changes only by transfer (Wafra staff) |
| name, nameAr | string | app | |
| type | string | app | `crops`, `trees` or `mixed` |
| country, region | string | app | |
| location | geopoint | app | the farm's centre |
| boundary | map | app | `{ points: [{lat, lon}, …], areaHa, version, updatedAt, updatedBy }` |
| contractId | string | app | set only at creation, and only to the contract in the creator's own `contractFarms` entry; otherwise null |
| adviceRules | map | app | where each type of advice goes, and whether it is sent automatically |
| status | string | app | `active` or `archived` |
| createdAt, updatedAt | timestamp | app | |
| mmcFarmId | string | functions | MMC's farm ID, from the first survey |
| surveyStatus | string | functions | `none`, `running`, `done` or `failed` |
| surveyedBoundaryVersion | number | functions | the boundary version MMC measured |
| cropAreaHa | number | functions | the crop hectares MMC measured; the price uses it |
| treeCount | number | functions | the trees MMC counted; the price uses it |
| sizeUpdatedAt | timestamp | functions | when `cropAreaHa` or `treeCount` last changed |

The size changes only after a survey: when the farm is created, or its boundary changes. Never on each new
satellite image, so the price does not jump between bands on its own.

Sub-collection `farms/{farmId}/contacts/{contactId}` (app; owner and co-owners). The people advice is sent to
(B10). They cannot sign in. Fields: `name`, `phone`, `channel` (`whatsapp`, `sms` or `telegram`),
`language`, `role` (`supervisor` or `worker`), `active`.

## `farmAccess/{uid}_{farmId}` — functions (`redeemInvite`), app to revoke
A co-owner's or supervisor's role on one farm. The document ID must be `uid + "_" + farmId`, because the
rules look it up by that name. The owner has none.

Fields: `uid`, `farmId`, `ownerUid`, `role` (`co-owner` or `supervisor`), `status` (`active` or `revoked`),
`grantedBy`, `grantedAt`, `revokedAt`. The owner or a co-owner may change `status` to `revoked`.

## `invites/{code}` — app, used by functions
An invitation to join a farm. The owner or a co-owner creates it; `redeemInvite` uses it.

Fields: `farmId`, `ownerUid`, `role`, `createdBy`, `createdAt`, `expiresAt`, `usedBy`, `usedAt`.

## `activeFarms/{farmId}` — functions
**The centre of the system.** One record per farm that is paid for. The app reads it to show a farm active or
read-only; MMC reads it to know which farms to analyse.

| Field | Type | Notes |
|---|---|---|
| mmcFarmId | string | MMC's farm ID |
| tier | string | `advanced` or `professional` |
| since | timestamp | when the farm came on the list |
| graceUntil | timestamp | set while the paid step does not cover this farm; null otherwise |
| updatedAt | timestamp | |

Readers: the farm's owner and team, Wafra staff, and MMC's login.

## `customers/{uid}` — revenuecat
RevenueCat's copy of one buyer's purchases, in RevenueCat's own format: active entitlements (`advanced` or
`professional`), the active product (its ID gives the paid price step), trial, purchase and expiry dates.
Readers: the buyer, and `keepActiveFarms`.

## `pricing/current` — staff
The price table. **Final prices only**, never supplier rates or markup. Its content is in Wafra's private
price sheet, not in this repository. Anyone signed in can read it.

| Field | Type | Notes |
|---|---|---|
| version | string | e.g. `2026-10` |
| currency | string | `USD` |
| vat | map | per country (ISO alpha-2) |
| inApp | map | `{ maxFarms, maxHaPerFarm, maxTreesPerFarm, maxPaymentBeforeVat }` |
| crop, trees | map | `{ bandSize, bands: [{ band, upTo, advanced: { month, year }, professional: { month, year } }] }` |
| steps | array<map> | `{ step, month, year }`; `year` is null when there is no yearly product |
| productIds | map | the product ID patterns per tier and period |

## `contracts/{contractId}` — staff
A deal paid by invoice: a government, a company, or an owner outside the in-app limits. Anyone signed in can
fetch one by its random ID, to show "Covered by …". Nobody can list them.

| Field | Type | Notes |
|---|---|---|
| clientName | string | shown as "Covered by …" |
| tier | string | `advanced` or `professional` |
| additionalUsers | number | seats per owner, or null for the tier's default |
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

## `suggestions/{suggestionId}` — functions (`notify`), app for status
A log of every advice MMC's engine makes for a farm. Never deleted; when replaced, marked `superseded`.

| Field | Type | Writer | Notes |
|---|---|---|---|
| farmId | string | functions | |
| plotIds, plotNames | array<string> | functions | MMC's plot IDs, and the plot names at the time |
| type | string | functions | `irrigation`, `nutrition`, `protection` or `weather` |
| severity | string | functions | `monitor` or `urgent` |
| headline, action | string | functions | a short English summary |
| activeIngredient | string | functions | for `protection` only (no product names in V1) |
| ruleVersion, mmcAdviceId | string | functions | |
| issuedAt | timestamp | functions | |
| supersededBy | string | functions | |
| status | string | app | `open`, `deferred`, `completed` or `superseded` |
| seenAt, deferredUntil, completedAt | timestamp | app | |
| completedBy | string | app | a uid, or `contact:<id>` |
| assignedTo | map | app | `{ type: user or contact, id, name }`, or null |
| shareCount, lastSharedAt | number, timestamp | functions | |

Sub-collection `suggestions/{suggestionId}/shares/{shareId}` (functions, append-only): one record every time
an advice is sent to someone. Fields: `farmId`, `kind` (`share` or `assign`), `byUid`, `auto`, `recipient`
(`{ type: user or contact, id, name }`), `channel` (`app`, `whatsapp`, `sms`, `telegram` or `email`),
`delivery` (`queued`, `sent`, `delivered`, `read` or `failed`), `at`, `deliveryUpdatedAt`.

## `feedback/{feedbackId}` — app, handled by staff
Fields: `uid`, `farmId` (optional), `type` (`bug`, `idea` or `question`), `message` (1–4000 characters),
`appVersion`, `platform`, `lang`, `status`, `createdAt`. The app creates it with `status: new`. Staff add
`assigneeUid`, `resolution` and `updatedAt`, and move `status` through `assigned` to `resolved`.

## Not in Firestore
- **Purchases and receipts:** in RevenueCat (copied into `customers`) and in Wafra's accounting tool.
- **MMC's data:** plots, crop cycles, imagery, indices, health, weather, reports, the full advice text.
- **Device-only data:** the offline queue, the cache, GPS.
