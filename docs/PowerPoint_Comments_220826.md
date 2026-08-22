# Comments on the mockup, 22 August 2026 — the full list

`Wafra_Farm_App_Screens_v1.5.1_Mark.pptx` is the 70-page v1.5 screen deck with
Mark Webster's annotations drawn straight onto it — red boxes over the thing
being talked about, a leader line, and the note in the margin. **The annotations
run from page 4 to page 18 only**: the first-run section, A1 through the password
reset. Pages 19–70 carry no marks.

There are **49 notes**, of which **46 are distinct** — three are repeated on a
second page ("guided tour after A1" on 4 and 7, "can A2 be merged with A3" on 5
and 6, "change OTP to code" on 8 and 9). Twenty-one further red boxes contain a
stray `v` keystroke and no text; they are the anchors of the leader lines, not
comments.

**All of it is applied**, on the build this document sits in — mockup v1.5.2.
Two of the forty-six ask for a screenshot rather than a change and are answered
in the deck generator instead; every other one names the file it landed in, in
the table for its page. Four of them were judgement calls, and page 3 of the
deck sets those out in plain prose so they can be corrected rather than found
later — they are the login screen showing one credential route at a time, A11
losing its four-tool row, the ambiguous "Delete" on A12, and the invitation
codes becoming numeric.

---

## The three that decided the rest

- **A2 is deleted and A3 is the front door.** The review asked twice whether A2
  could be merged into A3 and asked for A2's functions to be moved there. Three
  doors of equal weight is a decision the app can make for the farmer: logging
  in is the common case, so the login form *is* the screen and creating an
  account or joining a farm are links beneath it.
- **The guided tour runs between A1 and A3.** It used to sit between "Create an
  account" and the sign-up form, so the case for signing up was only ever made
  to somebody who had already decided to. It is still first-run only.
- **Both ways of adding a farm finish on A11.** The drawn route used to hand
  straight to A12 and the farmer never saw the plots he had just traced written
  out as one thing to approve. A9D now goes to A11, and A12 — which asks what
  the satellite should cover — is only on the whole-farm route, because one
  drawn plot is one crop.

---

## Page 4 · A1 Language

| # | Where on the screen | The comment | What was built |
|---|---|---|---|
| 1 | The logo | Bigger — the same size as on the next screen | Logo at 64, the size every other screen uses. `onboarding.js` `A1` |
| 2 | The logo (same note) | *Question:* "I assume the language menu appears only once when the user first downloads the app?" | **Yes, once.** `firstRunDone` is set the moment anyone enters the app, and logging out lands on A3 — A1 and the tour are first-launch only. `router.js` `enterOnboarding` |
| 3 | The Arabic subtitle `اختر لغتك` | Bigger font size, to match the English | Set at the English title's size × the Arabic optical scale. `onboarding.js` `A1` |
| 4 | The non-Latin rows (العربية, हिन्दी, বাংলা, پښتو) | Same note, second anchor — bigger font size, to match English | Each row sizes by its own script. The list was already one size — Devanagari, Bengali and Arabic simply draw smaller at the same pixel height, so the correction is per script. `i18n.js` `LANGUAGES.scale` |
| 5 | The **Continue** button | "We should have two options: Proceed with guided tour / Login / first time registration" | Both, as asked: **Proceed with guided tour** as the primary and **Register / log in** beside it. The tour's own Skip and last card land on A3 too, so nobody who takes the first route is any further from the second. `onboarding.js` `A1` |
| 6 | Page-level | The guided tour (A4) should be available after A1, **before** we ask the user to sign in or register | A1 → A4 → A3. Nobody is asked who they are before seeing what the product does. `onboarding.js` `openTour`, `A4` |

## Page 5 · A2 Get started

| # | Where | The comment | What was built |
|---|---|---|---|
| 7 | Page-level | "Can A2 be merged with A3?" | **Yes — A2 is deleted.** `onboarding.js`, `screens/index.js`, `router.js` |

## Page 6 · A3 Log in

| # | Where | The comment | What was built |
|---|---|---|---|
| 8 | The whole identifier → *Send me a code* → **or** → password → *Log in* block | "This menu is confusing: there are currently four permutations: mobile + code, mobile + password, email + code, email + password. Can we limit to only two? Mobile + code / Email + password" | Two routes, and only one on screen at a time: a country selector and a numeric field with **Send me a code**, and a link that swaps both fields for email and password in the same place. The free-text "mobile number or email" box is what invented the other two permutations. `onboarding.js` `codeRoute`, `passwordRoute` |
| 9 | "At least 8 characters" under the password field | Not needed — at this point the user has already created a password that meets our requirements | Gone. A rule about choosing a password belongs where one is being chosen. `onboarding.js` `passwordRoute` |
| 10 | "Fingerprint unlock is available on this device." | "Do you mean face recognition? I assume this function is provided by the phone operating system? There is no point in telling him it's available. **Remove this advisory.** We should ask him if he wants face ID when he first creates an account." | Advisory removed. A6 asks once, on a brand-new account, and A3 carries a **Log in with Face ID** button afterwards — only for somebody who said yes. `overlays.js` `BIOMETRIC`, `onboarding.js` `A6` / `codeRoute` |
| 11 | The empty area below the forgot-password link | "Move these functions here from A2" — i.e. Create an account and Join a farm | Both, as links under the form: *New here? Create an account* and *Invited? Join a farm as a guest*. `onboarding.js` `doorLink` |
| 12 | The Join-a-farm entry inside that area | Label it "Join a farm as a guest" | Done, on A3 and on A15's own title. `onboarding.js` `A3`, `A15` |
| 13 | Page-level | "Can A2 be merged with A3?" (repeat of 7) | — (repeat of 7) |

## Page 7 · A4 Guided tour

| # | Where | The comment | What was built |
|---|---|---|---|
| 14 | Tour card 1, title and body ("Your farm from above" / "Our survey finds your fields…") | Replace with: **"Enhancing your farm profitability through precision agriculture"** / "Our solution helps you increase crop yields and reduce input costs by optimizing crop scheduling, monitoring plant health, applying fertilizers based on soil nutrient levels, and improving irrigation efficiency." | Both lines replaced verbatim. The illustration went to 16:9 and the headline to title size so the sentence still fits a 640 dp screen. `onboarding.js` `TOUR`, `A4` |
| 15 | Page-level | Tour available after A1, before sign-in/register (repeat of 6) | — (repeat of 6) |

## Page 8 · A5 Create your account

| # | Where | The comment | What was built |
|---|---|---|---|
| 16 | "OTP verification required." under the mobile field | Remove "OTP"; change to **"Verification required"** | "Verification required." `onboarding.js` `A5` |
| 17 | The **Send OTP to mobile number** button | Change "OTP" to "code" | "Send code to mobile number". "OTP" now appears nowhere in the app. `onboarding.js` `A5` |
| 18 | The password hint | Add: "(password should include at least one letter, one number and one special character)" | The rule is stated **and enforced** — the button stays disabled until the password meets it. `onboarding.js` `passwordOk`, `A5`, `FORGOT` |

## Page 9 · A6 Verify code

| # | Where | The comment | What was built |
|---|---|---|---|
| 19 | The title "Enter OTP sent to +966 5X XXX XXXX" | Change "OTP" to "code" | "Enter the code sent to {to}". `onboarding.js` `A6` |

## Page 10 · A9 Add your farm

| # | Where | The comment | What was built |
|---|---|---|---|
| 20 | The land-unit chips **Dunum / Hectare** | Switch — hectare should come before dunum | Hectare first. The session default became hectare too, so a screen opened cold reads the default country's unit. `onboarding.js` `AREA_UNITS`, `store.js` |
| 21 | "Trace each plot and give it a name" on the *Draw my own plots* card | To be consistent with the farm boundary, change "Trace" to "Draw" | "Draw each plot and give it a name". `onboarding.js` `farmRouteCards` |
| 22 | "Two ways to get started. Both give you the same result." | Move down | Moved below the land-unit question, immediately above the two cards it introduces. `onboarding.js` `A9` |
| 23 | Page-level | Show another screenshot with the full text of the *Draw my own plots* card — this one is cut off at the bottom | **Answered in the deck generator.** Every screen with more than a sixth below the fold now carries a second, smaller shot of itself scrolled to the end. A9 hid 20% and fell in the gap between the threshold as documented (a sixth) and as coded (a quarter); the constant now matches the comment. `screendeck.mjs` |

## Page 11 · A10 Your farm boundary

| # | Where | The comment | What was built |
|---|---|---|---|
| 24 | "…No need to include greenhouses, warehouses or other structures." | Remove ", warehouses" | Removed. `onboarding.js` `A10` |

## Page 12 · A9D Draw my own plots

| # | Where | The comment | What was built |
|---|---|---|---|
| 25 | The **Plot area / 51.6 ha / Updates as you move the corners** block | Remove. This value should appear when we provide a quote | Removed — the same change A10 had at the previous round, for the same reason. The one-crop rule took its place in the panel. Sizes appear on A11 and in the quote. `onboarding.js` `A9D` |
| 26 | The subtitle "Trace your plot boundary" | Change to: "Draw your plot boundary. Each plot should preferably correspond to a single crop." | The whole sentence, in the app bar where the old subtitle was. It wraps to three lines and the map still has room. `onboarding.js` `A9D` |
| 27 | The flow strip, at A12 | Delete A12 for individual plots and replace it with A11, to show a plot summary for the user to approve. A11 applies to both scenarios — whole farm and individual plots | A9D → **A11** → A13. A11 reads from either source — the survey's areas or the drawn plots — and asks for the same shape from both. `onboarding.js` `A11`, `drawnScope` |

## Page 13 · A12 What should our satellite survey?

| # | Where | The comment | What was built |
|---|---|---|---|
| 28 | The heading line "What should our satellite survey?" | **Delete** — the box is drawn over the heading itself, immediately above "Tell us what you want to monitor on your farm." Read alongside note 31, this is the heading going, not the screen | Deleted. The question was printed twice, and only the body's version can add "you can change this later". `onboarding.js` `A12` |
| 29 | The *Field crops* examples | Change to: "wheat, alfalfa, Rhodes grass, tomato, melon, onion, potatoes, cucumber, eggplant, etc." | The list, in the order given. `onboarding.js` `COVERAGE` |
| 30 | The **Send a quote** button | Change "Send" to "Request" | "Request a quote". `onboarding.js` `A12` |
| 31 | Page-level | A12 is needed after A10 (for a farm) but not after A9D (for plots) — each plot is by definition a single crop | A12 is off the drawn route entirely. Its 15-to-20-minute wait is no longer conditional, because everyone who reads it is now waiting for a survey. `onboarding.js` `A9D`, `A12` |

## Page 14 · A11 What we found

| # | Where | The comment | What was built |
|---|---|---|---|
| 32 | The header ("What we found" / "Tabuk River Estate") | Put the farm name in bold at the top; the line below, unbolded, should say "Summary of plots to be monitored." | Farm name is the title; "Summary of plots to be monitored." is the line under it. `onboarding.js` `A11` |
| 33 | "We found 8 plots inside your boundary. Keep what looks right, and adjust anything we got wrong." | Change to: "We found 8 plots inside your farm." | Done — and the drawn route says "You drew {n} plots", because we did not find them. `onboarding.js` `surveyScope`, `drawnScope` |
| 34 | The Remove / Edit pair on a plot row | Each plot should have three options: **Keep, Edit, Remove** | All three on every row, always, with the one that is already true lit. It used to show two and swap them, so the farmer could only ever see half the choice. `onboarding.js` `areaRow` |
| 35 | "23.7 ha" on a plot row | To be consistent with a small farm size, each area shown for illustration should be less than 10 ha | Tabuk River Estate went from 214 ha to 62, which puts all eight plots between 6.9 and 8.4 ha. A freshly drawn plot starts at 8.3 ha rather than 51.6. `farms.json`, `boundaryEditor.js` `starterPolygon` |
| 36 | The bottom of the plot list and its footer action | Replace with an option to add a missing plot | The four-tool row is replaced by one **Add a missing plot** button. Three of the four were second ways to do what the rows now offer outright; Join and Split moved into a row's own Edit sheet. `onboarding.js` `plotScope`, `overlays.js` `AREA_EDIT` |
| 37 | Page-level | Both search options — whole farm and individual plots — should end up on this page | Done — see 27. `screens/index.js` `FLOWS` |

## Page 15 · A13 Your plan

| # | Where | The comment | What was built |
|---|---|---|---|
| 38 | "30 days free, on either plan" | Change to: "30 days free trial" | "30 days free trial". `onboarding.js` `A13` |
| 39 | "Nothing is taken until the trial ends, and we ask you before it is." | Change to: "We will seek your authorization before charging your bank card at the end of your free trial." | The sentence verbatim. `onboarding.js` `A13` |
| 40 | The "Your farm" card heading | Change to: "Cultivated areas to be monitored" | "Cultivated areas to be monitored". The card was headed with the farm's name, which is already in the bar above it. `onboarding.js` `A13` |
| 41 | "12.4 ha × SAR 40.01" | Delete. As we have a mix of crops (by ha) and trees (by unit), we are not able to show a cost per ha | Deleted, and `priceLines` became `planPrice` — it no longer computes a working it cannot state truthfully. `onboarding.js` `planPrice` |
| 42 | "Or SAR 5,061 a year — 15% off, paid once, for twelve months." | Delete. We can show this on the payment page | Deleted. The "Before you buy" note now says the choice is made at payment rather than describing an option the card no longer shows. `onboarding.js` `A13` |
| 43 | Bottom of the screen | Add a button back to A11 so the user can modify the plots: "Click here to modify the list of plots." | Added, in the reviewer's words, going back to A11 on either route. `onboarding.js` `A13` |
| 44 | Page-level | Show a second screenshot with the "Pro" plan card | **Answered in the deck generator** — see 23. A13 hides 48% of itself and now carries the second shot. `screendeck.mjs` |

## Page 16 · A14 You're ready

| # | Where | The comment | What was built |
|---|---|---|---|
| 45 | The body copy ("Farm 1 is being added to our satellite watchlist…") | Change to: "Farm 1 has been added to our account. We will notify you when the farm monitoring results are available (usually within one day)." | Both sentences verbatim, replacing all three paragraphs. `onboarding.js` `A14` |
| 46 | Below **Go to my farm** | Add a second button: "Add another farm." | Added. It saves the finished farm and goes straight back to the fork, with the account's farms counted so the next name offered is Farm 2. `onboarding.js` `A14`, `finishFarm` |

## Page 17 · A15 Join a farm

| # | Where | The comment | What was built |
|---|---|---|---|
| 47 | The **K** key on the keypad | "Not needed?" | **Removed, and the codes are six digits.** The letter existed only because the mockup read the joining role off it; a numeric pad with one letter has no way to reach the other twenty-five. Fixture and generated codes are numeric now. `onboarding.js` `A15`, `actions.js` `invitationCode` |
| 48 | The helper paragraph under the keypad | Change to: "Enter the invitation code or scan the QR code sent to you by the person who set up this service." | The sentence verbatim. `onboarding.js` `A15` |
| 49 | The title "Join a farm" | Add "as a guest" | "Join a farm as a guest". `onboarding.js` `A15`, `screens/index.js` |

## Page 18 · FORGOT Reset your password

| # | Where | The comment | What was built |
|---|---|---|---|
| 50 | "We will send **an OTP** to your registered mobile number: …" | Change to: "a code to reset the password:" | "We will send a code to reset the password to your registered mobile number: …" `onboarding.js` `FORGOT` |
| 51 | The **Send OTP** button | Change to: "Send code" | "Send code". `onboarding.js` `FORGOT` |

---

# The front door — what was built, and where it differs

The comments about the front door ask for several things that do not obviously
fit together, so this separates what they ask for from how they are expressed.
It was written as a proposal and is kept here as the record of the decision,
because the build follows it.

**What he is asking for**

- Anyone should be able to see what the product does before being asked who
  they are (notes 5, 6, 15).
- There should not be a hub screen whose only job is to send you to another
  screen (notes 7, 11, 13).
- The login screen should offer **two** ways in, not a grid of four (note 8).
- "Join a farm" is a guest route and should say so (notes 12, 49).
- Biometric unlock is an offer to make once, at account creation, not a status
  line on the login screen (note 10).

**Where the deck and the comments have got tangled**

- Note 5's second label, "Login / first time registration", covers two
  different jobs in one phrase. It is one button on A1 because both roads lead
  to the same screen: A3 is the login form, and creating an account is a link
  underneath it. So the label is honest — the button really does lead to both —
  and the choice between them is made where both are visible at once.
- Note 8's "four permutations" is a symptom of the layout, not of the feature
  set. A3 shows one free-text field labelled *Mobile number or email* with two
  submit buttons under it, so the eye reads a 2 × 2 matrix. There are really
  only two routes, and they are already the two he names.
- Notes 11 and 13 ask for A2's contents to move onto A3 — but A3 is titled
  *Log in*, which is exactly the screen a first-time registrant should not be
  landing on. The fix is not to move three doors onto a login form; it is for
  the login form to be the front door with signup and guest access underneath,
  which is what almost every app does.

## The flow as built

```
FIRST RUN
  A1  Language  ─ Proceed with guided tour ─→  A4  Guided tour (Skip →) ─┐
                ─ Register / log in ──────────────────────────────────→ A3  Log in
                                                                          ├─ Send me a code         → A6 → the app
                                                                          ├─ Use email and password → the app
                                                                          ├─ Create an account      → A5 → A6 → A9 …
                                                                          └─ Join a farm as a guest → A15 → the app

EVERY LAUNCH AFTER THAT, LOGGED OUT
  A3  Log in

THE TOUR, AFTER FIRST RUN
  More → Help → Guided tour
```

**A2 is deleted.** That is his merge, and it is the right call: three doors of
equal weight is a decision the app can make for the farmer, because one of the
three is overwhelmingly the common case. The language control A2 was carrying
in its app bar moves to A3's app bar, so a wrong tap on A1 still costs one tap
to undo.

### A1 · Language — two ways on

Note 5 asked for two options and A1 carries them: **Proceed with guided tour**
as the primary and **Register / log in** beside it. Neither can be pressed until
a language has been chosen, which is what the screen is for, but once it has
been the farmer who wants to see the product first and the farmer who already
has an account are two different people, and this is the earliest place they
part. The tour's own Skip and last card land on A3 as well, so taking the first
route costs nothing.

It also answers note 2: yes, first run only. The screen never appears again;
the language lives in Settings and in A3's app bar. The tour is first-run only
on the same flag, and a farmer who has logged out sees A3 immediately.

Notes 1, 3 and 4 are applied as written — logo at the size the rest of the app
uses, and the Arabic subtitle and the non-Latin rows sized to sit level with the
English.

### A3 · The front door — two routes, one at a time

This is the screen that does the work, and the cure for note 8 is that **the
two routes are never on screen together**.

```
┌──────────────────────────────── Log in ─────── 文A English ──┐
│                                                              │
│  Mobile number                                               │
│  ┌────────────┬─────────────────────────────────────────┐    │
│  │ 🇸🇦 +966 ▾ │ 5X XXX XXXX                             │    │
│  └────────────┴─────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Send me a code                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│              Log in with email and password                  │
│                                                              │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  New here?        Create an account                          │
│  Invited?         Join a farm as a guest                     │
└──────────────────────────────────────────────────────────────┘
```

- **Route one — mobile + code.** The default, because the mobile number is the
  one identifier registration actually proves, and it is one tap from a farmer
  who has his phone in his hand. The field is a country selector plus a number,
  the same control A5 uses, so it can only take a number: half the ambiguity in
  note 8 disappears with the free-text field.
- **Route two — email + password.** One tap away, behind a link. Tapping it
  swaps the mobile field for an email field and a password field in place, with
  *Forgot your password?* under them and a **Log in** button. No new screen, and
  no moment where both routes are visible.
- **The footer is A2's contents** (note 11), as links rather than cards,
  because they are the exceptions and the login is the rule. "Join a farm as a
  guest" carries his wording (note 12).
- **"At least 8 characters" is gone** from this screen (note 9). It belongs to
  A5 and to the new-password step of the reset, where a password is being
  chosen, not typed.
- **The fingerprint advisory is gone** (note 10). In its place: after A6
  verifies a new account, a single sheet asks *"Use Face ID to log in next
  time?"* with **Enable** / **Not now**. If enabled, A3 carries a **Log in with
  Face ID** button above *Send me a code* — a control the farmer can press,
  rather than a sentence telling him his phone has a feature. It appears only
  once the offer has been accepted: on a phone where nobody has made an account
  there is nothing to unlock, which is what the old sentence failed to notice.

### A5 · Create your account — unchanged in shape

Reached from A3's footer, and from nowhere else. Same fields. Copy per notes
16, 17 and 18, and the new biometric question lands after A6 rather than here,
so account creation stays one screen and one keyboard.

### A6 · Verify code — one screen, three callers

Registration, login-by-code and password reset all end here. Only the
destination differs. Copy per note 19 — and "OTP" should not survive anywhere
in the app, including A5's button and the reset screen (notes 16, 17, 50, 51).

### A15 · Join a farm as a guest

Title and helper text per notes 48 and 49. On note 47 — the **K** key was there
because the mockup keyed the joining role off a letter. Invitation codes are six
digits now, the letter key is gone, and the mockup reads the role from the first
digit instead: any six digits join as a Worker, a leading 9 as a Supervisor,
`000000` shows the expired-invitation message. The fixture codes and
`createInvitation()` were changed with it, or the two codes on the workforce
screens could not be typed on the keypad that redeems them.

### What this costs

One screen deleted (A2), no screen added — the email-and-password route is an
in-place swap on A3. Registration is unchanged in length. A returning farmer
reaches the front door in one tap from A1 rather than two.

### Where the deck files them

The screen deck now prints these as **two sections rather than one**. First run
holds A1 through A14 — everything somebody does once, in the order they do it.
Logging back in holds A3, the password reset and joining a farm as a guest,
which are the screens reached from the front door. A15 is filed with the second
even though redeeming an invitation is somebody's first run too: it is reached
from A3 and from nowhere else, and that is the line the split draws.
