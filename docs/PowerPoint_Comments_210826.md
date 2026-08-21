# Comments on the mockup, 21 August 2026 — what each one changed

`Marks_Comments_on_MockUp_Update_210826.pptx` is eight slides, one screenshot
each, with twenty-nine comments pencilled onto them and a leader line from every
comment to the thing it is about. This is the record of what each one produced.

The deck was drawn on the build that came out of the 18 August round, and covers
the registration path again — A5, A9, A10, A12, A9D, the password reset and the
in-app Add a farm — plus the sheet that round introduced.

A thirtieth comment, on A9's second card, read *"Could not review as text is
truncated"*: the screenshot cut the bullet off. It asks for nothing and is not
listed below.

---

Three of the twenty-nine are structural and decided most of the rest:

- **The middle of registration is reordered.** The farm is named on A9, drawn on
  A10 or A9D, and only then asked what to cover. A12 was sitting between the
  fork and the drawing, which put a commercial question in the middle of a
  practical one; it is now the last screen before the price, and it carries the
  ending A10 used to have.
- **A password reset goes to the registered mobile number and nowhere else.** No
  identifier field, no email route.
- **The Find your land sheet is deleted.** Two of its three routes were the map
  screen describing itself. The third — the phone's own position — is a button
  on the map, and the one thing that can refuse is now a screen rather than a
  silence.

---

## Slide 1 · A5 "Create your account"

| Comment | Change | Where |
|---|---|---|
| Country code is partially covered | The dial code ran under the chevron at a fixed 112 px and read "+96(". The selector sizes to its own widest option now, which is bounded — every entry is a flag and at most four digits | `onboarding.js` A5 |
| Are all country codes available? MENA from Morocco to Oman, possibly Africa and Central Asia | Nineteen countries became fifty-three: the GCC and Jordan on top (WF4.035), then the rest of MENA, sub-Saharan Africa, Central Asia and the Caucasus, and South and South-East Asia. **This is a sales footprint, not a complete list** — see the open question in the README | `content.json` `countries` |
| This part is confusing… I suggest removing the text | "Workers you invite sign in with a short code" is gone. WF4.044 is still true and the invitation screens still do it; a farmer filling in his own account has no staff yet and no way to issue a code, so the sentence was an instruction with nowhere to carry it out | `onboarding.js` A5 |

Extending the country list moved the land unit's default with it. `WF4.043`
names three countries; the fallback for everything else was dunum, which is the
Levant's unit and nobody else's. It is now a list — the Levant, Iraq, Turkey and
the UAE — with hectares everywhere else.

## Slide 2 · A9 "Add your farm"

| Comment | Change | Where |
|---|---|---|
| Shouldn't we start with the farm name? Required for whole farm and for individual plots | The name is the first field on the screen, and required: until it has one, neither route card can be tapped. It came up from A12, where it sat under the coverage question — which meant both drawing screens had to name a farm the farmer had not | `onboarding.js` `farmNameField()`, `components.js` `card({ disabled })` |
| Delete | "We have set this from your country. You can change it in Settings." — the right chip is already selected and Settings is where anything gets changed | `onboarding.js` `unitField()` |
| Replace with "Choose this option if you want all cultivated areas monitored on your farm. You will be able to add or delete plots later." | Both bullets on the survey card. The old first bullet listed the same three things the next screen asks the farmer to choose between, so it read as the choice being made for him | `onboarding.js` `farmRouteCards()` |

The name being required means the placeholder is doing two jobs: it still shows
the number the farm would have been given (`Farm 1`), so the field says what a
good answer looks like, but silence is no longer one.

## Slide 3 · A10 "Your farm boundary"

| Comment | Change | Where |
|---|---|---|
| This screen should come before the next one (selecting field crops and trees) | A9's fork now leads straight to the drawing; A12 follows it | `onboarding.js` `farmRouteCards()`, `startAddFarm()` |
| Change to "Find your farm" | The search bar, on both drawing screens | `onboarding.js` `placeSearch()` |
| Add box with "Use my current location" | The map button said **Locate**, which is a word with no object sitting under a search bar. It says what it does now, and it is the one route into the map the map cannot do for itself | `onboarding.js` `locateChip()` |
| Locate button is confusing. If it is tied to the search box, it should say "search" and move to the top | It is not tied to it — the bar searches, the button reads the phone. Two controls that were being read as one are now two things that say what they are, and the search stays at the top where it already was | `onboarding.js` |
| Delete | The farm-area readout — "Farm area / 51.6 ha / Updates as you move the corners." It was the running total of a bill nobody had been quoted for, printed twice the size of the sentence explaining what to draw. A13 is where a number about money belongs. **A9D keeps its plot area**: there the figure is what the farmer is naming | `onboarding.js` A10 |
| Change to "Draw your farm boundary to cover open fields, date palms and fruit trees you want to monitor. No need to include greenhouses, warehouses or other structures." | The drawing instruction | `onboarding.js` A10 |
| Move text up (replace top text with bottom text) | That instruction is now the app bar's second line, under the farm's name, and the panel it used to sit in has gone with the area readout. What is left is a map, one sentence and one button | `onboarding.js` A10, `components.js` `appBar({ wrap })` |
| Change to "continue" | The button, because A10 no longer ends anything | `onboarding.js` A10 |

## Slide 4 · The "Find your land" sheet

| Comment | Change | Where |
|---|---|---|
| Delete | The sheet is gone. Searching the map and naming a town were the map screen describing itself | `overlays.js`, `onboarding.js` `placeSearch()` |
| Add an action box on the previous page showing "Search my current location" | The map button, as on slide 3 | `onboarding.js` `locateChip()` |
| The user should be redirected to the phone menu if his phone doesn't allow our app to provide a location | `LOCATION_BLOCKED` — it names the setting to change and says what still works meanwhile. It reads `session.gpsGranted`, the one flag every other screen in the app already reads for this, so the harness's **Location: Refused** control plays the phone here too | `overlays.js` `LOCATION_BLOCKED` |

The search bar had to become a real control for this to be honest: it takes a
town directly now rather than opening a sheet to offer to.

## Slide 5 · A12 "What should our satellite survey?"

| Comment | Change | Where |
|---|---|---|
| Comes after "draw your farm boundary" | A12 is the last screen of both routes | `onboarding.js` A12, A10, A9D |
| Change to farm name (previously entered) | The app bar carries the farm, with the question as its second line — the same shape both drawing screens use | `onboarding.js` A12 |
| Change to "Tell us what you want to monitor on your farm. You can change this later." | The lead paragraph | `onboarding.js` A12 |
| Moved to previous screen | The name field, to A9 | `onboarding.js` |
| Change to "We will automatically identify the field crops, date palms and fruit trees on your farm." | The closing note | `onboarding.js` A12 |
| Change to "Send a quote" / "Usually ready in 15-20 min" | The dock, moved here from A10 with `WF4.072` and `WF4.073`. The farm record is created and the survey starts from this button now. **The wait shows only on the survey route** — the drawn route priced itself from what was traced and goes straight to A13, so promising it a fifteen-minute wait would be a contradiction on the screen | `onboarding.js` A12 |

## Slide 6 · A9D "Draw my own plots"

| Comment | Change | Where |
|---|---|---|
| Sequence is off. A10 should come before A9D | Read as the same reordering as slides 3 and 5: A12 moved off the front of both routes and behind them. The plots route does not gain a farm boundary — it never had one, and drawing the outer line to then trace plots inside it is a second question, not a reordering | `onboarding.js` |
| Change to "Find your farm" | The search bar, shared with A10 | `onboarding.js` `placeSearch()` |
| Change to "Add another plot" | The secondary action. The farmer is standing on a plot he has just traced, so "Add a plot" read as an offer to start the thing he was finishing | `onboarding.js` A9D |

## Slide 7 · FORGOT "Reset your password"

| Comment | Change | Where |
|---|---|---|
| Only allowed verification should be on registered mobile number — linked to govt ID and more secure than email | The screen sends to the number and offers nothing else. The address is collected at registration and never verified, so accepting it here made an unchecked field a way into an account. **Logging in is unchanged** — A3 still takes either, because an identifier is not a second factor | `onboarding.js` FORGOT |
| Change to "We will send an OTP to your registered mobile number: +xxx xxx xx xx." | The body, masked: the screen is proving we hold the right number, not reading it out to whoever has the phone | `onboarding.js` FORGOT |
| delete | The "Mobile number or email" field. The account holds the number already | `onboarding.js` FORGOT |
| Add "Contact us at info@wafragreen.com or by WhatsApp on +966 54 810 0443 to change your registered phone number." | Without it, a farmer who has lost the number has no way out of this screen. The two contact details were written out twice in `overlays.js`; they are now in `content.json`, which is what F13 already tells the farmer they are | `onboarding.js` FORGOT, `content.json` `contact` |

## Slide 8 · B12 "Add a farm"

| Comment | Change | Where |
|---|---|---|
| Please update same as previous farm page | The name field and the gated cards, from A9. The two cards were already one shared component, so the reworded bullets arrived here on their own | `home.js` B12 |

---

## Two things that changed on the way in

- **`.mapbox svg` was resizing the icons on the controls over the map.** The
  rule means "the map fills its box"; it was also telling every icon on a chip
  above the map to be 100% of a map. "Use my current location" is long enough
  to have exposed it — the glyph came out the size of a thumbnail. The rule now
  says `svg:not(.ico)`, and chips do not wrap.
- **A13 knows the farm's name before there is a farm record**, now that the name
  is collected at the top of the flow. Its bar used to be blank on the drawn
  route.

## Checks

`./tools/syntax.sh` and `node tools/smoke.mjs` both pass — 839 renders across
three roles, no console errors, no empty renders. The smoke test grew two walks
of the reordered flow: A9 refuses both routes until the farm is named, then
Survey my whole farm reaches A10 with the name in its bar, the instruction in
the bar and no area readout, and continuing reaches A12 with the quote and the
wait; and Draw my own plots reaches A9D, whose Done reaches the same A12 with
the quote but without a wait it does not have.

## Translations

Eight keys were **reworded** by this review and fourteen deleted, and the
translations went with them: a translation of the sentence that used to be there
is not a translation of the one that is. They fall back to English and are
logged, which is what WF10.014 asks for and what the coverage bars on F8 read.
`a12.farmname` kept its key when it moved from A12 to A9, so its four
translations travelled with it unchanged.
