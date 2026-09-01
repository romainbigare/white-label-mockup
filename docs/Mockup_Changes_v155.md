# v1.5.5, the comments on the v1.5.4 deck

The build moves to **1.5.5**. The requirement set underneath it is still at
**1.7** — this round moved screens, not rules.

- Round 1, the recorded call: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md)
- Rounds 2 and 3: [`Mockup_Changes_v154_round2.md`](Mockup_Changes_v154_round2.md)
- Round 4: [`Mockup_Changes_v154_round4.md`](Mockup_Changes_v154_round4.md)
- Round 5: [`Mockup_Changes_v154_round5.md`](Mockup_Changes_v154_round5.md)
- Round 6: [`Mockup_Changes_v154_round6.md`](Mockup_Changes_v154_round6.md)
- Round 7, this document

The comments arrived drawn onto the deck rather than as a document — peach note
boxes, red frames, leader lines, strike-throughs and pasted screenshots, on
twenty-two of the fifty-nine pages. **Forty-five changes.** Forty-four of them
are in this build; the forty-fifth is at the end, and it is a question rather
than a refusal.

---

## A12 is deleted

> *"Delete? Not sure what purpose this screen is fulfilling. After A10 (Survey
> my whole farm), he should go to A11 (Survey results). It is too early for him
> to request a quote."*

The whole screen was struck through, and so was its step in the flow ribbon.
Both halves of what it did had already moved out from under it: the explanation
of what a survey covers is now the tour's second panel, and the quote is asked
for on A11, in front of the plots it is about.

So **A10 does the work it used to hand on**. Its button says *Request survey*
— *"change to: 'Request survey'"* — and pressing it makes the farm record, runs
the survey against the boundary just drawn, and puts up the pop-up the review
asked for:

> *"Add a pop-up screen: We will notify you when the farm monitoring results
> are available (usually within one day)."*

One sentence, one way onward, no Cancel — there is nothing to cancel, the work
has been asked for. The button on it goes to **A11**, which is where the review
said the farmer should be.

The pop-up is a new overlay shape. Every modal in the app was either a question
with two answers or a picker; a plain acknowledgement had nowhere to live.

---

## A11 carries the farm's own outline

Four notes landed on this page, and two of them are the same idea.

**The map is the size of A10's.** It was a 215 dp letterbox under the bar,
against the full-height map the farmer had been drawing on a screen earlier, so
the plots the survey found were smaller than the single line he traced to find
them. It is now 420 dp and the tallest thing on the screen. Not literally A10's
height: A10 has nothing under its map, and a map that filled the phone here
would hide the fact that there is a list of plots to approve.

**The line he drew is on it**, and he can correct it.

> *"We should show the farm outline that the user selected in A10 as a reference
> point. If the user made a mistake, he should be able to adjust the farm
> outline to remove plots. An alternative way for him to remove plots."*

A10 now stores the boundary on the farm, so the shape on this map is the shape
he traced rather than a redrawing of it, and **every map in the app draws it**
— which is the answer to a separate note on C1, *"on all the maps, let's show
the farm boundary (if available)"*. A farm that arrived without a traced line —
every fixture farm — gets the hull of its own plots with a little air round it,
which is the second reading of *if available*: a farm with land has a shape even
if nobody drew it.

**Adjust the farm boundary** sits under the map and reopens A10 on that farm.
Saving a corrected line takes every plot whose centre now falls outside it off
the quote — the alternative way to remove plots the review named. Nothing is
deleted; putting the line back puts them back.

**The rule about crops is stated.** *"Add: 'A plot should not have more than one
crop.'"* It follows *We found 8 plots inside your farm.*, and it is what makes
Split on a row worth reaching for.

**The summary block is renamed and filled out.**

> *"Change to: 'What we will monitor'. Below that, we should show: Field crops
> 45.1 ha / Date palms 223 trees / Fruit trees 43 trees. If there is no value,
> we should show 0."*

Three rows, always, with a nought where there is nothing — a row that vanishes
when it is empty leaves the farmer to work out whether we found no palms or
forgot to look. The app could not answer this before: the survey had one tree
class and nothing under it. It now tells **date palms from other fruit trees**,
which is a distinction the imagery can genuinely make, and it sits *under* the
existing class rather than beside it — `kind` is still crops or trees, which is
what the colours, the pricing and WF4.048's vocabulary are built on.

**And the button says Request quote**, which is what the farmer is doing.

---

## A13 loses three lines, and A13B appears

> *"Remove 'at all'."* · *"Move '+VAT' up one line to the right of 'month'."* ·
> *"Delete."*

The trial promise reads *"…and nothing is charged during the free trial"*: *at
all* was doing the work of an argument in a sentence that is a promise, and a
promise that protests is a promise being doubted.

**VAT belongs to the number**, so it is set beside it — one line, one price, one
caveat — instead of standing underneath looking like a second fact about the
plan.

**The annual rate and the coverage line are off the cards.** The card is where
the farmer chooses a *level*; a second price for a billing period he has not
been offered yet is a number to compare against the one he is deciding on.

Which is where the marker on page 13 comes in:

> *"Add screen Axx (slide 15)."*

It sat in the gap between A13 and A14 — the one gap in the registration walk,
and the screen three rounds of comment have called *the payment page* without
ever drawing. **A13B · Confirm and pay** holds the two things that were waiting
for it: the billing period, which is where a 15% saving is a reason rather than
a distraction, and the permission A13 promises to ask for. Nothing is charged on
it and it says so twice.

Both routes now finish the same way. The survey route used to drop the farmer
straight into the app from A13, so one of the two ways in never saw **A14** at
all. Choosing a level goes to A13B either way, and A13B to A14.

**A14 says *your* account**, not *our*. One word, and the one that decided
whether the app sounded as though it had taken possession of the farm.

---

## The tour is six panels, and all of the words are the reviewer's

The five panels were placeholders held open for copy. The copy arrived, and it
changed the shape of the thing: each panel now argues a part of the product, and
a sixth was added second — *"new slide"* — because everything after it is a
thing the service does and this is the sentence that says how it can.

| | |
|---|---|
| 1 of 6 | *Enhancing your farm profitability through precision agriculture.* The body's last two clauses are switched: irrigation before fertiliser, which is the order the farmer meets them in. |
| 2 of 6 | *How our service works* — the new panel, over a satellite. |
| 3 of 6 | *Farm planner*, with D1 and F9 beside it. |
| 4 of 6 | *Irrigation and fertilization advice*, with D2 and D3. |
| 5 of 6 | *Optimizing crop yields*, with B5 and B6. |
| 6 of 6 | *Over 6 million farmers trust us worldwide*, three figures, and farm profitability underneath them. |

**The illustrations are live screens, not screenshots.** *"Add example from D1
and F9"* could have been answered with six pasted PNGs and a note to re-paste
them whenever a screen changed. They are the real screens instead, rendered
small and cropped from the top the way an app-store shot is — so the tour cannot
drift away from the app it is advertising. The thumbnails are inert and
aria-hidden: a picture of a screen is not a control, and counting its buttons
would fail the tour for touch targets that pass on their own pages.

The two panels with no screen to show draw their own artwork out of the same
imagery the map screens use. Nothing here is a photograph, and nothing here
needs maintaining separately from the app.

---

## Advice, in the units the farmer works in

> *"Express water requirements in volumetric rates per plot (m³/ha) rather than
> simple millimeter depths."*

D2 was already in cubic metres, and the figure it printed was already a rate —
8.4 mm/day of crop water use over a week at 85% efficiency is 693 m³ **per
hectare**, and it was labelled as the plot's total. On a 137 ha block of palms
that is a hundredfold error in the one number the farmer acts on. The headline
is now the rate, said as a rate, with the plot's total and its area underneath:
one figure to set the system by, one to check the bill against. Every weekly
amount is in the same unit.

> *"Provide application rates in actual fertilizer product terms (e.g. kg/ha of
> Urea or NPK formulation) rather than elemental values alone."*

D3 used to end its elemental block with a promise — *once you tell us which
fertilisers you use, we'll show product equivalents too* — which asked the
farmer for a shopping list before it would answer the question he came with.
**What to apply** now names the products, with the rate per hectare and the
amount for the plot, and more than one where more than one will do. The
recommendation is still made in the nutrient, because that is what the crop is
short of.

---

## Compare plans is about the farm, not the satellite

> *"We don't show the practical features that are provided to the farmer under
> each plan. I don't think the satellite resolution, cloud-free data, etc. is
> useful. It suggests the basic service is degraded. … Column 1: Features,
> Column 2: Basic plan, Column 3: Pro plan."*

The satellite group is gone: it described our supply chain, and read as a list
of the ways Basic is the cheap one. What is left is **four topics, each a thing
the farmer does** — where his land is, what we watch on it, what we tell him to
do, and what he can show afterwards — in **three columns**.

The previous shape printed every feature once, under *Basic includes* or *Pro
adds*, which was the right fix for sixty rows of two identical ticks but meant a
farmer reading the Basic column could not see that a feature was in both. A tick
under each level says it outright, and where the levels differ by degree the
cell carries the difference in words: *to 1 m* against *to 3 m*, *weekly amount*
against *day-by-day schedule*.

---

## The smaller marks

**A1** carries the address. The space between the language list and the two
buttons was the one part of a deliberately tight screen doing nothing, and a
farmer who wants to read about us before he registers now has somewhere to go.
It lives in `brand.js` with the names, because re-labelling this app is
replacing the artwork and those strings and nothing else.

**A3** ends with *We are here to help* and two contact buttons. It is F13's
opening block, shared as one component, because a farmer who cannot get past the
front door is the person who needs it most. The buttons are quiet here and
filled on F13: one primary action per screen, and on the front door that action
is logging in.

**F13** loses the opening hours (*"remove as they are not calling us"*), the
word *us* from both buttons, and the footnote about contact details being loaded
from our servers — a fact about our infrastructure told to somebody who wants
help. The two buttons were 92 dp against the support ticket's 52; all three are
now the same size.

**A10 and A10D open on a six-cornered shape**, at irregular intervals.

> *"The example provided to the user should have a minimum of five corners. This
> will tell him that he is not limited to a perfect square. The shape should not
> be a perfect pentagon."*

The v1.5.4 review had made it a rectangle on the argument that fields here are
laid out in rectangles; this round reversed that on both screens, and ruled out
the obvious way to satisfy it, because a regular polygon teaches its own wrong
lesson — that corners come evenly spaced. What is there is a rectangle with one
side stepped in and one corner cut, which is what a field bounded by a track and
a neighbour looks like. The plot example also grew: *"the plot example seems
small compared to the map area."*

**A10D loses the crop lists.** *"Under field crops: keep 'Priced per area',
delete 'For example: wheat, alfalfa…'"* — nine crops under an option nobody
chooses *by* crop made the card four lines tall and invited the farmer to hunt
for his own in a list that was never meant to be exhaustive. With them gone the
map takes at least half the screen, which is the other note on that page:
*"let's reduce the text to show a larger map screen."* Its button says *Request
quote*, the same words A11 now uses.

**The More section ends on Contact Wafra.** *"Move My Profile (F14) to the top
of the More section, as it makes the flow more natural, ending with F13."* It is
where the profile sits on F0 itself — the card above every other row — so the
printed walk now reads the way the screen does.

**And one note needed no work.** The proposal to move the guided tour to the
front of onboarding was answered on the slide it was written on: *"Romain, I'll
explain to Hani that the order doesn't matter as they are parallel workstreams.
No need to make changes."*

---

## The one that is a question

> *"A9B should come before A9"* — with the reason on the next page: *"A9 only
> applies if user selects 'Survey my whole farm'."*

**The deck prints it that way. The app does not, and this is why.**

A9 asks what is growing on the land, and that answer is what decides whether the
fork exists at all. A farm with any trees on it never sees A9B: trees are
counted one by one from the imagery, the count sets the price, and a farmer
cannot trace that by hand — settled at the 22 August review, which asked for the
fork to be shown to field crops alone. Asking the fork first would offer a date
grower a route that ends in his being told he cannot take it, which is the
screen apologising for existing that round 6 removed.

There is a reading of the note that works — ask *how shall we find your land*
first, then ask the farm's details only on the survey route — but it needs the
farm's name to move, and it needs a decision about what a tree grower sees.
Worth five minutes rather than a silent reordering, so the pages are in the
order the review asked for and the app is unchanged, with both facts written
down beside the code in `app/screens/index.js`.
