# Accounts and roles

*Part of the [service architecture](README.md). Audience: Wafra, MMC. Status: draft, not built.*

## 1. Decisions

1. **Wafra holds all client data**, in Wafra's Firebase: accounts, farms, roles, contacts, purchases (as a
   copy), contracts. MMC holds none of it, which keeps MMC's side light.
2. **An account is a phone number.** Sign-in is phone and SMS code (Firebase Auth). One phone number gives
   one UID. That UID is also the person's RevenueCat customer ID.
3. **Roles are per farm:** owner, co-owner or supervisor. The owner is the person who created the farm
   (`farms.ownerUid`). Co-owners and supervisors join by invitation.
4. **Two ways to pay** (details in [`PRICING_AND_PAYMENT.md`](PRICING_AND_PAYMENT.md)):
   - small owners pay **in the app**, through Apple or Google, via RevenueCat: one subscription for all
     their farms;
   - everyone else pays **by bank transfer on a Wafra invoice**, under a **contract**.
5. **Contract farms are found by phone number.** Wafra loads the contract's farm list. When an owner signs
   up, the app finds their farms by their verified phone number. They never see a paywall.
6. **One record says if a farm is paid for: `activeFarms`.** Only Wafra's Cloud Functions write it. The app
   and MMC read it.

## 2. The building blocks

| Thing | What it is | Where it lives |
|---|---|---|
| **Account** | A person who can sign in (phone and SMS code). | Firebase Auth, plus `users/{uid}` |
| **Farm** | A holding with a name, a boundary and an owner. | `farms/{farmId}` (MMC holds its shape and results under its own farm ID) |
| **Farm access** | A co-owner's or supervisor's role on one farm. | `farmAccess/{uid}_{farmId}` |
| **Invitation** | A code to join a farm. | `invites/{code}` |
| **Contact** | A worker who receives advice by WhatsApp or SMS. No account. | `farms/{farmId}/contacts/{contactId}` |
| **Purchase** | What the owner bought in the app. | RevenueCat, copied into `customers/{uid}` |
| **Contract** | A deal paid by invoice: which tier, until when. | `contracts/{contractId}` |
| **Contract farm list** | The farms a contract covers, by owner's phone number. | `contractFarms/{phone}` |
| **Active farm** | A farm that is paid for. | `activeFarms/{farmId}` |

## 3. Roles

| | Owner | Co-owner | Supervisor | Contact (no account) | Wafra staff |
|---|---|---|---|---|---|
| Has an account | yes | yes | yes | no | yes (`admin` claim) |
| Sees the farm, maps and advice | yes | yes | yes | only the advice sent to them | everything (read) |
| Edits the farm, redraws boundaries | yes | yes | only boundaries, on the farms they've been given | – | – |
| Sends advice on, sets automatic sending | yes | yes | no | – | – |
| Invites or removes people | yes | yes | no | – | – |
| Deletes or transfers the farm | yes | no | no | – | transfers |
| **Billing:** buys, upgrades, cancels | yes, for their farms in the app | no | no | – | prices and contracts |
| Paid for by | themselves or a contract | the farm's owner | the farm's owner | – | – |

The capability matrix is in `app/core/capabilities.js`. **The app enforces roles**; the Firestore rules
enforce who can read and write what. MMC does not need to see roles.

## 4. The flows

### 4.1 New owner, paying in the app
1. The owner signs in with phone and SMS code. The app calls RevenueCat `logIn(uid)` *before* showing any
   paywall, so purchases are never anonymous.
2. The app checks `contractFarms/{phone}`. Nothing is there, so this owner pays for themselves.
3. The owner draws a farm. The app writes `farms/{farmId}` with `ownerUid = uid`, then calls `surveyFarm`.
4. MMC measures the farm. `notify` stores the hectares and tree count on the farm.
5. The app prices all the owner's farms and shows the paywall: two buttons, monthly and yearly, with the
   30-day free trial. Outside the in-app limits, it shows "We'll send you a quote" instead.
6. The owner pays. RevenueCat's extension copies the purchase into `customers/{uid}`. `keepActiveFarms`
   adds the owner's farms to `activeFarms`. The app shows them active, and MMC starts analysing them.

### 4.2 Owner covered by a contract (e.g. a government)
1. Wafra staff create `contracts/{id}` and its private terms, and load the farm list into
   `contractFarms/{phone}`.
2. Wafra invoices the client. They pay by bank transfer. If they don't, staff set the contract `suspended`.
3. The owner signs in. The app reads `contractFarms/{their phone}` and finds their farms.
4. The app creates the farms with their `contractId`, and calls `surveyFarm` for each.
5. Once measured, `keepActiveFarms` adds them to `activeFarms`. The owner never sees a paywall; the app says
   "Covered by …".
6. When the contract ends, `keepActiveFarms` takes the farms off the list. The owner is offered the in-app
   plans. Their farms and data stay as they are.

### 4.3 Inviting a co-owner or supervisor
1. The owner or a co-owner creates an invitation (`invites/{code}`) and shares the code or QR code.
2. The invitee signs in and enters the code. The app calls `redeemInvite`.
3. `redeemInvite` checks a seat is free on the owner's farms, then writes `farmAccess`.
4. The invitee needs no subscription. Their app reads `activeFarms`, like the owner's.

**Seats:** Advanced gives 1 additional user, Professional 2. A contract can set its own number.

### 4.4 Edge cases
| Case | Handling |
|---|---|
| A contract owner also wants their own extra farms | Still to decide: do they join the contract, or are they paid in the app? (`PRICING_AND_PAYMENT.md` §9) |
| Owner of several farms | One subscription covers all of them, oldest farm first. |
| Paid step too low (the farms grew, or the owner picked a cheaper product in Apple's Settings) | The farms that don't fit keep working for 14 days, then come off `activeFarms`. The owner sees the right two buttons; the team sees "Ask the owner to update the plan". |
| Farm grows past 25 ha or 1,000 trees, or the total goes past the in-app limits | The app shows "We'll send you a quote". Wafra moves the owner to a contract. |
| Account switching (several phone numbers) | Each phone number is its own UID and its own customer. On switching, the app calls RevenueCat `logOut()` then `logIn(newUid)`. |
| "Restore purchases" with an Apple ID used on another UID | RevenueCat's *restore behaviour*: keep with the original App User ID, so a shared phone cannot move a subscription. |
| Farm transferred to a new owner | Wafra staff change `ownerUid`. `keepActiveFarms` then follows the new owner's purchase or contract. |
| Trial ends | The store charges on day 31. If the owner cancelled, the farms come off the list and become read-only. |
| Contract ends | The owner is offered the in-app plans. They get the 30-day trial only if their Apple ID or Google account has never had one. |
| Nothing paid | Every farm is read-only (WF9.032), never locked out. Nothing is deleted. |

## 5. Who checks what

| Who | Question | Answer from |
|---|---|---|
| Any app (owner, co-owner, supervisor) | Is this farm active or read-only, at which tier? | `activeFarms/{farmId}` |
| Owner's app | What does it cost? | `pricing/current`; RevenueCat SDK to buy |
| Any app | What may this person do on this farm? | their role: `farms.ownerUid` and `farmAccess` (`app/core/capabilities.js`) |
| `keepActiveFarms` | Which farms are paid for? | `customers`, `contracts`, `farms`, `pricing` |
| `redeemInvite` | Is there a free seat? | the tier or the contract, against `farmAccess` |
| MMC | Which farms do I analyse? | `activeFarms`, with its own login |
| Firestore rules | Can this person read or write this? | `farms.ownerUid`, `farmAccess`, the person's phone number |

## 6. What has to be built or configured

| Item | Who |
|---|---|
| The app: sign-in, farms, invitations, contacts, paywall, pricing, the payment gate | Wafra's app developer |
| Cloud Functions: `keepActiveFarms`, `surveyFarm`, `redeemInvite`, `notify` | Wafra's app developer |
| RevenueCat: products, the two entitlements, restore behaviour, the Firebase extension | Wafra |
| Firebase: Blaze plan, Firestore rules and indexes, MMC's login (`mmc` claim), staff accounts (`admin` claim) | Wafra |
| Price table, contracts and contract farm lists | Wafra staff (Firebase console or a small admin page) |
| Survey API, analytics API, calls to `notify`, reading `activeFarms` | MMC ([`MMC_INTERFACE.md`](MMC_INTERFACE.md)) |

## 7. Open questions
1. **What a contract client may see:** seat counts only (proposed), or its members' farms and results? This
   needs a data-sharing clause under PDPL.
2. **Seats on contracts:** the tier default, or a number set in each contract?
