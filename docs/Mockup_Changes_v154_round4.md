# v1.5.4, fourth round of comment

Still **1.5.4**, on instruction. One deck, one number, while the review cycle is
in flight; the specification underneath it has moved to **1.7**.

- Round 1, the recorded call: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md)
- Rounds 2 and 3, the first comments on the deck: [`Mockup_Changes_v154_round2.md`](Mockup_Changes_v154_round2.md)
- Round 4, this document

---

## The flow strip is a line again

Round 3 turned it into a tree. Round 4 turns it back, and the reason is worth
writing down: a tree answers *what can this screen lead to*, which is a question
about the app. A reviewer paging through a deck is asking *what was the farmer
doing when he got here*, which is a question about one journey — and a diagram
that shows every branch at once answers neither well on a printed page.

So `FLOWS` is a list of linear paths again, and each one now declares the
**section** it belongs to:

```js
{ section: 'My Farm',  name: 'Looking after the farm itself',           ids: ['B2', 'B12'] }
{ section: 'My Plot',  name: 'From the farm to one plot, and what is growing on it',
                                                                        ids: ['B2', 'B4', 'B5', 'B6'] }
{ section: 'Trees',    name: 'From the farm to a tree group, and down to one tree',
                                                                        ids: ['B2', 'B13', 'B10'] }
```

B2 is on three of them. Which one prints beside it is decided by the section the
page is filed under, so the copy of B2 in **My Farm** shows the farm journey and
the copy in **My Plot** shows the plot journey. The reviewer's context picks the
line, which is what "make sure the linear flow matches the current area in
focus" asked for.

Fourteen paths across eight sections. Registration is two of them — one ending
in a survey, one in a drawing — which is the price of a line, and a fair one.

---

## Markers for the small buttons

> *"Add markers for small buttons that redirect to other slides, and small
> buttons that have important features behind them (like the map buttons). The
> markers should be located OUTSIDE of the phone mockup, and not cover any
> content."*

A printout cannot be tapped. On paper an icon button that opens a whole screen
and one that does nothing much look identical, and the three controls on B4's
map — the reading picker, the date picker, the way into the map tab — are the
clearest case: three glyphs, 40 dp each, carrying a third of what that screen
can do.

**How it works.** A control declares itself where it is built, with `deckMark()`
in `app/ui/components.js`:

```js
mapTool('scan', t('b4.openmap', 'Open in the map'), false, openMap, { deckTo: 'C1' })
helpButton(body, { title })                         // declares its own note
overflowAction(onclick, label, { deckNote: 'Rename, edit the boundary, remove the plot' })
```

`deckTo` is the screen it leads to; `deckNote` is what it opens when it stays on
this screen. Both render as `data-` attributes and **nothing appears in the
app** — this is the same instruction as round 2's *no screen names another
screen*, honoured rather than worked around. The attributes are invisible on a
phone and read only by the deck builder.

`tools/screendeck.mjs` reads them off the rendered page with their positions and
draws:

* a **numbered green disc in the gutter** — the 0.40 inch of white between the
  phone's right edge and the filmstrip, empty on every page of the deck — at the
  height of the control it names, so the eye travels straight across;
* a **numbered key** under the strip: `Open in the map → C1 Map (page 34)` for
  anything that leads somewhere, with the page number so the reviewer can turn
  to it, and the declared sentence for anything that opens in place.

Nothing is drawn over the phone and nothing is covered. Discs that would collide
are pushed apart; the numbers still run top to bottom. Eight plot rows with the
same chevron collapse to one marker rather than eight, and a marker pointing at
a screen the deck does not print is dropped rather than sending the reviewer
looking for a page that is not there.

**26 controls marked across 12 screens.**

### `DECK_OMIT`

B11 was to come out of the slideshow. It was doing that by being left out of
`SCREEN_GROUPS`, which quietly took it out of the app's own contact sheet too —
a deck decision leaking into the app's index. `app/screens/index.js` now exports
`DECK_OMIT = ['B11']`: the index stays complete, and the deck skips what the
deck skips, in one named place.

---

## Screen by screen

| Screen | What changed |
|---|---|
| **Global** | **Status vocabulary.** Watch → **Monitor**, Action → **Planned**, with the meanings rewritten to say what to do: *No action required currently · Watch for changes and reassess · Complete as regular activity · Take action today*. The keys are unchanged, so nothing downstream had to move. |
| **Global** | **Both calendars, everywhere.** A date prints Gregorian and Hijri together — `12 February 2026 - 24 Sha'ban 1447` — ordered by the F8 setting (Gregorian first, Hijri first, or Hijri only). List cells and range endpoints stay short and Gregorian: two full dates either side of a dash is a paragraph where the column wants a stamp. B5's season bar was re-laid out for the extra width — the countdown moved above the bar and the two dates get a line each. |
| **Global** | **Counts say urgent and count only urgent.** The attention line counted everything that was not Good, which on any real farm says *something needs attention* every day of the year. It counts the urgent, and it is absent when there are none rather than printing "nothing urgent". |
| **Global** | **A tree group is counted, not measured.** Its hectares are the ground its parcels happen to cover — not what it is priced on, not what advice is calculated per, not a number anybody quotes about an orchard. Tree rows carry `1,240 trees`; the hectares are gone from B13's header, from the B2 plot line and from A11. |
| **A1** | Register and Log in are the primary pair; the tour is a quiet filled container underneath rather than a third equal button. |
| **A3** | The code button reads **"Send code to mobile number"**. |
| **A4 · A4A–A4D** | The tour is **five pages in the deck**, one per panel, and sits after A14 — registration reads unbroken, then the detour that is offered on A1 as its own run. |
| **FORGOT** | Mobile and Email are the same switch as A3; the email route sends a reset **link** rather than a code, because that is what an email reset is. |
| **A9** | The fork — survey the whole farm, or draw my own plots — is offered **only for field crops**. A farm of trees is surveyed, because the tree count sets the price. Nothing is drawn disabled; pressing a route without a farm name puts the cursor in the name field and says why. |
| **A10 / A10D** | The drawing instruction lives behind a **"How to draw this"** chip. A10D gained the plot-type step it was missing. *(Round 5 moved the chip to an ⓘ on the app bar.)* |
| **A11** | **Rectangles.** The survey drew wobbling five- and six-sided parcels here after every other surface had been squared off. Same generator, same square grid, same look as B2 and the map. Tree rows show the number of trees, and the watch panel row is **"Number of trees"**. |
| **A12** | Retitled **"Your survey"**, cut to four short rows, warning box gone. |
| **A13** | Annual pricing on the plan cards at a **15% discount**, the permission sentence on the trial card, and the bullets rewritten. |
| **B2** | The farm name at the top left is the picker, and it says so on hover; the plot list is hairlines rather than cards; only the chevron navigates. |
| **B4** | **"See AI suggestions" → "See Advices".** |
| **B11** | Out of the deck — see `DECK_OMIT` above. Still in the app and still in the harness index. |
| **B12** | No longer re-offers the survey. *(Round 5 removed B12: it is A9B now.)* |
| **F5 / F6** | Carry the same annual discount as A13, from one exported constant. |

---

## Checks

`./tools/syntax.sh` · `npm run icons` · `npm run catalogue` · `npm run smoke` ·
`npm run deck`

494 renders across both roles, no console errors, 50 tiles for 50 screens on the
contact sheet. The deck is 59 slides: cover, contents, 8 section dividers and 49
screens, 43 of which sit on one of the 14 paths.
