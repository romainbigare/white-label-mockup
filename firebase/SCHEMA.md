# Wafra Farm App — Firestore schema v1

Wafra's Firestore is a **light mirror** of MMC's backend, not a second source of truth. MMC owns the
agronomy: plots, imagery, indices and the advice engine. **Wafra owns the prices** (`pricing/current`);
in-app purchases are recorded in RevenueCat.
Wafra keeps only what it needs to run the business and support its customers:

1. who the customers are (people, contracts, roles),
2. which farms they have (name, location, boundary),
3. who pays for each farm, and what it may use (its `plan`),
4. the price table,
5. what customers tell us (feedback),
6. every suggestion made, and whether it was shared with or assigned to someone.

How accounts, roles, contracts and payment fit together is described in `ACCOUNTS_ROLES_BILLING.md`.
Prices, bands and store products are in [`docs/PRICING_STRATEGY.md`](../docs/PRICING_STRATEGY.md).

Both projects (`wafra-farm-staging` and `wafra-farm-production`) use the `(default)` database, Standard
edition, in `me-central2` (Dammam). The rules are in `firestore.rules` and the indexes in
`firestore.indexes.json`.

## Conventions

- **Who writes.** Wafra runs no server. There are two writers besides the app:
  - **sync**: MMC's backend, with the Admin SDK, which bypasses the rules. It writes everything mirrored,
    including each farm's `plan`;
  - **staff**: Wafra staff (`admin` claim), from the Firebase console or an admin page. They write the price
    table, contracts and contract farm lists.

  The app writes only three things: the signed-in user's own profile, their devices and their feedback.
- `uid` is the Firebase Auth UID from phone sign-in. It is **also the RevenueCat app user ID**. Every other
  ID is opaque, and MMC's own ID is kept alongside in an `mmc…Id` field.
- Timestamps are Firestore `Timestamp`; enums are lower-case strings.
- **No nested arrays**, because Firestore rejects them. A polygon is an array of `{ lat, lon }` maps (WGS84).
- Every mirrored document carries `syncedAt`.
- The custom claim `admin: true` marks Wafra staff, who can read everything.
- **There is no purchase collection.** In-app purchases, trials and renewals live in RevenueCat; contracts
  are in `contracts`. What each farm may use is copied into `farms.plan`.

## `users/{uid}`
A person who can sign in.

| Field | Type | Writer | Notes |
|---|---|---|---|
| firstName, lastName | string | app | |
| email | string | app | optional |
| phone | string | app | E.164; must be the Auth phone number |
| preferences | map | app | `lang`, `areaUnit` (`hectare` or `dunum`), `timeFormat` (`12h` or `24h`), `numerals` (`western` or `eastern`) |
| contract | map | sync | `{ contractId, clientName, until }` while the user's farms are covered by a contract, otherwise null. Lets the app say "Covered by ADAFSA". |
| mmcUserId | string | sync | |
| createdAt, updatedAt | timestamp | app | |
| lastActiveAt, syncedAt | timestamp | sync | |

Sub-collection `users/{uid}/devices/{deviceId}` (written by the app): `fcmToken`, `platform` (`ios` or
`android`), `appVersion`, `lastSeenAt`. Push notifications go out through Wafra's Firebase.

## `pricing/current` — staff
The price table. The app prices farms from it; MMC never does. Anyone signed in can read it. It holds
**final prices only**, never supplier rates or markup. Its content is in Wafra's private price sheet, not in
this repository; how it is used is in `docs/PRICING_STRATEGY.md`.

| Field | Type | Notes |
|---|---|---|
| version | string | e.g. `2026-10` |
| currency | string | `USD`; all prices are before VAT, as decimal strings |
| vat | map | per country (ISO alpha-2), e.g. `{ AE: "0.05" }` |
| inApp | map | `{ maxFarms, maxHaPerFarm, maxTreesPerFarm, maxPaymentBeforeVat }` |
| crop | map | `{ bandSize, bands: [{ band, upToHa, advanced: { month, year }, professional: { month, year } }] }` |
| trees | map | `{ bandSize, bands: [{ band, upToTrees, advanced: {…}, professional: {…} }] }` |
| steps | array<map> | `{ step, month, year }`; `year` is null when there is no yearly product |
| productIds | map | the product ID patterns per tier and period |

## `contracts/{contractId}` — staff
A deal paid by invoice: a government, a company, or an owner outside the in-app limits.

| Field | Type | Notes |
|---|---|---|
| clientName | string | |
| kind | string | `government`, `company`, `cooperative`, `ngo` or `owner` |
| country | string | ISO 3166 alpha-2 |
| contact | map | `{ name, email, phone }` |
| tier | string | `advanced` or `professional` |
| farmCount | number | the farms paid for |
| additionalUsers | number | overrides the tier's seat allowance, or null to keep it |
| price | map | `{ usd, vatRate, period }` as invoiced |
| startsAt, endsAt | timestamp | |
| status | string | `draft`, `active`, `ended` or `suspended` |
| invoiceRef | string | the number in the accounting tool |
| paid | bool | set by staff when the bank transfer arrives |
| createdAt, updatedAt | timestamp | |

## `contractFarms/{phone}` — staff
The farms a contract covers, keyed by the owner's phone number in E.164. It is how the app finds a contract
owner's farms at sign-up. A signed-in person can read only the document whose ID is their own verified
phone number; nobody can list the collection.

Fields: `contractId`, `farms` (an array of `{ name, location: {lat, lon}, boundary: [{lat, lon}, …],
areaHa, treeCount }`), `claimedBy` (a uid, set by sync once the owner has signed up), `addedAt`.

## `farmAccess/{uid}_{farmId}` — sync
Roles. There is one document per person per farm, and the document ID must be `uid + "_" + farmId`, because
the rules look it up by that name.

Fields: `uid`, `farmId`, `role`, `status` (`invited`, `active` or `revoked`), `grantedBy`, `grantedAt`,
`revokedAt`, `syncedAt`.

`role` is one of:
- `owner`: the farm's payer. Full rights, including billing.
- `co-owner`: full rights on the farm, no billing.
- `supervisor`: can view the farm and redraw boundaries; no billing, cannot invite.

## `farms/{farmId}` — sync

| Field | Type | Notes |
|---|---|---|
| ownerUid | string | the owner; pays in the app unless the farm is on a contract |
| name, nameAr | string | |
| type | string | `crops`, `trees` or `mixed` |
| country, region | string | |
| location | geopoint | the farm's centre |
| areaHa | number | always hectares |
| boundary | map | `{ points: [{lat, lon}, …], areaHa, version, updatedAt, updatedBy }` |
| registration | string | `drawn` or `survey` |
| cropAreaHa | number | the crop hectares MMC measured; the price uses it |
| treeCount | number | the trees MMC counted; the price uses it |
| plotCount | number | a summary for support |
| status | string | `active` or `archived` |
| mmcFarmId | string | |
| plan | map | who pays for the farm and what it may use; see below |
| createdAt, syncedAt | timestamp | |

The `plan` map holds:
- `paidBy`: `store`, `contract` or `none`;
- `contractId`, when `paidBy` is `contract`;
- `tier`: `advanced` or `professional`;
- `additionalUsers`;
- `until`;
- `readOnly`: true when nothing is paid;
- `syncedAt`.

All of an owner's farms carry the same plan, unless some are on a contract. MMC writes it from RevenueCat
(for `store`) or from `contracts/{id}` (for `contract`), and checks the same sources before doing any work.
The app, including co-owners' and supervisors' phones, reads it from here.

Sub-collection `farms/{farmId}/contacts/{contactId}` (sync). These are the people suggestions are sent to
(screen B10). They cannot sign in. Fields: `name`, `phone`, `channel` (`whatsapp`, `sms` or `telegram`),
`language`, `role` (`supervisor` or `worker`), `active`, `syncedAt`. A person who works on two farms has one
record on each.

## `feedback/{feedbackId}` — created by the app, handled by Wafra staff
Fields: `uid`, `farmId` (optional), `type` (`bug`, `idea` or `question`), `message` (1–4000 characters),
`appVersion`, `platform`, `lang`, `status`, `createdAt`.

The app creates it with `status: new`. Staff then add `assigneeUid`, `resolution` and `updatedAt`, and move
`status` through `assigned` to `resolved`. Nobody deletes feedback.

## `suggestions/{suggestionId}` — sync
A log of every suggestion MMC's engine makes (called "advice" in the app). Suggestions are never deleted;
when replaced, they are marked `superseded`.

| Field | Type | Notes |
|---|---|---|
| farmId | string | |
| plotIds, plotNames | array<string> | MMC's plot IDs, plus the plot names as they were at the time |
| type | string | `irrigation`, `nutrition`, `protection` or `weather` |
| severity | string | `monitor` or `urgent` |
| headline, action | string | a short English summary |
| activeIngredient | string | for `protection` suggestions only (no product names in V1) |
| ruleVersion | string | |
| issuedAt | timestamp | |
| status | string | `open`, `deferred`, `completed` or `superseded` |
| seenAt, deferredUntil, completedAt | timestamp | |
| completedBy | string | a uid, or `contact:<id>` |
| supersededBy | string | |
| assignedTo | map | `{ type: user or contact, id, name }`, or null |
| shareCount | number | |
| lastSharedAt | timestamp | |
| mmcAdviceId | string | |
| syncedAt | timestamp | |

### `suggestions/{suggestionId}/shares/{shareId}` — sync, append-only
One record every time a suggestion is sent to someone.

Fields:
- `farmId`;
- `kind`: `share` or `assign`;
- `byUid`: who sent it;
- `auto`: true if it was sent by the "always send" rule;
- `recipient`: `{ type: user or contact, id, name }`;
- `channel`: `app`, `whatsapp`, `sms`, `telegram` or `email`;
- `delivery`: `queued`, `sent`, `delivered`, `read` or `failed`;
- `at`, `deliveryUpdatedAt`.

## Out of scope in v1
- **Purchases and receipts:** in RevenueCat (in the app) and in Wafra's accounting tool (contracts).
- **MMC's data:** plots, crop cycles, plot boundaries, tree groups, imagery, indices, health, weather and
  reports; the full text of each suggestion; the survey's detected areas.
- **Invitation codes:** only the resulting `farmAccess` document is mirrored.
- **Device-only data:** the offline queue, the cache and GPS.
