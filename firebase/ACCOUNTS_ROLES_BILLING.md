# Accounts, roles and billing — how the Wafra Farm App handles them

*Companion to `SCHEMA.md` (Firestore schema v1). Audience: Wafra, MMC. Status: proposal for sign-off.*

## 1. Decisions

1. **RevenueCat is the source of truth for who has paid for what.** Wafra owns and runs the RevenueCat
   project. Firestore has no subscription records.
2. **Each person is one RevenueCat customer, identified by their Firebase UID.** One phone number gives one
   UID, which is one RevenueCat customer.
3. **Organisations are optional and mean one thing only: a sponsor.** A sponsor is an enterprise agreement
   that pays for many owners, for example ADAFSA covering 25,000 owners. A farmer who pays for themselves has
   no organisation.
4. **Sponsored owners are onboarded free.** When they sign up, Wafra grants them the sponsor's entitlements in
   RevenueCat, as a promotional grant that lasts until the agreement ends. From then on they look like any
   other entitled customer.
5. **Roles are per farm:** owner, co-owner or supervisor. The payer of a farm is its owner.
6. **MMC gets a read-only RevenueCat key** and checks entitlements itself before it computes or serves
   anything.
7. **Firestore keeps one small, read-only copy of the payer's access on each farm.** It exists because a
   supervisor's phone cannot read the owner's RevenueCat record.

## 2. The building blocks

| Thing | What it is | Where it lives |
|---|---|---|
| **Account** | A person who can sign in (phone and SMS code). | Firebase Auth, plus `users/{uid}` |
| **RevenueCat customer** | That same person, as a buyer. App user ID = Firebase UID. | RevenueCat |
| **Farm** | A holding with a name and a boundary. It has exactly one owner, who is its payer. | `farms/{farmId}`, and MMC for everything agronomic |
| **Farm access** | A person's role on one farm. | `farmAccess/{uid}_{farmId}` |
| **Sponsor** | An organisation with an agreement: who it covers, which entitlements, how many seats, until when. | `organizations/{orgId}` |
| **Contact** | A worker or supervisor who receives suggestions by WhatsApp or SMS. Contacts have no account. | `farms/{farmId}/contacts/{contactId}` |

## 3. Roles

| | Owner | Co-owner | Supervisor | Contact (no account) | Wafra staff |
|---|---|---|---|---|---|
| Has an account | yes | yes | yes | no | yes (`admin` claim) |
| Sees the farm, maps and suggestions | yes | yes | yes | only the suggestions sent to them | everything (read) |
| Edits the farm and plots, redraws boundaries | yes | yes | only boundaries, and only on the farms they've been given | – | – |
| Sends suggestions on, sets automatic sending | yes | yes | no | – | – |
| Invites or removes people | yes | yes | no | – | – |
| Deletes or transfers the farm | yes | no | no | – | through MMC or Wafra ops |
| **Billing:** buys, upgrades, cancels | yes (pays for the farm) | no | no | – | – |
| Paid for by | themselves or their sponsor | the farm's owner | the farm's owner | – | – |

A co-owner or supervisor works under the owner's entitlements on that farm. On a farm of their own, they
are its owner, with their own entitlements. The full capability matrix is in `app/core/capabilities.js`,
and MMC's API enforces it on every call. The Firestore rules enforce the owner/supervisor split and who can
reach which farm.

## 4. Three ways a farm gets paid for

| | 1 · Self-paid in the app | 2 · Self-paid on the web (B2B) | 3 · Sponsored |
|---|---|---|---|
| Who | a single farm owner | a company or a large farm on an invoice | members of an agreement (e.g. ADAFSA) |
| How | App Store or Google Play in-app purchase, through RevenueCat | web admin portal, then a RevenueCat grant (or RevenueCat Web Billing) | enrolment check, then a RevenueCat promotional grant |
| Trial | 14 days (store introductory offer) | as agreed | none needed |
| Price | per-country store price tiers | invoiced as agreed | paid by the sponsor, invoiced by Wafra |
| `farms.access.source` | `purchase` | `purchase` | `sponsor` |
| Paywall shown | yes, until they subscribe | no | no, while the agreement is active |

In every case the app, MMC and the Firestore copy ask the same question — *which entitlements are active?*
— so none of them needs to know which route the payment took.

### Entitlements in RevenueCat

- Four entitlements: `crop_basic`, `crop_premium`, `tree_basic`, `tree_premium`.
- A combined product grants the crop and tree entitlements of the same tier. That keeps it one product at
  one price, as the app requires (WF4.107).
- The mapping from entitlement to feature keys (`PLANS` in `app/core/entitlements.js`) should move to remote
  configuration, such as RevenueCat offering metadata or Firebase Remote Config. The app keeps asking
  `has(featureKey)`, and the list can change without a new release.
- Seats come from the tier: Basic gives 1 additional user, Premium gives 2. A sponsor agreement can override
  this.
- No active entitlement means **read-only** (WF9.032), never locked out.

## 5. The flows

### 5.1 New farmer, paying for themselves
1. The farmer signs in with phone and SMS code. Firebase gives a UID, and the app calls RevenueCat
   `logIn(uid)` *before* showing any paywall. Purchases are never made anonymously.
2. The farmer creates a farm and draws its boundary. MMC creates the farm, and the Firestore sync writes
   `farms/{id}` with `ownerUid = uid` and `farmAccess/{uid}_{farmId}` with role `owner`.
3. The survey prices the farm. The paywall offers the matching product; the 14-day trial is the store's
   introductory offer.
4. RevenueCat sends a webhook. Wafra's handler updates `farms.access` on every farm this owner owns.
5. MMC reads the entitlements from RevenueCat and starts producing results.

### 5.2 Sponsored farmer (e.g. ADAFSA)
1. Wafra creates the sponsor in `organizations/{orgId}`, with its agreement: entitlements, seat cap, dates
   and how eligibility is checked. Wafra loads the eligibility list the sponsor supplies (phone numbers or
   ADAFSA holding IDs), stored hashed and server-only.
2. The farmer signs in. The enrolment service matches them by phone number, by the ADAFSA holding their
   boundary came from, or by an agreement code they enter.
3. On a match, the service:
   - grants the agreement's entitlements in RevenueCat as a promotional grant, ending on the agreement's
     end date;
   - writes `organizations/{orgId}/members/{uid}`;
   - adds one to the seats used;
   - sets `users.sponsor` and `farms.access.source = 'sponsor'`.
4. The app never shows a paywall to a sponsored farmer, and says "Covered by ADAFSA" where the plan would
   normally appear.
5. When the agreement ends or the farmer is removed, the grant expires. The farm goes read-only and the
   farmer is offered the normal paid plans. Their farm and data stay as they are.

### 5.3 Inviting a co-owner or supervisor
1. An owner or co-owner creates an invitation in the app.
2. The invitee redeems it. The redeem service checks the **payer's** seat allowance in RevenueCat (or the
   sponsor's override) against the active people on that owner's farms, then writes `farmAccess`.
3. The invitee needs no subscription. Their app reads `farms/{farmId}.access` to know what the farm is
   entitled to.

### 5.4 Edge cases
| Case | Handling |
|---|---|
| Sponsored farmer also buys a plan | RevenueCat combines the entitlements. The app hides the paywall while a sponsor grant is active, so this should not happen by accident. If it does, support refunds through the store. |
| Owner of several farms | One customer and one set of entitlements, covering all their farms. `farms.access` is copied onto each farm. |
| Farm larger than the plan covers | The price band is in the product ID. MMC compares the farm's area and tree count with the band and asks for an upgrade. *(Open question 3.)* |
| Account switching (several phone numbers) | Each phone number is its own UID and its own customer. On switching, the app calls RevenueCat `logOut()` then `logIn(newUid)`. |
| "Restore purchases" with an Apple ID that has been used on another UID | RevenueCat's *restore behaviour* setting decides whether the purchase moves to the new UID. Recommendation: *keep with the original App User ID*, so a shared phone cannot move a subscription. |
| Farm transferred to a new owner | Handled by MMC or Wafra ops: `ownerUid` changes, and `access` is recalculated from the new owner's entitlements. |
| Trial ends with no purchase | No entitlement, so the farm goes read-only. |

## 6. Who checks what, and where

| Who is asking | Question | Where the answer comes from |
|---|---|---|
| Owner's app | What can I use? | RevenueCat SDK (`CustomerInfo.entitlements`) |
| Co-owner's or supervisor's app | What is this farm entitled to? | `farms/{farmId}.access` in Firestore (read-only copy) |
| MMC backend | Should I compute this, or serve this feature? | RevenueCat REST API, read-only key, customer = `farms.ownerUid` |
| Redeem service | Is there a free seat? | RevenueCat (payer's tier), or the sponsor agreement's override |
| Firestore rules | Can this person read this farm? | `farmAccess` only. The rules do not check entitlements. |
| Wafra ops and support | Revenue, churn, a customer's history | RevenueCat dashboard; Firestore for identity, farms, feedback and the suggestions log |

## 7. What has to be built or configured

| Item | Owner | Notes |
|---|---|---|
| RevenueCat project: products, the four entitlements, offerings, restore behaviour | Wafra | App user ID = Firebase UID. |
| RevenueCat webhook handler: writes `farms.access` | Wafra | A Cloud Function, which needs the Blaze plan, or a small service. |
| Enrolment service: sponsor matching and promotional grants | Wafra | Uses the RevenueCat secret key and `organizations/*`. |
| Seat check when an invitation is redeemed | MMC or Wafra | Reads RevenueCat. |
| Read-only RevenueCat key for MMC | Wafra → MMC | A V2 secret key limited to reading customer information. Stored in MMC's secret store. |
| Sync from MMC into Firestore (users, farms, farmAccess, contacts, suggestions and shares) | MMC | Service-account key per environment. |
| Web admin portal (B2B, sponsors) | Wafra / MMC | Grants go through RevenueCat. |

## 8. Open questions
1. **How sponsor eligibility is proven:** a phone-number list, ADAFSA holding IDs, an agreement code, or a
   mix. This affects what personal data the sponsor has to hand over.
2. **What a sponsor may see:** seat counts only (the proposed default), or its members' farms and results?
   This needs a data-sharing clause under PDPL.
3. **Enforcing the price band:** is the band carried in the product ID and checked by MMC, or does RevenueCat
   carry a coverage attribute?
4. **Sponsored seats:** do sponsored owners get the tier default for additional users, or an
   agreement-specific number?
5. **After a sponsorship ends:** does the farmer get a fresh 14-day trial, or go straight to read-only with
   the paid offer?
