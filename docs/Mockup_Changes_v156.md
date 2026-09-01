# v1.5.6, the second pass over the same comments

The build moves to **1.5.6**. The requirement set underneath it is still at
**1.7**.

- Round 7, the marks on the v1.5.4 deck: [`Mockup_Changes_v155.md`](Mockup_Changes_v155.md)
- Round 8, this document

Eleven notes on what round 7 produced. Two of them take work back out, and the
rest are about the size and the substance of pictures.

---

## The map is one size, on all three screens

> *"For A10, A10D and A11 — let's make the map the same size, 65% of the screen,
> no margins left, right or top. Scroll up / down to show the rest."*

The farmer draws his farm boundary on A10, draws his plots on A10D and reads
what came back on A11, and until now those were three different maps of three
different sizes: A10's filled everything between the bar and the button, A10D's
took what the panel under it left, and A11's was a card with a radius and a
margin. A map that changes shape between the drawing and the reading has to be
re-read each time.

All three now use **`mapBand()`** — 65% of the phone, flush to the top and to
both edges, with whatever is under it scrolling up over nothing. The percentage
is the reason the band is a **direct child of the scroll area** rather than a
block inside the page: a percentage height resolves against the nearest
ancestor that has a definite one, and `.page` does not. So those three screens
return an array as their body, the band first.

**What it costs is visible on A10**, which has nothing under its map but the
one warning that can appear: 65% leaves a band of empty paper above the button.
That is the note followed literally, and it is worth a word at the next review —
the alternative is to let A10's map take the room nothing else wants, at the
price of the three maps no longer matching.

---

## A11 is Survey results, and the boundary control is on the bar

> *"Move the 'adjust farm boundary' to the top bar, right side, as a smaller,
> subtle button."* · *"Change slide title and screen name to Survey Results."*

The boundary control was a full-width row under the map, which gave a
correction the same weight as the thing it corrects. It is now an icon and a
word on the right of the app bar, where every other per-screen action in the
app already lives. `barAction()` gained a `title`, so the bar reads **Boundary**
and a screen reader still hears *Adjust the farm boundary* — the same control,
and not the same length.

The screen is **Survey results** on the page and in the deck. *Summary of plots
to be monitored* described the list rather than naming the screen, which left
the reviewer's own shorthand — he calls it the survey results throughout —
nothing on screen to attach to. It is set in sentence case to match every other
screen name in the deck.

---

## A13B is withdrawn

> *"Remove A13b — it wasn't there before and shouldn't be there now."*

The marker on page 13 of the v1.5.4 deck — *"add screen Axx (slide 15)"* — was
read as a request for the payment page. It was not. The screen is gone, and
**Choose on A13 lands on A14 again**, for both routes; the 15% annual saving is
stated once, in *Before you buy* at the foot of A13, where the other commercial
facts are.

Both routes still finish on A14, which is the part of round 7 that stands: the
survey route used to drop the farmer into the app from A13 and never see the
screen that says the work is done.

---

## The tour shows pictures

> *"Screen A4A — use the satellite picture attached instead of your own
> drawing."* · *"A4E — use the image of the crops attached."* · *"A4B to A4D —
> use actual pictures of the screen, generated, cropped, with light border."*

Both photographs were already in the repository's own history: the reviewer had
pasted them onto slides 17 and 21 of the deck he marked up, so they came out of
that file at full size rather than being redrawn. They are in
`app/imgs/tour/` as AVIF, 42 KB and 134 KB.

The middle three panels used to mount the real screens live and scale them down.
It kept the tour honest by construction and cost three things this answer
removes: a page carrying three primary buttons and sixty sub-36 dp touch targets
belonging to other screens, six extra renders every time the tour opened, and —
on paper — a photograph of a photograph.

The honesty is a build step now. **`npm run tourshots`** drives the app,
photographs D1, F9, D2, D3, B5 and B6 at twice the phone's pixels, crops each to
the top 62% and writes it into `app/imgs/tour/`. It is the first thing to run
when one of those six screens changes. The pictures are checked in, because this
app has no build step and `index.html` has to open from a `file://` URL.

Each sits behind a hairline border and a soft shadow — the review's *light
border* — because they are pictures of a white app on a white panel and without
an edge they float.

---

## The smaller marks

**A3's help block is at the bottom.** *"Align the 'we are here to help' and the
contact buttons to the bottom of the screen."* They sat directly under the two
links, which put a help offer in the middle of a short screen where it read as a
third way to log in. A `page--fill` page and a spacer put it against the bottom
on a tall phone and let it simply follow the form on a short one — pushed down,
never pushed off.

**A10D's two buttons each keep to one line.** They were in a bare flex row,
which sized them to a share of the dock and then let the labels wrap:
*Add another / plot* beside *Request / quote*. They are a pair, which is what
`actionDockPair` is for, and a pair does not wrap.

---

## A9B goes back after A9, and says why on the page

> *"A9B: let's keep it AFTER A9 in the slides (against comments), and add a
> visible note to the powerpoint explaining it."*

Round 7 printed the deck in the order the first pass asked for and left the app
alone, which put the pages and the flow ribbon on the same page disagreeing with
each other. The pages are back in the order the app walks, and **A9B's page now
carries the reason in the green band under its title** — the band that already
carries the condition under which the screen appears at all:

> *Shown only when the farm's type is FIELD CROPS. A farm with trees goes from
> A9 straight to A10. PRINTED AFTER A9, AND NOT BEFORE IT: the 01/09 note asks
> for A9B first, but A9 is where the farmer says what is growing, and that
> answer is what decides whether this screen appears at all — so the fork cannot
> be asked before it. Open for discussion; see the change record.*

Which is better than the reordering was. A page out of order says nothing about
why; a note on the page does.
