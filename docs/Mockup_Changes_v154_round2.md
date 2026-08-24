# v1.5.4, second and third rounds of comment

The build number stays at **1.5.4** on instruction: one deck, one number, while
the review cycle is still in flight. The specification has moved twice
underneath it and is at **1.7** — the two answer different questions, which is
the point of holding both.

- Round 1, the recorded call: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md)
- Round 2 and 3, the comments on the deck: this document

---

## Round 2 — everywhere

### No screen names another screen
The build had begun annotating buttons with where they land — *"Opens your
advice list (D1)"*. That belongs on the deck, drawn as arrows, not in an app a
farmer uses. Gone.

### Lucide, vendored
The ~90 hand-written path strings looked hand-drawn because they were. They come
from [Lucide](https://lucide.dev) now, read out of `lucide-static` by
`tools/build-icons.mjs` into `app/ui/icons.data.js`. **Not a CDN**, though one
was offered: this file is opened from `file://` and photographed by two headless
browsers, and a network round trip is a way for any of those to come back with
empty boxes. `npm run icons` regenerates.

### Every plot is a rectangle
The wobbling five- and six-sided parcels and the centre-pivot circles were
making a satellite mockup look like a hand drawing. The farm grid is square too,
so parcels are no longer all portrait. The drawing canvas opens on a rectangle.

### Six screens deleted
**B1** (a list of farms is a picker, and a picker belongs in the app bar — it is
the `FARM_SWITCH` sheet now, carrying Add a farm), **B7** and **B8** (both were
the map rebuilt at plot scope), **B9** (replaced by **B13**, the tree *group*),
**E6** and **E7** (nothing in the app ever read a field observation back).

**A9D → A10D.** It is the drawing canvas and it belongs beside A10.

---

## Round 3 — screen by screen

| Screen | What changed |
|---|---|
| **B2** | The plot list loses its card: hairlines between rows and nothing else, at `--ink-200` so they are actually visible without the box round them. The size moves up beside the plot name. Only the chevron navigates — the row itself is not a target, so the crop control beside it can be pressed without opening the plot. "Harvested — tell us what you planted" is **"Set the new crop"**, one line. |
| **B12 / A9** | **Nothing is drawn disabled.** The route cards greyed out until the farm had a name, which reads as broken rather than as sequenced and leaves the farmer guessing which field unlocks it. The name is still required — pressing a card without one puts the cursor in the name field and says why — but the choice looks like a choice from the moment the screen opens. |
| **B4** | The map pulls back: the pad round a plot scales with the plot rather than sitting at a fixed 20 m, so the boundary is no longer hard against the frame. "What is growing here now" goes from five stacked paragraphs to **two lines** — the question, then the fact and the button — with the satellite-phenology explanation behind an ⓘ. |
| **A3** | **Mobile / Email pills**, per the example: a filled segmented control at the top, with the form beneath it swapping. It was one form with a "Log in with email and password" link at the bottom, which made one route the screen and the other a footnote a farmer had to read past his own form to find. |
| **A5** | Unchanged — the pills were tried here and taken out again. Registering is not a choice between two ways to prove who you are: an account needs both the mobile (it *is* the account) and the email (it finds a licence bought elsewhere), so a switch over two things you are going to fill in anyway only adds a step. |
| **A12** | Retitled **"Your survey"**. "What we will look for" is one line, and so is its answer. The explanation drops from five paragraphs to four short rows, the update-frequency line is gone, and the warning box is gone — the combined-service note is a sentence, because it is good news about the price rather than a caution. |
| **A10 / A10D** | The instruction — thirty-eight words wrapped over three lines above a map the farmer is trying to look at — moves behind a **"How to draw this"** chip. It is not lost, it is one tap away, and a farmer who has drawn one boundary never has to read it again. |

---

## The flow diagram is a tree

The strip beside each phone was a straight line, which meant registration had to
be declared twice — once ending in a survey, once in a drawing — and the deck
could only ever show one of them. A farmer looking at the log-in page could not
see from the paper that creating an account, redeeming an invitation and
resetting a password all start there.

`FLOWS` is a DAG now: a root and, for each screen, what it leads to. The deck
lays it out left to right by depth, stacks siblings, and draws orthogonal
elbows. That buys three things a line could not say — where the app **branches**
(A3 into three), where it **converges** (both drawing routes finish on A11), and
what is a dead end.

Five trees, the deepest eleven columns. Tiles are sized from that one so the
deck keeps a single rhythm, and a tree that would run past the footer shrinks
until it fits — with a build-time warning naming the flow if it still cannot.

---

## Checks

`npm run check` · `npm run icons` · `npm run smoke` · `npm run deck`

478 renders across both roles, no console errors. The smoke test learned this
round: the plot list must be lines rather than cards with the crop as a control;
A9 offers no route until the type is answered and no route cards at all to a
farm of trees; A12 offers no choices; and A10's drawing instruction must be one
tap away in the guidance sheet rather than absent.
