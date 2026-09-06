# v1.5.7 — the comments on the v1.5.6 deck

Seven notes on `Wafra_Farm_App_Screens_v1.5.6.pptx`. The requirement set
underneath is still **v1.7**.

- Round 7, the marks on the v1.5.4 deck: [`Mockup_Changes_v155.md`](Mockup_Changes_v155.md)
- Round 8, the passes over what those produced: [`Mockup_Changes_v156.md`](Mockup_Changes_v156.md)
- Round 9, this document

---

## The app is not a white label app any more

> *"The app name is dropping 'white label'. Wafra will own and control the app,
> so it is now the Wafra Farm app."*

Nothing on a screen changed, because no screen ever said it: the product has
been **Wafra Farm App** in `brand.js` since the first build, and the words
"white label" only ever lived in the prose around it — the README's opening
paragraph, the package description, the page's meta tag, and the note at the top
of `brand.js`.

All four now say what the app is. What white label described is still true of
the **code**, and `brand.js` still says so: the name, the mark and the palette
are one object and no screen knows what the mark looks like. That is an
implementation fact now, not something the product says about itself.

The specification PDFs keep their own title. They were issued as *White Label
Farm App Build Specification*, and renaming a document after it has been issued
is how two documents come to have one name.

---

## Nine languages, and two of them are the screen

> *"Languages to add: French, Azeri/Azerbaijani, Georgian and Turkish, alongside
> Arabic and English."*
> *"Put English and Arabic front and centre, with all other languages behind an
> 'Other' drop-down, to avoid a scrolling list."*

**Azerbaijani, French, Georgian and Turkish are added and nothing is taken
away.** Bengali, Hindi and Pashto have been here since WF10.001 and stay: the
people doing the work on a Gulf farm read them, and four new markets is not a
reason to take three languages off the phone of someone already using the app.
Nine in total, and `LANGUAGES` in `core/i18n.js` is still the only list.

**A1 stopped being a list.** Five rows fitted a 360 × 640 screen; nine would
either scroll — which WF4.013 forbids on this screen — or shrink to the point
where naming each language in its own script stops being worth doing. So Arabic
and English are two tiles the size of a decision, and the other seven are one
row underneath that opens a picker. Nobody has to scroll to find their language,
and nobody who has already found it reads past eight others to press it.

**One control, three places.** `languageChoice()` in `ui/components.js` is the
whole design, and A1, the language sheet behind A3's app bar, and F8's *App
language* section all call it. F8 was the reason to share it rather than write
it twice: with nine rows it opened on a full page of languages and pushed units,
numbers and currency below the fold, which is a settings screen answering a
question nobody came to it with.

**Four of the nine are a core rather than a catalogue.** Arabic, Bengali, Hindi
and Pashto are translated throughout. The four new ones carry the first run and
the shell — the language screen, the six tour panels, the sign-up walk, the tab
bar and the words on the buttons — which is what anyone switching language to
look at the mockup is looking at. Everything else falls back to English in the
open and F8's coverage bar says by how much. Four full catalogues is a
translation round with a named reviewer per language (WF10.012), not a build
step, and a mockup that pretended otherwise would be inventing a translation
memory it does not have.

---

## The guided tour: one type size, and the whole screen in each picture

> *"Font sizes are inconsistent. Slides 16, 17 and 19 should use the smaller
> font, to match slides 15 and 18."*

Slides 15 to 20 of the v1.5.6 deck are the six tour panels, and the headline
sized itself by its own length — a sentence at title size, three words at
display size. *How our service works*, *Farm planner* and *Optimizing crop
yields* are short, so panels 2, 3 and 5 set a size larger than the other three,
which is what the note is pointing at. **All six now take the smaller size.** It
is the one that holds the longest of them without pushing the dots off a 640 dp
screen, so it is the one they all take.

> *"Example images on slides 18 and 19 are cropped top and bottom. Keep the
> whole image and make it skinnier rather than cropping — but do not increase
> the height; it must stay on one screen."*

`tools/tourshots.mjs` kept the top 62% of each screen, on the argument that a
whole 852 px phone squeezed into a third of a tour panel is a picture of
nothing. The arithmetic is on the review's side: two pictures share the panel's
width, so **keeping the whole screen makes each one narrower rather than making
the panel taller**. The tour still fits WF2.002's 360 × 640, and the reviewer
sees a screen rather than a slice of one.

> *"Remove the indicator/time element at the top right."*

The clip was the whole device screen, harness furniture included — the fake
status bar with the clock and the network indicator, the camera cutout inside
it, and the home bar at the foot. None of that is the app, and a picture of a
picture of a phone is exactly what the note is about. **The clip now starts
under the bar and runs to the bottom of the screen**, so the app bar is the top
of every picture and there is no blank strip where the clock used to be.

`npm run tourshots` regenerates all six from the running app, as before. It is
still the first thing to run when one of those six screens changes.

---

## The green rectangle in the export

> *"The green rectangle on slide 9, used as a background for the note about the
> A9 order, is shown on multiple slides after that at times. It might be a pptx
> bug on macOS. We don't need that annotation any more, so remove all of it
> entirely."*

Round 8 put A9B's condition on its deck page as a dark green card with white
letters in the empty right-hand column, which is where the review had asked for
it. macOS PowerPoint draws that card onto slides after the one it belongs to.

**The whole thing is gone**: the `when` field on the screen registry, the card
on the page, the `contentBottom` tracking that placed it, the line in the
speaker notes, and the paragraph in the `S()` helper that described it. The fact
it carried has not gone anywhere — A9B's registry note now says in full that the
screen is reached only by a farm of field crops and that it is printed after A9
by design, and that note **is** the deck's speaker note for the page.

---

## What is in the deck

`docs/Wafra_Farm_App_Screens_v1.5.7.pptx`, rebuilt from the running app: the
cover, the contents, six section dividers and a page for each of the 49 screens.
