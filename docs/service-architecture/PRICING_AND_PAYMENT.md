# Pricing and payment

*Part of the [service architecture](README.md). Audience: Wafra, MMC. Status: draft, not built.*

*This document explains how pricing works. It has no prices in it. The numbers (rates, markup, discount,
bands, price steps) are in Wafra's private price sheet, which is not in this repository.*

## 1. The idea in five lines

1. **Wafra sets every price.** The prices live in one table in Wafra's database.
2. **Small owners pay in the app**, through Apple or Google: one subscription for all their farms.
3. **Bigger clients and governments pay by bank transfer**, on a Wafra invoice. No store fees.
4. **One list says which farms are paid for: `activeFarms`.** Wafra's Cloud Functions keep it right. The
   app reads it to show a farm active or read-only; MMC reads it to know which farms to analyse.
5. **MMC can focus on the farms.** Wafra calculates prices and keeps the list, so MMC measures farms and does
   the work for the farms on the list.

---

## 2. Who pays where

| Client | How they pay | Who makes the invoice |
|---|---|---|
| **Small owner** (inside the in-app limits, section 3.2) | in the app, through Apple or Google | Apple or Google (they are the seller; they send the receipt and pay the VAT) |
| **Bigger owner or company** (outside the in-app limits) | bank transfer | Wafra, from its accounting tool |
| **Government or sponsor** (e.g. 25,000 farms) | bank transfer | Wafra, from its accounting tool |

An owner outside the limits sees "Your farms are large. We'll send you a quote." in the app, and Wafra
follows up.

---

## 3. How a price is calculated

### 3.1 The rule

```
farm price  = crop band price + tree band price
owner price = all the owner's farms added up, then rounded UP to the next price step
price paid  = price + VAT of the owner's country
```

- **Bands are per farm:** 25 crop bands of 1 ha (up to 25 ha), and 25 tree bands of 40 trees (up to 1,000
  trees).
- **You pay for the top of your band.** A 12.3 ha field is in band C13 (12–13 ha), so it pays for 13 ha.
- **One tier for everything.** All the owner's farms, crops and trees are Advanced, or all Professional.
- **Monthly or yearly.** Yearly is cheaper.
- **VAT** depends on the country.
  - In the stores, the price shown already includes VAT, and Apple or Google pay it.
  - On Wafra invoices, Wafra adds VAT.

### 3.2 The in-app limits

An owner pays in the app only if **all** of these are true. Otherwise they get an invoice.

| Limit | Value |
|---|---|
| Farms | 10 at most |
| Crops per farm | 25 ha at most (250 ha in total) |
| Trees per farm | 1,000 at most (10,000 in total) |
| One payment | under the stores' price cap (the exact amount is in the price table) |

When the yearly price is over the cap, the app offers monthly only.

### 3.3 Who calculates it

| Where | What it does |
|---|---|
| **The app** | reads the price table, finds each farm's bands from MMC's numbers, adds them up, picks the price step, checks the in-app limits |
| **Cloud Functions** | use the same pricing code to decide which farms the paid step covers (section 5) |
| **Wafra staff** | use the same table for quotes and invoices |
| **MMC** | no price work. MMC sends hectares and tree counts, and Wafra does the rest. |

### 3.4 Changing prices

1. Edit the price table in the database.
2. Edit the matching prices in App Store Connect and Google Play Console.

Product names never change. Only their prices do.

---

## 4. Price steps: the products in Apple and Google

Apple and Google can't charge "any price". They only sell products with fixed prices. So the owner's total
is rounded **up** to the next price step, and each step is one product.

- Each step has a monthly product; the lower steps also have a yearly product. One set per tier:
  - `wafra_adv_m_001`, `wafra_adv_m_002`, … and `wafra_adv_y_001`, …
  - `wafra_pro_m_001`, `wafra_pro_m_002`, … and `wafra_pro_y_001`, …

  That is about 375 products, all in one subscription group called "Wafra plan".
- They are created **once, by a script** (App Store Connect API and Google Play API), not by hand.
- **Every product has a 30-day free trial**, set up as the store's "introductory offer" (Apple) or "free
  trial offer" (Google). Apple and Google give it once per Apple ID or Google account, so switching step
  doesn't start a new trial. The farmer is charged on day 31 unless they cancel.
- The store price in each country = the step price + that country's VAT, rounded up to the nearest price the
  store offers.
- In RevenueCat (the tool that talks to Apple and Google for us), every `wafra_adv_*` product gives the
  entitlement `advanced`, and every `wafra_pro_*` product gives `professional`.

### What the farmer sees

The farmer never sees the list of products. The app picks the step for them and shows **two buttons**:

> **Monthly — $X** · **Yearly — $Y**
> *30 days free, then the price above. Cancel any time.*

A farmer who has already used their trial sees the same two buttons without the trial line.

The app asks RevenueCat for just those two products by ID (e.g. `wafra_adv_m_032` and `wafra_adv_y_032`).
When the yearly price is over the store cap, only the monthly button is shown.

### When the farms change

- **The owner adds a farm or hectares:** the total goes up, and the app shows the two buttons for the
  higher step. Apple and Google charge only the difference for the rest of the term.
- **The owner removes a farm:** the app moves them to the lower step, starting at the next renewal.
- **The total goes past the in-app limits:** the app shows "We'll send you a quote" instead.

In every case, `keepActiveFarms` (section 5) makes sure the owner ends up on the right step.

---

## 5. Is this farm paid? The active farms list

**One record per paid farm: `activeFarms/{farmId}`** = `{ mmcFarmId, tier, since, graceUntil }`. Only
Wafra's Cloud Function `keepActiveFarms` writes it, from purchases, contracts, prices and farm sizes. It runs
whenever one of them changes, and once a day. The full logic is in
[`CLOUD_FUNCTIONS.md`](CLOUD_FUNCTIONS.md) §1.

### 5.1 How a farm gets on the list
1. **Contract farm:** the contract is active and not ended. Tier = the contract's tier.
2. **Paid in the app:** the owner has an active entitlement (the 30-day trial counts).
3. **Covered by the paid step:** the owner's farms are counted **oldest first**. Farms that fit inside the
   price step the owner pays for are on the list.
4. **Not covered:** the farm stays on the list for **14 days** (`graceUntil`), then comes off. The 14 days
   start from the later of two dates: when a farm's size last changed, or when the purchase last changed.

### 5.2 The payment gate in the app
Every call from the app to MMC goes through **one gate** in the app's API layer. It reads
`activeFarms/{farmId}`:

| The record | The farm is | The app may |
|---|---|---|
| exists | **active**, at the record's tier | make every call the person's role and the tier allow (`has('feature')`) |
| is missing | **read-only** | show what MMC has already produced. No new analysis, no edits. |

**What people see when `graceUntil` is set:**
- the owner: "Your plan no longer covers your farms", with the two buttons for the right step;
- a co-owner or supervisor: "Ask the owner to update the plan."

### 5.3 What MMC does with the list
MMC reads the list with its own login. It analyses only the farms on it, and bills Wafra for those (plus the
surveys Wafra asks for), so Wafra pays only for paid farms. See [`MMC_INTERFACE.md`](MMC_INTERFACE.md).

### 5.4 What we accept
- **A hacked app** could show a farm as active that is not. It still can't get new analysis from MMC,
  because MMC follows the list, which only the functions write.
- **Apple's Settings can switch to a cheaper product.** That takes effect at renewal. `keepActiveFarms`
  sees it then and applies the 14 days.

---

## 6. What is stored, where, and why

| Data | Where | Why | Written by | Read by |
|---|---|---|---|---|
| **Active farms**: MMC farm ID, tier, grace | Firestore `activeFarms/{farmId}` | the one answer to "is this farm paid for?" | Cloud Functions | app (the farm's people), MMC |
| **Price table**: final band prices, price steps, VAT per country, in-app limits | Firestore `pricing/current` | prices in the app, coverage in the function | Wafra staff | app, Cloud Functions |
| **Farm size**: crop hectares, tree count, when they last changed | Firestore `farms/{id}` | prices and coverage are based on it | Cloud Functions, from MMC's survey | app, Cloud Functions |
| **Store purchases** | RevenueCat, copied into Firestore `customers/{uid}` | the function decides from the copy | RevenueCat and its Firebase extension | owner, Cloud Functions |
| **Contracts**: client name, tier, start, end, status | Firestore `contracts/{id}` | the function covers contract farms | Wafra staff | app, Cloud Functions |
| **Contract terms**: price, invoice number, paid yes/no, contact | Firestore `contracts/{id}/private/terms` | Wafra's records | Wafra staff | Wafra staff only |
| **Contract farm list**: owner's phone, farm location, contract | Firestore `contractFarms/{phone}` | to find the owner's farm when they sign up | Wafra staff (import) | app (own phone only) |
| **Invoices** | Wafra's accounting tool | law and tax | Wafra staff | Wafra staff |

**The farm size changes only after a survey**: when the farm is created or its boundary changes. Never on
each new satellite image, so the price does not jump between bands on its own. MMC analyses only the shape
Wafra sent for that survey, so what MMC analyses always matches what the owner pays for.

The full field list is in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md).

---

## 7. Which code goes where

| Piece | Where it runs | Who builds it |
|---|---|---|
| Price table | Firestore `pricing/current` | Wafra staff (Firebase console, or a small admin page) |
| Pricing code: bands, total, price step | shared by the app and the functions | Wafra's app developer |
| Paywall, two buttons, in-app limits, purchase | the app + RevenueCat SDK | Wafra's app developer |
| Payment gate (reads `activeFarms`) | the app's API layer | Wafra's app developer |
| `keepActiveFarms`, `surveyFarm` | Cloud Functions in Wafra's Firebase | Wafra's app developer |
| The store products and their prices | App Store Connect, Google Play Console, RevenueCat; created once by a script | Wafra |
| Copy of purchases into Firestore | RevenueCat's Firebase extension | Wafra installs it; no code |
| Contracts, contract farm lists | Firestore | Wafra staff |
| Invoices | accounting tool | Wafra staff |
| Surveys and analytics for the farms on the list | MMC | MMC |

---

## 8. The two scenarios, step by step

### Scenario 1: a private farmer pays on Apple
1. The farmer draws their farm. The app saves it and calls `surveyFarm`.
2. `surveyFarm` sends the shape to MMC. MMC runs its AI on the latest satellite image and sends back hectares
   and tree count, which Wafra stores on the farm.
3. The app finds the bands, adds up all the owner's farms, picks the price step and shows two buttons.
4. The farmer picks Advanced or Professional, monthly or yearly, and pays with Apple (30 days free first).
5. RevenueCat copies the purchase into Firestore. `keepActiveFarms` puts the farm on `activeFarms`. The app
   shows it active, and MMC starts analysing it.

### Scenario 2: a government pays for 25,000 farms
1. Wafra signs the contract and creates `contracts/{id}`.
2. Wafra loads the list of 25,000 farms (owner's phone and farm location) into `contractFarms`.
3. Wafra invoices the government for all 25,000 farms, whether owners sign up or not. They pay by bank
   transfer.
4. An owner signs up with their phone number. The app finds their farm in `contractFarms`, creates it with
   its `contractId`, and calls `surveyFarm`.
5. Once measured, `keepActiveFarms` puts the farm on `activeFarms`. The owner never sees a payment screen.
6. When the contract ends, `keepActiveFarms` takes the farm off the list. The farm becomes read-only, and the
   owner can pay in the app.

---

## 9. Still to decide

1. **Tier names:** which Wafra plan name the farmer sees for Advanced and Professional.
2. **Apple review:** confirm once that Apple accepts "paid for by a government or by invoice".
3. **An owner with contract farms and their own farms:** do the own farms join the contract, or does the
   owner pay for them in the app?
4. **Time to update a plan that is too low:** 14 days is proposed.
