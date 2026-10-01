# Wafra Farm App — pricing and payment

*Audience: Wafra, MMC. Status: proposal.*

*This document explains how pricing works. It has no prices in it. The numbers (rates, markup, discount,
bands, price steps) are in Wafra's private price sheet, which is not in this repository.*

## 1. The idea in five lines

1. **Wafra sets every price.** The prices live in one table in Wafra's database.
2. **Small owners pay in the app**, through Apple or Google: one subscription for all their farms.
3. **Bigger clients and governments pay by bank transfer**, on a Wafra invoice. No store fees.
4. **MMC never calculates a price.** MMC measures farms, and checks "is this farm paid?" before doing work.
5. **Every farm has one "plan" record** that says who pays, which tier, and until when. Everyone reads that.

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
| **Wafra staff** | use the same table for quotes and invoices |
| **MMC** | nothing. MMC only sends hectares and tree counts. |

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
- The store price in each country = the step price + that country's VAT, rounded up to the nearest price the
  store offers.
- In RevenueCat (the tool that talks to Apple and Google for us), every `wafra_adv_*` product gives the
  entitlement `advanced`, and every `wafra_pro_*` product gives `professional`.

**The owner adds a farm or hectares:** the total goes up, and the app moves them to the higher step. Apple
and Google charge only the difference for the rest of the term.

**The owner removes a farm:** the app moves them to the lower step, starting at the next renewal.

---

## 5. Is this farm paid? How it's checked

Everyone reads one record: **`farms/{farmId}.plan`**. All of an owner's farms carry the same plan.

```
plan = { paidBy: "store" | "contract", tier: "advanced" | "professional",
         contractId, until, readOnly }
```

| Who asks | Reads | Why |
|---|---|---|
| The owner's app | RevenueCat (to buy), then `farms.plan` | to show the plan, the locks and the paywall |
| Co-owners and supervisors | `farms.plan` | they can't see the owner's purchases |
| MMC, before any work | its own source: RevenueCat for `store`, `contracts/{id}` for `contract` | to refuse work on unpaid farms |

**Who writes `plan`:** MMC, as part of the farm sync it already does.
- For an owner paying in the app, MMC copies the owner's state from RevenueCat.
- For a contract farm, MMC copies it from `contracts/{id}`.

**When the plan ends:** the farm becomes **read-only**. Data is kept. Nothing is deleted.

**Size check:** the app enforces the bands and limits. MMC does not check that the step bought matches the
farms. Once a month, Wafra compares the RevenueCat export with the farm sizes. Cheating would need a hacked
app.

---

## 6. What is stored, where, and why

| Data | Where | Why | Written by | Read by |
|---|---|---|---|---|
| **Price table**: final band prices, price steps, VAT per country, in-app limits | Firestore `pricing/current` | the app calculates prices from it | Wafra | app, Wafra staff |
| **Farm size**: crop hectares, tree count | Firestore `farms/{id}` | prices are based on it | MMC | app |
| **Farm plan**: who pays, tier, until when | Firestore `farms/{id}.plan` | one answer to "is this farm paid?" | MMC | app, MMC |
| **Store purchases** | RevenueCat (not our database) | Apple and Google receipts | RevenueCat | app, MMC |
| **Contracts**: client, tier, number of farms, price, start, end, invoice number, paid yes/no | Firestore `contracts/{id}` | who pays for which farms | Wafra | MMC, Wafra staff |
| **Contract farm list**: owner's phone, farm location, contract | Firestore `contractFarms/{phone}` | to find the owner's farm when they sign up | Wafra (import) | app (own phone only), MMC |
| **Invoices** | Wafra's accounting tool | law and tax | Wafra | Wafra |

**Privacy:** `contractFarms` uses the phone number as its ID. The database rules let a signed-in person read
only the entry for their own verified phone number. Nobody can list the others.

The full field list is in [`firebase/SCHEMA.md`](../firebase/SCHEMA.md).

---

## 7. Which code goes where

| Piece | Where it runs | Who builds it |
|---|---|---|
| Price table | Firestore `pricing/current` | Wafra edits it (Firebase console, or a small admin page) |
| Price calculator, step picker, in-app limits | the app | Wafra |
| Paywall and purchase | the app + RevenueCat SDK | Wafra |
| The store products and their prices | App Store Connect, Google Play Console, RevenueCat; created once by a script | Wafra (or a freelancer, one-off) |
| Database rules (e.g. read only your own phone's entry) | Firestore rules | Wafra |
| Import of a contract's farm list | Firestore | MMC (one-off import), or a small Wafra admin page |
| Match at sign-up (phone → farm → contract) | the app reads `contractFarms`; MMC creates the farm and links the contract | Wafra + MMC |
| Write `farms.plan`; refuse work on unpaid farms | MMC's backend | MMC |
| Invoices for contracts | accounting tool | Wafra staff |
| Monthly size check | spreadsheet | Wafra staff |

---

## 8. The two scenarios, step by step

### Scenario 1: a private farmer pays on Apple
1. The farmer draws their farm. The app sends it to MMC.
2. MMC runs its AI on the latest satellite image and sends back hectares and tree count.
3. The app finds the bands, adds up all the owner's farms, picks the price step and shows the price.
4. The farmer picks Advanced or Professional, monthly or yearly, and pays with Apple.
5. RevenueCat records the purchase. MMC writes `farms.plan` and starts working on the farm.

### Scenario 2: a government pays for 25,000 farms
1. Wafra signs the contract and creates `contracts/{id}`.
2. Wafra loads the list of 25,000 farms (owner's phone and farm location) into `contractFarms`.
3. Wafra invoices the government for all 25,000 farms, whether owners sign up or not. They pay by bank
   transfer.
4. An owner signs up with their phone number. The app finds their farm in `contractFarms`.
5. MMC creates the farm and writes `farms.plan` with `paidBy: "contract"`.
6. The owner never sees a payment screen.
7. When the contract ends, the farm becomes read-only. The owner can then pay in the app.

---

## 9. Still to decide

1. **Free trial:** how long, if any. It would be a store "introductory offer".
2. **Tier names:** which Wafra plan name the farmer sees for Advanced and Professional.
3. **Apple review:** confirm once that Apple accepts "paid for by a government or by invoice".
4. **An owner with contract farms and their own farms:** do the own farms join the contract, or does the
   owner pay for them in the app?
