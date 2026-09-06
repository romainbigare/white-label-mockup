# v1.5.8 — the marks on the v1.5.7 deck

Sixty-six changes on `Wafra_Farm_App_Screens_v1.5.7_Mark.pptx`, read screen by
screen in [`PowerPoint_Comments_060926.md`](PowerPoint_Comments_060926.md). This
is what each one produced. The requirement set underneath is still **v1.7**: the
round moves screens, and the one rule it does move — which credential is the
account — is recorded here rather than in a new specification document.

- Round 9, the comments on the v1.5.6 deck: [`Mockup_Changes_v157.md`](Mockup_Changes_v157.md)
- Round 10, this document

Six of the sixty-six change what the app **is** rather than what a screen says,
and everything else follows one of them.

---

## The account is an email address

> *"Most users will sign in via Face ID. The login screen is only shown to
> registered users who fail Face ID. No need to 'create an account' or 'join farm
> as a guest' here. OTP can be sent to registered mobile number or registered
> email address."*
>
> And, alongside the deck: sign up with an email; name, phone and the rest are
> collected afterwards as additional data; coming back is Face ID first, and a
> code to the **email** when that fails. No more phone login. Farm workers are
> the exception and arrive by their own route, from an invitation code.

`WF4.032` made the mobile number the account, and the reason it did — a verified
number is what work alerts and worker records hang off — survives as a reason to
**collect** the number. It is no longer a reason to lock the door with it. An app
sold from Georgia to Bengal cannot assume the number a farmer holds this season
is the one he holds next season; an address travels with him.

**A3 was redrawn** as the screen the reviewer built out of pieces of ours and a
banking app: the mark, **Welcome back** and the farmer's first name, Face ID
first, a password, then a code to the registered address. What came off it:

| Gone from A3 | Because |
|---|---|
| the Mobile / Email switch | there is one credential now, so there is nothing to switch between |
| the country selector | it belongs to a phone number, and a number is no longer how anyone gets in |
| *New here? Create an account* | *"no need to create an account … here"* — this screen is for somebody the app has already met |
| *Invited? Join a farm as a guest* | as above |

**A5 is where a stranger lands, so the two doors moved onto it.** That is a
judgement call and worth flagging: taking both links off A3 leaves sign-up and
the guest route reachable from nowhere unless something else carries them. A1's
**Skip** and the tour's last card both hand to A5 now, and A5 carries *Already
registered? Log in* and *Invited? Join a farm as a guest* under its form. Nothing
became unreachable and A3 stayed as the reviewer drew it.

**A6 addresses the code to the address.** **FORGOT** does the same, and lost its
Mobile / Email control with it — a screen that offers a choice of two credentials
when the app has one is offering a choice that cannot be honoured.

**F14 stopped saying the number is the account.** *"Delete. Since we are created
an international app, we can allow changes to mobile number and email address
from the app."* Both are editable; changing the number sends a code to the new
one and hands to A6, which is what the button says.

---

## The first screen says what we do

> *"First screen tells users what we do (to avoid any misunderstanding). Logo
> should be English only to accommodate new international focus. Registered users
> will go straight to login screen."*

The reviewer struck out **A1** and drew two screens in its place, assembled over
our own from a reference app he pasted in.

**A1 is the welcome screen.** The mark, one sentence — *"AI-powered satellite
monitoring for precision agriculture, to enhance your farm profitability"*, his
wording with one letter changed from his `IA` — the address, **Skip** in one
corner and **Next** at the foot. Next takes the tour; Skip goes to the form.

**A1B is new**: the language sheet A1's corner chip raises, modelled on the
bottom sheet he pasted in — a row per language with its two-letter code and a
radio button. `WF4.013`'s no-scrolling rule was about a *screen*; a sheet is
allowed to scroll, which is what finally lets the language list be ten equal rows
instead of two tiles and an *Other* drop-down.

**Ten languages, his list and his order**: English, Arabic, Bengali, Pashto,
Hindi, French, Turkish, Azerbaijani, Georgian, **Armenian**. Armenian is new and
carries the first run and the shell, like the four that arrived in v1.5.7; F8's
coverage bar says by how much.

**The logo is English only, and stacked.** The supplied artwork carried the name
twice — وفرة جرينتك over WafraGreentech — and ran the Latin half together on one
line. `app/imgs/logo.avif` is now that same artwork rearranged: the Arabic gone,
**Wafra** set over **Greentech**, the mark one and a half times the height of the
two lines, everything vertically centred. Which is the lock-up his own pasted
artwork uses, and it is nearly square, so a screen with a logo in the middle of
it finally has something square-ish to put there. Nothing was redrawn — the
letters and the mark are cut from the file that was supplied. The reviewer's own
designer is drawing the real replacement; when it arrives it is a file swap and
three numbers in `brand.js`.

---

## The tour is five panels

The opening card — *Enhancing your farm profitability through precision
agriculture*, and the last one still illustrated by an icon — was struck through
corner to corner and marked **Delete**. What it said is now on the welcome
screen, where somebody who has not pressed anything yet actually reads it.

The tour runs **A4 … A4D**; A4E is gone. Four more marks landed on it:

| Mark | What it produced |
|---|---|
| *"Seems redundant. Delete '2 of 6' and keep graphics at bottom"* | the written step counter is gone from every panel; the dots stay |
| *"Add 'Telegram'"* | tasks go to a supervisor by WhatsApp, Telegram or SMS |
| *"Add small space"* | a paragraph's worth of air between the last line of copy and the dots |
| *"Change to: 'crop yields'"* | on A4C, *increase plant growth* became *increase crop yields* |

**The closing panel was redrawn to his own sketch.** White dividers between the
five crop photographs instead of black; his sentence — *"On average, farmers
experience the following benefits from our service:"* — in place of ours;
*yields* plural; and the chevron under the three savings replaced by a solid
triangle, because *"use triangle for greater emphasis"* is an argument about
what the shape means. Three measured savings narrowing into one profitability
figure is a funnel, not a *next*.

**The panels are keyed by name now.** They were `a4.0`, `a4.1` and so on;
deleting the first would have slid every catalogue one panel along — nine
languages quietly showing the right picture under the wrong caption, with nothing
anywhere reporting it. The translation sources were re-keyed in the same commit.

---

## D1's screener is three menus

> *"The screener is confusing with boxes and drop down menus. It seems there are
> three types of screening: by severity … by level of completion … by type … It
> seems three drop down menus are the easiest? The setting from the last login
> should be maintained. Also, can we develop the taxonomy of all available
> options under each type?"*

He read the screen correctly and then read it better than it was built. There
were three filters drawn as three different *kinds* of control — a pill-tab row,
a scrolling chip strip and a select — which is why it looked like more than
three. Worse, the pill tabs mixed two of his axes into one: *Needs action* is a
severity, *Done* is a completion state, and choosing either silently moved the
other.

Three menus, one shape, one axis each, and the taxonomy is closed:

| Menu | Options |
|---|---|
| Severity | Any severity · Urgent · Planned · Monitor · Good |
| Progress | Any progress · Not sent to anyone yet · Sent, not yet done · Done |
| Type | All types · Irrigation · Nutrition · Crop protection · Weather |

*Deferred* is deliberately not offered: an ignored item is out of the inbox until
tomorrow, and a filter for things the app is intentionally not showing is a trap.
The three live on the session beside the layer choices, so *"the setting from the
last login should be maintained"* holds — and B4's **See Advices** button stopped
forcing the tab, which used to undo a choice the farmer had made on purpose.

---

## The index names are gone

> *"Each monitoring layer is generated from multiple indices / combinations of
> indices. We should remove 'NDVI', 'NDRE', etc."*

The acronyms were not shorthand, they were **wrong**. A row reading *Plant health
· NDVI* says the layer is that index; it is a model reading several bands at
once, and the index it was named after is the one a farmer might go and look up,
to find a definition that does not match what he is looking at.

`technical` is off the measure records and out of every screen a farmer meets —
C2's list, C1's legend, B4's panel, B13's readings, the measure picker and the
measure sheet. What replaces it is the range the colours run across, which is
what a legend actually needs beside it.

**C2 was renamed twice in the same round.** *Basemap* → **Map options**, with his
sentence under it — *"Daily farm monitoring results are displayed with both
options"* — because the old satellite description, *"this is what we measure
from"*, read as a warning that choosing the other one costs you the
measurements. It does not. And *Measure layers* → **Monitoring layer**, singular,
because the farmer is choosing one.

Both basemap descriptions are his: they lead with the clarity and then concede
the freshness, one clause each, so the two rows read as a trade rather than as a
list of properties.

---

## Everything else, screen by screen

### First run

| Screen | Change |
|---|---|
| **A9B** | *"Choose this option if you are a small farm with only 2-3 plots"* — the line described the farm, not the choice, and *fields* was the wrong noun where everything else counts plots |
| **A10D** | the one-crop-per-plot rule is on the screen while the farmer is drawing, not only on A11 afterwards, and not behind the ⓘ |
| **A11** | a third legend key, **Farm boundary**, drawn as the dashed blue line it names |
| **A13** | the trial promise is his — *"No payment is due during the free trial. We will ask for your permission before charging your credit card at the end of the free trial."* |
| **A13** | *Compare all features* → **Compare plans**, which is what the screen it opens is called |
| **A13** | the combined-subscription sentence is replaced by the one he wrote: areas can be modified at any time and the payment adjusts at the next billing cycle. It is no longer conditional on holding both crops and trees, because it is true of every account |
| **A13** | the App Store currency question is answered on the screen: prices show in the currency of the store account, which is what the card is charged in |
| **A5** | first and last name, side by side; an optional company name with no asterisk; every country in the world in the dial-code list, 53 → 200, with the GCC and Jordan still held on top |
| **A5** | *Verification required.* deleted — the number is no longer what gets checked |
| **A5** | *Farm reports are sent to this email address* deleted, and the fact it was carrying is now a real control on F1 |
| **A6, A15** | the drawn keypad is gone. *"Why do we need this? Keyboard should appear once the user presses the first entry box, right?"* The boxes are one-character numeric inputs, so the phone raises its own keyboard and can fill the code in itself |
| **A15** | *"Enter the invitation code or scan the QR code on the phone of the person who set up this account"* — the code is shown by the person who made it, so the guest needs one phone rather than two |
| **A15** | *"No invitation code? Ask the account owner to create one for you"* |
| **FORGOT** | *"Add: 'temporary'"* — the code is good once and briefly, and the sentence now says so |

### Map

| Screen | Change |
|---|---|
| **C1** | the farm outline stands 16% off its plots instead of 7%, and is drawn twice — a dark casing under the pale dash — so it survives ground that runs from bright sand to dark crop in one frame. It was drawn before and could not be seen, which is what *"add farm boundary(ies)?"* was really reporting |
| **C4** | opens **a week apart**. It opened six satellite passes back, which is a count rather than an interval: passes run two to thirteen days apart, so six of them was anywhere between a fortnight and two months — and the screen opened on the least readable comparison it had |

### More

| Screen | Change |
|---|---|
| **F1** | **Sent to** — the account's address, always first and not removable, plus any others the farmer adds |
| **F5** | *"You can cancel the renewal of your subscription at the end of your billing cycle"* — *at any time* is what the button feels like and not what the billing does |
| **F5** | the combined-plan sentence deleted: *"why is the purpose of this information? The service is at the farm level"* |
| **F5** | one contact-us row became three things the app does — download an invoice, switch monthly/annual or Basic/Pro, and **team members** rather than *seats* |
| **F5** | the server-side access sentence deleted, *"too confusing"*. The rule still holds and is still tested; it is not something to tell the farmer about |
| **F6** | no prices. *"This is just to show the features"* |
| **F6** | *In every plan* deleted, and the number of people is a row in the table with a value per level: Basic two, Pro five |
| **F6** | the button hands back to A13 or F5, and is called **Back to my plan** rather than *Choose a plan* |
| **F7** | the language **menu itself**, not a row to another screen. *"Seem repetitive with F8 … remove region"* — and there never was a region setting behind that word |
| **F7** | a **Units and formats** row that opens F8, which is how the other half of that screen stops being hidden |
| **F7** | *Unlock with fingerprint or face* → **Unlock with Face ID**, matching A3's button |
| **F8** | the app-language block is gone; **Calendar** and **Time** are sections of their own; *Numbers and dates* is now **Numbers** |
| **F8** | the currency row deleted — see the note below |
| **F14** | first and last name; the role, farms and language card deleted, *"this screen should be to update contact information only"*; **Save boundary**, which was simply the wrong label from another screen, is now the save button the screen needs |

---

## The three judgement calls

**The currency sentence broke off.** *"Delete. I believe currency is set by ,
and add language menu in F7"* stops mid-clause. Paired with the App Store
question on A13, the reading is that the store account sets the currency — so
F8's currency row went, and A13 now says the prices are in the currency of the
store account. If that reading is wrong, the row comes back and the A13 sentence
goes; nothing else moves.

**F8 is called *Units and formats*, not *Units*.** He wrote *Units* over
*Language and region*, which is right about the half he was looking at. Calendar,
time and numerals are formats rather than units, and leaving them under a heading
that does not name them is how they got lost under *Numbers and dates* in the
first place.

**Login follows the conversation, not the drawing.** His A3 mockup shows *Send
code to mobile number* and *Send code to email*, and his assumption says the code
can go to either. The direction given alongside the deck was narrower — Face ID,
then a code to the email, no phone login — and that is what is built. Restoring
the mobile route is one button and one line if the wider reading is the right one.

---

## The empty note box on p57

A yellow box on F14's page carries no text. Nothing was inferred from it. Worth
asking whether something was meant to go there before the next round closes.

---

## What the next deck carries

Some pages carry a small box of prose in the bottom-right corner, clear of the
space the deck exists to leave empty. It began as somewhere to keep the
assumptions that asked for no work, and the second pass over this round took the
heading off it — *"remove the title 'The reviewer's assumption', that's just
silly. Keep the box."* — which turned it into something better: the place a page
says what a photograph of a phone cannot.

Six pages have one. **A3** and **A5** carry the assumptions the build now rests
on. **C3** and **C5** say what those two screens are, which the open questions
on them were really asking — a plot sheet is the panel that appears when you tap
a plot, and the boundary editor corrects one outline after the fact and keeps the
old one. **D1** carries the whole taxonomy of its three menus. **F6** notes that
the feature list is still to come.

They live in `REVIEW_NOTES` in `app/screens/index.js`, beside the titles and the
flows, because they are facts about screens.

---

## The second pass

A read of the v1.5.8 build produced a further round of marks, all of them about
how the screens sit rather than what they say.

| Screen | Change |
|---|---|
| the logo | **Wafra** now sits over **Greentech** rather than running into it, with the mark one and a half times the height of the two lines and the whole thing vertically centred — which is the lock-up the reviewer's own pasted artwork uses. It is cut from the file that was supplied, so nothing has been redrawn |
| **A1** | the mark and the sentence are centred in the screen rather than sitting a third of the way down, and the logo is half as big again |
| **A1**, the deck | the guided tour is printed immediately after the welcome screen. It used to sit at the end of the First run section as a detour; it is not one any more — A1's Next opens it and its last card hands to the sign-up form, so the deck prints the walk in the order a farmer meets it |
| **A3** | no app bar. A bar saying *Log in* over a screen that says *Welcome back* is the same sentence twice, and its language picker was the third place in four screens to offer the same menu |
| **A3** | the *Unlock with Face ID* button is gone, and a notice at the top says **Face ID not recognised** — which is the reason the screen is open at all. A button asking the farmer to press, by hand, the thing that had just declined to recognise him was the wrong shape for it |
| **A3** | *Welcome back* and the farmer's name are one sentence in one size, and *Switch account* and *Forgot your password?* are on one line. The field, its two escapes and the two buttons are grouped as one block |
| **A5** | the assumptions box loses the note about the lawyers and the rest of it; one line remains, that the screen is for new users only |
| **A6** | everything is centred, with the code boxes on the vertical middle rather than the block of prose beneath them |
| **A13** | the App Store currency sentence is off the screen. The question is answered — the store bills in its own currency, which is why F8's currency row went — and the answer is how the billing works rather than something a farmer reading a price needs telling |
| **D1** | the three menus take the page's gutters. They sat hard against both edges of the phone, because an app bar's inline padding is an icon button's rather than a form control's |
| **F14** | the information box is gone; the *This is your account…* hint under the email field is gone; and the button is **Send code to new phone number**, unconditionally, handing to A6 |
