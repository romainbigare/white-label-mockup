# v1.7.1 — the deck marks and the 21 September call, merged

Two inputs, one list.

- **The deck.** 61 marks on `Wafra_Farm_App_Screens_v1.7.0_Mark.pptx`, read off the
  slides and written up in [`PowerPoint_Comments_210926.md`](PowerPoint_Comments_210926.md).
- **The call.** ~1h 26m on 21 September, Mark and Romain walking those same marks
  screen by screen, then through the live mockup.

**Where the two disagree, the call wins.** Six deck rows were overturned outright
and eight were refined; they are set out below the table so nothing is lost.
Every other deck row stands as written.

The call also decided things the deck never raised — the whole of Parts 4 to 8
(plot detail, plot metrics, the crop list, tree groups, the two new screens) was
walked in the live mockup, not in the deck, and none of it carries a deck mark.

Most screens were never named by code on the call. Every row below has been traced
to the screen and, where it exists, the translation key or the line of code.

**107 rows.** Source is marked in each row: **[deck]**, **[call]**, or **[deck+call]**.
**73 of them come from the call** — 46 on things the deck never raised, 21 where
the call confirmed or sharpened a deck mark, and 6 where it overruled one. The
remaining 34 are deck marks the call never reached.

---

## Built in v1.7.1

Every row below is implemented except where this section says otherwise. The
deck is `Wafra_Farm_App_Screens_v1.7.1.pptx`, 67 pages, 59 screens.

**Screens gone:** FORGOT (deleted with the password).
**Screens new:** **A9F** *Not interested* · **A10C** *Draw your farm boundary* ·
**A13B** *Your annual plan and price for new users*.
**Screens rebuilt:** A9E, A10, A13.

Three rows could not be built as written, and here is exactly why:

1. **The A13a / A13b rename is not applied.** The call renamed the two plan
   screens A13a (first-time) and A13b (returning); the deck had already used
   **A13B** for the *annual* page. Both cannot hold the letter. The annual page
   keeps A13B — that is what the marked-up deck says — and the
   first-time/returning distinction is carried by the screen titles instead.
   **This is open question 1 and it needs Mark.**

2. **The Georgia crop could not be removed** because it does not exist. None of
   the 38 crops is Georgian. The only Georgia-specific thing in the app is the
   **Georgian language** on A1B, which Mark himself added at the 06/09 review,
   so nothing was deleted on a guess.

3. **A5's two doors moved to the dock rather than fitting above the fold.**
   Stacking the names and dropping the password was expected on the call to make
   the form short enough. Measured, it does not: the form is 765px against 601px
   of phone, and it was 164px over before the two 108px links were counted. The
   dock does not scroll, so the decided outcome — both links reachable without
   scrolling — is true on every phone and in all ten languages rather than on
   the one we measured. The smoke test asserts it.

Two further things worth flagging, both consequences rather than choices:

- **The survey now runs before the price**, reversing the 13/09 third pass. Three
  separate marks require it: the sequence written on A10, the A10B button
  renamed "Go to service plans (A13)", and the four steps on the new A9E. A13
  reached before the answer is back says the survey is still running rather than
  inventing a figure — which answers Mark's own blue-box question the way he
  proposed it.
- **B15's calendar is called "field work", not "tasks".** `tools/syntax.sh`
  forbids the word in live code, because task management was removed from this
  app deliberately and grew back last time "one convenience at a time". Nothing
  on the planner is assigned, holds a state, or can be completed.

---

## What the call overturned

Six straight reversals. These deck rows are **dead** — do not build them.

| Screen | The deck said | The call decided |
|---|---|---|
| **A4D** | Wrap the benefits, the triangle and the profitability figure in one **grey box** | Romain had already added the grey box. Mark: *"what it needs is a stronger, darker, thicker outline rather than more elements."* Keep the box, restyle the outline — don't add anything |
| **A10** | The two locate options **side by side** at the top | *"they should be stacked, since they're just two equivalent ways to do the same thing"* — stacked, still at the top, still labelled Option 1 / Option 2 |
| **A10** | One screen, retitled *"Locate your farm"*, button *"Get quote"* | **Split into two screens.** Finding and drawing are separate steps |
| **A10B** | Body → *"We will notify you when the survey is completed. Please keep the app open to see available service plans."* | *"why does it say 'keep the app open'? I don't think that's needed."* The survey runs server-side and a push notification arrives. Body → *"You will be notified when the survey is completed"* **plus an estimated time** |
| **A13 / A13B** | Add a **checkmark** below the plan cards to switch to the annual plan | It is a **toggle**, and its position is fixed: *"put it after the Basic/Pro comparison rather than before — comparing plans first, then the monthly/annual choice a bit below"* |
| **A15 / Log in** | *"QR code seems complicated for first version"* — QR leaves v1 | **QR stays in the product.** It leaves A15 only. QR = in-person path (owner shows, guest scans, deep-links straight into registration); six-digit SMS code = remote path, which is what A15 is for |

And one refinement that changes wording already agreed: the deck's trial copy said
*"...anytime through your iPhone."* The call pins the term — *"Apple calls this
'in-app purchase' — we should align our wording to that"*, with Google's
equivalent on Android.

## The naming collision — needs settling before anything is built

Romain, on the call: *"There are actually two A13s — an earlier version (for a
first-time user) and a later version (for a returning one). We'll rename them
**A13a** and **A13b**."*

The deck had already used **A13B** for something else: the **annual** plan screen.
The two cannot both hold the letter. And Mark's *"I don't think we move A13 up;
leave it where it is"* sits awkwardly against his own deck note on A10,
*"Sequence: A10, A10B, A11, A13"*, which moves the plan screen to after the survey.

**My reading**, and it is a reading — the new A9E the deck builds out of A13 *is*
the "earlier version for a first-time user", and A13 proper *is* the "later
version for a returning one" — the user who comes back after the push
notification. That makes **A13a = the estimate screen (deck: new A9E)** and
**A13b = the real-price screen (today's A13)**, and it needs no reordering
argument at all. It is also the only reading that fits the new A9E's own
four-step text, which the deck spells out: *"You tell us the location of your
farm · Our platform automatically surveys your farm · We send you a final quote ·
You select the service plan you want"* — plan selection last, after the survey.

Under that reading the **annual** screen needs a free code. The rows below call it
**A13-ANNUAL** as a placeholder.

**Confirm with Mark before building.** Everything about the price flow hangs on it.

---

| SCREEN CODE | CHANGE NECESSARY |
|---|---|
| **Project** · trial length | **[deck]** *Question.* *"I wasn't sure who is paying for the free trial. MMC or Wafra. I will clarify with Neil. If we are paying, then we will reduce the trial window to two weeks."* Not raised on the call, so it stands open. If Wafra pays, `a13.trial` goes from **30 days** to **14 days**, and everywhere the trial is shown: A13, A13-ANNUAL, F5, F6, and `a9e.step3.sub`. |
| **Project** · passwords | **[deck+call]** Answered on the call, and it is the largest change in this round. *"I've seen a shift industry-wide, over the last six months, away from passwords toward SMS/email one-time codes… I think it's safe to move Wafra to that model."* Passwords go. OTP is the primary sign-in. Touches A5, A3, A6, A15, FORGOT. |
| **Project** · Face ID | **[call]** Face ID stays and is already wired, but it is **the default for returning users only** — it does not fire on the very first run (standard Apple/Samsung/Google behaviour). If it fails, it falls back to OTP. This is what A3 exists to handle and the screen already says so. |
| **Project** · contact | **[call]** **No phone number anywhere in the app** — it is an international product. Support goes through the new **Wafra Green Tech** WhatsApp business username (backups reserved: *Wafra Green*, *Wafra Tech*); the Saudi number will be attached to that WhatsApp account later, not shown as a number. Remove `"whatsapp": "+966 54 810 0443"` from `content.json:2829` and show a WhatsApp button instead. Affects F13, A3, the new A6 help block, and every "We are here to help" block. |
| **A1** · p4 | **[deck]** *Info.* *"FYI, Hannah is getting the stacked logo sorted out."* New artwork is coming. No code change now — swap `app/imgs/logo.avif` when the file arrives. |
| **A4B** · p8 | **[deck]** Frame round **fertilization** in *"Irrigation and fertilization advice"*: *"Move to next line."* It breaks as *"Irrigation and fertilization / advice"* today. Break it as *"Irrigation and / fertilization advice"*. (`a4.advice.h`) |
| **A4D** · p10 | **[deck]** Frame round the five-photo strip: *"Update picture (sent separately). No need for black frame."* The replacement is saved at `docs/assets/A4D-new-photo-strip-210926.png` — lettuce rows, green figs, a crop field, date palms, potato rows. Use those five and drop the black dividers. |
| **A4D** · p10 | **[deck]** Frame round **in farm** in *"Potential increase in farm profitability"*: *"Move to next line."* Break it as *"Potential increase / in farm profitability"*. (`a4.stat.profit`) |
| **A4D** · p10 | **[deck]** Line to **10–25%**: *"Add + sign."* It becomes **+10–25%**. (`onboarding.js:600`) |
| **A4D** · p11 | **[call — overturns deck]** The grey box is already there. Mark: *"I think what it needs is a stronger, darker, thicker outline rather than more elements."* **Do not add anything** — give the existing profitability box a heavier, darker border so the funnel reads. |
| **A4D** · p11 | **[deck]** *Deck note.* *"Repeated slide."* A4D prints twice, p10 and p11. A fault in `tools/screendeck.mjs`, not in the app. |
| **A5** · p12 | **[deck+call]** Frame round the **First name / Last name** row: *"Arabic names can be quite long."* **Stack the two fields vertically.** The call gives the reason and the acceptance test: with the fields stacked *and* the password gone, the screen must be short enough that **"Already registered? Log in"** (`a5.already`) and **"Invited? Join a farm as a guest"** (`a2.join`) are both visible **without scrolling** (`onboarding.js:904-905`). |
| **A5** · p12 | **[deck]** Frame round *"We send a code to this number to check it."*: change to **"A verification code will be sent to this number."** |
| **A5** · p12 | **[deck+call]** Remove the **Create a password** field, its rule line and its show/hide eye. Sign-up authenticates by SMS code only. Confirmed on the call as a deliberate reversal of what was agreed earlier. |
| **A6** · p13 | **[deck]** Frame round *"Your keyboard opens when you tap the first box, and can fill the code in from the message."*: *"Delete. This is an automatic phone feature."* |
| **A6** · p13 | **[deck+call]** Add the **"We are here to help."** block with **WhatsApp** and **Email** buttons — Mark pasted the A3 block onto the bottom of A6 in the deck, and on the call gave the reason: *"if someone has a problem with their code (didn't get it, lost their phone number), they can reach us."* No phone number in it — WhatsApp and email only. |
| **A6** · Face ID | **[call]** A6 is where a brand-new account is asked about Face ID, and that is still right: Face ID cannot fire on the first run, so it is set up here and becomes the default from the next sign-in. No change — recorded so it is not "fixed" by mistake. |
| **A9** · screen name | **[call]** *"'Create your first farm' — drop 'first,' it's confusing this early; there's already a later option to add a second farm, so introducing the 'first farm' concept now just adds noise."* The screen name becomes **"Create your farm"**, and the word "first" leaves the screen entirely. |
| **A9** · p14 | **[deck]** Frame round the on-screen heading *"Create your first farm"*: change to **"Tell us about your farm"**. Not contradicted on the call, and it carries no "first" either. |
| **A9** · p14 | **[deck+call]** Frame round the label *"Approximate area"*: change to **"Approximate cultivated area"** — *"we don't want the user to give us the entire farm area"*. On the call: *"good instinct, 'approximate area' alone loses precision."* (`a9.area`) |
| **A9** · p14 | **[deck]** *Question.* Frame round the area input, placeholder `0`: *"If we allow decimals, should the example show 0.0?"* Not raised on the call — still open. |
| **A9** · p14 | **[deck+call]** Replace the hint *"Fill in whichever you have. A rough number is fine — we will confirm it with a real survey."* (`a9.hint2`) with a **discrete secondary button, "I'm not sure"**. The call confirms where it goes: straight to **A10**, *"it just skips the price estimate step"* — so A9E/A13a is bypassed entirely for a farmer who cannot give numbers. |
| **A9E** · p14 | **[deck]** **Delete the current A9E.** The slide is struck through corner to corner and labelled *"Old A9E Slide"*. The SAR 716–1,074 range and the three "what happens next" rows go. (`a9e.price`, `a9e.rough`, `a9e.step1`–`a9e.step3.sub`) |
| **A9E** → **A13a** · p16 | **[deck+call]** **Rebuild it from the A13 plan layout** — the deck's *"New A9E Slide"*. It shows both plans and their prices as an estimate, with nothing to choose and nothing to confirm. The call renames it **A13a**, the first-time user's version of the plan screen — see the naming note above. |
| **A9E** → **A13a** · p16 | **[deck]** Header *"Your plan"* → **"Available service plans"**. |
| **A9E** → **A13a** · p16 | **[deck]** *"Priced on what you told us: 12.4 ha · 220 date palms and fruit trees. We will adjust it to whatever the survey actually finds."* → **"Estimated cost based on 12.4 ha and 220 trees. We will give you a final quote once we complete the automated farm survey."** |
| **A9E** → **A13a** · p16 | **[deck]** **Remove the radio buttons** on the BASIC and PRO cards — *"not needed at this point."* Plans are shown here, not chosen. |
| **A9E** → **A13a** · p16 | **[deck]** Replace the **30 days free trial** block and *"When you confirm, we send your boundary for satellite survey and AI analysis."* with **"Once you have reviewed the plan features and cost, we can proceed with the next steps:"** and four steps, each with a checkmark icon: *You tell us the location of your farm · Our platform automatically surveys your farm · We send you a final quote · You select the service plan you want.* |
| **A9E** → **A13a** · p16 | **[deck+call]** Add a secondary **"I'm not interested"** link below the main button. Mark typed it onto the screen in the deck and reaffirmed it on the call: *"let's still capture 'not interested / why' as an option if the user backs out at the price stage — we want some signal if conversion isn't happening."* |
| **A13-EXIT** · new screen | **[deck+call]** **New screen.** Behind "I'm not interested": four options — *Not what I'm looking for · Too complicated · Too expensive · Other reason:* (free text) — with **our contact info (WhatsApp and email) at the bottom**. Needs a screen code. |
| **A10** · split, screen 1 | **[call — overturns deck]** **A10 splits in two.** Screen 1 is **purely finding the farm** — no drawing. Mark: *"Screen one is purely 'find your farm' (search Google Maps or use current location) — no drawing yet. Once you confirm 'I found my farm,' a second screen appears."* Keep the deck's new title, **"Locate your farm"**. |
| **A10** · screen 1 | **[call — overturns deck]** The two locate options are **stacked**, not side by side, both at the top, labelled **"Option 1: Search on Google Maps"** and **"Option 2: Use my current location"**. |
| **A10** · screen 1 | **[call]** The bottom button is no longer *"Use my current location"* — that is now one of the two options above. It becomes a confirmation: **"Ready to map my farm"** (Romain's wording), which is what reveals screen 2. `a10.request` / `map.uselocation`. |
| **A10C** · new screen | **[call]** **New screen — draw the boundary.** Mark expected a polygon to adjust and instead had to draw one from scratch with no visible instruction: *"The instructions weren't clear — I expected you to hand me a pre-drawn polygon to manipulate."* This screen does one thing: draw the boundary with your finger. Code proposed — A10, A10B and A10D are taken; **A10C is free**. |
| **A10C** · new screen | **[deck+call]** **"Draw your farm boundary" must be large, unmistakable on-screen text** — not the small subtitle it is today (`a10.subtitle`) and **not behind the info button**. Deck: *"Text is very small and easy to miss. Farmer may not know how to proceed."* Call: *"needs to be large, unmistakable text."* Romain: *"I could move the instruction text onto the screen itself and shrink the map slightly."* Move `a10.instruction` out of the help sheet and onto the screen. |
| **A10C** · new screen | **[deck]** The button at the foot is **"Get quote"** (the deck's change to *"Continue to survey"*, now landing on screen 2 rather than screen 1). |
| **A10C** · new screen | **[call]** **No auto-detection in v1.** *"Let's not over-automate this for now — we're covering a lot of different countries and farm shapes; keep it simple: find your farm (two options), confirm 'this is my farm,' then draw the boundary with your finger."* The AI pre-drawn polygon is a future enhancement, not this release. |
| **A10** · sequence | **[deck, superseded in part]** The deck's blue note *"Sequence: A10, A10B, A11, A13"* is the reorder question. The call's *"I don't think we move A13 up; leave it where it is"* and the A13a/A13b split answer it — see the naming note above. **Confirm with Mark.** `app/meta.js:214` and `index.js:403` carry the current order. |
| **A10B** · p20 | **[deck]** *Question.* *"What happens when the user click the green button? Does the app take him to A13 (without cost), and he waits until the cost is calculated and is displayed?"* Still open. |
| **A10B** · p20 | **[deck]** Frame round **Analysis** in *"Analysis in progress"*: change to **"Survey"** — the heading becomes **"Survey in progress"**. (`a10b.title2`) |
| **A10B** · p20 | **[call — overturns deck]** Body copy. **Drop "keep the app open"** — Romain: *"the survey itself runs outside the app… the server sends a push notification when it's done."* Mark: *"let's simplify to 'you will be notified when the survey is completed,' plus an estimated time."* Replace both paragraphs (`a10b.body2`, `a10b.check2`) with that one sentence **and an estimated time**. |
| **A10B** · p20 | **[call]** The estimated time is **MMC's number, not ours** — *"it'll vary by country, so we'll let MMC supply the actual number."* Mark assumed ~30 minutes; MMC may get it to one or two. Put a placeholder in the mockup and mark it as MMC-supplied. |
| **A10B** · p20 | **[deck]** Frame round the **Go to my farm** button: change to **"Go to service plans"**, going to the plan screen rather than Home. (`a10b.home`) |
| **A13** · p18 | **[deck]** **Rename the screen** to *"Your **monthly** plan and price for new users"* — Mark recoloured the word green in the deck title. |
| **A13** · p18 | **[deck]** Header *"Your plan"* → **"Monthly service plans"**. (`a13.title`) |
| **A13** · p18 | **[deck]** *"Priced on what you told us: …"* → **"The service plans are based on 12.4 ha and 220 date palms and fruit trees."** (`a13.basis.estimate`) |
| **A13** · p18 | **[call — overturns deck]** The monthly/annual switch is a **toggle**, not a checkmark, and its **position is fixed**: *"put it after the Basic/Pro comparison rather than before — comparing plans first, then the monthly/annual choice a bit below."* So the order down the screen is: plan cards → **Compare plans** row → monthly/annual toggle. Tapping it opens the annual screen. |
| **A13** · p18 | **[deck+call]** Trial copy. Deck: *"The language should reflect how the Apple/Google payment plans work. We don't charge a credit card, as the subscription is through Apple/Google."* → **"At the end of your free trial, we will ask for your permission before starting your paid subscription."** Call refines the rest: use Apple's own term — *"Apple calls this 'in-app purchase' — we should align our wording to that"* — and the Google equivalent on Android. (`a13.trial.permission4`, `a13.thenwhat`, `a13.cancel2`, `a13.storecurrency`) |
| **A13** · p18 | **[deck]** Frame round **Confirm and start survey**: change to **"Start free trial"**. (`a13.confirm.survey`) |
| **A13-ANNUAL** · p19 | **[deck+call]** **New screen — the annual twin.** Deck: *"Repeat of A13 with annual service plan. Note that MMC changed discount plan. User can togle back and forth."* Call: *"Clicking through takes you to a second screen for the annual plan."* Needs a code — the deck's "A13B" is taken by the call's returning-user screen. |
| **A13-ANNUAL** · p19 | **[deck]** Header → **"Annual service plans"**. |
| **A13-ANNUAL** · p19 | **[deck]** *"Priced on what you told us: …"* → **"The service plans are based on 12.4 ha and 220 date palms and fruit trees."** |
| **A13-ANNUAL** · p19 | **[deck]** Frames round **month** in both *"SAR 716 / month"* and *"SAR 1,074 / month"*: change to **"year"**. The annual discount is MMC's new one — the rate needs confirming. (`a13.annualrate`) |
| **A13-ANNUAL** · p19 | **[deck+call]** The toggle back to monthly, in the same position as on A13 — below the Basic/Pro comparison. Deck wording: *"Show me the monthly plan."* |
| **A13-ANNUAL** · p19 | **[deck+call]** Same trial and in-app-purchase copy as A13. |
| **A13-ANNUAL** · p19 | **[deck]** Main button → **"Start free trial"**. |
| **A13b** · returning user | **[call]** The **returning user's** version of the plan screen — the one he opens after the push notification, priced on what the survey actually found rather than on his own estimate. Already in the code as A13's second state (`a13.basis.survey`); the call makes it a named screen. |
| **Log in** · p23 | **[deck, overturned]** *"QR code seems complicated for first version."* Answered on the call, and QR survives — see the A15 rows. |
| **A3** · p24 | **[deck+call]** *"If Face ID doesn't work, isn't it simpler just to issue an SMS code?"* Answered: yes. |
| **A3** · p24 | **[deck+call]** Replace the whole block — password field, *Switch account*, *Forgot your password?*, **Log in**, *Send code by SMS instead* — with a single **"Send code by SMS"** button. Mark pasted the A5 button over it in the deck. |
| **A3** · help block | **[call]** The *"We are here to help"* block stays, but with **no phone number** — WhatsApp and Email buttons only. |
| **FORGOT** · p25 | **[deck+call]** **Delete the screen.** Struck through in the deck, blue box *"Delete?"* With no password there is nothing to reset. A3's *"Forgot your password?"* goes with it, and so does the **A3 → FORGOT → A6** journey in `index.js:423`. |
| **A15** · p26 | **[deck]** *Question.* *"Where do we ask for guest's preferred language?"* A guest joining by invitation never passes A1B, so nothing ever asks. Not resolved on the call — still open. |
| **A15** · p26 | **[call — refines deck]** **A15 becomes the remote-guest path only: six-digit code by SMS.** Mark: *"If I'm sending an invite to someone remote, that's a six-digit code; face-to-face, sitting next to each other, that's a QR code."* The *"Join a farm as a guest"* link on A5 leads here, and here there is no QR. |
| **A15** · p26 | **[deck+call]** Intro line *"Enter the invitation code or scan the QR code on the phone of the person who set up this account."* → **"Enter the invitation code. If you do not have one, ask the account owner to send you one."** (`a15.enter`) |
| **A15** · p26 | **[deck]** The single **Your name** field becomes three: **First name**, **Last name**, **Phone number**. (`a15.name`) |
| **A15** · p26 | **[deck]** Delete the **Your email** field — *"Email not needed."* (`a15.email`) |
| **A15** · p26 | **[deck+call]** Delete the **Scan QR code** button (`a15.scan`) and the line *"No invitation code? Ask the account owner to create one for you."* (`a15.nocode`). The call is explicit that the fallback button is what made the screen confusing: *"if I scan a QR code I shouldn't need to see all these extra screens, it should go straight to registration."* |
| **A15** · p26 | **[deck]** The **Join** button becomes **"Send code by SMS"** — the guest is verified by code like everybody else. (`a15.join`) |
| **A15-QR** · deep link | **[call]** **The QR path is a deep link, not a screen to navigate to.** *"Scanning deep-links straight into the app at that page"* — the guest scans the owner's QR and lands directly on registration, already carrying the farm. No intermediate screens, no fallback button. Mark: *"the farm owner would already have told them to come scan it, the way you'd exchange business cards in person."* |
| **B14** · owner side | **[call]** The invite is **generated by the owner in their own app** and can go out **either way**: shown as a **QR code** in person, or **sent as a six-digit SMS code** to someone remote. B14 already creates an invitation (`b14.invite`, `home.js:461-465`) and shows pending ones with a QR icon — it needs the two explicit send options. |
| **B4** · the empty-plot screen | **[call]** **Collapse the two screens into one.** Mark: *"I don't follow the purpose, since if you click 'set new crop' it just takes you to the crop-setting page anyway"* and later *"the old second 'what is growing here' screen from the deck should just go away."* One generic plot-detail screen that shows either the unknown-crop message or the live crop data, depending on state. The deck printed the empty case as if it were its own screen; it never was. |
| **B4** · unknown-crop state | **[call]** That state is **a concise box**: *"we don't know what's growing here — set the crop,"* not a whole placeholder screen mimicking the populated view. `b4.whatnow` (*"What is growing here now?"*) and `b4.setcrop.short` are already there — it is the surrounding scaffolding that goes (`plot.js:440-472`). |
| **B4** · summary fields | **[call]** **Reorder and complete the plot summary: area → variety → planting date → expected yield.** *"Add planting date, which I'd already entered but wasn't shown."* The `kv` block at `plot.js:496-503` is Area, Variety, Also growing, Target yield, Soil, Irrigation efficiency, Flow rate — **planting date is genuinely missing**. Mark is right. |
| **B4** · advice link | **[call]** **"See Advices" → "See advice"** — singular, and lowercase. *"'Advices' should be singular — 'Advice' — and probably lowercase."* (`b4.seeadvice`, `plot.js:385`) The link filters the advice inbox (D1) by that plot, which is correct and stays. |
| **B4** · trend chart | **[call]** **Merge the trend chart with the health-score label.** *"That box should probably be merged with the 'health score' label rather than sitting in its own separate category — visually they read as unrelated right now."* The `section(title, {}, card(…))` pattern puts every title outside its card; on this screen it breaks the link. (`b4.trend`, `plot.js:322`) |
| **B4** · trend chart | **[call]** The time axis runs **planting date → harvest, in weeks** — *"it should run from planting date to harvest, building up week over week"* — over a typical three-month cycle. |
| **B4** · trend chart | **[call]** **Add a target reference line** to the trend chart. *"Could we also add a reference line showing the target?"* |
| **B4** · growth stage | **[call]** **Combine "Growth stage" and "stem extension" into one box.** *"it's not clear the two are linked; make it one combined box."* "Stem extension" is a growth-stage name (`content.json:3172`) rendered apart from its own heading. (`b4.growth`, `plot.js:335`) |
| **B4** · disease and pest risk | **[call]** **Same fix** — *"Same note for 'disease and pest risk.'"* Title grouped with content. (`b4.risk`, `plot.js:345`) |
| **B4** · disease and pest risk | **[call]** *Open.* The display format may change: *"I'm not fully clear yet on how MMC actually delivers this data — as a percentage, or just a binary warning."* |
| **B4** · recent suggestions | **[call]** **"Recent suggestions" → "Advice for this plot."** *"it's not a suggestion, it's advice, and that's the language we've been using elsewhere."* (`b4.suggestions`, `plot.js:366`) The same wording B13 already uses for its tree-group block. |
| **B4** · irrigation | **[call]** *No change.* Mark asked whether irrigation is day-to-day or a weekly forecast; it is already a weekly forecast plus best time to apply and the split/quantity, with a calendar view. This answers Hany's earlier comment. Recorded so it is not "improved" by mistake. |
| **B4 / B5 / B6** · target yield | **[call]** **Target yield is not farmer-editable.** *"He shouldn't be able to override our number"* — Wafra's model sets it and the app reports on-track/off-track. Remove the editable input on B6 (`b6` form) and the editable presentation on B4 (`b5.target` row at `plot.js:499`). Mark confirmed it is **the input** being removed, not the data. |
| **B5** · mismatch warning | **[call]** A satellite-vs-farmer-entry mismatch warning on the crop-cycle page with **ignore / update** actions. **Already built** — `b5.mismatch`, with *"Update with satellite data"* and *"Keep as is"* (`plot.js:742-761`). Align the two button labels to **Update** and **Ignore** if Mark's words are to be taken literally. |
| **B5** · p30 | **[deck]** Frame round the Hijri date **24 Sha'ban 1447** beside *Planted 12 Feb 2026*: *"Since we are now selling this across multiple jurisdictions, we can delete Hiji calendar from the app."* Remove the Hijri date everywhere it is paired with a Gregorian one, not only here. (F8 offers Gregorian / both / Hijri — that setting is what drives it.) |
| **B6** · p31 | **[deck]** Frame round the amber banner: change the instruction to **"Close it out before entering a new crop for this plot."** (Marked twice in the deck — the second line also points at the *New crop cycle* heading, which looks like a stray anchor.) |
| **B6** · p31 | **[deck+call]** *Deck question:* *"Won't our system forecast the yield? Do we need the user to enter this information?"* **Answered on the call: yes, we forecast it, and no, he doesn't enter it.** The field goes — see the target-yield row above. |
| **B6** · crop picker | **[call]** **Remove trees from the crop picker entirely.** *"we only need crops here, not trees (trees are auto-detected separately, so they shouldn't be in this dropdown)."* That is the whole **`fruit-trees`** category — 14 of the 38 entries, every one with `isTree: true` (`content.json` crops; picker at `overlays.js:344`). |
| **B6** · crop picker | **[call]** **Simplify the sub-categories.** *"I don't think we need all these sub-categories either."* With trees gone the chips are cereals (5), forage (4), vegetables (13), other (2) — trim further. |
| **B6** · variety | **[call]** **Variety becomes an optional free-text field, greyed out** — not another picklist. *"Before I confirm a crop like alfalfa, where do I specify the variety?"* It belongs on B6, which is the same page as "add crop". |
| **Crop list** · source | **[call]** **The "codes" document is the authoritative source for crops** from now on, superseding the older taxonomy doc. Romain added crops ad hoc (okra among them) without reconciling. Applies to the picker, F16 Crop guide, and the tree grouping below. |
| **Crop list** · Georgia item | **[call]** *"Is there a Georgia-specific crop item in the list? …Let's just remove it rather than gating it behind a settings toggle."* **Not found.** None of the 38 crops in `content.json` is Georgian, and nothing else in the app is Georgia-specific except the **Georgian language** on A1B, which Mark himself added at the 06/09 review. Ask him which item he means before deleting anything. |
| **B13** · tree grouping | **[call]** **Grapes are not a tree.** `grape` is `isTree: true` and Al Kharj South carries a 648-"tree" **Grapes** group (`farms.json`). It must not be a tree group. |
| **B13** · tree grouping | **[call]** **Split citrus.** *"lemon, orange, and lime are different enough that they shouldn't be lumped together."* Drop the **Citrus (mixed)** entry and the 210-tree **Citrus** group; use the `orange`, `lemon` and `lime` species that already exist. Correct the rest against the codes document. |
| **B13** · measure label | **[call]** **"Plant health" → "Tree health"** on the tree pages. `GROUP_MEASURES` at `trees.js:47` carries the label; the key `measure.ndvi` is shared with B2 and B4, where *Plant health* is still right — so this needs a tree-specific string, not a global rename. |
| **B13** · donut | **[call]** **Remove the donut chart.** *"I don't follow how the donut chart relates to the row of symbols below it… I'd remove it — it reads as connected to what's below it, and it isn't."* (`trees.js:127`) **Keep the status icons** — Romain added them for colour-blind accessibility — paired clearly with their categories. |
| **B13** · dead trees | **[call]** **"Missing / dead" → "Died in the last three months."** *"A tree could have a gap in the ground for a year with nothing done about it; what we actually want is to distinguish trees that recently stopped giving us signal from ones that have simply been gone a long time."* Worked out from the monitoring history — was signalling, now isn't. Keep the **count** and add a **click-through list** of which trees. (`status.missing`, `b9.filter.missing`) |
| **B13** · per-tree breakdown | **[call]** **Drop the per-tree urgent/dead breakdown.** *"on a farm, you're managing a tree group, not caring for one or two individual trees… If advice stays at the group level, the per-tree urgent/dead breakdown risks being data the farmer can't act on — just noise."* The monitored/urgent status counts driven by the donut go with it. **Note the tension:** the "died in the last three months" count and list above survive, because replanting is something the farmer *can* act on. Worth confirming that reading with Mark. |
| **B13** · advice scope | **[call]** *Reaffirmed, no change.* Advice stays at **tree-group level**, never per tree — the earlier decision with Hany. B13 already says so (`b13.advice.sub`: *"These actions apply to the whole group, not individual trees."*). |
| **B13** · granularity | **[call]** *Open.* *"I still have doubts MMC can deliver granularity at that level."* Whether MMC can supply per-tree water-stress and nutrition data at all is unconfirmed; the mockup assumes it can. |
| **B15** · crop planner | **[call]** **Remove trees from the crop planner.** *"trees aren't rotated, so they're not relevant here."* Today they appear as *"standing planting, the ground is not free"* rows (`b15.bar.trees`, `b15.key.trees`, `b15.line.trees`, `b15.value.trees`, `planner.js:442-448`). All of it goes. |
| **B15** · crop planner | **[call]** **Rebuild it as a task-based calendar per plot**, not a "what to grow next" recommender. *"One thing missing from a 'what to grow' recommendation is market pricing data, which we don't have — so for this version, even though I like the feature, I think it's premature."* The shape to copy is MMC's own deck, **slide 67**: land sampling, levelling, tillage, planting, fertilisation, plant preparation, pruning, harvest. The `suggestNext` machinery (`planner.js:305`) and the "what we would put in next" dashed bars come out. |
| **B15** · crop planner | **[call]** **Keep it rough.** *"I don't want you spending too much time on this before we've talked it through with MMC on Thursday — a quick, basic mock-up is enough for now."* Romain: about 15 minutes' work. |
| **B16** · farm progress | **[call]** **Tag it clearly as "TBD" in the mockup** so it is not mistaken for a finished design. *"Since it's placeholder, can you tag it clearly as 'TBD'?"* |
| **B16** · farm progress | **[call]** *Open — framing unresolved.* *"Health, water stress, nutrition as an overall farm scorecard… I'm not sure how useful that framing actually is."* Romain's own guess is that it ends up an aggregation of growth-stage data already shown at crop-detail level rather than a new metric. To be checked with Hany and against MMC's master deck before it is finished. |
| **B14 / B11 / rest** | **[call]** *No review.* *"The rest — manage workforce, farm settings — is business as usual, screens we've already seen; I don't think we need to go through them now."* They keep iterating in parallel while MMC builds. |

---

## Deck rows the call did not touch

They stand exactly as the deck wrote them: A1 (logo), A4B (line break), A4D
(photos, line break, `+` sign), A5 (verification-code line), A6 (keyboard line),
A9 (decimals question), the whole of the A9E rebuild, A10B (the "Survey in
progress" rename and the button target), A13 and the annual screen's headers and
basis lines, A3, FORGOT, A15's fields, B2, B5 (Hijri), B6 (banner text) — and the
trial-length question, which nobody raised on the call.

## Open questions

Eleven, six of them carried over from the deck.

1. **The A13a / A13b naming and the price-flow order.** Nothing can be built until this lands. *(Mark)*
2. Who pays for the free trial — 30 days or 14? *(Mark, with Neil)*
3. Is target yield in **Basic** as well as **Pro**, or Pro-only? *(Mark to check)*
4. Which **Georgia-specific crop item** does Mark mean? Nothing in our data matches. *(Mark)*
5. Does the area field on A9 show `0.0` if we allow decimals? *(Mark)*
6. Where does a **guest** choose their language? A15 never passes A1B. *(Mark)*
7. What does A10B's button do while the price is still being worked out? *(Mark)*
8. **How long does a survey take?** The estimated time on A10B is MMC's number and varies by country. *(Neil / MMC)*
9. Can MMC's **boundary-detection model run on-device**? Future enhancement only. *(Romain → Neil)*
10. Does MMC deliver **disease/pest risk** as a percentage or a binary warning? *(Neil / MMC)*
11. Can MMC deliver **per-tree** water-stress and nutrition granularity at all? *(Neil / MMC)*

## Decided, but explicitly not for v1.7.1

- **AI-pre-drawn farm boundaries.** Keep drawing manual and simple across all markets.
- **UAE national-ID lookup** to pre-fill a boundary from ADAFSA data. *"ADAFSA won't be giving us national IDs"* in this phase.
- **"What to grow next" recommendations** on B15 — they need market-price data Wafra does not have.

## Not mockup changes

Recorded so they are not lost, but nothing in the app follows from them.

- Ship v1.7.1 at **"80%, not 100%"** — straight to **Neil at MMC**, no Mark sign-off, **before lunch tomorrow**, giving MMC ~48 hours before **Thursday's** call. Send the mockup link with implementation notes and suggested workflow patterns.
- First real-world test is a **limited pilot**: Hany's four farmers in Jordan, plus **Dr Abdullah**, head of Estidama.
- Romain to send Mark the **high-quality source images** from the first-run screens, to forward to MMC.
- Mark's presentation to ~60 agricultural companies in **Al-Jouf**; demo rehearsal on an iPad around the **6–8 October Abu Dhabi** event, ahead of the Saudi Agriculture Conference two weeks later. Mark expects GroTech Dubai to be thin.
- Annual **Zoom** subscription to be set up.
