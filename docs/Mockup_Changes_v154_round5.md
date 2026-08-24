# v1.5.4, fifth round of comment

The last round on this version. Still **1.5.4**, on instruction; the requirement
set underneath it is at **1.7**.

- Round 1, the recorded call: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md)
- Rounds 2 and 3: [`Mockup_Changes_v154_round2.md`](Mockup_Changes_v154_round2.md)
- Round 4: [`Mockup_Changes_v154_round4.md`](Mockup_Changes_v154_round4.md)
- Round 5, this document

---

## Adding a farm is one flow, and it is an A flow

> *"B12 should really be an A screen, and we need to remove the name input. When
> the user adds a farm, either through the FIRST RUN or through the MY FARM
> screen, we should present A9, and then this new version of B12, that leads to
> A10 or A10D."*

B12 was in the wrong place twice over. It was filed under **My Farm**, which made
adding a farm look like something you do *to* a farm you already have; and it
asked for the farm's name a second time, in a draft of its own, because it ran
the fork without A9 in front of it. Two screens described the same two routes,
and they had already drifted apart once.

So the flow is one flow now, from either end:

```
A9   name the farm · how you measure land · what is growing on it
        ↓  Continue
A9B  survey the whole farm, or draw the plots yourself
        ↓
A10 (survey)   or   A10D (draw)
```

**A9B** is the old B12 with the name field taken out: the fork, and the two
notices that qualify it — the ten-farm limit and the combined-plan offer, both of
which appear only for an account that already has farms. B12 is gone from the
registry, from the app map and from the deck.

Everything that adds a farm now opens A9: the registration walk, and **Add a
farm** in the farm picker at the top left of My Farm. `startAddFarm()` is the one
door. *Adding a plot* to a farm that already exists is a different thing and was
being routed through the add-a-farm flow by accident; it has its own
`startDrawPlot()` and goes straight to the canvas, because the farm is already
named and its type already settled.

### A9 has a Continue button

It had none, and the reason it had none is the reason it needed one: the two
route cards *were* the action, so a farmer who had filled in a name, a unit and a
crop type had nothing to press. With the fork moved to A9B, A9 ends the way every
other form in the app ends.

Not disabled. A dimmed button does not say which answer is short — this one lands
on whichever one is, and says why.

---

## Screen by screen

| Screen | What changed |
|---|---|
| **A9** | Asks only: the farm's name, the unit its land is measured in, and what is growing on it. **Continue** in the dock. The fork and the trees explanation have moved to A9B. |
| **A9B** | New — the old B12, minus its name field. Two route cards for a farm of field crops; for a farm with any trees on it, the reason there is only one way in and a single **Draw my farm boundary** button. Carries the ten-farm limit and the combined-plan note for an account that already has farms. |
| **B12** | Removed. |
| **A10 / A10D** | The **"How to draw this"** chip is gone. The guidance is an **ⓘ on the app bar**, beside the subtitle that names what the screen is for — the same sheet, one tap, and the panel under the map is back to being about the plot rather than about the instructions. `helpChip()` has gone with it: there is one shape of help button in the kit now, not two. |
| **A12** | No card round **We monitor** / **Priced by**. Two facts in two lines did not need a box, and the box was the tallest thing on a screen whose whole point this round was that it had stopped being tall. |

---

## The deck

**No markers on the D screens.** Every one of them was the same ⋯ menu, four
times over, which is a key repeated rather than a key.

**No empty markers.** A control with no accessible name, no tooltip and no text
produced a numbered disc the key could not explain, and a key line that began
with a dash. The deck builder drops those now rather than drawing them, so a
marker either says something or does not exist. Two related fixes went in with
it: the ⓘ on a drawing screen names the screen it explains rather than saying
*"What does this mean?"*, and the key rows are allowed to wrap again — the
no-wrap setting introduced in round 4 is what made some of them come out blank in
PowerPoint.

**Nothing on the section dividers.** Markers are drawn on screen pages only —
the cover, the contents and the eight section title pages leave the loop before
any marker code runs. Worth saying plainly: on the generated deck I could not
find a marker on the section 8 title page, in the file or in its XML. The
guarantee is now structural rather than incidental, and if one is still showing
in your copy, the slide number will tell me where to look.

**21 controls marked across 8 screens**, down from 26 across 12.

---

## Checks

`./tools/syntax.sh` · `npm run smoke` · `npm run catalogue` · `npm run deck` ·
`npm run changelog`

494 renders across both roles, no console errors, 50 tiles for 50 screens. The
smoke test learned this round: A9 offers no route cards and must carry a
Continue that refuses to proceed on an empty form; A9B is where the fork lives,
gives a farm of trees no cards and a way on, and never asks for the farm name a
second time; and A10's guidance is reachable from the **app bar** rather than
from the body.

This document is generated: `tools/changelog.mjs` typesets these round records
into `docs/Wafra_Mockup_Changes_v1.5.4.pdf`.
