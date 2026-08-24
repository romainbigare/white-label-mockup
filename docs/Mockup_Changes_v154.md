# What v1.5.4 changed, and where each of it landed

> **Superseded in part by v1.5.5.** The comments on this deck cut six more
> screens and changed the icons and the plot shapes throughout; see
> [`Mockup_Changes_v155.md`](Mockup_Changes_v155.md). Where the two disagree —
> the four judgement calls below in particular — the later document wins.

The companion to [`Meeting_Comments_v152.md`](Meeting_Comments_v152.md), which
is the extraction from the call. This is the record of the build: every row in
that table, the file it landed in, and the four judgement calls that were mine
rather than the review's.

**Versions moved differently, and on purpose.** The mockup goes to **1.5.4** and
the specification to **1.6** — the first time the spec number has moved since
v1.2 was issued as a document. Four earlier rounds redrew screens; this one
deleted two whole concepts and changed a third, and no amount of redrawing would
have implemented it. Both live in `app/meta.js`.

---

## The five decisions, and what each one cost

### 1. Tasks are gone; advice is the only unit of work

The deepest change, and the one everything else hangs off. There is no task
record, no task list, no assignment and no completion form.

An advice is now in one of four states, and `sentAt` is the whole of the
difference between the first two:

| state | what it means |
|---|---|
| open, not sent | the farmer has not decided |
| open, sent | out with the supervisor, waiting for him to confirm |
| done | somebody recorded what was actually done, on D7 |
| deferred | ignored or put off; it comes back tomorrow |

**Gone:** `app/screens/tasks.js` (E1–E4), `taskFromAdvice()`, `tasksFor()`,
`groupedTasks()`, `createTask()`, `completeTask()`, `blockTask()`,
`assignAllAdvice()`, the `tasks` fixture array, the Tasks tab and WF3.004's
badge, `TASK_ICON`, and the `tasks` entitlement key.

**New:** `sendAdvice()`, `unsendAdvice()`, `sendAllAdvice()`, `isSent()`,
`unsentAdvice()`, `can('advice.send')`.

`tools/syntax.sh` now fails the build if the word "task" appears in live code
outside a comment, or if any module other than `advice.js` calls `sendAdvice()`.
Task management came back once before, one convenience button at a time.

### 2. The workforce is gone, and the worker role with it

§5.6 was a directory: worker records, per-person languages, SMS/WhatsApp/push
delivery pipes, invitations bound to records, and an identity model joining
accounts to people by mobile number. All of it is deleted.

What replaced it is one selector — `supervisorOf(farmId)` — and one rule: work
goes to that person as a message with a link they tap when it is done. Nobody
below them holds an account.

The **worker role** went with it, which was not asked for in those words but
follows from Mark's "there's only going to be one user": with no queue to hold
and nothing to mark done, a worker account had nothing in it. The capability
matrix ships two roles. A15 redeems an invitation as the farm's supervisor.

**Gone:** `app/screens/workforce.js` (G1–G3), the `workers` and `invitations`
fixtures, `assignees()`, `deliveryFor()`, `identityIds()`, `attachAccount()`,
`accountForNumber()`, the QR sheets, and the worker rows of the capability
matrix, the notification categories and the cache/offline tables.

E6 and E7 survive and are **not** tasks — they are field capture, a person
standing in a plot recording what the satellite cannot see. They moved to
`app/screens/field.js`.

### 3. Single farm is the product

`router.homeRoute()` decides where Home opens: `B1` for an account with more
than one farm, `B2:<the farm>` for everybody else. It is computed rather than
stored, so adding a second farm puts the chooser back without anyone remembering
to.

Multi-farm stays in the requirements and in the build; it is simply not on the
path a single-farm owner walks. Inside a farm, the app-bar title is a picker for
accounts that have somewhere to go.

### 4. B2 and B3 merged

B3 is deleted. B2 is the farm **and** every plot on it: map, one line saying
whether anything is urgent, the advice count, then the plots — crops first, tree
groups second, under the state filter and the colour key that used to live on
B3.

Three blocks came off the same screen in the same round:

- **"Health today"** — plant health, water stress and nutrition read at farm
  level. Every crop has its own profile, so the farm-level figure averages things
  that cannot be averaged. The measures are untouched on the plot and the map.
- **Weather** — moved to More, as the new **F15**. Given a screen of its own it
  prints the whole forecast the plan pays for rather than three columns and a
  "+11 days".
- **Workforce and Farm diary** — deleted with task management.

### 5. Trees are tree groups, and they must be surveyed

A tree group is one record per species per farm: `kind: 'trees'`, a species, a
tree count, and a `parcels` count saying how many separate pieces of ground its
trees stand on. It has no crop cycle — citrus is citrus — and no hand-drawn
boundary, because trees are counted individually from the imagery and the count
is what the price is worked out from.

Al Kharj North's **twelve date-palm plots are now one group of 7,801 palms**,
standing in three places. Al Kharj South has four crop plots and four tree
groups, which is why the deck opens B2 on it: farm-1 demonstrates the fold
perfectly and the merged screen not at all.

The geometry change is contained: a plot is a list of rings (`plot.patches`)
rather than one ring, `plot.geometry` is still the largest of them, and only
`ui/map.js` had to learn about it. A group's parcels are drawn with a dashed
outline so three shapes read as one holding.

**A9 asks what is growing before it offers a route.** A farm of trees gets the
survey and a sentence saying why, not a disabled card to argue with. A12 keeps
the answer and the quote; it is the price screen now rather than the question
screen.

---

## The reminder that was new

Mark's case: it is January, the tomatoes are off, something else is in, and the
satellite cannot name it for about three weeks because it reads a canopy.

A plot carries `harvestDetectedOn`. While it is set, the plot has no current
crop; the row on B2 says so in red with "Tell us what you planted", and B4 opens
on the same question above the imagery rather than below three screens of it.
`declareCrop()` clears it and opens a cycle. `plot-23` is in that state in the
fixtures.

---

## Everything else, by file

| What | Where |
|---|---|
| Urgent-only attention counts | `home.js` `urgentCount()`, and the wording of `b1.needing` / `b2.needing` |
| Four tabs, not five | `core/capabilities.js` `tabsFor()` |
| Home opens on the farm for single-farm accounts | `core/router.js` `homeRoute()` |
| Plot rows: name, size, what is growing, urgent flag; no NDVI | `home.js` `plotRow()` |
| Crops and tree groups as two blocks | `home.js` `B2()` |
| Plot list filter — all / urgent / action needed / watch / good | `state.ui.plotFilter` |
| Advice filtered by action type, not by assignee | `advice.js` `STATE_FILTERS`, `state.ui.adviceStateFilter` |
| Send / Ignore before, Record / Take it back after | `advice.js` `adviceCard()` |
| Send everything waiting, and an auto-send switch | `advice.js` `sendAllBar()` |
| Tree group detail: count, parcels, no cycle | `plot.js` `cropHeader()` |
| Boundary editing and crop cycles refused on a tree group | `overlays.js` `PLOT_MENU` |
| Weather | `more.js` `F15()` |
| Buttons say where they land, for a printed deck | `b1.seewhat.dest`, `b2.advice.dest` |
| Realistic plot geometry | unchanged — the shapes were already jittered parcels; what changed is that a farm now has four of them rather than twelve |

---

## Four judgement calls

Each is a small change back if it was read wrongly.

1. **Which four tabs.** The review agreed Tasks goes and that Plots earns a slot,
   and left the final set to me. Merging B2 and B3 made a Plots tab a second door
   onto the screen the farmer is already standing on, so the four are **Home,
   Map, Advice, More** and Home is the plot list.
2. **The worker role is deleted, not just the workforce screens.** Follows from
   "there's only going to be one user", but it was not said in those words.
3. **B3 is deleted rather than kept as a thinner screen.** "Merge the two" and
   "make B3 the home screen" are the same instruction from two directions; a
   surviving B3 would have duplicated B2.
4. **The activity log (F11) stays under More.** The "Farm diary" row on B2 is
   gone as asked, but F11 is the append-only audit log of WF5.187/WF5.188 rather
   than the diary the farmer was being offered, and deleting it would have taken
   `auditlog.view` with it.

---

## Still open

- **One tree group per species, or one for all trees.** Mark is checking with
  Neil. The build goes per-species: lemon trees get different advice from date
  palms.
- **Who pays for the farmer's licence**, and pre-registration by phone number
  against ADAFSA's 25,500-farm list. The existing large-government registration
  path already covers it and needs no change yet.

---

## Checks

`npm run check` · `npm run smoke` · `npm run deck`

The smoke test walks 579 renders across both roles and now also asserts: every
farm has a supervisor to send work to; only the owner may send; an advice card
carries Send/Ignore or Record/Take-it-back and never "Mark as complete"; and A9
offers one route for a farm of trees and two for a farm of crops.

The deck is `docs/Wafra_Farm_App_Screens_v1.5.4.pptx` — 62 slides, generated
from the running app, so the screenshots cannot drift from the build.
