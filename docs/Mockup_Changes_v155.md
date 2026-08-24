# What v1.5.5 changed

The comments on the v1.5.4 deck, applied. The round before it is recorded in
[`Mockup_Changes_v154.md`](Mockup_Changes_v154.md); this one is shorter to
describe and cuts more, because most of it is subtraction.

**Mockup 1.5.4 → 1.5.5, specification 1.6 → 1.7.** Six screens are deleted, one
is renamed, one is new, and two things changed on every screen at once.

---

## Everywhere

### No screen names another screen

The build had begun annotating buttons with where they land — *"Opens your
advice list (D1)"*, *"Everything we think this farm needs (D1)"* — for the
benefit of a reviewer holding a printout who cannot tap anything. That is a real
problem and this was the wrong place to solve it: no farmer needs to know that
the Advice tab is called D1. The annotations are gone from the app; the deck
carries them as arrows and boxes drawn beside the phone.

### Lucide, vendored

The ~90 hand-written path strings in `icons.js` looked hand-drawn because they
were. They are [Lucide](https://lucide.dev) now — ISC-licensed, maintained —
read out of the `lucide-static` package by `tools/build-icons.mjs` and written
to `app/ui/icons.data.js`.

**Not a CDN**, though one was offered. This file is opened from `file://` by
reviewers, photographed by two headless browsers and printed into a deck, and a
network round trip is a way for any of those to come back with a page of empty
boxes. `npm run icons` regenerates after adding a name to the map.

What stayed in `icons.js` is what a mockup should own: the size, the stroke
weight, and how a filled status glyph differs from a stroked one. The mapping is
by MEANING — `advice`, `tree`, `droplet` — so a better glyph can be swapped in
without touching a screen. One needed a hand: Lucide's `contrast` ships both
halves as outlines, and the "Watch" state is half-FILLED, so the generator fills
the second element.

### Every plot is a rectangle

The fixtures drew wobbling five- and six-sided parcels, a quarter of the
open-field plots as centre-pivot circles, on the argument that real cadastre is
irregular. The review's answer, from somebody who has walked these farms, is
that it is not — and the wobble was making a satellite mockup look like a hand
drawing. Parcels still differ in size and proportion, because fields do.

Two consequences worth naming: the farm grid is now **square** (it was 4 × 3
into a square space, which made every cell a third taller than it was broad and
every parcel in it the same), and the drawing canvas opens on a rectangle rather
than a five-cornered shape.

---

## Screen by screen

| Screen | What changed |
|---|---|
| **A9** | The two route cards are shown to **field crops and to nobody else**. A farm with trees gets a sentence saying why there is one way in — trees stand in irregular groups and are counted one by one — and a single button to the farm boundary. Offering a choice and then taking half of it away is a worse screen than not offering it. |
| **A10D** | Renamed from A9D. It is the drawing canvas and it belongs beside A10, the other one. |
| **A12** | **Stopped asking.** The crops-trees-both question moved to A9, so a farmer reaching A12 had answered it and was being asked again over a boundary he had just spent five minutes drawing. It explains instead: what the satellite reads, how often, and the two things it cannot do. The quote is still requested from the dock. |
| **B1** | **Deleted.** A list of farms is a picker, and a picker belongs in the app bar. It is the `FARM_SWITCH` sheet, opened from the farm name on B2, and it carries Add a farm — the one other thing B1 had that was worth keeping. |
| **B2** | Six things came off and one changed shape. Gone: the "Nothing urgent" line when nothing is (silence is the answer), the plot filter, the colour legend, and the Advice card. The plot is no longer a card: it is a **row** — name, crop, size, chevron — with the crop as its own control, because correcting the crop is what this screen exists for. A plot the satellite has watched being cleared says so in red and opens the crop picker directly. |
| **B4** | The map owns its controls. The measure picker, the date stepper and the compare chip were three full-width rows under a 190 px image; they are **three buttons on the image**, each opening a panel over it, and the picture got the height back. The third button hands the plot to the Map tab. The crop cycle is a **box directly under the map** with everything else about the plot inside it. "Nothing to do here today" — a disabled control in the most valuable space on the screen — is now **See AI suggestions**. "Recent activity" is **Recent suggestions**. |
| **B5** | Clearer and more graphic, as asked. The season is a **bar** — sown at one end, our estimated harvest at the other, today marked, days to go written out — rather than a table leaving the farmer to do that arithmetic. Cuts are marks, not "4 of 8". The history is a **timeline keyed by year**, which is what makes one season comparable with the last. |
| **B7, B8** | **Deleted.** Both were the map, rebuilt at plot scope and reachable from nowhere else. WF5.029…WF5.033 are satisfied on C1 and C4. |
| **B9** | **Deleted, and replaced by B13 · Tree group** — opened by pressing a tree group in the plot list. Where the trees stand (all their parcels, every tree drawn), what the satellite reads over them, how they are spread across the four states of health, and the tree list. The plot filter went with the change: a tree group *is* the plot. |
| **B11** | The **Land** section is gone — three doors under a heading that told the farmer nothing about which of them he wanted. What a farmer opens Farm settings to do about his land is **add a plot**, so that is the row. |
| **E6, E7** | **Deleted.** They survived the deletion of tasks on the argument that they were field capture rather than work. Nothing in the app ever read an observation back: no screen listed them, no advice consumed them, no report counted them. The write path went with the screens. |
| **Navigation** | Home is **My Farm**. The tab opens on a farm rather than on a list of them, and the label says so. |

---

## The deck

Sections are renamed as asked: **Log in**, **My Farm**, **My Plot**. They come
from `SCREEN_GROUPS` in `app/screens/index.js`, which is also what orders the
deck, so the deck and the harness index cannot disagree about them.

`docs/Wafra_Farm_App_Screens_v1.5.5.pptx`, generated from the running app.

---

## Checks

`npm run check` · `npm run icons` · `npm run smoke` · `npm run deck`

The smoke test learned this round's rules and now asserts, among the rest: that
every plot on B2 is a line rather than a card and carries the crop as a control;
that exactly one plot prompts for a crop; that the legend, the filter and the
"Nothing urgent" line stay gone; that A9 offers no route until the type is
answered and none at all to a farm of trees; and that A12 offers no choices.
