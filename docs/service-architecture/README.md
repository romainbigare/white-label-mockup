# Service architecture

*How the Wafra Farm App's services fit together, and how data moves between them. Wafra owns the Firebase
projects and the database rules. Status: live on staging and production (rules, indexes, RevenueCat);
the `keepActiveFarms` program goes live once the Blaze plan is on.*

![Service architecture](architecture.svg)

## 1. The four pieces

| Piece | What it does | Run by |
|---|---|---|
| **The app** | what farmers use on their phones | built by MMC's engineers, owned by Wafra |
| **Wafra's Firebase** | sign-in, the database, one small program (`keepActiveFarms`) | Wafra |
| **RevenueCat** | in-app payments through Apple and Google | Wafra |
| **MMC's backend** | measures farms from satellite images, maps, advice | MMC |

**Where data lives.** Everything about people stays in Wafra's Firebase: names, phone numbers, farms, roles,
contacts, payments (a copy), contracts and prices. MMC's backend keeps farms only: its own farm ID, the farm's
shape and its results. MMC's backend reads one thing from Firebase: the list of paid farms.

## 2. How data moves

1. **Sign in.** Phone number and SMS code (Firebase Auth). The person's user ID is also their RevenueCat ID.
2. **Add a farm.** The app saves the farm in Firebase (`farms`), sends its shape to MMC's backend, and saves
   back what MMC measured: MMC's farm ID, hectares and tree count.
3. **Pay.** The app works out the price (section 3) and the farmer pays through Apple or Google. RevenueCat's
   ready-made Firebase add-on copies the purchase into Firebase (`customers/{userId}`).
4. **The paid-farms list.** Wafra's program `keepActiveFarms` keeps `activeFarms` up to date: one record per
   paid farm. It runs whenever a purchase, a farm, a contract or the prices change, and once a day.
5. **Use the farm.** The app checks `activeFarms/{farmId}`: if it is there, the farm is active; if not, it is
   read-only. MMC's backend analyses only the farms on the list.
6. **Contracts** (governments, big clients). Wafra adds the contract and its farm list (by owner's phone
   number). When the owner signs up, the app finds their farms by phone and creates them with the contract.
   They never see a payment screen.
7. **Team.** An owner or co-owner creates an invitation code. The person invited enters it, and the app adds
   them to the farm (`farmAccess`).

## 3. Prices

The numbers are in `pricing/current` in Firebase. The rules are:

- **Each farm** has a crop band (1 ha steps, up to 25 ha) and a tree band (40-tree steps, up to 1,000 trees).
  Its price is the two added up.
- **The owner's farms are added up**, then rounded up to the next price level. Each level is one store
  product: `wafra_adv_m_032` is Advanced, monthly, level 32 (`pro` for Professional, `y` for yearly).
- **The app shows two buttons:** monthly and yearly. Every plan starts with a 30-day free trial.
- **In the app:** up to 10 farms, 25 ha and 1,000 trees per farm. Bigger clients get a contract and an invoice.
- **If a farm grows** past what the owner pays for, it stays active for 14 days, then becomes read-only until
  the owner moves to the right level.
- **RevenueCat:** entitlements `advanced` and `professional`; offering `wafra` (a fallback the SDK expects).

`firebase/functions/pricing.js` has these rules as code. The app can use the same file.

## 4. Roles

| | Owner | Co-owner | Supervisor |
|---|---|---|---|
| Sees the farm, maps and advice | yes | yes | yes |
| Edits the farm | yes | yes | redraws boundaries only |
| Invites people, sends advice on | yes | yes | no |
| Pays | yes | no | no |

## 5. Firebase

| | Staging | Production |
|---|---|---|
| Project | `wafra-farm-staging` | `wafra-farm-production` |
| Use | testing | real farmers |
| Test phone numbers | +15555550101 to +15555550103, code `123456` | none |

The files are in [`firebase/`](firebase/): the database rules (`firestore.rules`), the indexes, and the
program (`functions/`). The fields of every collection are in [`FIRESTORE_SCHEMA.md`](FIRESTORE_SCHEMA.md).

To deploy (from the repository root, after `npx firebase-tools login`):

```bash
npx firebase-tools deploy --project staging --config docs/service-architecture/firebase/firebase.json
```

Staging first, then the same command with `--project production`. The program and RevenueCat's add-on need
Firebase's Blaze plan.

**Never in the repository:** service-account keys, app config files, and Wafra's price sheet (`private/`).
