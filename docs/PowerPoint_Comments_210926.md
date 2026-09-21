# The comments on the v1.7.0 deck — 21 September

Every mark on `Wafra_Farm_App_Screens_v1.7.0_Mark.pptx`, traced back to the thing
it points at. The reviewer is **Mark Webster**; the file's change log is dated
20 September 2026. The deck carries no PowerPoint comment threads — all of the
review is drawn onto the slides.

What is on the pages:

- **52 yellow boxes** — the instructions. Almost all of them have a red leader
  line to the exact element they are about.
- **9 blue boxes** — questions and context. These are not instructions; six of
  them need an answer from Mark before they become work.
- **47 red frames** and **52 leader lines** joining the two.
- **2 full-slide strike-throughs** — a red line corner to corner, meaning delete:
  the old A9E (p14) and FORGOT (p25).
- **4 titles recoloured**. Red means the screen goes (p14). Green means the
  screen is new or renamed: p16 is a **new A9E**, p18 renames A13, p19 is a
  **new screen A13B**, p26 was touched but its text is unchanged.
- **3 pasted crops from our own screens**, used to show where a control should
  go: the A5 "Send code by SMS" button dropped onto A3 (p24) and A15 (p26), and
  the A3 "We are here to help" block dropped onto A6 (p13).
- **1 new photograph** for the A4D strip, saved here as
  `docs/assets/A4D-new-photo-strip-210926.png`.

The deck has 68 pages. Pages 32 to 68 — everything from B13 onward, so all of
Map, Advice and More — carry no marks at all. The review stops at B6.

**61 rows below.** Page numbers are pages in the marked deck.

## The three threads running through the review

**Passwords go away.** This is the largest single change and it touches six
screens. Mark raises it on the cover, again on A5, again on the Log in divider
and again on A3: *"It seems that many apps are doing away with password. It is
either face ID or OTP."* Following it through: A5 loses its password field, A3
loses its password block for a "Send code by SMS" button, FORGOT has nothing
left to reset and is struck through, and A15 joins by code rather than by a
Join button. He knows this reverses an earlier decision and says so.

**The price screens are reorganised.** Today the order is A9 → A9E → A10 → A13.
Mark wants A10 → A10B → A11 → A13 (his blue box on p17), the old A9E deleted,
and a **new A9E** built out of the A13 plan layout — showing the plans and an
estimate, with no plan to pick yet and no commitment. A13 then splits in two:
A13 monthly, and a new **A13B** annual, with a checkbox toggling between them.
Both get wording that matches how Apple and Google actually bill.

**QR codes leave the first version.** *"QR code seems complicated for first
version. I don't want to delay MMC."* This lands on A15, where the QR button
and the line about it both go.

---

| SCREEN CODE | CHANGE NECESSARY |
|---|---|
| **Project** · p1 | *Question (blue).* *"Based on our group call with Neil, I wasn't sure who is paying for the free trial. MMC or Wafra. I will clarify with Neil. If we are paying, then we will reduce the trial window to two weeks."* If the answer is Wafra, the **30 days free trial** becomes **14 days** — `a13.trial` in `en.json`, and everywhere the trial length is shown: A13, the new A13B, F5 and F6. |
| **Project** · p1 | *Question (blue).* *"I'm struggling with the password. It seems that many apps are doing away with password. It is either face ID or OTP. What do you think?"* This is the thread that drives the A5, A3, FORGOT and A15 rows below. Answer it once and the six screens follow. |
| **A1** · p4 | *Info.* Line to the Wafra Greentech lock-up: *"FYI, Hannah is getting the stacked logo sorted out."* New artwork is coming. No code change now — swap `app/imgs/logo.avif` when the file arrives. |
| **A4B** · p8 | Frame round the word **fertilization** in the heading *"Irrigation and fertilization advice"*: *"Move to next line."* The heading currently breaks as *"Irrigation and fertilization / advice"*. Break it as *"Irrigation and / fertilization advice"* instead. (`a4.advice.h`) |
| **A4D** · p10 | Frame round the five-photo strip at the top of the card: *"Update picture (sent separately). No need for black frame."* The replacement strip is pasted on the slide and saved at `docs/assets/A4D-new-photo-strip-210926.png` — lettuce rows, green figs, a crop field, date palms, potato rows. Use these five photographs and drop the black dividers between them. |
| **A4D** · p10 | Frame round **in farm** in *"Potential increase in farm profitability"*: *"Move to next line."* Break it as *"Potential increase / in farm profitability"*. (`a4.stat.profit`) |
| **A4D** · p10 | Line to the figure **10–25%**: *"Add + sign."* It becomes **+10–25%**. (`onboarding.js:600`) |
| **A4D** · p11 | *"Something is missing visually to connect above and below the triangle. What about adding gray box?"* The three benefits, the small downward triangle and the profitability figure read as three loose pieces. Wrap them in one grey container so the funnel is visible. |
| **A4D** · p11 | *Deck note.* *"Repeated slide."* A4D appears twice, on p10 and p11. This is a fault in our deck generator, not in the app — `tools/screendeck.mjs` emits the page twice. |
| **A5** · p12 | Frame round the **First name / Last name** row: *"Arabic names can be quite long. Is it best to stacked the two entries?"* Stack the two fields vertically instead of side by side. |
| **A5** · p12 | Frame round *"We send a code to this number to check it."*: change to **"A verification code will be sent to this number."** |
| **A5** · p12 | Frame round the **Create a password** field: *"It seems many apps are doing away with passwords. Shall we only use SMS codes to authenticate users? I realize I'm changing something we agreed on earlier."* Remove the password field, its rule line and its show/hide eye. Sign-up authenticates by SMS code only. |
| **A6** · p13 | Frame round *"Your keyboard opens when you tap the first box, and can fill the code in from the message."*: *"Delete. This is an automatic phone feature."* |
| **A6** · p13 | *"Add our contact into."* He has pasted the A3 help block onto the bottom of A6. Add **"We are here to help."** with the **WhatsApp** and **Email** buttons to A6, the same block A3 and FORGOT already carry. |
| **A9** · p14 | Frame round the heading *"Create your first farm"*: change to **"Tell us about your farm"**. |
| **A9** · p14 | Frame round the label *"Approximate area"*: change to **"Approximate cultivated area"** — *"(we don't want the user to give us the entire farm area)"*. (`a9.area`) |
| **A9** · p14 | *Question.* Frame round the area input, whose placeholder is `0`: *"If we allow decimals, should the example show 0.0?"* |
| **A9** · p14 | Frame round the hint *"Fill in whichever you have. A rough number is fine — we will confirm it with a real survey."*: *"Replace with a discrete button that says: 'I'm not sure'. In this case, clicking on 'Continue' takes him to A10 for the automated farm survey."* The hint text goes; a quiet secondary button takes its place. (`a9.hint2`) |
| **A9E** · p14 | **Delete this screen.** The whole slide is struck through corner to corner and labelled *"Old A9E Slide"*. The price-estimate screen as built — the SAR 716–1,074 range and the three "what happens next" rows — goes. |
| **A9E** · p16 | **Rebuild A9E from the A13 plan layout**, labelled *"New A9E Slide"*. Mark duplicated the A13 page and retitled it in green as A9E. It shows the two plans and their prices as an estimate, with nothing to choose and nothing to confirm. The six rows below are his marks on that rebuilt screen. |
| **A9E** · p16 | Frame round the header *"Your plan"*: change to **"Available service plans"**. |
| **A9E** · p16 | Frame round *"Priced on what you told us: 12.4 ha · 220 date palms and fruit trees. We will adjust it to whatever the survey actually finds."*: change to **"Estimated cost based on 12.4 ha and 220 trees. We will give you a final quote once we complete the automated farm survey."** |
| **A9E** · p16 | Frame round the radio buttons on the BASIC and PRO cards: *"Remove buttons. Not needed at this point."* The plans are shown, not chosen — the choice happens later on A13. |
| **A9E** · p16 | Frame round the **30 days free trial** block and the line *"When you confirm, we send your boundary for satellite survey and AI analysis."*: replace both with **"Once you have reviewed the plan features and cost, we can proceed with the next steps:"** followed by four steps — *You tell us the location of your farm · Our platform automatically surveys your farm · We send you a final quote · You select the service plan you want.* He pasted checkmark icons beside three of them and labelled them *"Checkmark icon"*, so each step carries a checkmark. |
| **A9E** · p16 | He has typed **"I'm not interested"** onto the screen below the main button — a new secondary exit. *"If user clicks on 'I'm not interested', bring him to a page that gives him the following options: Not what I'm looking for · Too complicated · Too expensive · Other reason: — Our contact info (WhatsApp and email) should be at bottom."* This is a **new screen** as well as a new link. |
| **A10** · p17 | *Context (blue).* *"Sequence: A10, A10B, A11, A13."* The plan-and-price screen moves back to **after** the survey. Today A10's button hands straight to A13; it should hand to A10B, then A11, and only then A13. This reverses the third pass of the 13/09 review — see `app/meta.js:214`. |
| **A10** · p17 | Frame round the title bar showing *"Farm 1"*: change to **"Locate your farm"**. |
| **A10** · p17 | Frame round the subtitle *"Draw your farm boundary"*: *"Text is very small and easy to miss. Farmer may not know how to proceed. Should 'draw your farm boundary' appear on the map (at top of map or in the middle of the polygon) in bigger font?"* Move the instruction onto the map itself, and make it bigger. |
| **A10** · p17 | Frames round the **Find your farm** search field and the **Use my current location** button, which sit at opposite ends of the screen: *"These are two equivalent options that should be side by side. The user can pick one or the other. Can we put both boxes at top, with: 'Option 1: Search on GoogleMaps' / 'Option 2: Use my current location'."* |
| **A10** · p17 | Frame round the **Continue to survey** button: change to **"Get quote"**. (`a10.request`) |
| **A10B** · p20 | *Question (blue).* *"What happens when the user click the green button? Does the app take him to A13 (without cost), and he waits until the cost is calculated and is displayed?"* Needs an answer before the button below is wired. |
| **A10B** · p20 | Frame round the word **Analysis** in *"Analysis in progress"*: change to **"Survey"**, so the heading reads **"Survey in progress"**. (`a10b.title2`) |
| **A10B** · p20 | Frame round both body paragraphs — *"Our satellite is reading Farm 1, and our AI model is working out what is growing there."* and *"Check back later. We will let you know as soon as the results are ready."* Replace both with **"We will notify you when the survey is completed. Please keep the app open to see available service plans."** |
| **A10B** · p20 | Frame round the **Go to my farm** button: change to **"Go to service plans"**, and it goes to **A13**, not Home. (`a10b.home`) |
| **A13** · p18 | **Rename the screen** to *"Your **monthly** plan and price for new users"* — he recoloured the word "monthly" green in the title. A13 is now the monthly half of a pair with the new A13B. |
| **A13** · p18 | Frame round the header *"Your plan"*: change to **"Monthly service plans"**. (`a13.title`) |
| **A13** · p18 | Frame round *"Priced on what you told us: …"*: change to **"The service plans are based on 12.4 ha and 220 date palms and fruit trees."** (`a13.basis.estimate`) |
| **A13** · p18 | Line ending below the plan cards: *"Add a checkmark that says: 'Show me the annual plan to get two months free each year.'"* A checkbox under the cards that switches to **A13B**. |
| **A13** · p18 | Frame round the trial block — *"No charge today. We will ask before your card is charged, once the trial ends."* and *"When you confirm, we send your boundary for satellite survey and AI analysis."*: *"The language should reflect how the Apple/Google payment plans work. We don't charge a credit card, as the subscription is through Apple/Google."* Change to **"At the end of your free trial, we will ask for your permission before starting your paid subscription. You can cancel your subscription renewal anytime through your iPhone."** — and *"Use equivalent term (Google Store?) for Android device."* (`a13.trial.permission4`, `a13.thenwhat`) |
| **A13** · p18 | Frame round the **Confirm and start survey** button: change to **"Start free trial"**. (`a13.confirm.survey`) |
| **A13B** · p19 | **New screen — the annual twin of A13.** Green title *"A13B · Your annual plan and price for new users"*. Blue box: *"Repeat of A13 with annual service plan. Note that MMC changed discount plan. User can togle back and forth."* Note: A13B was added and withdrawn once before, for a different purpose — see `app/meta.js:363`. The letter is reused here for the annual plan. |
| **A13B** · p19 | Frame round the header *"Your plan"*: change to **"Annual service plans"**. |
| **A13B** · p19 | Frame round *"Priced on what you told us: …"*: change to **"The service plans are based on 12.4 ha and 220 date palms and fruit trees."** |
| **A13B** · p19 | Frames round **month** in both *"SAR 716 / month"* and *"SAR 1,074 / month"*: change to **"year"**. The annual discount is MMC's new one — the exact rate needs confirming. |
| **A13B** · p19 | *"Add a checkmark that says: 'Show me the monthly plan.'"* The mirror of A13's checkbox, switching back. |
| **A13B** · p19 | Same Apple/Google trial wording as A13: **"At the end of your free trial, we will ask for your permission before starting your paid subscription. You can cancel your subscription renewal anytime through your iPhone."** |
| **A13B** · p19 | Frame round the **Confirm and start survey** button: change to **"Start free trial"**. |
| **Log in** · p23 | *Question (blue), on the section divider.* *"QR code seems complicated for first version. I don't want to delay MMC. What do you think?"* Taken together with the A15 rows below, QR leaves v1. |
| **A3** · p24 | *Question (blue).* *"If Face ID doesn't work, isn't it simpler just to issue an SMS code? Ir seems apps are moving away from passwords."* |
| **A3** · p24 | Frame round the whole block — the password field, *Switch account*, *Forgot your password?*, **Log in** and *Send code by SMS instead*. He has pasted our own A5 **Send code by SMS** button over it: *"Replace with 'Send code by SMS' button."* One button where five controls are today. |
| **FORGOT** · p25 | **Delete this screen.** Struck through corner to corner, blue box: *"Delete?"* With no password there is nothing to reset. A3's *"Forgot your password?"* goes with it, and the A3 → FORGOT → A6 journey in `app/screens/index.js:423` needs removing. |
| **A15** · p26 | *Question (blue).* *"Where do we ask for guest's preferred language?"* A guest joining by invitation never passes A1B, so nothing ever asks. |
| **A15** · p26 | Frame round *"Enter the invitation code or scan the QR code on the phone of the person who set up this account."*: change to **"Enter the invitation code. If you do not have one, ask the account owner to send you one."** (`a15.enter`) |
| **A15** · p26 | Frame round the single **Your name** field: *"We should ask for: First name / Last name / Phone number."* Three fields in place of one. (`a15.name`) |
| **A15** · p26 | Frame round the **Your email** field: *"Email not needed."* Delete it. (`a15.email`) |
| **A15** · p26 | *"Delete."* One note, two frames: the **Scan QR code** button and the line *"No invitation code? Ask the account owner to create one for you."* Both go — the second is replaced by the new intro line above. (`a15.scan`, `a15.nocode`) |
| **A15** · p26 | Frame round the **Join** button, with the A5 button pasted over it: *"Replace with 'Send code by SMS' button."* The guest is verified by code like everybody else. (`a15.join`) |
| **B2** · p28 | Frame round the **Set the new crop** chip on Plot 2: change to **"Set new crop"**. |
| **B5** · p30 | Frame round the Hijri date **24 Sha'ban 1447** beside *Planted 12 Feb 2026*: *"Since we are now selling this across multiple jurisdictions, we can delete Hiji calendar from the app."* Remove the Hijri date everywhere it is paired with a Gregorian one, not only here. |
| **B6** · p31 | Frame round the amber banner *"This plot already has an open cycle: Tomato, started 12 Feb 2026 - 24 Sha'ban 1447. Close it first by recording a harvest date and, optionally, a yield."*: change the instruction to **"Close it out before entering a new crop for this plot."** (Marked twice on the page — the same note also has a line to the *New crop cycle* heading, which looks like a stray anchor.) |
| **B6** · p31 | *Question.* Frame round the **Target yield** field: *"Won't our system forecast the yield? Do we need the user to enter this information?"* If the forecast is ours, the field goes. |

---

## What needs an answer before it can be built

Six rows are questions, not instructions. They are worth putting to Mark
together, because four of them are really one decision:

1. Who pays for the free trial, and is it 30 days or 14? (p1)
2. Passwords — confirmed gone? This settles A5, A3, FORGOT and A15 at once. (p1, p12, p23, p24)
3. Decimals on A9's area field — does the placeholder show `0.0`? (p14)
4. Where a guest chooses their language. (p26)
5. What A10B's button does while the price is still being worked out. (p20)
6. Whether we forecast target yield, which decides if B6 keeps the field. (p31)

And two things are needed from Mark before the work is complete: the **new logo
file** from Hannah (p4) and **MMC's annual discount rate** for A13B (p19).
