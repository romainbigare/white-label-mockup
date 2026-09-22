# Wafra Farm App — implementation handbook

This repository is a **complete, interactive UI/UX mockup** of the Wafra farm
app: 60 screens, 46 overlays, 10 languages, two roles, two plan tiers. It runs
in a browser with no build step.

It is user interface only. There is no backend, no real authentication and no
live satellite feed. Everything a server would supply is faked in
`app/data/`, consistently, so the app behaves like the real thing for the length
of a session.

**This document is for the team building the production app.** It describes
what is here, how it is put together, what is real, what is pretended, and what
you have to replace.

---

## 1. Run it

```bash
git clone <repo> && cd white-label-mockup
npm install            # only needed for the tools in §11, not for the app
npm run serve          # http://localhost:8080
```

There is **no compile step**. `index.html` loads `app/main.js` as an ES module
and the browser does the rest. Edit a file, reload the page.

`npm install` may try to download Playwright browsers. To skip:
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`.

**Two shells, decided at load time** (`index.html`, inline script):

| Shell | When | What you see |
|---|---|---|
| `harness` | desktop | a phone body on a stage, plus reviewer controls (device, language, role, connectivity, text scale) and a grid of all 60 screens |
| `phone` | coarse pointer, short side ≤ 560 px | the app filling the screen, controls hidden behind one button |

Force either with `?view=phone` or `?view=harness`. **The harness is scaffolding
for reviewing the mockup. It is not part of the product and should not be
ported** — see §12.

Deep links: `#/B2:plot-04` is screen `B2` with parameter `plot-04`.
`#/screens` opens the grid of every screen.

---

## 2. Ground rules of this codebase

1. **No framework and no build.** Plain ES modules, one 60-line hyperscript.
2. **Screens are pure functions of state.** `render(param)` returns a plain
   object; it never touches the DOM.
3. **One mutable place.** `app/core/store.js`. Nothing else holds state.
4. **Re-render everything on every change.** There is no diffing and no virtual
   DOM. At this size it is fast enough and it removes a whole class of bug.
5. **No backward compatibility.** When a design changes, the old path is
   deleted rather than kept behind a flag.
6. **Every user-visible string goes through `t()`.** See §8.1.

---

## 3. Repository map

```
index.html              the two shells, the stylesheets, the module entry
app/
  main.js               boot, the render loop, scroll memory, deep links
  shell.js              wraps a screen with the bars, tabs and overlay layer
  meta.js               version numbers and the change log, in one place
  harness.js            reviewer controls          ← NOT part of the product
  screengrid.js         the all-screens grid       ← NOT part of the product
  core/                 the engine (see §4–§8)
    dom.js              h() — the hyperscript
    store.js            the state object, subscribe/commit
    router.js           routes, tabs, the back stack, overlays
    local.js            per-screen scratch state
    i18n.js             t(), language list, direction
    capabilities.js     what a ROLE may do
    entitlements.js     what a PLAN includes
    format.js           numbers, units, dates, money
    status.js           the four-state health scale
    health.js           index → score → status
    geo.js              Web Mercator ↔ the app's drawing space
    freshness.js        warns when a deployed build is stale
  data/                 the fake backend (see §6)
    farms.json          farms, plots, trees
    activity.json       advice, team, activity log, reports, observations
    content.json        crops, measures, help, glossary, plans, countries…
    *.data.js           generated from the JSON — what the app imports
    fixtures.js         loads and derives the working database
    selectors.js        read the database
    actions.js          write to the database
    survey.js           the satellite survey model
    localise.js         per-record translated content
    geo/                real farm geometry + satellite imagery (see §9)
  screens/
    index.js            THE SCREEN REGISTRY — start here
    onboarding.js       A1–A21
    home.js plot.js trees.js planner.js   B screens
    mapscreens.js       C screens
    advice.js           D screens
    more.js guides.js   F screens
    overlays.js         all 46 sheets and modals
    banners.js badges.js
  ui/                   presentation components (see §7)
  styles/               five stylesheets, token-driven (see §10)
  i18n/                 10 language catalogues
tools/                  generators and tests (see §11)
specifications/         the original build specification PDFs
docs/                   review history and the generated slide decks
```

---

## 4. The render loop

```
user event → mutate state → commit() → every subscriber re-renders
```

`app/main.js`:

```js
subscribe(render);        // re-render on any commit
initHashListener();       // deep links
render();
```

`render()` calls `composeApp(el, view, param)` in `app/shell.js`, which:

1. looks the screen up in `SCREENS`,
2. calls `screen.render(param)` inside a `try/catch`,
3. assembles the result with the status bar, banners, tab bar and overlay layer,
4. mounts it, replacing the previous DOM,
5. restores focus and scroll position.

`commit(reason)` is the only way to trigger a render. Call it after mutating
anything.

**Focus and scroll are preserved by hand** because the DOM is thrown away each
time (`captureFocus` in `shell.js`, `restoreScroll` in `main.js`). A port that
keeps its DOM between renders does not need either.

---

## 5. State

### 5.1 The store — `app/core/store.js`

One exported object, four slices:

| Slice | Holds | In production |
|---|---|---|
| `session` | who is looking: `userId`, `role`, `lang`, `plan`, `connectivity`, units, GPS permission, notification settings | **server-resolved**; most of it is an account/profile API |
| `db` | a working copy of the fixtures | **your API** |
| `nav` | route, tab, back stack, current overlay | client-side, keep |
| `ui` | transient view state: which filter, which measure, which date | client-side, keep |
| `device` | which phone body the harness is emulating | harness only, drop |

API: `subscribe(fn)`, `commit(reason)`, `update(slice, patch)`, `resetData()`,
`toast(text, tone)`.

### 5.2 Per-screen scratch — `app/core/local.js`

Screens are re-created on every render, so anything a screen must remember
between renders — a half-typed field, which card is open, the vertices placed so
far — lives here:

```js
const d = local('signup', { phone: '', email: '', agreed: false });
d.phone = '0555…';
commit('signup');
```

`resetLocal(key)` drops it when a flow finishes. In React this is component
state; in the mockup it is keyed by screen so two screens cannot collide.

---

## 6. The data layer — replace this with your API

This is the part that becomes real. It is deliberately isolated: **no screen
imports a JSON file.** Screens call selectors and actions.

```
JSON  →  fixtures.js  →  state.db  →  selectors.js  →  screens
                                   ←  actions.js    ←
```

### 6.1 Source data

Three hand-authored JSON files. `npm run fixtures` copies each into a
`.data.js` ES module (the app imports those, so it works from `file://` with no
fetch).

**`farms.json`** — `farms`, `plots`, `trees`.

```jsonc
// farm
{ "id": "farm-1", "name": "Al Kharj North", "nameAr": "…",
  "type": "trees",            // crops | trees | mixed
  "country": "SA", "region": "…", "timezone": "Asia/Riyadh",
  "areaHa": 142, "treeCount": 7801, "plotCount": 1,
  "status": "urgent",          // good | monitor | urgent | nodata
  "headline": "Water stress across the palms",
  "imageryDate": "2026-08-02", "imageryAgeHours": 6,
  "imageryBlockedReason": null, "soil": "Sandy loam",
  "lat": 24.155, "lon": 47.305, "adviceCount": 5,
  "weather": { … }, "createdAt": "…", "adjoins": [] }

// plot
{ "id": "tg-01", "farmId": "farm-1", "name": "Date palms",
  "cropId": "date-palm", "cropName": "Date palm", "variety": "Khalas",
  "areaHa": 136.8, "treeCount": 7801, "treeSpacing": 8,
  "kind": "trees",             // crops | trees
  "parcels": 3,                // how many separate pieces of ground it is
  "status": "urgent", "statusLine": "…", "interpretation": "…",
  "plantedOn": "…", "flowRateM3h": 60,
  "measures": { "ndvi": { "value": 0.31, "score": 27, "delta": -0.09 }, … },
  "irrigationEfficiencyPct": 82 }

// tree
{ "id": "T-2801", "farmId": "farm-1", "plotId": "tg-01",
  "row": 1, "position": 1, "species": "Date palm", "variety": "Khalas",
  "status": "urgent", "health": 22, "water": 16, "chlorophyll": 54,
  "canopyM2": 12.5, "ripenessPct": 60 }
```

**`activity.json`** — `advice`, `team`, `activityLog`, `reports`,
`observations`.

**`content.json`** — reference data that is not per-farm: `crops` (37),
`measures` (5), `helpArticles`, `glossary`, `planCompare` (the Basic/Premium
feature tables), `countries` (200, with currency and rate), `diseases` (18),
`growthStages`, `contact`.

### 6.2 `fixtures.js` — the derived database

`loadFixtures()` deep-clones the JSON and then **derives** a great deal:

- health scores from raw index values (`core/health.js`),
- plot geometry and per-tree points (§9),
- the farm's own boundary,
- weather fields such as ET₀, spray suitability,
- extra tree records so a group always has a sample to show.

Anything derived here is a **calculation your backend must own**, or that the
client must do from what the backend sends. It is documented in the file.

### 6.3 `selectors.js` — reads

~33 functions: `visibleFarms()`, `farmById(id)`, `plotsOf(farmId)`,
`plotById(id)`, `treesOf(farmId)`, `adviceFor({farmId, status, type})`,
`membersOf(farmId)`, `me()`, `observationsOf(plotId)`, `activityFor(farmId)`…

`visibleFarms()` already applies the role filter (§8.2). **Every list a screen
shows comes from here.** These map one-to-one onto API endpoints.

### 6.4 `actions.js` — writes

25 functions, each a user intent: `markAdviceDone(id)`, `sendAdvice(id,
personId)`, `deferAdvice(id)`, `addTeamMember(farmId, {…})`,
`declareCrop(plotId, crop)`, `addFarm(draft)`, `confirmSurvey(farmId)`,
`setFarmBoundary(farmId, points, areaHa)`, `closeCropCycle(…)`, `syncNow()`…

Each mutates `state.db`, appends to `activityLog`, and calls `commit()`.
**These are your mutation endpoints.** Several already check connectivity
through `requiresConnection()` — the real app needs the same guard plus a
queue.

### 6.5 The survey — `data/survey.js`

The satellite survey that runs when a farm is added: it produces "areas" the
farmer approves, edits, splits, merges or removes (screens A15–A16). Where a
farm has real parcel geometry the survey reports those; otherwise it generates
a grid. **In production this is MMC's detection output.**

---

## 7. UI components — `app/ui/`

| Module | What |
|---|---|
| `components.js` | 53 exported components — `appBar`, `page`, `card`, `row`, `btn`, `field`, `input`, `select`, `segmented`, `chips`, `actionDock`, `switchRow`, `emptyState`, `lockedRow`, `sheetShell`… |
| `icons.js` + `icons.data.js` | ~94 Lucide icons, vendored. `icon(name, size)`. One stroke weight, one grid |
| `map.js` | every map. `mapSvg()`, `plotRasterSvg()`, `treeLocatorSvg()`, `landUseSvg()`, legends |
| `charts.js` | inline SVG charts |
| `boundaryEditor.js` | the tap-to-place-a-corner polygon editor (A14, B9, C5) |
| `brand.js` | **the only place the brand lives**: name, logo, colours |
| `screenshot.js` | renders a screen off-screen for the grid — harness only |

`components.js` is the contract between screens and pixels. **Port this module
first**: if your `btn`, `card`, `row` and `field` behave the same, most screens
transcribe almost mechanically.

---

## 8. Cross-cutting systems

### 8.1 Language — `app/core/i18n.js`, `app/i18n/`

**10 languages**: English, Arabic, French, Hindi, Bengali, Pashto, Turkish,
Azerbaijani, Armenian, Georgian. Arabic, Pashto (and Urdu if added) are RTL —
`dir()` returns `rtl` and the whole app mirrors through CSS logical properties.

Every visible string is written as:

```js
t('a9.unit', 'How do you measure land?')
```

— key first, **English default second**. The English default in the code is the
source of truth; the catalogues are generated from it.

> **Never hand-edit `app/i18n/source/en.json`.** It is produced by
> `npm run catalogue`, which walks every screen in a headless browser and
> collects what actually rendered. Change the `t()` call, then regenerate.

`npm run i18n` rebuilds the 10 catalogues from the source files.
`isolateLatin()` wraps Latin text inside RTL so numbers and names do not
reorder.

### 8.2 Roles — `app/core/capabilities.js`

Two roles: **owner** and **supervisor**. Permissions are a matrix, not
`if (role === …)`:

```js
can('advice.send', farm)      // → boolean
```

Grants are `yes`, `no` or `scoped` (this farm only). `farmsFor(role)` is what
`visibleFarms()` uses. `tabsFor()` decides which tabs a role sees.

### 8.3 Plans — `app/core/entitlements.js`

Two tiers, **Basic** and **Premium**, across three families (crop, tree,
combined) — six plan keys such as `combined_pro`. (The tier id is still `pro`
internally; the label is Premium.)

```js
has('irrigation.schedule')    // → boolean
lock('irrigation.schedule')   // → { locked, name, benefit, plan } for the upgrade sheet
```

The family is **derived from the account's farms**, never chosen by the user
(`offeredFamily`). `PLAN_LIMITS` caps additional users per tier.

### 8.4 Numbers, units, dates — `app/core/format.js`

Everything a farmer reads passes through here: `num`, `area`, `volume`,
`depth`, `tempC`, `speed`, `pct`, `date`, `time`, `ago`, `price`, `duration`,
`bytes`.

- **Area**: hectare or dunum, per account (`session.areaUnit`). Acres are not
  offered. The database is always hectares; conversion happens at display.
- **Numerals**: Western or Eastern Arabic digits (`session.numerals`).
- **Money**: `content.json → countries` carries a currency and a rate per
  country. Prices are stored in USD and converted for display.
- **Dates**: Gregorian.

### 8.5 The health scale — `app/core/status.js`, `health.js`

Four states used identically everywhere: **good / monitor / urgent / nodata**.
Each carries a colour token, an icon **and a word** — colour is never the only
signal. `scoreFromValue(measure, raw)` turns a raw index into 0–100;
`statusFromScore(score)` turns that into one of the four.

### 8.6 Overlays — `app/screens/overlays.js`

46 sheets and modals in one registry. `openSheet('C3', { plotId })` /
`openModal('CONFIRM', {…})` / `closeOverlay()`. Exactly one overlay at a time,
held in `state.ui.overlay`, rendered by the shell.

---

## 9. Maps and geography — `app/core/geo.js`, `app/data/geo/`

The maps use **real farm boundaries and real satellite imagery**.

- `app/data/geo/plots.js`, `crops.js`, `landuse.js` — 500 ADAFSA farm
  boundaries and 2,425 crop parcels across Abu Dhabi, as GeoJSON in Web
  Mercator (EPSG:3857). 4.4 MB; **the app never imports these**.
- `tools/build-geo.mjs` (`npm run geo`) picks six neighbouring holdings, writes
  a 11 KB `selected.data.js`, and downloads one satellite photograph per farm
  plus one of the whole block.
- `app/data/geo/imagery/*.jpg` — **Esri World Imagery**, vendored. Free with
  attribution; the credit is drawn by `mapSvg()` and **must not be removed**.

**Coordinate model.** Screens draw in an abstract **0–1000 space**, not in
lat/lon. `geo.js` is the only module that knows both:

```js
const space = farmSpace(clusterBboxInMercator);
space.project([x, y])       // Mercator metres → 0–1000
```

The six farms are neighbours in one real block, so they share one projection and
"all farms" is one continuous map. `farm.imagery.fit` is a farm's own square in
that space; `farm.imagery.box` is the wider ground its photograph covers.

`geo.js` also provides `simplifyRing`, `openRing`, `ringArea`, `pointInRing` —
used by the boundary editor.

**For production:** replace the vendored JPEGs with a real tile layer
(MapLibre / Mapbox / react-native-maps). Keep `geo.js`'s projection idea or
move the overlays into true lat/lon and let the map library project. Do not ship
the 4.4 MB GeoJSON to a phone.

---

## 10. Styling — `app/styles/`

| File | What |
|---|---|
| `tokens.css` | every colour, space, radius, type size. **No raw hex anywhere else.** |
| `base.css` | layout, the app shell, the bars |
| `components.css` | one block per component in `ui/components.js` |
| `screens.css` | the few screen-specific rules |
| `harness.css` | the reviewer chrome — **not part of the product** |

Rules that matter:

- **Colour only through tokens.** `--brand-*`, `--ink-*`, `--st-*` (status),
  `--ramp-*` (measures). The ink ramp has a contract: 900–500 clear WCAG AA on
  both backgrounds; 400 and below are decoration only, never text.
- **Logical properties throughout** (`margin-inline-start`, not
  `margin-left`) — this is what makes RTL work without a second stylesheet.
- **Touch targets ≥ 48 dp**, checked automatically (§11).
- **Type scale in `--t-*`**, and it respects the OS text-size setting up to
  200%.

---

## 11. Tooling

| Command | What it does |
|---|---|
| `npm run serve` | static server on :8080 |
| `npm run check` | parses every module **and** enforces the house rules |
| `npm run smoke` | **the test suite** (below) |
| `npm run catalogue` | regenerates `app/i18n/source/en.json` from the code |
| `npm run i18n` | rebuilds the 10 language catalogues |
| `npm run fixtures` | JSON → `.data.js` |
| `npm run icons` | vendors icons from `lucide-static` |
| `npm run geo` | picks the farms and downloads their imagery |
| `npm run deck` | builds the PowerPoint from the running app |
| `npm run shots` | writes a PNG of every screen to `.shots/` |

**`npm run smoke` is the important one.** It opens every screen in a headless
browser, in two roles, and checks:

- no uncaught error or console error on any screen (534 renders),
- **live walks** through the real flows — sign-up, drawing a boundary,
  approving a survey, sending advice — asserting what each step must produce,
- **spec audits**: touch targets ≥ 36 dp, body text ≥ 16 sp, no sideways
  scroll at 360 dp, one primary action per screen, WCAG AA contrast on every
  rendered string,
- the app still works at **200% text**,
- every route points at a registered screen,
- no translation key carries two different English strings.

It currently reports **3 known problems**, listed in its output. Anything else
is a regression.

`tools/syntax.sh` also **forbids the word "task" in live code**. Task
management was deliberately removed from this product; the crop planner is
"field work". This is a guard rail, not a style rule.

---

## 12. Porting notes

### What is product, and what is not

**Do not port:** `app/harness.js`, `app/screengrid.js`,
`app/styles/harness.css`, `app/ui/screenshot.js`, the harness markup in
`index.html`, everything in `tools/` and `docs/`. These exist to review the
mockup.

**Port:** `app/core/` (minus `freshness.js`), `app/data/` (as the shape of your
API), `app/screens/`, `app/ui/`, `app/styles/` (minus harness).

### Option A — React Native

The honest mapping:

| Mockup | React Native |
|---|---|
| `h('div.card', …)` | `<View style={s.card}>` |
| screen returns `{ top, body, dock }` | a screen component with a header, a `ScrollView` and a footer |
| `store.js` + `commit()` | Zustand / Redux — the slices map directly |
| `router.js` | React Navigation; `nav.tab` → a tab navigator, the back stack → a native stack |
| `local()` | `useState` / `useReducer` |
| `t(key, en)` | i18next or similar; feed it `app/i18n/*.js` |
| `components.js` | your component library — **do this first** |
| `map.js` (inline SVG) | `react-native-svg` over `react-native-maps`/MapLibre |
| `styles/*.css` | a token file plus `StyleSheet` objects |

What transcribes easily: the data layer, formatting, capabilities,
entitlements, the status scale, all business logic. What needs real work: the
maps, the boundary editor (gestures), RTL, and the ~50 components.

An LLM conversion is plausible **screen by screen, after a human has ported
`ui/components.js` and the store by hand**. Converting the whole repository in
one pass will produce something that compiles and is wrong.

### Option B — Capacitor

Wraps this code as-is in a native shell. Fastest to something installable.

Expect to do anyway:

- replace the fake data layer with your API (§6) — unavoidable either way,
- replace the vendored imagery with a real map (§9),
- native camera, push notifications, biometrics, background sync via Capacitor
  plugins,
- **performance**: the app re-renders everything on every change. Fine in a
  desktop browser, noticeably slower in a WebView on a mid-range Android phone
  on the long lists. Either add targeted diffing or accept it.
- in-app purchase through a plugin (the mockup draws the store sheet on A18).

**Recommendation.** If this is a product you will keep building for years, React
Native. If you need something in front of farmers quickly, Capacitor first, then
port screen by screen behind it.

### Whichever you choose, start here

1. `app/screens/index.js` — the registry. It names every screen, says what it
   is for, and lists the requirement ids it satisfies.
2. `npm run serve`, then `#/screens` — every screen at once.
3. `docs/Wafra_Farm_App_Screens_v1.7.1.pptx` — the same screens as a deck, with
   flow diagrams and annotations.
4. `app/ui/components.js` and `app/styles/components.css` side by side.
5. `app/data/selectors.js` and `actions.js` — your API surface.

### Things that will bite you if you skip them

- **RTL is not a translation.** Arabic and Pashto mirror the entire layout.
  Test with the harness language switch before building anything new.
- **The four-state scale is load-bearing.** Colour, icon and word, always all
  three.
- **Units are per account**, and the database is always hectares and m³.
- **Roles change what exists**, not just what is greyed out. A supervisor sees
  different tabs and different farms.
- **Offline is a designed state**, not an error. `session.connectivity` drives
  banners, queued writes and a sync indicator on every screen.
- **Entitlements gate real screens.** A locked feature shows a purposeful
  locked row and the upgrade sheet, not a disabled button.

---

## 13. What is faked, and what has to become real

| Area | In the mockup | In production |
|---|---|---|
| Authentication | any 6-digit code works; Face ID is a switch | SMS OTP + biometric |
| The database | `app/data/*.json` in memory | your API |
| Satellite imagery | vendored Esri JPEGs of six real farms | MMC imagery through a tile service |
| Vegetation indices | authored values per plot | MMC analytics |
| The survey | generated or read from real parcel data | MMC boundary/crop detection |
| Weather | authored 7-day fixture | a weather provider |
| Advice | 13 authored records | your agronomy engine |
| Sending advice | flips a flag, writes the activity log | SMS / WhatsApp / Telegram gateway |
| Payment | a drawn App Store sheet | StoreKit / Play Billing |
| Sync and offline | a counter and a banner | a real queue with conflict handling |
| Photos | placeholders | camera + upload |

Everything else — navigation, permissions, entitlements, formatting, language,
the interaction design of all 60 screens — is meant to be taken as specified.
