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

Nothing below has been applied. This is the list only.

---

## Page 4 · A1 Language

| # | Where on the screen | The comment |
|---|---|---|
| 1 | The logo | Bigger — the same size as on the next screen |
| 2 | The logo (same note) | *Question:* "I assume the language menu appears only once when the user first downloads the app?" |
| 3 | The Arabic subtitle `اختر لغتك` | Bigger font size, to match the English |
| 4 | The non-Latin rows (العربية, हिन्दी, বাংলা, پښتو) | Same note, second anchor — bigger font size, to match English |
| 5 | The **Continue** button | "We should have two options: Proceed with guided tour / Login / first time registration" |
| 6 | Page-level | The guided tour (A4) should be available after A1, **before** we ask the user to sign in or register |

## Page 5 · A2 Get started

| # | Where | The comment |
|---|---|---|
| 7 | Page-level | "Can A2 be merged with A3?" |

## Page 6 · A3 Log in

| # | Where | The comment |
|---|---|---|
| 8 | The whole identifier → *Send me a code* → **or** → password → *Log in* block | "This menu is confusing: there are currently four permutations: mobile + code, mobile + password, email + code, email + password. Can we limit to only two? Mobile + code / Email + password" |
| 9 | "At least 8 characters" under the password field | Not needed — at this point the user has already created a password that meets our requirements |
| 10 | "Fingerprint unlock is available on this device." | "Do you mean face recognition? I assume this function is provided by the phone operating system? There is no point in telling him it's available. **Remove this advisory.** We should ask him if he wants face ID when he first creates an account." |
| 11 | The empty area below the forgot-password link | "Move these functions here from A2" — i.e. Create an account and Join a farm |
| 12 | The Join-a-farm entry inside that area | Label it "Join a farm as a guest" |
| 13 | Page-level | "Can A2 be merged with A3?" (repeat of 7) |

## Page 7 · A4 Guided tour

| # | Where | The comment |
|---|---|---|
| 14 | Tour card 1, title and body ("Your farm from above" / "Our survey finds your fields…") | Replace with: **"Enhancing your farm profitability through precision agriculture"** / "Our solution helps you increase crop yields and reduce input costs by optimizing crop scheduling, monitoring plant health, applying fertilizers based on soil nutrient levels, and improving irrigation efficiency." |
| 15 | Page-level | Tour available after A1, before sign-in/register (repeat of 6) |

## Page 8 · A5 Create your account

| # | Where | The comment |
|---|---|---|
| 16 | "OTP verification required." under the mobile field | Remove "OTP"; change to **"Verification required"** |
| 17 | The **Send OTP to mobile number** button | Change "OTP" to "code" |
| 18 | The password hint | Add: "(password should include at least one letter, one number and one special character)" |

## Page 9 · A6 Verify code

| # | Where | The comment |
|---|---|---|
| 19 | The title "Enter OTP sent to +966 5X XXX XXXX" | Change "OTP" to "code" |

## Page 10 · A9 Add your farm

| # | Where | The comment |
|---|---|---|
| 20 | The land-unit chips **Dunum / Hectare** | Switch — hectare should come before dunum |
| 21 | "Trace each plot and give it a name" on the *Draw my own plots* card | To be consistent with the farm boundary, change "Trace" to "Draw" |
| 22 | "Two ways to get started. Both give you the same result." | Move down |
| 23 | Page-level | Show another screenshot with the full text of the *Draw my own plots* card — this one is cut off at the bottom |

## Page 11 · A10 Your farm boundary

| # | Where | The comment |
|---|---|---|
| 24 | "…No need to include greenhouses, warehouses or other structures." | Remove ", warehouses" |

## Page 12 · A9D Draw my own plots

| # | Where | The comment |
|---|---|---|
| 25 | The **Plot area / 51.6 ha / Updates as you move the corners** block | Remove. This value should appear when we provide a quote |
| 26 | The subtitle "Trace your plot boundary" | Change to: "Draw your plot boundary. Each plot should preferably correspond to a single crop." |
| 27 | The flow strip, at A12 | Delete A12 for individual plots and replace it with A11, to show a plot summary for the user to approve. A11 applies to both scenarios — whole farm and individual plots |

## Page 13 · A12 What should our satellite survey?

| # | Where | The comment |
|---|---|---|
| 28 | The heading line "What should our satellite survey?" | **Delete** — the box is drawn over the heading itself, immediately above "Tell us what you want to monitor on your farm." Read alongside note 31, this is the heading going, not the screen |
| 29 | The *Field crops* examples | Change to: "wheat, alfalfa, Rhodes grass, tomato, melon, onion, potatoes, cucumber, eggplant, etc." |
| 30 | The **Send a quote** button | Change "Send" to "Request" |
| 31 | Page-level | A12 is needed after A10 (for a farm) but not after A9D (for plots) — each plot is by definition a single crop |

## Page 14 · A11 What we found

| # | Where | The comment |
|---|---|---|
| 32 | The header ("What we found" / "Tabuk River Estate") | Put the farm name in bold at the top; the line below, unbolded, should say "Summary of plots to be monitored." |
| 33 | "We found 8 plots inside your boundary. Keep what looks right, and adjust anything we got wrong." | Change to: "We found 8 plots inside your farm." |
| 34 | The Remove / Edit pair on a plot row | Each plot should have three options: **Keep, Edit, Remove** |
| 35 | "23.7 ha" on a plot row | To be consistent with a small farm size, each area shown for illustration should be less than 10 ha |
| 36 | The bottom of the plot list and its footer action | Replace with an option to add a missing plot |
| 37 | Page-level | Both search options — whole farm and individual plots — should end up on this page |

## Page 15 · A13 Your plan

| # | Where | The comment |
|---|---|---|
| 38 | "30 days free, on either plan" | Change to: "30 days free trial" |
| 39 | "Nothing is taken until the trial ends, and we ask you before it is." | Change to: "We will seek your authorization before charging your bank card at the end of your free trial." |
| 40 | The "Your farm" card heading | Change to: "Cultivated areas to be monitored" |
| 41 | "12.4 ha × SAR 40.01" | Delete. As we have a mix of crops (by ha) and trees (by unit), we are not able to show a cost per ha |
| 42 | "Or SAR 5,061 a year — 15% off, paid once, for twelve months." | Delete. We can show this on the payment page |
| 43 | Bottom of the screen | Add a button back to A11 so the user can modify the plots: "Click here to modify the list of plots." |
| 44 | Page-level | Show a second screenshot with the "Pro" plan card |

## Page 16 · A14 You're ready

| # | Where | The comment |
|---|---|---|
| 45 | The body copy ("Farm 1 is being added to our satellite watchlist…") | Change to: "Farm 1 has been added to our account. We will notify you when the farm monitoring results are available (usually within one day)." |
| 46 | Below **Go to my farm** | Add a second button: "Add another farm." |

## Page 17 · A15 Join a farm

| # | Where | The comment |
|---|---|---|
| 47 | The **K** key on the keypad | "Not needed?" |
| 48 | The helper paragraph under the keypad | Change to: "Enter the invitation code or scan the QR code sent to you by the person who set up this service." |
| 49 | The title "Join a farm" | Add "as a guest" |

## Page 18 · FORGOT Reset your password

| # | Where | The comment |
|---|---|---|
| 50 | "We will send **an OTP** to your registered mobile number: …" | Change to: "a code to reset the password:" |
| 51 | The **Send OTP** button | Change to: "Send code" |

---

# Proposal — the login and registration flow

The comments about the front door pull in two directions at once, and it is
worth separating what he wants from how he has expressed it.

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

- Note 5 asks A1 for two buttons, one of which is "Login / first time
  registration". That single label covers two different jobs. A returning
  farmer and a brand-new one need different first screens, and a language
  picker is the wrong place to make them choose: you cannot press either button
  until you have picked a language, so the screen already has a natural single
  next step.
- Note 8's "four permutations" is a symptom of the layout, not of the feature
  set. A3 shows one free-text field labelled *Mobile number or email* with two
  submit buttons under it, so the eye reads a 2 × 2 matrix. There are really
  only two routes, and they are already the two he names.
- Notes 11 and 13 ask for A2's contents to move onto A3 — but A3 is titled
  *Log in*, which is exactly the screen a first-time registrant should not be
  landing on. The fix is not to move three doors onto a login form; it is for
  the login form to be the front door with signup and guest access underneath,
  which is what almost every app does.

## The flow I would build instead

```
FIRST RUN
  A1  Language            →  A4  Guided tour (Skip →)  →  A3  Log in
                                                            ├─ Send me a code       → A6 → the app
                                                            ├─ Use email and password → the app
                                                            ├─ Create an account     → A5 → A6 → A9 …
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

### A1 · Language — one button, not two

Keep the single **Continue**, and let it lead to the tour. This delivers note 6
and note 5's intent — the tour comes before anyone is asked to identify
themselves, and skipping it lands on the login screen — without asking a farmer
to choose his route on the screen where he is choosing his language. It also
answers note 2: yes, first run only. The screen never appears again; the
language lives in Settings and in A3's app bar.

The tour is first-run only too, on the same flag. A returning farmer who has
logged out sees A3 immediately.

Also apply notes 1, 3 and 4 — logo at A2's size, and the Arabic subtitle and
the non-Latin rows sized to sit level with the English.

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
  time?"* with **Enable** / **Not now**. If enabled, A3 opens with the number
  pre-filled and a Face ID button above *Send me a code* — a control the farmer
  can press, not a sentence telling him his phone has a feature.

### A5 · Create your account — unchanged in shape

Reached from A3's footer, and from nowhere else. Same fields. Copy per notes
16, 17 and 18, and the new biometric question lands after A6 rather than here,
so account creation stays one screen and one keyboard.

### A6 · Verify code — one screen, three callers

Registration, login-by-code and password reset all end here. Only the
destination differs. Copy per note 19 — and "OTP" should not survive anywhere
in the app, including A5's button and the reset screen (notes 16, 17, 50, 51).

### A15 · Join a farm as a guest

Title and helper text per notes 48 and 49. On note 47 — the **K** key is there
because the mockup keys the joining role off a letter. Make invitation codes
six digits, drop the letter key, and let the mockup read the role from the
first digit instead. A numeric keypad that only accepts numbers is honest about
what it wants; a keypad with one letter on it is not.

### What this costs

One screen deleted (A2), no screen added — the email-and-password route is an
in-place swap on A3. Registration is unchanged in length. A returning farmer
reaches the code field in one tap from launch instead of two.
