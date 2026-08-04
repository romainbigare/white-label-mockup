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
| Trees | B9 tree list · B10 tree detail · B13 harvest planning and yield |
| Map | C1 map · C2 layers · C3 plot sheet · C4 compare dates · C5 boundary editor |
| Advice | D1 inbox · D2 irrigation · D3 nutrition · D4 crop protection · D5 harvest · D6 weather · D7 record what you did |
| Tasks | E1 tasks / my work · E2 task detail · E3 new task · E4 complete task · E6 field observation · E7 photo disease check |
| More | F1 reports · F2 team · F3 invite · F4 member · F5 subscription · F6 compare plans · F7–F10 settings · F11 activity log · F12 help · F13 contact · F14 profile |

Plus the cross-cutting layers the specification treats as first-class: the
single upgrade sheet (WF-713), the demo conversion sheet (WF-167), the
offline/queued states (§11), empty, loading and error states (WF-011, WF-012),
and the four-state health scale used identically everywhere (WF-009).

## The reviewer harness

The page around the phone is tooling, not product. It exists because the
specification asks for the same build to be checked under a lot of different
conditions:

| Control | Why it is there |
|---|---|
| **Device** | WF-002 makes **360 × 640** the acceptance size — it is first in the list. Nine presets from that baseline up to a Pro Max, each with the right notch, safe areas and platform. |
| **Zoom** | Fit, or a fixed percentage, so a screen can be read at true size on a laptop. |
| **Text size** | WF-007 — the OS font-size setting up to 200%, to check nothing clips or drops off-screen. |
| **Language** | WF-750 — the five launch languages. Arabic and Pashto mirror the whole interface (WF-751/752). |
| **Role** | WF-030/031 — Owner and Supervisor get five tabs, a Worker three and lands on My Work. The whole menu and every screen respond. |
| **Plan** | WF-712 — switch between the nine plans (and an expired trial) to see locked features appear and disappear. Nothing is hidden; it is locked. |
| **Connection** | WF-791 — online, offline and syncing, with the pending count. |
| **Demo mode** | WF-165/169 — the non-dismissible banner, everything unlocked, the conversion sheet on anything needing an account. |
| **WF ids** | Overlays the requirement identifiers each screen implements, for walking the spec against the build. |
| **All screens** | An index of every screen, to jump straight to one. |
| **Reset** | Puts the fixture data back. |

The panel beside the phone names the screen, what it is for, and which
requirements it implements.

## Architecture

No build step, no dependencies, no framework. `index.html` plus ES modules, which
is what makes it deployable to Pages as-is and openable from `file://`.

```
index.html            the harness shell and the phone body
app/
  main.js             composes the app shell; drives every re-render
  harness.js          device presets and the reviewer controls
  core/
    dom.js            a 60-line hyperscript; the only way an element is built
    store.js          the single mutable place: session, db, nav, ui
    router.js         per-tab back stacks + an overlay layer (mobile semantics)
    i18n.js           t(), direction, fallback-and-log (WF-763)
    format.js         §10.4 in one module — units, dates, Hijri, currency
    status.js         WF-009: one definition of the four-state scale
    capabilities.js   WF-670/671: the capability matrix; can(), never role ===
    entitlements.js   §9: plan → feature keys; has(), lock()
    local.js          per-screen scratch state
  data/
    farms.json        authored fixtures (farms, plots, trees)
    activity.json     authored fixtures (advice, tasks, team, log, reports)
    content.json      authored fixtures (crops, help, glossary, plan tables)
    *.data.js         generated ES modules — see tools/json-to-module.py
    fixtures.js       derives geometry, imagery dates and time series
    selectors.js      the read layer — scoping and ordering live with the query
    actions.js        the write layer — offline queueing, demo behaviour
  ui/                 component kit, icons, SVG map, SVG charts, boundary editor
  screens/            one module per group, plus the screen registry
  styles/             tokens, base, components, screens, harness
  i18n/               generated catalogues + the translation sources
tools/                syntax check, smoke test, fixture and catalogue builders
```

Three decisions carry most of the weight:

- **The status scale is a module, not a convention.** `statusChip()` cannot
  render a colour without its icon and its word, so WF-008 holds by construction.
- **Entitlement and capability are questions, never inferences.** Screens ask
  `has('irrigation.schedule')` and `can('task.assign', farm)`. Plan names and
  role names appear in exactly two files.
- **The shell owns the cross-cutting rules.** The demo banner (WF-165), the
  connectivity indicator (WF-791) and the tab badges (WF-032/033) are rendered by
  `main.js`, so no screen can forget them.

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
npm run fixtures                  # regenerate app/data/*.data.js from the JSON
```

The smoke test drives every registered screen through three roles, then every
farm, plot, tree, advice item and task, then every plan, every connectivity
state, demo mode and all five languages — about 650 renders — and fails on any
console error or empty render.

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
| SMS codes | Any six digits continue; `000000` simulates a wrong code so the five-attempt lockout of WF-120 can be seen. |
| Invitation codes | Any six characters join as a Worker; a leading `S` joins as a Supervisor; `EXPIRE` shows the used/expired message of WF-156. |
| Photos, QR codes | Deterministic placeholders. QR blocks are decoration, not scannable codes. |
| Purchases | The plan chooser changes the session's entitlement. No store, no payment — WF-330 says payment can only happen through the stores. |
| Reports | A shape-of-the-PDF preview and a share sheet toast. WF-316 puts generation on the server. |
| Notifications | A list, with the deep links of WF-656 wired to the objects they name. |

Dates are fixed to **3 August 2026**, the date of the specification, so "6 hours
ago" and "due today" mean the same thing on every visit.

## Known limits

- Translations are machine-produced and unreviewed. WF-760 requires a named
  reviewer per language before release; the coverage bars on F8 show where each
  language stands and untranslated keys fall back to English exactly as WF-763
  specifies.
- Pinch-zoom on the map is buttons rather than gestures, since the mockup is
  driven with a mouse as often as a finger.
- The capability and entitlement checks here are client-side by necessity. In the
  product both are resolved server-side on every request (WF-675, WF-715).
