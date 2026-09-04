# v1.5.7 — the comments on the v1.5.4 deck

The build number moves for the first time since June. v1.5.4 was held at one
number through seven rounds of comment so that one deck carried one number;
that cycle is closed, and this is the build that answers the comments made on
the deck it produced. The requirement set underneath is still **v1.7**.

- The v1.5.4 cycle: [`Mockup_Changes_v154.md`](Mockup_Changes_v154.md) and the
  round documents beside it, through
  [round 6](Mockup_Changes_v154_round6.md)
- This document is v1.5.7

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
Farm App Build Specification* and renaming a document after it has been issued
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
where the whole purpose of naming each language in its own script is lost. So
Arabic and English are two tiles the size of a decision, and the other seven are
one row underneath that opens a picker. Nobody has to scroll to find their
language, and nobody who has already found it reads past eight others to press
it.

**One control, three places.** `languageChoice()` in `ui/components.js` is the
whole design, and A1, the language sheet behind A3's app bar, and F8's *App
language* section all call it. F8 was the reason to make it shared rather than
to write it twice: with nine rows it opened on a full page of languages and
pushed units, numbers and currency below the fold, which is a settings screen
answering a question nobody came to it with.

**Four of the nine are a core rather than a catalogue.** Arabic, Bengali, Hindi
and Pashto are translated throughout. The four new ones carry the first run and
the shell — the language screen, the guided tour, the sign-up walk, the tab bar
and the words on the buttons — which is what anyone switching language to look
at the mockup is looking at. Everything else falls back to English in the open
and F8's coverage bar says by how much. Four full catalogues is a translation
round with a named reviewer per language (WF10.012), not a build step, and a
mockup that pretended otherwise would be inventing a translation memory it does
not have.

---

## The guided tour: one type size, and three real screens

> *"Font sizes are inconsistent. Slides 16, 17 and 19 should use the smaller
> font, to match slides 15 and 18."*

The tour headline sized itself by the length of the headline — a sentence at
title size, three words at display size — which is why five cards in a row read
as though five people had set them. **All five now take the smaller size.** It
is the one that holds the longest of the five without pushing the dots off a
640 dp screen, so it is the one they all take.

> *"Example images on slides 18 and 19 are cropped top and bottom. Keep the
> whole image and make it skinnier rather than cropping — but do not increase
> the height; it must stay on one screen."*
> *"Remove the indicator/time element at the top right."*

**A4B, A4C and A4D now carry a screen instead of a glyph** — D2 the irrigation
advice, D1 the advice inbox, F11 the activity log — because an icon of a droplet
is a picture of the word *water* and D2 is a picture of the answer. They are
**live renders, not saved images**: a screenshot pasted into a tour goes stale
the first time the screen it photographs is redrawn and nothing in the build
would notice. `screenSnapshot()` in `shell.js` composes the real screen at the
real phone size and scales it down.

Three things follow from what the review asked for:

- **The app bar is left out**, which is the indicator at the top right. A
  snapshot is there to show the screen's substance, and the bar is the same
  strip of chrome on all of them. The banners go with it — a connectivity
  warning inside a picture of a screen is a fact about the reviewer's wifi.
- **The whole screen is kept.** It is narrow rather than cropped: 200 px showing
  all of a phone tells a reader more than 200 px showing the middle third.
- **The height does not move.** All five illustrations stand exactly 200 px
  tall, which is what the tour can afford and still fit WF2.002's 360 × 640
  without scrolling.

A picture full of real buttons is a hazard as well as a feature, so the snapshot
subtree is `inert`, is `role="img"` to a screen reader, and is skipped by name
in `tools/smoke.mjs` and `tools/screendeck.mjs`. Its buttons are photographed,
not offered: they are not the screen's primary actions, not its tap targets, and
not something for a numbered marker in the deck to point at.

---

## The green rectangle in the export

> *"Small green rectangles are appearing over some slides in the PowerPoint. We
> don't need the annotation about the A9 order any more, so remove all of it."*

Round 6 added a `when` field to the screen registry and printed it on the deck
page as a green line between the title and the phone — one screen used it, A9B,
to say that it is reached only by a farm of field crops. On macOS PowerPoint
that text box was drawing its box as well as its text, and carrying it onto
slides after it.

**The whole thing is gone**: the field, the line on the page, the line in the
speaker notes, and the paragraph in the `S()` helper that described it. The fact
it carried has not gone anywhere — A9B's registry note has said it in full since
round 6, and that note is the deck's speaker note.

---

## What is in the deck

`docs/Wafra_Farm_App_Screens_v1.5.7.pptx`, rebuilt from the running app: the
cover, the contents, six section dividers and a page for each of the 49 screens.
