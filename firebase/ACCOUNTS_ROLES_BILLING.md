# Accounts, roles and billing — how the Wafra Farm App handles them

*Companion to `SCHEMA.md` (Firestore schema v1) and [`docs/PRICING_STRATEGY.md`](../docs/PRICING_STRATEGY.md)
(prices, bands, store products). Audience: Wafra, MMC. Status: proposal for sign-off.*

## 1. Decisions

1. **Wafra sets every price; MMC never calculates one.** The price table is in Firestore
   (`pricing/current`). The app prices farms from it. See `docs/PRICING_STRATEGY.md`.
2. **Two ways to pay.**
   - Small owners pay **in the app**, through Apple or Google, via RevenueCat.
   - Everyone else (bigger owners, companies, governments) pays **by bank transfer on a Wafra invoice**,
     under a **contract**.
3. **Each person is one RevenueCat customer, identified by their Firebase UID.** One phone number gives one
   UID, which is one RevenueCat customer.
4. **One subscription per owner covers all their farms**, up to the in-app limits (10 farms, 25 ha and 1,000
   trees per farm, and a maximum payment).
5. **Contract farms are found by phone number.** Wafra loads the contract's farm list. When an owner signs
   up, the app finds their farm by their verified phone number. They never see a paywall.
6. **Roles are per farm:** owner, co-owner or supervisor. The payer of a farm is its owner, or its contract.
7. **Every farm carries one `plan` record** (who pays, tier, until when). MMC writes it and checks it before
   doing any work. Co-owners and supervisors read it, because they cannot see the owner's purchases.
8. **Wafra runs no server.** MMC writes everything server-side. Wafra staff write only the price table and
   the contracts.

## 2. The building blocks

| Thing | What it is | Where it lives |
|---|---|---|
| **Account** | A person who can sign in (phone and SMS code). | Firebase Auth, plus `users/{uid}` |
| **RevenueCat customer** | That same person, as a buyer in the app. App user ID = Firebase UID. | RevenueCat |
| **Farm** | A holding with a name and a boundary. It has exactly one owner. | `farms/{farmId}`, and MMC for everything agronomic |
| **Farm access** | A person's role on one farm. | `farmAccess/{uid}_{farmId}` |
| **Plan** | Who pays for a farm, which tier, until when. | `farms/{farmId}.plan` |
| **Contract** | A deal paid by invoice: a government, a company or a big owner. Which farms, which tier, until when. | `contracts/{contractId}` |
| **Contract farm list** | The farms a contract covers, by owner's phone number. | `contractFarms/{phone}` |
| **Price table** | Final prices: bands, price steps, VAT, in-app limits. | `pricing/current` |
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
| **Billing:** buys, upgrades, cancels | yes (pays for their farms in the app) | no | no | – | contracts and prices |
| Paid for by | themselves or a contract | the farm's owner | the farm's owner | – | – |

A co-owner or supervisor works under the farm's plan. On a farm of their own, they are its owner, with their
own plan. The full capability matrix is in `app/core/capabilities.js`, and MMC's API enforces it on every
call. The Firestore rules enforce the owner/supervisor split and who can reach which farm.

## 4. Two ways a farm gets paid for

| | In the app | Contract |
|---|---|---|
| Who | an owner inside the in-app limits | a government, a company, or an owner outside the limits |
| How | Apple or Google, through RevenueCat | bank transfer on a Wafra invoice |
| Price | the owner's farms added up, rounded up to the next price step | the bands, or an agreed price per farm |
| Invoice | Apple or Google | Wafra's accounting tool |
| `farms.plan.paidBy` | `store` | `contract` |
| Paywall shown | yes, until they subscribe | never |

In both cases the app and MMC ask the same question — *what does `farms.plan` say?* — so neither needs to
know how the farm was paid for.

### Entitlements in RevenueCat

- Two entitlements: `advanced` and `professional`. Every `wafra_adv_*` product gives `advanced`, and every
  `wafra_pro_*` product gives `professional`.
- The products are price steps, not plans. Which step an owner buys depends only on the total price of
  their farms. The full list is in `docs/PRICING_STRATEGY.md` §5.
- The mapping from tier to feature keys (`PLANS` in `app/core/entitlements.js`) should move to remote
  configuration, such as the price table or Firebase Remote Config. The app keeps asking
  `has(featureKey)`, and the list can change without a new release.
- Seats come from the tier: Advanced gives 1 additional user, Professional gives 2. A contract can override
  this.
- No active plan means **read-only** (WF9.032), never locked out.

## 5. The flows

### 5.1 New owner, paying in the app
1. The owner signs in with phone and SMS code. Firebase gives a UID, and the app calls RevenueCat
   `logIn(uid)` *before* showing any paywall. Purchases are never made anonymously.
2. The app checks `contractFarms/{phone}`. Nothing is there, so this owner pays for themselves.
3. The owner draws a farm. MMC measures it (hectares and tree count), creates the farm, and the sync writes
   `farms/{id}` with `ownerUid = uid` and `farmAccess/{uid}_{farmId}` with role `owner`.
4. The app prices all the owner's farms from `pricing/current`, picks the price step and shows the price.
   Outside the in-app limits, it shows "We'll send you a quote" instead.
5. The owner pays. RevenueCat records it. MMC reads it and writes `farms.plan` on each of the owner's farms.
6. Adding a farm or hectares moves the owner to a higher step. The store charges the difference.

### 5.2 Owner covered by a contract (e.g. a government)
1. Wafra creates `contracts/{id}`: client, tier, farms, dates, invoice.
2. Wafra loads the contract's farm list into `contractFarms/{phone}`: owner's phone number and farm
   locations.
3. Wafra invoices the client. They pay by bank transfer, and Wafra marks the contract paid.
4. The owner signs in. The app reads `contractFarms/{their phone}` and finds their farms. The rules let
   them read only their own entry.
5. MMC creates the farms, links them to the contract, and writes `farms.plan` with `paidBy: "contract"`.
6. The app never shows a paywall to this owner.
7. When the contract ends, MMC sets the farms read-only. The owner is offered the in-app plans. Their farms
   and data stay as they are.

### 5.3 Inviting a co-owner or supervisor
1. An owner or co-owner creates an invitation in the app.
2. The invitee redeems it. MMC checks the owner's seat allowance (from the tier, or the contract's override)
   against the active people on that owner's farms, then writes `farmAccess`.
3. The invitee needs no subscription. Their app reads `farms/{farmId}.plan` to know what the farm may use.

### 5.4 Edge cases
| Case | Handling |
|---|---|
| A contract owner also wants to buy in the app | The app hides the paywall on contract farms. Whether their own extra farms join the contract or are paid in the app is still to decide (`docs/PRICING_STRATEGY.md` §10). |
| Owner of several farms | One subscription covers all of them. `farms.plan` is the same on each. |
| Farm grows past 25 ha or 1,000 trees, or the total goes past the in-app limits | The app shows "We'll send you a quote". Wafra moves the owner to a contract. |
| Account switching (several phone numbers) | Each phone number is its own UID and its own customer. On switching, the app calls RevenueCat `logOut()` then `logIn(newUid)`. |
| "Restore purchases" with an Apple ID that has been used on another UID | RevenueCat's *restore behaviour* setting decides whether the purchase moves to the new UID. Recommendation: *keep with the original App User ID*, so a shared phone cannot move a subscription. |
| Farm transferred to a new owner | Handled by MMC or Wafra ops: `ownerUid` changes, and `plan` is rewritten from the new owner's subscription or contract. |
| Plan ends with no renewal | The farm goes read-only. |

## 6. Who checks what, and where

| Who is asking | Question | Where the answer comes from |
|---|---|---|
| Owner's app | What can I use? What does it cost? | `farms.plan`; RevenueCat SDK to buy; `pricing/current` to price |
| Co-owner's or supervisor's app | What is this farm entitled to? | `farms/{farmId}.plan` |
| MMC backend | Should I compute this, or serve this feature? | RevenueCat REST API (read-only key, customer = `farms.ownerUid`) for `store`; `contracts/{id}` for `contract` |
| Seat check on an invitation | Is there a free seat? | the owner's tier, or the contract's override |
| Firestore rules | Can this person read this farm? | `farmAccess` only. The rules do not check plans. |
| Wafra ops and support | Revenue, a customer's history | RevenueCat dashboard, the accounting tool, and Firestore |

## 7. What has to be built or configured

| Item | Owner | Notes |
|---|---|---|
| Price table `pricing/current` | Wafra | Final prices only. Kept in Wafra's private price sheet, not in this repository. |
| The store products, RevenueCat products, the two entitlements, restore behaviour | Wafra | Created once by a script. App user ID = Firebase UID. |
| App: pricing, price step, in-app limits, paywall, contract lookup at sign-up | Wafra | |
| Contracts and contract farm lists | Wafra staff | Firebase console or a small admin page; MMC can do the first import. |
| Read-only RevenueCat key for MMC | Wafra → MMC | A V2 secret key limited to reading customer information. Stored in MMC's secret store. |
| Sync from MMC into Firestore (users, farms with `plan`, farmAccess, contacts, suggestions and shares) | MMC | Service-account key per environment. |
| Plan checks before any work, seat checks on invitations | MMC | |

## 8. Open questions
1. **What a contract client may see:** seat counts only (the proposed default), or its members' farms and
   results? This needs a data-sharing clause under PDPL.
2. **After a contract ends:** does the owner get a free trial in the app, or go straight to read-only with
   the paid offer?
3. **Seats on contracts:** the tier default, or a number set in each contract?
