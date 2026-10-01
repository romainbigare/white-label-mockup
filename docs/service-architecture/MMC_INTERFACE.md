# MMC interface — what MMC holds, reads and does

*Part of the [service architecture](README.md). Audience: MMC. Status: draft for agreement.*

## 1. How we share the work

1. **Wafra looks after all client data.** Names, phone numbers, emails, owners, roles, contacts, contracts,
   prices and purchases stay with Wafra. This keeps people's data in one place, and MMC has none of it to
   protect.
2. **MMC looks after farms:** its own farm ID, the farm's shape, imagery, survey results, analytics and
   advice. This is the part MMC knows best.
3. **Wafra looks after payment.** Wafra's `activeFarms` list says which farms are paid for, and MMC follows
   it. MMC does not need to check payment itself.

## 2. What MMC reads: the active farms list

- One record per paid farm, in Wafra's Firestore: `activeFarms/{farmId}` =
  `{ mmcFarmId, tier, since, graceUntil, updatedAt }`.
- MMC reads it with **its own login**: a Firebase account Wafra creates for MMC. The database rules let
  that login read this list and nothing else, because the list is all MMC needs.
- MMC keeps its own copy in step: a live Firestore listener, or a read every few minutes.
- A farm that leaves the list is no longer paid for.

## 3. What MMC does

| Farm | MMC |
|---|---|
| **On the list** | runs analytics and advice at the record's tier (`advanced` or `professional`), and serves results |
| **Not on the list** | runs nothing new. It may still serve results it has already produced (the farm is read-only in the app). |

## 4. The APIs

| API | Called by | What it carries |
|---|---|---|
| **Survey API** (MMC) | Wafra's `surveyFarm` function only, with an API key | a farm's shape. The first call returns MMC's farm ID. |
| **Analytics API** (MMC) | the app | MMC's farm ID, and the user's Firebase sign-in token |
| **Events** (Wafra's `notify` endpoint) | MMC, signed with a key Wafra gives it | a farm ID and an event: survey done (+ hectares and trees), new advice, weather warning |

**The sign-in token.** MMC checks it with Google's public keys, so it knows the call comes from a signed-in
Wafra user. It holds only an opaque user ID, nothing else about the person.

**Roles are Wafra's job.** The app enforces roles, so MMC does not need to know who works on which farm.
MMC's farm IDs must be random (for example UUIDs), so they can't be guessed.

**Shapes come from Wafra's function.** `surveyFarm` is the only way a shape reaches MMC. MMC analyses the
shape it was sent, which is always the shape Wafra priced, so both sides see the same farm.

## 5. Billing Wafra

MMC bills Wafra for:
- each survey `surveyFarm` asks for;
- each farm, for the days it is on the active list, at its tier.

These two items make up the bill, which keeps it simple: a farm off the list costs nothing.

## 6. What Wafra takes care of

So that MMC can focus on surveys, analytics and advice, Wafra takes care of:

- payment, prices and roles;
- all personal data;
- messages to people. Wafra's `notify` function sends them, because only Wafra has the phone numbers.
