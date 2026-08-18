# Everything changed in this round, screen by screen

The work of one session: actioning the thirty comments on
`Marks_Comments_on_MockUp_Update_180826.pptx`, plus the three corrections that
came back on the first pass.

Baseline `1e89559`. Every change below is on `claude/powerpoint-comments-review-cav3ou`.

| Where | What moved |
|---|---|
| [First run](#first-run) | A5, A6, A7 (deleted), A9, A12, A9D, A10, A3, FORGOT |
| [Elsewhere](#elsewhere-in-the-app) | B12, and every screen that names a plot |
| [New sheet](#new-sheet) | Find your land |
| [Shared parts](#shared-components) | App bar, boundary editor, inline links, the farm fork |
| [Data, strings, tools, docs](#data-strings-tooling-and-documents) | Fixtures, translations, the smoke test, the review-document builder |

---

## First run

### A5 · Create your account

| Change | Detail |
|---|---|
| "Your name" added | Required, first field on the form. Moved from A7 (WF4.041). |
| "Create a password" added | Required, at least 8 characters, with the show/hide control (WF4.042). Moved from A7. |
| Mobile hint rewritten | "OTP verification required." |
| Email hint rewritten | "Farm reports are sent to this email address." |
| Terms line spacing fixed | The two links no longer push their lines 24 px apart. They keep the full tap box; only its effect on the line height is cancelled. |
| Sign-in paragraph deleted | "You can sign in afterwards with either the number or the address…" is gone. |
| Worker note kept | "Workers you invite sign in with a short code — no password needed." (WF4.044), carried over from A7. |
| Button relabelled | "Send OTP to mobile number", enabled only once name, number, address, password and the tick are all answered. |

### A6 · Verify code

| Change | Detail |
|---|---|
| One sentence, not two | The heading and the line beneath it are now a single title: "Enter OTP sent to +966 5X XXX XXXX". The app bar gained a `wrap` option so a whole sentence can sit in it. |
| Four digits | Four cells, auto-submitting on the fourth; `0000` is the wrong-code sentinel. **WF4.038 is updated to four digits** — the README carries the reasoning and the one constant (`OTP_LENGTH`) to change if six is ever required. |
| The screen knows where it came from | It is reached from three places, so the route now says which: `A6` from registration goes on to A9, `A6:login` opens the app, `A6:reset` returns to choose a password. |

### A7 · Your details and units — **deleted**

The screen is gone from the flow, the registry and the harness index. Nothing in
§4.8 was dropped; the screen that carried it was:

- **WF4.041, WF4.042, WF4.044** (name, show/hide, workers need no password) → **A5**
- **WF4.043** (land unit, pre-selected from the country) → **A9**
- **WF4.045** (Create an account makes you an Owner) → the signup branch of **A6**

### A9 · Add your farm

| Change | Detail |
|---|---|
| Land unit asked here | "How do you measure land?" — Dunum or Hectare, pre-selected from the country, with the note about changing it in Settings. |
| Lead trimmed | "Two ways to get started. Both give you the same result." |
| Survey card subtitle | "Draw your farm boundary, and our satellite will automatically detect cultivated plots and trees." |
| Survey card, first bullet | "Choose this option if you want to survey field crops, date palms and fruit trees on your farm." |
| Survey card, second bullet | "You will have an option to add or delete plots after our satellite survey." |
| No "Choose this option" button | Added on the first pass, then removed: the comment was about the bullet wording, which is already there. The whole card is the tap target, as before. |
| One fork, two screens | Both cards now come from a shared component that B12 also uses. |

### A12 · What should our satellite survey?

| Change | Detail |
|---|---|
| Title | "What should we cover?" → "What should our satellite survey?", in the app and in the screen registry. |
| Field crops | "Priced per area. For example: wheat, alfalfa, Rhodes grass, okra, eggplant, potatoes, melon, etc." |
| Date palms and fruit trees | "Priced per tree. For example: dates, olives, citrus, mango, pomegranate." |
| Both | "One subscription covering field crops, date palms and fruit trees." |
| Farm name moved up | Now the first thing on the screen, above the three options, labelled "Name your farm". |
| Placeholder reads Farm 1 | The automatic name counts the farms the *account* holds — none during registration, whatever the demo database carries. Only the in-app Add farm route numbers from what is there. |
| Numbering note deleted | "Leave it blank and we number it for you." is gone; the placeholder already shows it. |

### A9D · Draw my own plots

| Change | Detail |
|---|---|
| Two-line app bar | "Farm 1 · Plot 1" over "Trace your plot boundary". |
| Area labelled | "Plot area", with "Updates as you move the corners." underneath. The figure always followed the shape; nothing said so. |
| Field label | "Call this plot" → "Name this plot", here and in the rename sheet. |
| Placeholder and defaults | "P1" → "Plot 1". |
| Optional note deleted | "Optional. Leave it and we number it for you." is gone. |
| Search bar | Now a real control, opening the Find your land sheet. |

### A10 · Survey my whole farm

| Change | Detail |
|---|---|
| Two-line app bar | The farm name over "Trace your farm boundary". |
| Area labelled | "Farm area", with the same live note. |
| Boundary colour | Blue, against the green used for plots. Brown was the other suggestion; the basemap is tan desert soil and a brown line is lost in it. |
| Help text | "Draw your farm boundary to cover open fields and tree areas. No need to include greenhouses, warehouses or other structures." This reverses the old instruction, which asked for buildings to be included. |
| Search bar | The same Find your land sheet. |

### A3 · Log in

Sending a code now goes to `A6:login`, which opens the app. Before, a returning
user logging in with a code was routed into farm creation. Its password field
uses its own string keys rather than A7's.

### FORGOT · Reset your password

Three steps of its own now that A7 is gone: identifier → code → new password. It
used to borrow A7 for the last step, so a returning user was asked for his name
again on the way to changing his password.

---

## Elsewhere in the app

### B12 · Add a farm

Draws A9's pair of route cards instead of its own copy of them. The two screens
had drifted into describing the same choice in different words.

### Every screen that names a plot

`P1` became `Plot 1` throughout — the 32 plots in the fixtures, the labels a
survey returns, the names drawn plots are given, and therefore B3, B4, Home,
advice, tasks and reports. One convention, so no screen shows both.

---

## New sheet

### Find your land

Behind the search bar on A9D and A10. Three ways in, because nobody knows their
coordinates:

- Search on the map
- Enter a town or locality
- Use my current location

---

## Shared components

| Component | Change |
|---|---|
| `appBar` | New `wrap` option, for a title that is a whole sentence (A6). The existing `subtitle` carries the second line on A9D and A10. |
| `boundaryEditor` | New `tone` option — `plot` (green) or `farm` (blue). C5, which edits plot boundaries, stays green. |
| `.textlink` | Inside a tick-box label, the vertical padding no longer takes up room in the line. Links standing on their own line keep the full box. |
| `farmRouteCards()` | The A9 fork, exported so B12 shares it. `fresh: true` clears the draft for a farmer who already has farms. |

---

## Data, strings, tooling and documents

**Fixtures.** `farms.json` plot names renamed, `*.data.js` regenerated.

**Translations.** Seven keys moved screen and took their Arabic, Hindi, Bengali
and Pashto with them. Seventeen keys were reworded by this round and their
translations were dropped rather than left saying the old thing plausibly; those
fall back to English and are logged (WF10.014). Coverage is now 1,364 of 1,403
strings in each of the four languages.

**Smoke test.** New assertions for A5's name and password fields and A6's four
cells; the walk that collects the string catalogue now also visits the states
behind a single screen id (`FORGOT:password`, `A6:login`, `A6:reset`), which is
where four of the new strings live.

**Review-document builder.** `--data` and `--out` so each review round gets its
own document; a deleted screen is now drawn as "Deleted by this review" rather
than photographed as an error page; and each sheet names the screen it is shot
over, so Find your land no longer appears above Home, which cannot open it.

**Documents.**

- `docs/PowerPoint_Comments_180826.md` — comment by comment, what each produced.
- `docs/PowerPoint_Comments_180826.pdf` — the same as before/after screenshots.
- `README.md` — screen map, the registration chapter, the requirements section,
  the plot-naming convention, string counts and the tooling block.

---

## Corrections made after the first pass

1. The "Choose this option" button was removed from A9's cards. The comment was
   about the wording of the bullet, not a control.
2. The Find your land sheet was being photographed above Home in the PDF. In the
   app it is only reachable from A9D and A10; the document builder was opening
   every sheet over Home for convenience.
3. The PDF's prose was rewritten. It reported each change and then landed a
   flourish, twenty times over. It now states what changed and stops, giving a
   reason only where one is owed — the four-digit code, the boundary colour, the
   reversed drawing instruction, the deleted screen.

---

## Checks

`./tools/syntax.sh` — every module parses, every stylesheet balances.

`node tools/smoke.mjs` — 839 renders across three roles, no console errors, no
empty renders, no side effects from the screen grid.
