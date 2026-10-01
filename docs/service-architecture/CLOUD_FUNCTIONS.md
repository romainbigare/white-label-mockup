# Cloud Functions — Wafra's server code

*Part of the [service architecture](README.md). Status: draft, not built.*

Wafra runs no server of its own. The little server code it needs runs as **Cloud Functions in Wafra's
Firebase**: four small functions, a few hundred lines in total. Wafra's app developer builds them, in the
same repository as the app.

They need Firebase's **Blaze plan** (pay as you go). Secrets (MMC's API key, the key MMC uses to call Wafra,
the SMS/WhatsApp gateway keys) live in Firebase's secret manager, never in the app.

| Function | Started by | Job |
|---|---|---|
| `keepActiveFarms` | changes in Firestore, and once a day | keeps the `activeFarms` list right |
| `surveyFarm` | the app (owner or co-owner) | sends a farm's shape to MMC to be measured |
| `redeemInvite` | the app (the person invited) | adds someone to a farm, if a seat is free |
| `notify` | MMC (events), and the app ("send this advice") | stores results, sends push, SMS and WhatsApp |

---

## 1. `keepActiveFarms`

### When it runs
- `customers/{uid}` changes (a purchase, renewal, cancellation or trial, copied in by RevenueCat's
  extension);
- `farms/{farmId}` changes (created, archived, new size, new owner, new contract);
- `contracts/{contractId}` changes;
- `pricing/current` changes;
- every day at 00:30 UTC, for plans, trials, contracts and grace periods that end.

Each run recomputes **one owner at a time**, from scratch: all of that owner's farms. A contract, price or
daily run recomputes every owner it touches. Running twice gives the same result, so retries are safe.

### What it reads
`farms` (the owner's active farms), `customers/{ownerUid}`, `contracts/{id}` for contract farms, and
`pricing/current`.

### How it decides, for one owner

1. **Farms never measured** (no `mmcFarmId` yet) are never on the list.
2. **Contract farms:** active if the contract's status is `active` and it has not ended. Tier = the
   contract's tier.
3. **Other farms:** if the owner has no active entitlement in `customers/{ownerUid}` (the trial counts as
   active), none of them is on the list.
4. **The paid step** comes from the active product ID (`wafra_adv_m_032` → step 32, Advanced).
5. **Coverage:** take the owner's other farms, **oldest first**. Add each farm's price (crop band + tree
   band, at the tier) from `pricing/current`. A farm is **covered** while the running total still fits inside
   the paid step's price.
6. **Not covered:** the farm stays on the list with `graceUntil` = 14 days after the later of two dates:
   when a farm's size last changed, or when the purchase last changed. After that, it comes off.

### What it writes
- `activeFarms/{farmId}` for every farm that is on: `{ mmcFarmId, tier, since, graceUntil, updatedAt }`.
  `since` keeps its first value while the farm stays on.
- It deletes `activeFarms/{farmId}` for the owner's farms that are off.

### One price calculation, two places
The app and this function use **the same pricing code** (bands, total, price step), written once and shared.
The app uses it to show prices; the function uses it to decide coverage. Both read `pricing/current`.

---

## 2. `surveyFarm`

The only way a farm's shape reaches MMC. Called by the app when a farm is drawn or its boundary changes.

1. Checks the caller is the farm's owner or a co-owner.
2. Checks the limits (numbers in the function's config):
   - farms per owner, outside contracts: the in-app limit (10);
   - surveys per farm per day, and per owner per month, so unpaid users can't run up Wafra's survey bill.
3. Sends the farm's boundary to MMC's survey API. The first time, MMC returns its farm ID, saved as
   `farms.mmcFarmId`.
4. MMC measures the farm, then calls `notify` with the result (see 4).

**Why through a function:** MMC only ever sees shapes that Wafra sent, so the size Wafra stores, the price
the owner pays, and the area MMC analyses always match.

---

## 3. `redeemInvite`

Called by the app when someone enters an invitation code or scans its QR code.

1. Checks the invitation exists, is not used and has not expired.
2. Checks a seat is free on the owner's farms: Advanced gives 1 additional user, Professional 2, and a
   contract can set its own number. It counts the active `farmAccess` records on the owner's farms.
3. Writes `farmAccess/{uid}_{farmId}` with the role from the invitation, and marks the invitation used.

---

## 4. `notify`

Everything that sends a message, or receives one from MMC.

**From MMC** (an HTTPS endpoint; MMC signs each call with a key Wafra gives it). MMC sends only a farm ID and
an event:
- **survey done** (+ hectares and tree count): writes `cropAreaHa`, `treeCount` and `sizeUpdatedAt` on the
  farm, then sends the "survey ready" push (A15). `keepActiveFarms` runs next, because the farm changed;
- **new advice**: writes the entry in `suggestions`, then sends push to the farm's team. If the farm's rules
  say so, it also auto-sends to the farm's contacts by SMS or WhatsApp;
- **weather warning**: sends push to the farm's team.

**From the app** (callable): "send this advice to these contacts now", from the "Send to" sheet. It sends
through the SMS/WhatsApp gateway and writes a `shares` record.

Push respects each person's quiet hours. Contacts' phone numbers never leave Wafra, so MMC does not need to
handle them.

---

## 5. What is left to specify

- The exact limits in `surveyFarm`.
- The SMS/WhatsApp gateway to use, and the message templates in each language.
- The format of MMC's survey API and of its calls to `notify` (with MMC, see
  [`MMC_INTERFACE.md`](MMC_INTERFACE.md)).
