# Wafra Farm App — mockup handover

This repository is a **clickable mockup** of the Wafra Farm app. It shows every
screen and every path through the app. It runs in a web browser.

It has **no server**. All the data is fake. Nothing is saved when you reload.

**Your job** is to turn it into the real mobile app:

1. Put it inside a mobile framework: **Capacitor** (reuse this code) or
   **React Native** (rewrite the screens).
2. Connect it to real things: accounts, farm data, satellite data, maps, AI
   advice, weather, messages, payments.

This README tells you what is here, what to keep, what to replace, and in
which order.

**Live mockup:** https://romainbigare.github.io/white-label-mockup/
(it updates every time someone pushes to `main`).

---

## Contents

1. [Start here: use the app](#1-start-here-use-the-app)
2. [The plan, in 8 steps](#2-the-plan-in-8-steps)
3. [What is in the app](#3-what-is-in-the-app)
4. [Keep, replace, drop](#4-keep-replace-drop)
5. [Where things are](#5-where-things-are)
6. [How the mockup code works](#6-how-the-mockup-code-works)
7. [Choose a framework: Capacitor or React Native](#7-choose-a-framework-capacitor-or-react-native)
8. [Connect the real services](#8-connect-the-real-services)
9. [Rules the real app must keep](#9-rules-the-real-app-must-keep)
10. [Traps: things that will surprise you](#10-traps-things-that-will-surprise-you)
11. [Tools and tests](#11-tools-and-tests)
12. [Words used in this project](#12-words-used-in-this-project)

---

## 1. Start here: use the app

Do this before you read any code. It takes about 30 minutes.

1. Open the [live mockup](https://romainbigare.github.io/white-label-mockup/).
2. Walk through sign-up, from the first screen to the end. Tap everything.
   When it asks for a code, type any 4 digits except `0000`.
3. Add `#/screens` to the address. You now see all 60 screens on one page.
4. On a computer, use the controls beside the phone to change:
   - **Language.** Pick Arabic. The whole layout flips right-to-left.
   - **Role.** Owner or supervisor.
   - **Connection.** Go offline and see what changes.
   - **Text size.** Up to 200%.
5. Open the slide deck `docs/Wafra_Farm_App_Screens_v1.7.1.pptx`. It has every
   screen, the paths between them, and notes.

### Run it on your computer

```bash
git clone https://github.com/romainbigare/white-label-mockup.git
cd white-label-mockup
npm run serve          # then open http://localhost:8080
```

- There is **no build step**. The browser loads the files directly.
- Change a file, then reload the page.
- You do **not** need `npm install` to run the app. You need it only for the
  tools in [section 11](#11-tools-and-tests).

### Two views

| View | When you get it | What you see |
|---|---|---|
| `harness` | on a computer | a phone on a dark stage, plus review controls |
| `phone` | on a phone | only the app, full screen |

To force one, add `?view=phone` or `?view=harness` to the address.

The harness is a **review tool**. It is not part of the product. Do not port it.

### Open one screen directly

| Address ends with | Opens |
|---|---|
| `#/A8` | Sign up |
| `#/home/B2:plot-13` | Plot detail, for plot `plot-13` |
| `#/advice/D2:adv-01` | Irrigation advice `adv-01` |
| `#/screens` | all screens on one page |

---

## 2. The plan, in 8 steps

| Step | What to do | Read |
|---|---|---|
| 1 | Use the app. Read the slide deck. | [section 1](#1-start-here-use-the-app) |
| 2 | Choose Capacitor or React Native. | [section 7](#7-choose-a-framework-capacitor-or-react-native) |
| 3 | Remove the review tools from the code. | [section 4](#4-keep-replace-drop) |
| 4 | Build the app shell, navigation and the shared components. | [section 6](#6-how-the-mockup-code-works) |
| 5 | Design your API from `selectors.js` (reads) and `actions.js` (writes). | [section 8.1](#81-your-api-the-data-layer) |
| 6 | Connect the services, one at a time: login → farms and plots → satellite data → maps → AI advice → survey → messages → payments → offline. | [section 8](#8-connect-the-real-services) |
| 7 | Check every screen against the rules. | [section 9](#9-rules-the-real-app-must-keep) |
| 8 | Test side by side with the mockup, in several languages and both roles. | [section 11](#11-tools-and-tests) |

---

## 3. What is in the app

### Screens

There are **60 screens**. Each one has a **code**: a letter and a number. You
will see the same code in the source files, in the slide deck, and in review
notes.

| Codes | Group | How many | Examples |
|---|---|---|---|
| A1–A21 | First run and log in | 21 | Welcome, tour, sign up, find your farm, draw the boundary, survey, plans, payment, log in |
| B1–B11 | My Farm (tab 1) | 11 | Farm home, one plot, crop seasons, tree group, one tree, crop planner, draw plots, team, farm settings |
| C1–C5 | Map (tab 2) | 5 | Map, layers, plot sheet, compare two dates, boundary editor |
| D1–D6 | Advice (tab 3) | 6 | Advice inbox, irrigation, fertilisation, crop protection, photo check, photo result |
| F1–F17 | More (tab 4) | 17 | Profile, reports, weather, subscription, settings, units, help, crop guide, pests, contact |

The full list, with one line about each screen, is in `app/screens/index.js`.

### Pop-ups

There are **46 pop-ups**: bottom sheets and dialogs. For example: the upgrade
sheet, "are you sure?", the farm switcher, "send this advice to…". They are all
in `app/screens/overlays.js`.

### The main paths

**Sign up** (first day):

> A1 Welcome → A2 Language → A3–A7 Tour → A8 Sign up → A9 Email code →
> A10 About your farm → A11 Plans (price estimate) → A13 Find the farm on the
> map → A14 Draw the farm boundary → A15 Survey is running

**When the survey is ready** (a push notification brings the farmer back):

> B1 Farm home → A16 Survey results (farmer approves the plots) → A17 Plan,
> priced on the real plots → A18 App Store / Google Play payment → A19 You're
> ready

**Every day:**

> D1 Advice inbox → D2 Irrigation advice → send it to a team member by SMS,
> WhatsApp or Telegram

All paths are listed in `FLOWS` in `app/screens/index.js`.

### Other facts

- **4 tabs:** My Farm, Map, Advice, More. Everyone sees the same four.
- **2 roles:** owner and supervisor. See [section 9](#9-rules-the-real-app-must-keep).
- **2 plan levels:** Basic and Premium. Each is sold for crops, for trees, or
  for both. That makes 6 plans. In the code, Premium is called `pro`
  (for example `combined_pro`).
- **10 languages:** English, Arabic, Pashto, Bengali, Hindi, French, Turkish,
  Azerbaijani, Georgian, Armenian. Arabic and Pashto are right-to-left.
- **Offline** is a designed state on every screen, not an error.

---

## 4. Keep, replace, drop

```
┌──────────────────────────────────────────────────────┐
│  app/screens/   60 screens + 46 pop-ups              │  KEEP the design
├──────────────────────────────────────────────────────┤
│  app/ui/        buttons, cards, rows, maps, charts   │  KEEP or REBUILD
│  app/styles/    colours, sizes, layout               │
├──────────────────────────────────────────────────────┤
│  app/core/      store, navigation, language, units,  │  KEEP the logic
│                 roles, plans, health scale           │
├──────────────────────────────────────────────────────┤
│  app/data/      selectors (read) + actions (write)   │  KEEP the function names,
│                 + fake data                          │  REPLACE what is inside
└──────────────────────────────────────────────────────┘
```

### Keep

| Path | Why |
|---|---|
| `app/screens/` | The design of every screen. It is the specification. |
| `app/ui/components.js` | The shared building blocks (54 of them). |
| `app/ui/brand.js`, `app/imgs/logo.avif` | The brand: name, web address, logo. |
| `app/styles/tokens.css` | Every colour, space, radius and font size. |
| `app/core/` | Logic you need in any framework: language, units, roles, plans, health scale, geometry. |
| `app/i18n/` | The translations. |
| `app/data/selectors.js`, `app/data/actions.js` | The shape of your API. |

### Replace

| Path | With |
|---|---|
| `app/data/*.json`, `*.data.js`, `fixtures.js` | Your API. |
| `app/data/survey.js` | The real plot detection from the satellite supplier (MMC). |
| `app/ui/map.js` (SVG + photos) | A real map library with real tiles. |
| `app/data/geo/imagery/*.jpg` | Real satellite imagery. |

### Drop (review tools only)

| Path | What it is |
|---|---|
| `app/harness.js`, `app/styles/harness.css` | The phone stage and review controls. |
| `app/screengrid.js`, `app/ui/screenshot.js` | The "all screens" page. |
| `app/core/freshness.js`, `app/version.js`, `app/meta.js`, `version.json` | Mockup version stamps. |
| The harness markup and the view script in `index.html` | Picks harness or phone view. |
| `req(...)`, `deckMark()`, `deckTo`, `deckNote` inside screens | Requirement tags and slide-deck arrows. |
| `state.device`, `state.ui.preview`, `state.ui.showReqIds` | Harness state. |
| `globalThis.wafra` in `app/main.js` | Debug handle for the tests. |
| `app/data/geo/plots.js`, `crops.js`, `landuse.js` | 4.4 MB of raw map data. Input for a tool only. **Never ship these.** |
| `tools/`, `docs/`, `specifications/` | Build tools and review history. Read them; do not ship them. |

---

## 5. Where things are

```
index.html                 loads the styles and app/main.js
app/
  main.js                  starts the app, redraws it on every change
  shell.js                 wraps each screen: banners, tab bar, pop-ups, toast
  core/
    dom.js                 h() — builds the page elements
    store.js               THE state. The only place that holds data.
    router.js              tabs, back stacks, pop-ups
    local.js               small memory for one screen (a typed field, etc.)
    i18n.js                t() — every text on screen
    format.js              numbers, units, dates, money
    capabilities.js        what each role may do
    entitlements.js        what each plan includes
    status.js, health.js   the four health states and scores
    geo.js                 map coordinates
  data/
    selectors.js           READ data  → your GET endpoints
    actions.js             WRITE data → your POST/PUT/DELETE endpoints
    survey.js              the satellite survey (fake)
    fixtures.js            builds the fake database from the JSON
    localise.js            translates text inside records
    farms.json             farms, plots, trees
    activity.json          advice, team, activity log, reports
    content.json           crops, measures, help, glossary, plans, countries, pests
    geo/                   real farm shapes and satellite photos
  screens/
    index.js               THE LIST OF ALL SCREENS — start reading here
    onboarding.js          A screens
    home.js, plot.js, trees.js, planner.js    B screens
    mapscreens.js          C screens
    advice.js              D screens
    more.js, guides.js     F screens
    overlays.js            all 46 pop-ups
    banners.js, badges.js  offline banner, tab badges
  ui/
    components.js          shared building blocks
    map.js                 every map
    charts.js              every chart
    boundaryEditor.js      draw a shape by tapping corners
    icons.js               icons (Lucide)
    brand.js               the brand
  styles/                  tokens.css, base.css, components.css, screens.css
  i18n/                    the 10 languages
tools/                     tests and generators
docs/                      review notes and slide decks
specifications/            old versions of the build specification
```

---

## 6. How the mockup code works

Six ideas explain almost all of it.

### 6.1 A screen is a function

A screen gets its parameter (for example a plot id). It returns an object. It
does not touch the page itself.

```js
// app/screens/more.js (shortened)
export function F17() {
  return {
    top:  appBar({ title: t('f13.title', 'Contact Wafra') }),
    body: page(helpBlock(), btn(t('f13.ticket', 'Raise a support ticket'), { … })),
  };
}
```

(The keys say `f13` and not `f17` because the screens were renumbered. See
trap 3 in [section 10](#10-traps-things-that-will-surprise-you).)

The object can have: `top` (the bar), `body` (the page that scrolls), `dock`
(buttons fixed at the bottom), `fab` (a floating button), `tabs: false` (hide
the tab bar).

Elements are built with `h()` from `app/core/dom.js`:
`h('div.card', { onclick }, h('h2', 'Title'))`.

### 6.2 One store

All state is in one object in `app/core/store.js`:

| Part | Holds | In the real app |
|---|---|---|
| `session` | who is using the app: user, role, language, plan, units, online or offline, settings | comes from the server (profile and account) |
| `db` | all data: farms, plots, trees, advice, team… | comes from your API |
| `nav` | tabs, back stacks | stays in the app |
| `ui` | open pop-up, toast, selected filter, selected measure | stays in the app |
| `device` | the phone the harness shows | drop |

After you change state, call `commit()`. That redraws the screen.

### 6.3 The whole screen is redrawn on every change

There is no diffing. Each `commit()` throws away the page and builds it again.
Because of this, `shell.js` puts back the keyboard focus and the text cursor,
and `main.js` puts back the scroll position. A framework that keeps its elements
between draws does not need that code.

### 6.4 Navigation

`app/core/router.js`:

- Each tab has **its own back stack**, like a native app.
- Sign-up and log-in (the A screens) are a separate stack, with no tab bar.
- Pop-ups sit on top. Only one is open at a time.

| Function | Does |
|---|---|
| `go('B2:plot-13')` | open a screen (`screen:parameter`) |
| `back()` | go back (or close the pop-up) |
| `switchTab('map')` | change tab; tapping the open tab goes to its first screen |
| `openSheet('C3', { plotId })` | open a bottom sheet |
| `openModal('CONFIRM', { … })` | open a dialog |
| `closeOverlay()` | close the pop-up |
| `enterApp()`, `enterOnboarding()` | move between sign-up and the main app |

### 6.5 Screen memory

Because screens are rebuilt every time, a screen keeps its small memory (a
half-typed field, which card is open, the corners drawn so far) in
`local('screen-key', { … })` from `app/core/local.js`. In React this is
`useState`.

### 6.6 Every text goes through `t()`

```js
t('a9.unit', 'How do you measure land?')
```

First the key, then the English text. The English in the code is the source.
The translation files are made from it (see [section 11](#11-tools-and-tests)).

---

## 7. Choose a framework: Capacitor or React Native

### Side by side

| | Capacitor | React Native |
|---|---|---|
| What happens to this code | It runs almost as it is, inside a web view | The screens are rewritten |
| First build on a phone | days | weeks to months |
| Code you reuse | nearly all of `app/` | the logic in `core/` and `data/`; screens are the guide |
| Look and feel | web app inside a native shell | native controls and gestures |
| Speed on cheap Android phones | needs testing, may need work | good |
| Maps | a web map (MapLibre GL JS, Google Maps JS) or a native map plugin | `react-native-maps` or MapLibre React Native |
| Right-to-left | works now (CSS) | switching needs an app restart |

**Our advice:** if farmers need the app soon, use **Capacitor**. If you will
build this app for years and have the time, use **React Native**.

### 7.1 Path A — Capacitor

1. **Remove the review tools** (list in [section 4](#drop-review-tools-only)).
   In `app/main.js`, remove the imports and calls to `harness.js`,
   `screengrid.js` and `freshness.js`. Make the phone view the only view.
2. **Add a bundler**, for example Vite. The mockup loads about 60 separate
   files. A bundle starts faster. Point Capacitor's `webDir` at its output.
3. **Add Capacitor** and create the iOS and Android projects.
4. **Replace the fake data** with your API ([section 8.1](#81-your-api-the-data-layer)).
5. **Add native plugins** for:

   | Need | Used on |
   |---|---|
   | Camera | D5 photo check |
   | Location (GPS) | A13 find my farm, the map, "show me where" |
   | Push notifications | A15 survey ready, new advice |
   | Face ID / fingerprint | A9, A20, F7 |
   | In-app purchase | A17, A18, F5 |
   | Network status | offline banner, sync |
   | Secure storage | login token |
   | Share / open files | F3 reports |
   | Status bar, safe areas, Android back button | every screen (back button → `back()`) |

6. **Replace the map** ([section 8.5](#85-maps)).
7. **Test speed on a mid-range Android phone.** The app redraws the whole screen
   on every change, even on each key press. If it is too slow, the fix is in one
   place: `h()` and `mount()` in `app/core/dom.js`. For example, `h()` could
   build Preact virtual nodes so only changes are drawn. Measure first.

### 7.2 Path B — React Native

1. **Set up the project** (Expo is fine) with:
   React Navigation, a store (for example Zustand), i18next,
   `react-native-svg`, a map library, a bottom-sheet library,
   `react-native-gesture-handler`, `lucide-react-native`.
2. **Copy the logic first.** These files are plain JavaScript and move almost
   as they are: `core/format.js`, `status.js`, `health.js`, `capabilities.js`,
   `entitlements.js`, `geo.js`, `data/selectors.js`, `data/actions.js`,
   `data/survey.js`. They read `state` from the store directly. Use a store you
   can read outside React (Zustand's `getState()` works), or pass the values in.
3. **Turn `app/styles/tokens.css` into a theme file**: colours, spacing, radii,
   font sizes.
4. **Build the shared components by hand**, from `app/ui/components.js` and
   `app/styles/components.css`. Do this before any screen. Make one demo page
   that shows every component, and compare it with the mockup.
5. **Port the screens one at a time.** Keep the mockup open next to the
   simulator.

   | Mockup | React Native |
   |---|---|
   | `h('div.card', props, …)` | `<View style={styles.card}>…</View>` |
   | screen returns `{ top, body, dock, fab }` | header + `ScrollView` + fixed footer + floating button |
   | `state` + `commit()` | the store; keep the same parts (`session`, `db`, `nav`, `ui`) |
   | `router.js` | React Navigation: bottom tabs, one stack per tab, one sign-up stack |
   | `openSheet()` / `openModal()` | bottom sheet / `Modal` |
   | `local('key', {…})` | `useState` / `useReducer` |
   | `t('key', 'English')` | i18next `t()`, same keys |
   | `app/ui/icons.js` | `lucide-react-native` (the mockup uses its own names, like `advice`; the list of real Lucide names is in `tools/build-icons.mjs`) |
   | `app/ui/charts.js` (SVG) | `react-native-svg`, same shapes |
   | `app/ui/map.js` | map library + overlays |
   | CSS files | theme file + `StyleSheet` |
   | `toast()` | a toast library |

6. **Rebuild the maps and the boundary drawing** with the map library and
   real gestures ([section 8.5](#85-maps)).
7. **Plan for right-to-left.** In React Native, changing direction needs
   `I18nManager.forceRTL()` and an app restart. So when a user picks Arabic or
   Pashto, the app must restart. Use `start`/`end` in styles, never
   `left`/`right`.

**About AI code conversion:** it works well **screen by screen**, after a
person has built the components and the store by hand. Converting the whole
repository in one go gives code that compiles but is wrong.

---

## 8. Connect the real services

Everything below is fake today. This table is the short version. Details follow.

| Area | In the mockup | In the real app |
|---|---|---|
| Data | JSON files in memory | your API |
| Login | any 4-digit code works; Face ID is a switch | email code, password, biometrics |
| AI advice | 13 hand-written advice records | your advice engine |
| Satellite readings | hand-written numbers per plot | the satellite supplier (MMC) |
| Map colours (crop health layer) | generated noise | real index images per date |
| Map photos | 7 Esri photos of 6 real farms | a real tile service |
| Survey (finding plots) | generated, or read from real parcel shapes | satellite supplier's plot detection |
| Weather | a fixed 7-day forecast | a weather provider |
| Photo check | a fixed answer | camera + image model |
| Sending advice to people | a flag and a log line | SMS / WhatsApp / Telegram gateway |
| Payment | a drawn App Store sheet | App Store / Google Play billing |
| Offline and sync | a counter and a banner | a local database and a real queue |
| Reports | a list | PDFs made on the server |
| Push notifications | none | push service |

### 8.1 Your API (the data layer)

Data flows like this:

```
farms.json, activity.json, content.json
        │
        ▼
  fixtures.js  (builds the fake database)
        │
        ▼
    state.db  ──►  selectors.js  ──►  screens      (read)
        ▲
        └──────  actions.js  ◄──────  screens      (write)
```

Replace the top half with your API. **Keep the names of the selector and action
functions**, so the screens do not change.

**Reads — `app/data/selectors.js`** (each one is a GET):
`visibleFarms`, `farmById`, `plotsOf`, `plotById`, `treesOf`, `treeById`,
`adviceFor`, `adviceById`, `adviceForPlot`, `unsentAdvice`, `membersOf`,
`memberById`, `supervisorOf`, `me`, `measures`, `cropById`, `observationsOf`,
`activityFor`, `plotActivity`, and a few helpers.

`visibleFarms()` already applies the role rules. Lists are already sorted with
the worst health first.

**Writes — `app/data/actions.js`** (each one is a POST, PUT or DELETE):

| Area | Functions |
|---|---|
| Advice | `markAdviceSeen`, `markAdviceDone`, `deferAdvice`, `restoreAdvice`, `completeAdvice`, `sendAdvice`, `sendAllAdvice` |
| Team | `addTeamMember`, `updateTeamMember`, `removeTeamMember` |
| Farm and plots | `addFarm`, `setFarmBoundary`, `saveBoundary`, `markSurveyReady`, `confirmSurvey` |
| Crop seasons | `startCycle`, `addCropCycle`, `closeCropCycle` |
| Sharing a farm | `createFarmInvitation`, `cancelFarmInvitation`, `redeemFarmInvitation` |
| Other | `logActivity`, `syncNow`, `clearCache` |

The survey edits in `app/data/survey.js` are writes too: `setAreaKind`,
`setAreaIncluded`, `splitArea`, `joinAreas`, `removeArea`, `addArea`,
`setAreaGeometry`.

Settings screens (F7–F10 and others) write to `state.session` directly. In the
real app, save these to the user's profile on the server.

**Look at these before you design the API:**

- **Some screens skip the selectors.** About 40 places read `state.db` directly,
  mostly for reference data (crops, pests, countries, team, reports). One pop-up
  deletes a plot directly. Find them all with:
  ```bash
  grep -rn "state\.db" app/screens app/ui
  ```
  Move each one behind a selector or an action when you port.
- **`fixtures.js` calculates things.** Health scores from index values, plot
  shapes, tree positions, weather values (ET₀, "can I spray today"). For each
  one, decide: the server sends it, or the app calculates it.
- **Text inside records must be in the user's language.** For example the
  advice text, a farm's headline, a plot's status line. In the mockup,
  `localise.js` translates them by record id. In the real app, the server must
  send them already translated, or send a template key and values.
- **Record shapes.** Open the JSON files to see every field. Short examples:

```jsonc
// a plot (farms.json)
{ "id": "tg-01", "farmId": "farm-1", "name": "Date palms",
  "kind": "trees",                     // crops | trees
  "cropId": "date-palm", "areaHa": 136.8, "treeCount": 7801,
  "status": "urgent",                  // good | monitor | urgent | nodata
  "statusLine": "Water stress: severe",
  "measures": { "ndvi": { "value": 0.28, "delta": -0.09 }, … },
  "parcels": 3 }                       // a tree group can be several pieces of land

// an advice (activity.json)
{ "id": "adv-01", "farmId": "farm-1", "plotIds": ["tg-01"],
  "type": "irrigation",                // irrigation | nutrition | protection | weather
  "severity": "urgent",                // urgent | monitor
  "bucket": "today",                   // today | week | later
  "action": "Increase to 693 m³/ha this week",
  "amount": "231 m³/ha on Monday, between 6 and 8 p.m.",
  "reason": "Soil moisture is low and 44 °C is forecast Tuesday",
  "status": "open",                    // open | completed | superseded
  "supersededBy": null, "ruleVersion": "irr-2026.7.3",
  "detail": { … },                     // different for each type, see below
  "sentAt": null }
```

### 8.2 Accounts and login

| Screen | Mockup | Real app |
|---|---|---|
| A8 Sign up | name, company, email (the email is the account), phone with country code, password | create the account |
| A9 Email code | 4 digits. **Any code works, except `0000`** (that one shows "wrong code"). 5 wrong tries lock for 15 minutes. | send and check a real code |
| A9, A20, F7 Face ID | a switch | device biometrics + a token in secure storage |
| A20 Log in | Face ID, password, or a code by email | the same, for real |
| A21 Join a farm | 6-digit code, or scan a QR code from the owner's phone | invitations from the server (`createFarmInvitation`, `redeemFarmInvitation`) |

### 8.3 AI advice

Advice is the heart of the app. One advice = one thing to do on one piece of
land. The D screens show it. The AI engine must produce records like the one in
[section 8.1](#81-your-api-the-data-layer).

What the engine must give, for every advice:

- **one clear action**, with an **amount** and a **reason**, in the user's
  language and units;
- a **severity** (`urgent` or `monitor`) and **when** (`today`, `week`, `later`);
- the **"why" list**: the inputs used (crop water use, soil moisture, forecast…);
- the **rule or model version** (it is shown on screen);
- when a newer reading changes the advice: mark the old one `superseded` and
  point `supersededBy` to the new one.

Extra details by type (the `detail` object):

| Type | Screen | Details |
|---|---|---|
| `irrigation` | D2 | days, time windows and volume per hectare; % more or less than usual; irrigation efficiency |
| `nutrition` | D3 | how much N, P or K is missing per hectare; common products |
| `protection` | D4 | active ingredient, rate, pre-harvest interval, earliest safe harvest date, re-entry hours |
| `weather` | D1 | a weather warning, for example "Do not spray Tuesday" (the full forecast is on F4) |

Also:

- **Inbox (D1)** filters by severity, status and type, and sorts. The user's
  filter choice is kept between visits.
- **Sending advice** to a team member: see [section 8.8](#88-sending-advice-to-people).
- **Photo check (D5, D6):** the farmer takes a photo of damage. The answer is a
  short list, not a verdict: the likely cause with a match %, a second
  candidate, how to confirm it on the plant, what to do, and the pre-harvest
  interval. Today the answer is fixed. The real app needs the camera and an
  image model.

### 8.4 Satellite data and crop health

The app shows five **measures**. Each has a simple name for farmers:

| Key | Name in the app |
|---|---|
| `ndvi` | Plant health |
| `ndwi` | Water stress |
| `ndre` | Nutrition status |
| `evi` | Growth and vigour |
| `moisture` | Soil moisture |

How a reading becomes a status (`app/core/health.js`):

1. Each measure has a **fixed scale** (for example NDVI from 0.05 to 0.90).
2. The value is turned into a **score from 0 to 100** on that scale.
3. The score becomes a **status**: 80 or more = `good`, 60 or more =
   `monitor`, less = `urgent`, no value = `nodata`.
4. A plot's **overall health** is the lowest score of NDVI, NDWI and NDRE.

Map legends use the same fixed scales. **Never auto-scale a legend to one
image**, or two weeks cannot be compared.

What the satellite supplier must send, per plot and per date: the index values,
the change since last time, and a coloured image of each measure over the plot.
Per farm: the date of the last image, its age, and why it is missing (for
example clouds) — see `imageryDate`, `imageryAgeHours`, `imageryBlockedReason`
on the farm.

Today the coloured measure layer on the maps is **generated noise**
(`plotRasterSvg()` in `app/ui/map.js`). It is not data.

### 8.5 Maps

**Today:**

- Every map is an SVG drawn by `app/ui/map.js`.
- Under it is a **real satellite photo** of six real farms in Abu Dhabi
  (from ADAFSA farm records). The photos are Esri World Imagery, stored in
  `app/data/geo/imagery/`. Where there is no photo, a generated texture is drawn.
- Screens draw in a simple **0–1000 box** per farm, not in latitude and
  longitude. `app/core/geo.js` converts between the two. The six farms are
  neighbours, so they share one box and "all farms" is one map.
- Zoom is by buttons only. There is no pinch or drag.

**In the real app:**

- Use a real map library with real tiles (MapLibre, Mapbox, Google Maps, or
  `react-native-maps`).
- Draw plots as GeoJSON layers in latitude and longitude. Let the map library
  do the projection.
- Add pinch, drag and the GPS dot.
- Keep the look: plot outlines with a status icon and label, labels that hide
  when zoomed out, the legend, the two base maps (satellite and street) on C2,
  and the split view to compare two dates on C4.
- If you keep Esri imagery, **keep its credit on the map**. It is required.

**Drawing shapes** (A14 farm boundary, B9 draw plots, C5 edit a plot) uses
`app/ui/boundaryEditor.js`: tap to add a corner, undo, a check that the lines do
not cross, and the area. Rebuild the drawing on the real map with real
gestures. Keep its rules (`polygonAreaHa`, `selfIntersection`).

### 8.6 Farm survey (finding the plots)

After the farmer draws the farm boundary (A14), the satellite supplier finds
the plots inside it. This takes time.

1. A15 says the survey is running. The farmer can close the app.
2. A **push notification** says the survey is ready.
3. A16 shows the plots found. For each one the farmer can **keep**, **edit** or
   **remove**. They can also **split**, **join** and **add** plots.
4. A17 shows the plan price for the real plots.

Today `app/data/survey.js` makes the plots up (or reads real parcel shapes when
it has them). In the real app it is the supplier's detection result. Farmers
can also draw plots by hand, from the farm home or Farm settings (B1 or B11 → B9).

### 8.7 Weather

Each farm has `weather`: temperature, condition, wind, humidity and a 7-day
forecast. `fixtures.js` adds ET₀ and "can I spray today". F4 shows it. Weather
also feeds irrigation advice and weather warnings. In the real app, use a
weather provider, in the farm's time zone.

### 8.8 Sending advice to people

- **Team members** (B10) are people who do the work: name, phone, and the app
  they read (SMS, WhatsApp or Telegram). **They have no account in the app.**
- The owner sends an advice through the **"Send to" sheet** only. This is the
  only place in the code where advice is sent (`sendAdvice`).
- **Rules** (F9) say where each type of advice goes by default. **Auto-send**
  (`session.autoSend`) sends new advice without asking.
- In the real app: an SMS / WhatsApp Business / Telegram gateway. Keep a record
  of what was sent and when (`sentAt`, and a line in the activity log).

### 8.9 Payments and plans

- A11 shows an estimated price. A17 shows the plans (monthly or yearly) priced
  on the real plots. A18 is a drawing of the **App Store purchase sheet**.
  Wafra never takes a card: payment is through Apple or Google.
- F5 shows the current plan. What it can offer depends on where the plan was
  bought (`session.purchasePath`: `inapp`, `web` or `managed`).
- F6 compares plans (from the supplier's feature document).
- A trial that ends makes the account **read-only**, not locked out.
- Prices are stored in US dollars and shown in the country's currency
  (`content.json → countries`).

In the real app: StoreKit and Google Play Billing (or a service like
RevenueCat). The server checks the receipt and returns the plan. The app only
ever asks `has('feature')`.

### 8.10 Offline and sync

- `session.connectivity` is `online`, `offline` or `syncing`. A banner and a
  sync sign are on every screen (the shell draws them).
- Actions that can work offline **confirm at once** and go into
  `db.syncQueue`. Each item has an id and an idempotency key.
- Actions that need a connection call `requiresConnection()`. It opens a calm
  dialog that says what is needed.
- F10 shows storage use, "Wi-Fi only" for images, and what is waiting to send.

In the real app: a local database (for example SQLite), a real queue, retries,
conflict handling, and the network status from the phone.

### 8.11 Reports

F3 lists reports: weekly, season, and a report for a bank. They come in the
language the user asks for. They can be emailed to several addresses
(`session.reportRecipients`). In the real app, the server makes the PDF.

### 8.12 Push notifications

Needed for: survey ready (A15), new advice, and weather warnings. Respect
**quiet hours** (`session.quietHours`, 21:00 to 05:00 by default), set on F9.
Tapping a notification opens the advice, plot or report it is about.

### 8.13 Brand

The brand is in one place: `app/ui/brand.js` (name, product name, web address,
logo size), the logo file `app/imgs/logo.avif`, and the `--brand-*` colours in
`app/styles/tokens.css`. No screen knows the brand. Keep it that way.

---

## 9. Rules the real app must keep

Check every screen against this list.

**Language**
- [ ] Every text on screen goes through translation. No text is hard-coded.
- [ ] Text from the server arrives in the user's language.
- [ ] Arabic and Pashto flip the **whole** layout. Use `start`/`end`, never
      `left`/`right`.
- [ ] Numbers and Latin names inside Arabic text keep their order
      (`isolateLatin()` in `app/core/i18n.js`).

**Numbers and units** (always through `app/core/format.js`)
- [ ] Land is in **hectares or dunums**, chosen per account. No acres.
- [ ] The database always stores **hectares** and **m³**. Convert only for display.
- [ ] Every number shows its unit.
- [ ] Digits are Western (123) or Eastern Arabic (١٢٣), chosen by the user.
- [ ] Time is 12-hour or 24-hour, chosen by the user. Dates are Gregorian.

**Health status**
- [ ] Always one of four: **good, monitor, urgent, no data**.
- [ ] Always shown with **colour + icon + word**. Never colour alone.

**Roles** (`app/core/capabilities.js`)
- [ ] Ask `can('advice.send', farm)`. Never write `role === 'owner'`.
- [ ] A supervisor sees only the farms shared with them, and can do less.
- [ ] The server checks the same rules.

**Plans** (`app/core/entitlements.js`)
- [ ] Ask `has('irrigation.schedule')`. Never check a plan name.
- [ ] A feature not in the plan is **shown with a lock** and opens the upgrade
      sheet. It is not hidden and not a grey button.

**Offline**
- [ ] Offline is a normal state, not an error.
- [ ] Offline actions confirm at once, then send later.

**Layout and access**
- [ ] Touch targets at least **48 dp**.
- [ ] Body text at least **16 sp**. The app still works at **200%** text size.
- [ ] No sideways scroll on a **360 dp** wide screen.
- [ ] **One main button** per screen.
- [ ] Text contrast passes **WCAG AA**.
- [ ] Colours come only from the tokens. No raw colour codes in screens.

---

## 10. Traps: things that will surprise you

1. **Time is frozen.** `NOW` in `app/core/format.js` is 3 August 2026, 09:12
   UTC. All the fake data matches this date. "2 hours ago" and "today" come
   from it. Use the real clock in the real app.
2. **Plot shapes and tree positions are generated** from the record id
   (`fixtures.js`). They look real, but they are not. Real shapes come from the
   server.
3. **Translation keys do not match screen codes.** The screens were renumbered
   in v1.7.1, but the keys were not. For example `a13.*` keys belong to A17,
   `b15.*` to B7, `a9d.*` to B9. The table of old and new codes is at the top of
   `app/screens/index.js`. Do not rename keys: that would lose the translations.
4. **Translations are not complete.** Arabic, Pashto, Hindi and Bengali have
   about 60% of the texts. French, Turkish, Azerbaijani, Georgian and Armenian
   have only the first screens, the tabs and the buttons (about 75 texts).
   Missing texts show in English.
5. **A hidden screen.** `A9B` exists in `app/screens/onboarding.js`, but nothing
   opens it. Wafra asked to keep it in the code. Do not port it unless asked.
6. **"Co-owner".** Invitations can create a `co-owner`. The rights table has no
   column for it, so a co-owner gets supervisor rights. Decide with Wafra what
   a co-owner may do.
7. **No "tasks".** Task management was removed on purpose. The unit of work is
   an advice. `tools/syntax.sh` fails if the word "task" comes back in code.
   Keep this product rule.
8. **Long comments.** Many comments quote review meetings and explain **why** a
   screen is the way it is. Read them before you change how something works.
   Old screen codes inside quotes may have been renumbered; use the table in
   `app/screens/index.js`.
9. **Requirement IDs** like `WF4.034` point to the build specification.
   `app/meta.js` says the mockup follows **version 1.7**, but `specifications/`
   only has **v1.1 and v1.2**. Ask Wafra for the latest one.
10. **Everything is lost on reload.** The data lives in memory only.

---

## 11. Tools and tests

Install first (only needed for the tools):

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

| Command | What it does |
|---|---|
| `npm run serve` | runs the mockup at http://localhost:8080 |
| `npm run check` | checks every file parses, CSS braces match, and the house rules |
| `npm run smoke` | **the main test** (below) |
| `npm run shots` | saves a picture of every screen to `.shots/` |
| `npm run catalogue` | rebuilds `app/i18n/source/en.json` from the texts in the code |
| `npm run i18n` | rebuilds the 10 language files |
| `npm run fixtures` | turns the JSON data files into `.data.js` files |
| `npm run icons` | copies icons from `lucide-static` |
| `npm run geo` | picks the farms and downloads their satellite photos |
| `npm run deck` | builds the slide deck from the running app |
| `npm run tourshots` | re-takes the screen pictures used in the tour |

**`npm run smoke`** opens every screen in headless Chrome (Chrome with no window), as owner and as
supervisor (534 screen draws), and checks:

- no errors on any screen;
- the real paths work: sign up, draw a boundary, approve a survey, send advice;
- touch target size, text size, contrast, no sideways scroll, one main button;
- the app still works at 200% text size;
- every link goes to a real screen;
- no translation key has two different English texts.

It needs Chrome. Point to it with `CHROME_PATH`, for example on a Mac:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run smoke
```

It ends with a short list of **known problems**. Note them before you change
anything. Anything new on that list after your change is a bug.

You can reuse the smoke test's checks as **acceptance tests** for the real app.

**Translation files:** never edit `app/i18n/source/en.json` by hand. Change the
`t()` call in the code, then run `npm run catalogue` and `npm run i18n`.

**Publishing:** every push to `main` runs `.github/workflows/pages.yml`, which
checks the code and publishes the mockup to GitHub Pages.

---

## 12. Words used in this project

| Word | Meaning |
|---|---|
| **Screen code** | The letter and number of a screen, like `B2`. A = first run, B = My Farm, C = Map, D = Advice, F = More. |
| **WF number** | A requirement ID from the build specification, like `WF4.034`. Each screen lists its IDs in `app/screens/index.js`. |
| **Owner** | The person who owns the farm and pays. Can do everything. |
| **Supervisor** | A person the owner shares a farm with. Has an app account, but fewer rights. |
| **Team member** | A worker who receives advice by SMS, WhatsApp or Telegram. No app account. |
| **Farm** | One holding, with a boundary. An account can have several. |
| **Plot** | One piece of land with one crop. |
| **Tree group** | One kind of tree on a farm. It can be in several places on the farm. |
| **Crop cycle** | One season on a plot: from planting to harvest. |
| **Advice** | One recommendation: what to do, where, how much, and why. |
| **Survey** | The satellite supplier finding the plots inside a new farm's boundary. |
| **Measure** | A satellite index shown as a simple name, like "Plant health" (NDVI). |
| **MMC** | The supplier of the satellite service: images, measures, and plot detection. |
| **ADAFSA** | Abu Dhabi Agriculture and Food Safety Authority. The real farm shapes in the mockup come from their data. |
| **Dunum** | A land unit: 1,000 m², or 0.1 hectare. |
| **Harness** | The review tool around the phone. Not part of the product. |
| **Fixtures** | The fake data. |
| **Selector / action** | A function that reads / writes data. Your API will replace what is inside them. |
