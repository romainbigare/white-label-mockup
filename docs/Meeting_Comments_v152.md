# Comments on v1.5.2 — the call, and what changes

> **All of it is applied**, on mockup v1.5.4. Where the build had to decide
> something the call left open — which four tabs, whether the worker role
> survived the workforce — the decision and its reasoning are recorded in
> [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md), which also names the file
> each row landed in.

A recorded review call between Mark Webster and Romain Bigare over the v1.5.2
mockup. The call covers **section 3 only** — Home, Plots, Advice and the
concepts underneath them. Mark said plainly he had not reached the other
sections yet ("first was the registration, secondly the organisation of plots …
let's get that sorted out and then I'll go through the rest"), so nothing below
touches Reports, Settings or the rest of More except where a removal pushes
something into them.

The headline is Mark's own: **the app is about 30% too complicated**. Almost
every row in the table is a consequence of cutting that 30%.

---

## The five decisions that carry the rest

1. **Tasks are gone; advice is the only unit of work.** An advice no longer
   becomes a task when assigned. It stays open until it is completed, ignored or
   delayed, and can be sent to one supervisor (WhatsApp/SMS with a "click when
   done" link) which flags it as sent. This removes E1–E4 and the fifth tab.
2. **Workforce is gone, to a later version.** No worker database, no per-worker
   languages, no notification routing. Mark: "I'm not saying no to it. I'm
   saying it's a V2." It follows from (1) — with one supervisor there is
   nobody to manage.
3. **Single farm is the product; multi-farm is optional.** ~95% of users have
   one farm. B1 only appears when the account has more than one; a single-farm
   account lands straight on its farm. Multi-farm stays in the requirements.
4. **B2 and B3 merge into one home screen.** Map on top, the plot list under
   it, no separate "farm overview" hop. Health at farm level is meaningless
   because each crop has its own profile — so "Health today" comes off.
5. **Trees are not plots — they are tree groups, and they must be surveyed.**
   One virtual tree group per species, geographically spread, no crop cycle, no
   manual boundary drawing. A farmer cannot outline trees correctly and the
   trees have to be counted individually anyway.

---

## The changes

| SCREEN | ACTION |
| --- | --- |
| **Global — wording** | Count and phrase only *urgent* items in every attention line. "2 farms need attention" → "2 farms need **urgent** attention"; same on the farm and plot lines. Planned, monitor and good are routine and are never called out. |
| **Global — concepts** | Delete the task concept entirely. An advice is open → completed / ignored / delayed. Nothing converts into anything. |
| **Global — concepts** | Rename trees away from "plot". A tree group is a virtual plot: one per tree species (Dates, Citrus, Pomegranate), spread anywhere on the farm, no boundary of its own. Mark to confirm with Neil whether it is one group per species or one group for all trees. |
| **Global — naming** | Fix the ladder in the screen titles so the hierarchy reads: B1 all farms → B2 one farm → B3 **overview of all plots** → B4 **individual plot**. |
| **Global — tab bar** | Five tabs down to four. Tasks is removed; Plots takes a slot. Home, Plots, Map, Advice, More is still five — Romain to try arrangements and settle it, given Home and the plot list now merge. |
| **Global — deck** | Annotate every button on the exported deck with the screen it leads to ("See what to do → D1", "Advice → D1", each Explore row → its section). The interconnections do not survive a linear PowerPoint without them. |
| **B1 — Home / My farms** | Make the screen conditional: shown only when the account holds more than one farm. A single-farm account never sees it and opens on B2/B3 instead. |
| **B1 — Home / My farms** | Keep "See what to do" (Mark: "the more buttons the better") and keep it pointing at D1. |
| **B1 — Home / My farms** | Tapping a farm goes to the merged single-farm home, i.e. the same screen a single-farm owner sees. B1 is an interface layer over that, nothing more. |
| **B2 — Farm detail** | Merge with B3 into one single-farm home: farm map, then the plot list directly on the page. No separate hop to see plots. |
| **B2 — Farm detail** | Remove the "Health today" block entirely — plant health, water stress and nutrition at farm level. These are meaningful per crop only. |
| **B2 — Farm detail** | Keep the Advice count as a button ("6 new") linking to D1, filtered to this farm. Remove the Tasks count with the task concept. |
| **B2 — Farm detail** | Remove the weather block; weather moves under More, reachable from there. |
| **B2 — Farm detail** | In Explore: remove **Workforce** and **Farm Diary**. Keep **Reports** (Mark: he can have reports emailed to him). Keep Trees, now as tree groups. |
| **B2 — Farm detail** | Move the plot list out of the Farm section of the deck and into the Plots section, since that is where it now lives. |
| **B3 — Plots (becomes the home screen)** | Retitle as the overview of all plots and make it the farmer's home, merged with B2's map. |
| **B3 — Plots** | Split the list into two blocks: **crops first** (open field: tomatoes, wheat, onions), **tree groups second**. The two are displayed differently because they behave differently. |
| **B3 — Plots** | Change what a plot card shows: plot name/number, **size**, and **what is being grown** with its cycle. Remove NDVI and water stress from the cards. |
| **B3 — Plots** | Add a small urgent flag per card, so the farmer sees at a glance that plots 5 and 2 need urgent action and 1 and 6 are fine. |
| **B3 — Plots** | Add the filter dropdown with the five options: all actions, urgent, planned, monitor, good. |
| **B3 — Plots** | Surface crop entry here: when the AI has detected a harvest and the plot has no current crop, show that state in red on the card with a dropdown to say what is being grown now. The record of the plot belongs on the record of the plot. |
| **B4 — Plot detail** | Cut it back — Mark: "this page shouldn't have too much information". It says either "you are currently growing tomatoes" or "your cycle has finished, tell us what is next", and little else above the satellite reading. |
| **B4 — Plot detail** | Remove the crop cycle section for tree groups. Crop cycles exist for crops only; citrus stays citrus. |
| **B5 / B6 — Crop cycles** | Un-bury the cycle. It is currently three navigations and a scroll below the plot — the entry point moves up to B3 and B4 per the rows above; B5/B6 remain only for the fuller season history. |
| **B5 / B6 — Crop cycles** | Add the reminder the farmer actually needs: when the satellite sees the previous crop harvested and cannot yet identify the new one (it needs ~3 weeks of leaf), prompt him to enter the new crop. No reminder mechanism exists in the build today. |
| **A9 — Add your first farm** | Make the trees answer force the satellite route: if the farmer says he grows fruit trees or date palms, skip "draw your own plots" and go straight to drawing the **farm** boundary (A10). |
| **A9D — Draw my own plots** | Remove manual plot drawing wherever trees are involved. Manual boundaries stay available for open field only. |
| **B12 — Add farm** | Same rule as A9 — a farm with trees always goes through the survey. |
| **B9 / B10 — Trees** | Re-frame around tree groups: one virtual plot per species holding trees spread across the farm, priced and advised as a group. No boundary drawing, no crop cycle. |
| **D1 — Advice inbox** | Replace the "anyone" assignee filter with an **action type** filter: all actions, urgent, planned, monitor, good. An advice is not assigned to anybody by definition, so filtering by assignee was an error in the mockup. |
| **D1 — Advice inbox** | Advice covers everything from urgent to routine — no change to scope, but the screen must say so. |
| **D1 — Advice inbox** | Replace assignment with sending: one supervisor, one send. The advice carries a flag showing it was sent, and stays open until the supervisor closes it via the link or the owner ignores/delays it. |
| **D1 — Advice inbox** | Accept the state set: open, sent, completed, ignored, delayed. Remove "assign to worker". |
| **E1–E4 — Tasks** | Delete the whole section: Tasks/My Work, task detail, new task, complete task. Remove the Tasks tab and its badge. |
| **G1–G3 — Workforce** | Delete the whole section: workforce list, add worker, worker record. |
| **F0 — More** | Add **weather** here, with the summary still clickable where it appears. Absorb whatever else the removals push out. Farm Diary is not moved here — it is removed. |
| **F9 — Notifications** | Cut back to what survives without workforce: no per-worker language or channel routing. |
| **C1 — Map** | Redraw the mock plot geometry more realistically — real plots are squarer than the shapes in the current fixtures. |

---

## Raised and deliberately not actioned

- **Removing multi-farm outright.** Mark suggested it ("if you want two farms
  you get two subscriptions") and Romain agreed it could go, but they settled on
  keeping it in the requirements and simply not surfacing it for single-farm
  accounts — because retro-fitting it later is expensive and multi-farm owners
  are big entities who would use the web platform anyway.
- **One tree group per species vs. one for all trees.** Mark is checking with
  Neil. The mockup goes with one per species in the meantime, since lemon trees
  get different advice from date palms.
- **Who pays for the farmer's licence** (ADAFSA vs. the farmer) and
  **pre-registration by phone number** against ADAFSA's 25,500-farm list. Still
  open with the client; the existing large-government registration path in the
  spec already covers it and needs no change yet.
- **Which four tabs.** Agreed that Tasks goes and that Plots earns a slot;
  the final four are Romain's to try.
