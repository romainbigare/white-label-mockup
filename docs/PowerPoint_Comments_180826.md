# Comments on the mockup, 18 August 2026 — what each one changed

`Marks_Comments_on_MockUp_Update_180826.pptx` is seven slides, one screenshot
each, with thirty comments pencilled onto them and a leader line from every
comment to the thing it is about. This is the record of what each one produced.

The deck covers the registration path only — A5 through A10 — which is the part
of the app a farmer meets before he has any reason to trust it.

[`PowerPoint_Comments_180826.pdf`](PowerPoint_Comments_180826.pdf) is the same
work as screenshots, each screen as it stood when the comments were written
beside what it looks like now. Rebuild it with:

```bash
git worktree add /tmp/before <the commit the deck was drawn from>
ln -s "$PWD/node_modules" /tmp/before/
node tools/reviewdoc.mjs --before /tmp/before \
     --data tools/reviewdoc.180826.json --out docs/PowerPoint_Comments_180826.pdf
git worktree remove /tmp/before
```

Three of the thirty are structural and decided the rest:

- **A7 is deleted.** The name and the password it asked for are what creating an
  account consists of, so they are on A5. The land unit it also carried is not
  an account fact at all, so it is on A9.
- **The farm is named at the top of A12**, before it is drawn, and both drawing
  screens carry that name in their app bar.
- **The two boundaries are different colours** — a plot outline green, a farm
  outline blue — because the farmer draws one and then the other.

---

## Slide 1 · A5 "Create your account"

| Comment | Change | Where |
|---|---|---|
| Add data box called "Your name" | A required name field, first on the form | `onboarding.js` A5 |
| Replace with "OTP verification required." | The mobile number's hint | `onboarding.js` A5 |
| Add data box for "Create a password" | A required password with the show/hide control of WF4.042 | `onboarding.js` A5 |
| Replace with "Farm reports are sent to this email address." | The email hint. It says what the address is *for*, where the old line said what it is not | `onboarding.js` A5 |
| Remove space between lines | The Terms and Privacy links keep their 44 px tap box and stop adding 24 px of leading to the sentence they sit in — the padding takes the press, a negative block margin takes it back out of the line box | `components.css` `.check__text .textlink` |
| Delete all text | The "you can sign in afterwards with either" paragraph is gone | `onboarding.js` A5 |
| Replace "Send code" with "Send OTP to mobile number" | The button, and it now waits for all five answers: name, number, address, password, tick | `onboarding.js` A5 |

## Slide 2 · A6 "Enter your code"

| Comment | Change | Where |
|---|---|---|
| Merge with a single sentence: "Enter OTP sent to +966 xx xxx xxxx" | The heading and the sentence under it said the same thing twice. The sentence is now the title, and the app bar was taught to let a title wrap | `onboarding.js` A6, `components.js` `appBar({ wrap })` |
| Limit OTP to 4 digits | Four cells, auto-submitting on the fourth; `0000` is the wrong-code sentinel. **This deviates from WF4.038**, which asks for six — see the README's deviations section for the reasoning and the one constant to change if six is required | `onboarding.js` `OTP_LENGTH` |

## Slide 3 · A7 "Tell us about you"

| Comment | Change | Where |
|---|---|---|
| Delete. Name and password can be requested under "Create an account" | The screen is gone: from the registry, the harness index and the flow | `index.js`, `onboarding.js` |

Three things followed from deleting it, none of them visible in the deck:

- **A6 now decides where it lands.** It is reached from three places and each
  wants somewhere different afterwards, so the route carries which: registration
  goes on to A9, logging in with a code opens the app, and a reset goes back to
  choose a password.
- **Password recovery owns its last step.** FORGOT used to send the farmer
  through A7 to set the new password, which meant a returning user was asked for
  his name again on the way. It is now three steps of its own — identifier,
  code, new password.
- **The land unit moved to A9**, which is the next comment.

## Slide 4 · A9 "Add your farm"

| Comment | Change | Where |
|---|---|---|
| Add land measurement question | Dunum or Hectare, pre-selected from the country (WF4.043), under the lead paragraph | `onboarding.js` `unitField()` |
| Delete "— pick whichever suits your farm" | The lead reads "Two ways to get started. Both give you the same result." | `onboarding.js` A9 |
| Change to "Draw your farm boundary, and our satellite will automatically detect cultivated plots and trees." | The survey card's subtitle | `onboarding.js` `farmRouteCards()` |
| Change to "Choose this option if you want to survey field crops, date palms and fruit trees on your farm." | Its first bullet | `onboarding.js` `farmRouteCards()` |
| Change to "You will have an option to add or delete plots after our satellite survey." | Its second bullet | `onboarding.js` `farmRouteCards()` |
| Add "Choose this option" | A button on **both** cards, because WF4.052 wants the routes to carry equal weight. The card stops being one large tap target — and a button inside a button is not something a browser will render | `onboarding.js` `routeCard()` |

B12 "Add a farm" drew its own copy of these two cards, which is how the same
fork came to be described in two sets of words. It now calls A9's component.

## Slide 5 · A12 "What should we cover?"

| Comment | Change | Where |
|---|---|---|
| Change to "What should our satellite survey?" | The title, and the screen's name in the registry | `onboarding.js` A12, `index.js` |
| "Priced per area. For example: wheat, alfalfa, Rhodes grass, okra, eggplant, potatoes, melon, etc." | Field crops | `onboarding.js` `COVERAGE` |
| "Priced per tree. For example: dates, olives, citrus, mango, pomegranate." | Date palms and fruit trees. A comma added between the last two | `onboarding.js` `COVERAGE` |
| "One subscription covering field crops, date palms and fruit trees." | Both | `onboarding.js` `COVERAGE` |
| Move up, and "Name this farm" → "Name your farm" | The field is first on the screen now, above the three options | `onboarding.js` A12 |
| "Farm 7" → "Farm 1" | The automatic name counts the farms the **account** holds. During registration that is none, whatever the demo database carries; only the in-app Add farm route numbers from what is there | `onboarding.js` `autoFarmName()` |
| Delete "Leave it blank and we number it for you." | The placeholder already shows the name he gets if he types nothing | `onboarding.js` A12 |

## Slide 6 · A9D "Draw my own plots"

| Comment | Change | Where |
|---|---|---|
| Farm name + plot name on the first line, "Trace your plot boundary" on the second | The app bar reads **Farm 1 · Plot 1** over the instruction | `onboarding.js` A9D |
| Nobody knows their coordinates — offer search on map, town/locality, current location | The search bar is a real control now and opens those three | `overlays.js` `FIND_PLACE`, `onboarding.js` `placeSearch()` |
| Should it say "Plot area: 516 dunum"? Does it change automatically? | It is labelled, and it says so: *Updates as you move the corners.* It always did — the figure is shoelace geometry over the live vertex list — but nothing on the screen said it | `onboarding.js` A9D |
| Change to "Name this plot" | The field label, here and in the rename sheet | `onboarding.js`, `overlays.js` |
| Change "P1" to "Plot 1" | The placeholder, the name a drawn plot gets, the labels a survey returns, and the 32 plots in the fixtures — one convention, so no screen shows both | `onboarding.js`, `actions.js`, `survey.js`, `farms.json` |
| Delete "Optional. Leave it and we number it for you." | Gone | `onboarding.js` A9D |

## Slide 7 · A10 "Your farm boundary"

| Comment | Change | Where |
|---|---|---|
| Farm name on the first line, "Trace your farm boundary" on the second | The app bar | `onboarding.js` A10 |
| Nobody knows their coordinates | The same three ways in | `overlays.js` `FIND_PLACE` |
| Should it say "Farm area: 516 dunum"? Does it change? | Labelled, and stated | `onboarding.js` A10 |
| Should the farm boundary be a different colour — brown or blue? | Blue. The basemap is tan desert soil and a brown line over it is a line nobody can see. One component, two tones: plots stay green | `boundaryEditor.js` `TONES` |
| Change to "Draw your farm boundary to cover open fields and tree areas. No need to include greenhouses, warehouses or other structures." | The help text — and a reversal, not a rewording. The screen used to ask for everything the farmer holds, buildings included, so the algorithm knew where to stop looking. He now draws what he is buying | `onboarding.js` A10 |

---

## Two wordings changed on the way in

- "other structure" → "other structures".
- "mango pomegranate" → "mango, pomegranate".

## Translations

Seven keys moved screen without changing meaning, and their Arabic, Hindi,
Bengali and Pashto travelled with them. Seventeen keys were **reworded** by this
review, and those translations were dropped rather than kept: a translation of
the sentence that used to be there is not a translation of the one that is, and
a plausible wrong sentence is worse than an English one. They fall back to
English and are logged, which is what WF10.014 asks for and what the coverage
bars on F8 read.

## Checks

`./tools/syntax.sh` and `node tools/smoke.mjs` both pass — 839 renders across
three roles, no console errors, no empty renders. The smoke test grew three
assertions to match: A5 asks for a name and a password, A6 shows four cells and
addresses them to the number, and the walk that collects the string catalogue
now visits the states behind a single screen id (`FORGOT:password`, `A6:login`,
`A6:reset`), which is where four of the new strings live.
