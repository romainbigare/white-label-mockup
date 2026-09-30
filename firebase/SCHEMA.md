# Wafra Farm App — Firestore schema v1

Wafra's Firestore is a **light mirror** of MMC's backend, not a second source of truth. MMC owns the
agronomy: plots, imagery, indices and the advice engine. **RevenueCat owns billing and entitlements.**
Wafra keeps only what it needs to run the business and support its customers:

1. who the customers are (people, sponsors, roles),
2. which farms they have (name, location, boundary),
3. what each farm is entitled to (a read-only copy of RevenueCat),
4. what customers tell us (feedback),
5. every suggestion made, and whether it was shared with or assigned to someone.

How accounts, roles, sponsors and payment fit together is described in `ACCOUNTS_ROLES_BILLING.md`.

Both projects (`wafra-farm-staging` and `wafra-farm-production`) use the `(default)` database, Standard
edition, in `me-central2` (Dammam). The rules are in `firestore.rules` and the indexes in
`firestore.indexes.json`.

## Conventions

- **Who writes.** Everything mirrored is written server-side with the Admin SDK, which bypasses the rules.
  There are three writers:
  - **sync**: MMC's backend;
  - **billing**: Wafra's RevenueCat webhook handler;
  - **enrolment**: Wafra's sponsor enrolment service.

  The app writes only three things: the signed-in user's own profile, their devices and their feedback.
- `uid` is the Firebase Auth UID from phone sign-in. It is **also the RevenueCat app user ID**. Every other
  ID is opaque, and MMC's own ID is kept alongside in an `mmc…Id` field.
- Timestamps are Firestore `Timestamp`; enums are lower-case strings.
- **No nested arrays**, because Firestore rejects them. A polygon is an array of `{ lat, lon }` maps (WGS84).
- Every mirrored document carries `syncedAt`.
- The custom claim `admin: true` marks Wafra staff, who can read everything.
- **There is no subscription collection.** Plans, trials, renewals and prices live in RevenueCat only.

## `users/{uid}`
A person who can sign in.

| Field | Type | Writer | Notes |
|---|---|---|---|
| firstName, lastName | string | app | |
| email | string | app | optional |
| phone | string | app | E.164; must be the Auth phone number |
| preferences | map | app | `lang`, `areaUnit` (`hectare` or `dunum`), `timeFormat` (`12h` or `24h`), `numerals` (`western` or `eastern`) |
| sponsor | map | enrolment | `{ orgId, name, until }` while the user is a sponsored member, otherwise null. Lets the app say "Covered by ADAFSA". |
| mmcUserId | string | sync | |
| createdAt, updatedAt | timestamp | app | |
| lastActiveAt, syncedAt | timestamp | sync | |

Sub-collection `users/{uid}/devices/{deviceId}` (written by the app): `fcmToken`, `platform` (`ios` or
`android`), `appVersion`, `lastSeenAt`. Push notifications go out through Wafra's Firebase.

## `organizations/{orgId}` — enrolment, server-only
**Sponsors only.** An organisation is an enterprise agreement that pays for many owners, for example ADAFSA.
A farmer who pays for themselves has no organisation. Clients cannot read these documents; a sponsored
user sees the sponsor's name in `users.sponsor`.

| Field | Type | Notes |
|---|---|---|
| name | string | |
| kind | string | `government`, `cooperative`, `bank`, `company` or `ngo` |
| country | string | ISO 3166 alpha-2 |
| contact | map | `{ name, email, phone }` |
| agreement | map | see below |
| seatsUsed | number | the number of active members |
| createdAt, syncedAt | timestamp | |

The `agreement` map holds:
- `status`: `draft`, `active`, `ended` or `suspended`;
- `startsAt`, `endsAt`;
- `entitlements`: the RevenueCat entitlements granted to members, e.g. `["crop_premium", "tree_premium"]`;
- `seatsMax`, e.g. 25000;
- `additionalUsers`: overrides the tier's seat allowance, or null to keep it;
- `eligibility`: `allowlist`, `registry`, `code`, or a combination;
- `invoiceRef`.

Sub-collections, both server-only:
- `members/{uid}`: `uid`, `status` (`active` or `removed`), `via` (`allowlist`, `registry` or `code`),
  `enrolledAt`, `grantedUntil`, `removedAt`, `farmIds`.
- `eligibility/{key}`: who may enrol. `key` is the SHA-256 of an E.164 phone number, `registry:<holdingId>`
  or `code:<code>`. Fields: `status` (`unused` or `used`), `usedBy`, `addedAt`. Only hashes are stored here,
  never the sponsor's raw list.

## `farmAccess/{uid}_{farmId}` — sync
Roles. There is one document per person per farm, and the document ID must be `uid + "_" + farmId`, because
the rules look it up by that name.

Fields: `uid`, `farmId`, `role`, `status` (`invited`, `active` or `revoked`), `grantedBy`, `grantedAt`,
`revokedAt`, `syncedAt`.

`role` is one of:
- `owner`: the farm's payer. Full rights, including billing.
- `co-owner`: full rights on the farm, no billing.
- `supervisor`: can view the farm and redraw boundaries; no billing, cannot invite.

## `farms/{farmId}` — sync (identity), billing (`access`)

| Field | Type | Notes |
|---|---|---|
| ownerUid | string | the payer; their RevenueCat customer decides the farm's entitlements |
| name, nameAr | string | |
| type | string | `crops`, `trees` or `mixed` |
| country, region | string | |
| location | geopoint | the farm's centre |
| areaHa | number | always hectares |
| boundary | map | `{ points: [{lat, lon}, …], areaHa, version, updatedAt, updatedBy }` |
| registration | string | `drawn` or `survey` |
| plotCount, treeCount | number | a summary for support |
| status | string | `active` or `archived` |
| mmcFarmId | string | |
| access | map | a **read-only copy** of the owner's RevenueCat state, written by the billing handler; see below |
| createdAt, syncedAt | timestamp | |

The `access` map holds:
- `source`: `purchase`, `sponsor` or `none`;
- `sponsorOrgId`;
- `entitlements`, e.g. `["crop_premium"]`;
- `tier`: `basic` or `premium`;
- `additionalUsers`;
- `expiresAt`;
- `readOnly`: true when no entitlement is active;
- `syncedAt`.

This copy exists so that co-owners and supervisors, whose phones cannot read the owner's RevenueCat record,
know what the farm is entitled to. The owner's own app reads RevenueCat directly, and MMC reads it through
the RevenueCat API.

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
- **Billing:** plans, trials, renewals, prices and receipts are in RevenueCat.
- **MMC's data:** plots, crop cycles, plot boundaries, tree groups, imagery, indices, health, weather and
  reports; the full text of each suggestion; the survey's detected areas.
- **Invitation codes:** only the resulting `farmAccess` document is mirrored.
- **Device-only data:** the offline queue, the cache and GPS.
