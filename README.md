# Wafra Farm App — interactive UI mockup

An interactive mockup of every screen in the **White Label Farm App Build
Specification v1.1** (`specifications/`). It is user interface and user
experience only: no backend, no real authentication, no real satellite imagery.
Anything that could not be mocked without a server is pretended, visibly and
consistently.

**Live:** enable GitHub Pages (see below) and open
`https://<owner>.github.io/white-label-mockup/`

---

## What is in it

Every screen in the App Map of §3.2, keyed by its specification identifier:

| Group | Screens |
|---|---|
| First run | A1 language picker · A2 welcome · A3 sign up · A4 verify · A5 details · A6 how will you use the app · A7 what do you grow · A8 add farm · A8D draw boundary · A11 farm details · A12 choose plan · A13 you're ready · A14 join a farm · A15 demo mode · log in · reset password |
| Home | B1 my farms · B2 farm detail · B3 fields and plots · B11 farm settings · B12 add farm |
| Plots | B4 plot detail · B5 crop cycles · B6 add/edit cycle · B7 measure viewer · B8 compare |
| Trees | B9 tree list · B10 tree detail (with the locator map) · B13 harvest planning and yield |
| Map | C1 map · C2 layers · C3 plot sheet · C4 compare dates · C5 boundary editor |
| Advice | D1 inbox · D2 irrigation · D3 nutrition · D4 crop protection · D5 harvest · D6 weather · D7 record what you did |
| Tasks | E1 tasks / my work · E2 task detail · E3 new task · E4 complete task · E6 field observation · E7 photo disease check |
| More | F1 reports · F2 team · F3 invite · F4 member · F5 subscription · F6 compare plans · F7–F10 settings · F11 activity log · F12 help · F13 contact · F14 profile |

Plus the cross-cutting layers the specification treats as first-class: the
single upgrade sheet (WF-713), the demo conversion sheet (WF-167), the
offline/queued states (§11), empty, loading and error states (WF-011, WF-012),
and the four-state health scale used identically everywhere (WF-009).

## On a phone, the harness gets out of the way

Open the mockup on an actual phone and there is no picture of a phone: the app
fills the screen, using the device's own notch and home-indicator insets, and
the reviewer controls fold away behind a slim handle on the left edge.

The test is a **coarse pointer on a screen whose short side is 560 dp or less**.
Measuring the short side is what keeps a tablet out — its short side is around
750 dp — while keeping a phone turned sideways in. There is no user-agent
sniffing: it is unreliable, and it answers the wrong question. What matters is
the input device and the amount of room, not the vendor.

The decision runs inline in `<head>` before first paint, so a phone never sees
the harness flash past.

| | |
|---|---|
| `?view=phone` | force the app on its own — also useful on a laptop for presenting, where it renders as a phone-width column rather than a stretched layout |
| `?view=harness` | force the reviewer harness, even on a phone |
| **Auto** in the controls | hand the decision back to the detector |

The choice is remembered. Language, role, plan, connection and demo mode stay
reachable on a phone through the edge handle; device size, zoom and OS text
scaling are hidden there, because the phone already provides all three.

## The reviewer harness

The page around the phone is tooling, not product. It exists because the
specification asks for the same build to be checked under a lot of different
conditions.

Two things stay in the open on the bar: **Device**, because every judgement
about a screen depends on which one you are looking at, and **All screens**,
because that is what a reviewer opens the mockup to do. The other ten controls
are set once and left alone, so they fold behind the **Settings** gear rather
than competing for the same row. On a phone the gear disappears — the whole bar
is already a sheet you raised deliberately from the edge handle, so the controls
sit inline in it.

| Control | Why it is there |
|---|---|
| **Device** | WF-002 makes **360 × 640** the acceptance size — it is first in the list. Nine presets from that baseline up to a Pro Max, each with the right notch, safe areas and platform. |
| **All screens** | A contact sheet — see below. |
| **Zoom** | Fit, or a fixed percentage, so a screen can be read at true size on a laptop. |
| **Text size** | WF-007 — the OS font-size setting up to 200%, to check nothing clips or drops off-screen. |
| **Language** | WF-750 — the five launch languages. Arabic and Pashto mirror the whole interface (WF-751/752). |
| **Role** | WF-030/031 — Owner and Supervisor get five tabs, a Worker three and lands on My Work. The whole menu and every screen respond. |
| **Plan** | WF-712 — switch between the nine plans (and an expired trial) to see locked features appear and disappear. Nothing is hidden; it is locked. |
| **Connection** | WF-791 — online, offline and syncing, with the pending count. |
| **Demo mode** | WF-165/169 — the non-dismissible banner, everything unlocked, the conversion sheet on anything needing an account. |
| **WF ids** | Overlays the requirement identifiers each screen implements, for walking the spec against the build. |
| **Reset** | Puts the fixture data back. |

The panel beside the phone names the screen, what it is for, and which
requirements it implements.

### All screens at once

**All screens** lays the whole build out as a contact sheet: every registered
screen rendered live into its own **360 × 640** tile — the WF-002 acceptance
size, so the sheet is a size check as much as an index — and zoomable from 20%
to 100% with a slider. Click any tile to jump to it.

The tiles are always in **English**, because that is what a reviewer scans for.
Everything else is the live session: switch the harness to Worker, or to an
expired trial, reopen the sheet, and you are looking at what that person can
actually reach.

Two things make it safe to draw sixty screens into a running app. Rendering
happens under `state.ui.preview`, so render-time side effects stand down —
drawing every advice card must not mark them all as read. And tiles render as
they scroll into view, because sixty synthesised satellite rasters at once is a
visible stall. `tools/smoke.mjs` asserts all of that: every tile non-empty,
every tile English, and the session handed back untouched.

## Architecture

No build step, no dependencies, no framework. `index.html` plus ES modules, which
is what makes it deployable to Pages as-is and openable from `file://`.

```
index.html            the harness shell and the phone body
app/
  main.js             boots the app; live route, scroll memory, deep links
  shell.js            composes one screen: banners, bar, dock, tabs, overlays
  harness.js          device presets and the reviewer controls
  screengrid.js       the All screens contact sheet
  imgs/logo.avif      the brand lockup — one file, cropped two ways
  core/
    dom.js            a 60-line hyperscript; the only way an element is built
    store.js          the single mutable place: session, db, nav, ui
    router.js         per-tab back stacks + an overlay layer (mobile semantics)
    i18n.js           t(), direction, bidi isolation (WF-752), fallback (WF-763)
    format.js         §10.4 in one module — units, dates, Hijri, currency
    status.js         WF-009: one definition of the four-state scale
    capabilities.js   WF-670/671: the capability matrix; can(), never role ===
    entitlements.js   §9: plan → feature keys; has(), lock()
    local.js          per-screen scratch state
  data/
    localise.js       WF-761/762: content through the same catalogue as the UI
    farms.json        authored fixtures (farms, plots, trees)
    activity.json     authored fixtures (advice, tasks, team, log, reports)
    content.json      authored fixtures (crops, help, glossary, plan tables)
    *.data.js         generated ES modules — see tools/json-to-module.py
    fixtures.js       derives geometry, imagery dates and time series
    selectors.js      the read layer — scoping and ordering live with the query
    actions.js        the write layer — offline queueing, demo behaviour
  ui/                 component kit, icons, SVG map, SVG charts, boundary editor
    brand.js          the only module that knows what the label looks like
  screens/            one module per group, plus the screen registry
  styles/             tokens, base, components, screens, harness
  i18n/               generated catalogues + the translation sources
tools/                syntax check, smoke test, fixture and catalogue builders
```

`index.html` carries one inline script: the phone-or-harness decision, which has
to run before first paint. Everything else is a module.

Five decisions carry most of the weight:

- **The status scale is a module, not a convention.** `statusChip()` cannot
  render a colour without its icon and its word, so WF-008 holds by construction.
- **A form answers while you are still typing in it.** A text field commits on
  every keystroke, not on blur, so a Continue button enables on the character
  that makes the entry valid rather than when you tap somewhere else. What made
  that impossible before is that a render replaces the DOM wholesale and takes
  focus and the caret with it — so `shell.js` now notes both before the rebuild
  and puts them back after. The re-render stands down mid-composition, because
  three of the five languages are typed through an input method editor and a
  half-formed character must not be thrown away.
- **The ink ramp has a contract, and it is enforced.** `--ink-900` through
  `--ink-500` are text colours and every one clears WCAG AA on both paper and
  canvas; `--ink-400` and below are chevrons, borders and icon strokes, never a
  word to read. The smoke test measures every rendered string, which is how a
  cascade accident that put near-black on the dark green of every primary button
  was found: `.app button { color: inherit }` silently outranked
  `.btn--primary { color: #fff }`, so the rule is now wrapped in `:where()` and
  contributes no specificity at all.
- **Entitlement and capability are questions, never inferences.** Screens ask
  `has('irrigation.schedule')` and `can('task.assign', farm)`. Plan names and
  role names appear in exactly two files.
- **The shell owns the cross-cutting rules.** The demo banner (WF-165), the
  connectivity indicator (WF-791) and the tab badges (WF-032/033) are rendered by
  `shell.js`, so no screen can forget them. It takes the route as an argument
  rather than reading the router, which is what lets the contact sheet compose
  sixty screens with the same code that composes the live one.

### The brand is one module

It is a *white label* app, so the label is configuration. `app/ui/brand.js`
holds the artwork and the two names, and nothing else knows what the mark looks
like; screens ask for `logo('lockup')` or `logo('mark')`. The supplied artwork
is a horizontal lockup — mark, gap, then the bilingual wordmark — and the
compact form is a **CSS crop of the same file**, not a second asset to keep in
step: the image is scaled to the element's height, and the element's width
decides how much of it shows.

Which variant goes where is not arbitrary. The wordmark is set in black, so it
reads on paper (A1, log in, the report letterhead of WF-320) and does not read
on dark chrome. The app bar and the harness bar take the mark alone.

## Running it

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

Opening `index.html` directly from disk also works — everything is a static ES
module, nothing is fetched.

### Development tools

```bash
./tools/syntax.sh                 # parse every module, report the first error in each
npm install && npm run smoke      # render every screen in every role/plan/language
npm run shots                     # the same, writing a PNG per screen to .shots/
npm run catalogue                 # dump the live English strings to app/i18n/source/en.json
npm run i18n                      # merge the translation parts into app/i18n/<lang>.js
                                  #   drops any translation that lost a placeholder
npm run fixtures                  # regenerate app/data/*.data.js from the JSON
```

The smoke test drives every registered screen through three roles, then every
farm, plot, tree, advice item and task, then every plan, every connectivity
state, demo mode and all five languages — about 780 renders — and fails on any
console error or empty render. It then audits every screen at 360 × 640, and
again at 200% text, against WF-002 (nothing scrolls sideways), WF-004 (48 dp
targets), WF-006 (16 sp body text), WF-007 (nothing clipped or pushed
off-screen), WF-010 (one primary action per screen) and colour contrast — WCAG
AA on every rendered string, which the specification does not name a ratio for
but a farm app read in full sun needs. It then types into a form and checks that
focus, the caret and the primary action's enabled state all keep up. Finally it
opens the
contact sheet and checks that all 61 tiles drew, in English, without disturbing
the session that was running underneath.

## Deploying to GitHub Pages

The site is the repository root, so there is nothing to build.

**Option A — Actions (recommended).** `.github/workflows/pages.yml` publishes on
every push to `main`, and can be run by hand from the Actions tab against any
branch while the mockup is under review.
Set **Settings → Pages → Source** to **GitHub Actions**.

**Option B — branch.** Set **Settings → Pages → Source** to *Deploy from a
branch*, pick the branch and `/ (root)`. `.nojekyll` is committed so that Pages
serves the `app/` directory untouched.

Every asset path is relative, so the site works from `/<repo>/` without
configuration.

## What is mocked, and how

| Thing | How it is faked |
|---|---|
| Satellite imagery | Synthesised in SVG: a turbulence basemap plus a per-plot measure raster, seeded on the plot id so the same plot draws identically every time. |
| Measure values | Authored per plot with a 7-day delta; 30 dates of history are derived from them, with genuine gaps so the date stepper of WF-216 has something to skip. |
| Maps and boundaries | The drawing space is 1000 units where 1 unit = 2 m. Area is real shoelace geometry, so the dunum readout of WF-134 moves as you drag a corner, and self-intersection is genuinely detected (WF-137). |
| Tree positions | Every tree gets a point from its row and position on its plot's planting grid, so the distance and bearing on B10 are computed, not written down, and "row 12" means the same place in the list and on the map. |
| The operator's position | One fixed point on the session, shared by the map, the tree locator and "Show me where". The **Location** control switches the permission off, which is a state three screens have to handle (WF-259, WF-132). |
| SMS codes | Any six digits continue; `000000` simulates a wrong code so the five-attempt lockout of WF-120 can be seen. |
| Invitation codes | Any six characters join as a Worker; a leading `S` joins as a Supervisor; `EXPIRE` shows the used/expired message of WF-156. |
| Photos, QR codes | Deterministic placeholders. QR blocks are decoration, not scannable codes — and they exist only for invitations (§4.1). A tree is found by its row and position and by the B10 locator map, never by a code on the trunk. |
| Purchases | The plan chooser changes the session's entitlement. No store, no payment — WF-330 says payment can only happen through the stores. |
| Reports | A shape-of-the-PDF preview and a share sheet toast. WF-316 puts generation on the server. |
| Notifications | A list, with the deep links of WF-656 wired to the objects they name. |

Dates are fixed to **3 August 2026**, the date of the specification, so "6 hours
ago" and "due today" mean the same thing on every visit.

## Deviations from the specification

The build has moved away from v1.1 in six places. Each is a deliberate design
decision made during review, and each needs a corresponding edit to the
specification before the two can be said to agree.

| Where | What changed | What the spec needs |
|---|---|---|
| **B9 / B10, §9** | Trees have no QR codes. The scan action, the per-tree code block and the `tree.qr` entitlement are gone; a tree is found by row and position and by the B10 locator map. Invitation QR (§4.1) is untouched. | **Delete WF-242.** Remove the QR line from the Tree Pro feature list in §9. |
| **B10** | New: a locator map showing where the tree stands relative to the operator, with distance and bearing. | **Add a requirement** under §5.5, or extend WF-241. It is currently unwritten. |
| **C1, §5.8** | The map has no app bar. It is full-bleed to the top edge and every control floats on it. That removes the search field and the List button. | **Redraw the §5.8 wireframe** without the top bar. **WF-263 has no entry point on C1** — either move search onto the map as a floating control, or restate WF-263 as belonging to B9 (tree list), which is where it still lives. |
| **Every screen with an overflow menu** | The ⋮ button carries no caption. Both stores' own apps use it bare, and "More" underneath competed with the screen title beside it. The accessible name is still on the button. | **Qualify WF-014** — "icons carry a text label" should exempt platform-convention glyphs whose accessible name is set, or name ⋮ explicitly. |
| **C1 map controls** | Layers, Compare, Locate and the two zoom buttons are bare glyphs. Captioned, the five pills ran a third of the way across the map and most of the way down it. Each still carries its name for a screen reader and as a tooltip. | **The same edit to WF-014**, extended to map controls — these are the symbols both platforms' own map apps use uncaptioned. If the exemption is written narrowly for ⋮ only, this needs naming too. |
| **Filters (D1, B9, C2)** | Filter chips paint at 36 dp inside a 48 dp touch target, and use a tint rather than a fill. | **Nothing, but worth stating.** WF-004 is being read as "the *target* is 48 dp", not "the control looks 48 dp"; that is the standard reading and it is what makes a filter row possible at 360 dp. Separately, WF-004's "8 dp between adjacent targets" rules out a joined segmented control anywhere in the product — worth confirming that is intended. |

## Known limits

- All 1,286 strings are translated into all five languages, interface and
  advisory content alike (WF-761), but the translations are machine-produced and
  **unreviewed**. WF-760 requires a named reviewer per language before release.
  The coverage bars on F8 read from the live catalogue, and any key that were
  missing would fall back to English and be logged, exactly as WF-763 specifies.
- Pinch-zoom on the map is buttons rather than gestures, since the mockup is
  driven with a mouse as often as a finger.
- The capability and entitlement checks here are client-side by necessity. In the
  product both are resolved server-side on every request (WF-675, WF-715).
