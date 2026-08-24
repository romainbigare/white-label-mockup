# v1.5.4, sixth round of comment

Still **1.5.4**. The requirement set underneath it is at **1.7**.

- Round 1, the recorded call: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md)
- Rounds 2 and 3: [`Mockup_Changes_v154_round2.md`](Mockup_Changes_v154_round2.md)
- Round 4: [`Mockup_Changes_v154_round4.md`](Mockup_Changes_v154_round4.md)
- Round 5: [`Mockup_Changes_v154_round5.md`](Mockup_Changes_v154_round5.md)
- Round 6, this document

---

## A9B is for field crops, and it always offers both routes

> *"A9B should always show both options to detect farm (manual drawing vs farm
> boundary) and should only be shown if Crop is picked as type grown. Please
> make note of that in the slideshow, and in notes for this screen in the mockup
> — not on the screen itself."*

Two rules read from the same end. Round 5 left A9B doing the branching itself:
a farm of trees reached it and found one button and a paragraph explaining why
the other option was missing, which is a screen apologising for existing. It
does not exist for that farmer now.

**A9 sends a farm with trees straight to A10**, the farm-boundary canvas, and
carries the reason on its own last line — *"Trees are counted one by one from
the imagery, so we read your whole farm from above. Next you will draw its
boundary."* A9B is reached only by a farm of field crops, and because that is
the only farm that reaches it, **both route cards are always there**. No state
withholds one, greys one, or swaps one for an explanation.

**The condition is written down in three places and none of them is the screen.**
A farmer never reads *"this screen appears when…"* — he either sees it or he does
not. So it lives in the registry note in `app/screens/index.js`, on the A9B deck
page as a green line between the title and the phone, and in that slide's
speaker notes. The registry gained a `when` field for exactly this; any screen
that is conditional can now say so to the deck without saying it to the farmer.

---

## The deck

**A3 is in Section 2 as well**, as its first screen. It is the last screen of
the registration walk for somebody who already has an account and the first
screen of the way back in, and a reviewer opening **Log in** should not have to
remember a page number from thirty pages earlier. The deck now prints a screen
once per section it is filed in — same photograph, its own page, its own
filmstrip: page 5 shows A3 on the signing-up path, page 22 shows it on
*I have forgotten my password*.

**Six sections, not eight.** *My Plot* and *Trees* had a title page each, which
put two dark dividers between the farm and the plot you reach from it — and a
plot is not a peer of the farm, it is what the farm contains. **My Farm** is now
B2, then a plot and its cycles, then a tree group and one tree.

**B2's filmstrip is the plot walk**: B2 → B4 → B5 → B6, with the tree walk
picking up B13 and B10. It was *Taking on another farm* for one round, which
meant the busiest screen in the app illustrated the rarest thing anyone does on
it. Adding a farm is A9 and A9B, it is drawn in First run, and it does not need
drawing twice.

---

## Screen by screen

| Screen | What changed |
|---|---|
| **A9** | A farm with trees goes straight to A10 from here, and the last line says why. Field crops go to A9B. |
| **A9B** | Both routes, always. The trees branch and its single button have gone — that farmer never arrives. The condition is recorded in the registry note and printed on the deck page, not on the screen. |
| **A13** | Both **Choose** buttons are primary. Review S03 asked for the two to be the *same*, because a green button on one card and a grey one on the other is the app choosing for the farmer; sameness was the requirement and quietness never was, and a grey button under a price reads as the option you are being talked out of. Recorded as the one named exception to WF2.010's single primary action, so a *third* primary on A13 still fails the audit. |
| **C1** | **Search is a tool, not a bar.** The full-width pill across the top was covering the part of the map the farmer's own farm is in — it is the first glyph in the tool column now, where a search control belongs. The corner it vacated goes to the **farm picker**: which farm you are looking at, top left, over the map it names. |
| **B2 · B13** | The **Open map** button on the thumbnail was grey text on a blurred rectangle, which read as an unfinished caption rather than a control. It is a floating white pill with the glyph in a brand-tinted square and the arrow that says it leads somewhere — 32 dp of paint inside a 48 dp target, so it does not own the picture it sits on. One component, `openMapChip()`, shared by both screens. |

---

## A12 sounds like a person again

Cutting this screen down for length two rounds ago turned its prose into
headlines — *"What you get for the boundary you just drew"*, *"And draw a
boundary round each one"* — which is short, and cold, and this is the moment a
farmer has just finished handing us his land and is waiting to hear what happens
to it.

The lead is a sentence now: *"Thank you — we have your farm boundary. Here is
what we will do with the land inside it, and what your price is based on."* And
each of the three rows underneath is a whole sentence rather than a caption that
only parses if you have read the title above it. Whole, but still short — warmth
is not a licence to grow the screen back.

And the three steps are no longer in a card. They were `.row--static` inside a
`card()`, which is the shape this app uses for the things you fill in or tap: a
white panel, hairline dividers, 48 dp bands. Nothing on this part of the screen
is either — it is us telling the farmer what we are about to do with his land
while he waits for a price, and a settings-list frame around that reads as three
switches he has failed to find. It is prose with a glyph beside it now: no box,
no rules, no bands.

The deck note on **A9B** loses *"Both routes are always offered; neither is ever
withheld."* The first sentence already says the screen is for field crops, and
the code has no branch left that could withhold anything.

---

## Checks

`./tools/syntax.sh` · `npm run smoke` · `npm run catalogue` · `npm run deck` ·
`npm run changelog`

494 renders across both roles, no console errors. The smoke test learned this
round: a farm of trees is never shown the fork and A9 says why; a farm of crops
reaches A9B and finds two live route cards, always; and the contact sheet is
counted per **filing** rather than per screen, with a new check that no
registered screen is filed in no section at all.

The deck is 58 slides: cover, contents, 6 section dividers and 50 screen pages
across 49 screens.
