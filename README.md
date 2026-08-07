# Wafra Farm App — interactive UI mockup

An interactive mockup of every screen in the **White Label Farm App Build
Specification v1.2** (`specifications/`). It is user interface and user
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
| First run | A1 language · A2 get started · A3 log in · A4 guided tour · A5 sign up · A6 verify code · A7 your details and units · A8 what do you grow · A9 add your first farm (the fork) · A9D draw my plots myself · A10 survey my whole farm · A11 what we found · A12 farm details · A13 your plan and price · A14 you're ready · A15 join a farm · reset password |
| Home | B1 my farms · B2 farm detail · B3 plots · B11 farm settings · B12 add farm |
| Plots | B4 plot detail · B5 crop cycles · B6 add/edit cycle · B7 measure viewer · B8 compare |
| Trees | B9 tree list · B10 tree detail (with the locator map) |
| Workforce | G1 workforce · G2 add a worker · G3 worker record |
| Map | C1 map · C2 layers · C3 plot sheet · C4 compare dates · C5 boundary editor |
| Advice | D1 inbox · D2 irrigation · D3 nutrition · D4 crop protection · D6 weather · D7 record what you did |
| Tasks | E1 tasks / my work · E2 task detail · E3 new task · E4 complete task · E6 field observation · E7 photo disease check |
| More | F1 reports · F5 subscription · F6 compare plans · F7–F10 settings · F11 activity log · F12 help · F13 contact · F14 profile |

Two codes are not in the App Map: **A9D**, the drawing canvas behind A9's "draw
my plots myself" route, which §4.10.1 describes but does not number; and
**FORGOT**, reached from A3's "forgot your password?".

**There is no Team and access screen.** Access to a farm is granted by inviting
somebody from their **worker record** (G3), which is the one place the owner has
already described them — and attaching the code to that record is what makes the
work already logged against the person follow them when they redeem it.

Plus the cross-cutting layers the specification treats as first-class: the
single upgrade sheet (WF9.034), the offline/queued states (§11), empty, loading
and error states (WF2.011, WF2.012), and the four-state health scale used
identically everywhere (WF2.009).

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

The choice is remembered. Language, role, plan and connection stay reachable on
a phone through the edge handle; device size, zoom and OS text scaling are
hidden there, because the phone already provides all three.

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
| **Device** | WF2.002 makes **360 × 640** the acceptance size — it is first in the list. Ten presets from that baseline up to a Pro Max, each with the right notch, safe areas and platform. |
| **All screens** | A contact sheet — see below. |
| **Zoom** | Fit, or a fixed percentage, so a screen can be read at true size on a laptop. |
| **Text size** | WF2.007 — the OS font-size setting up to 200%, to check nothing clips or drops off-screen. |
| **Language** | WF10.001 — the five launch languages. Arabic and Pashto mirror the whole interface (WF10.003). |
| **Role** | WF3.001, WF3.002 — Owner and Supervisor get five tabs, a Worker three, and a Worker lands on My Work. The whole menu and every screen respond. |
| **Plan** | WF9.033 — switch between the six subscriptions (and an expired trial) to see locked features appear and disappear. Nothing is hidden; it is locked. |
| **Connection** | WF11.012 — online, offline and syncing, with the pending count. |
| **Bought via** | §9.1.3 — the three purchase routes. Which one paid decides what F5 may offer (WF5.176 against WF5.178) and never what the account is entitled to (WF5.177). |
| **WF ids** | Overlays the requirement identifiers each screen implements, for walking the spec against the build. |
| **Reset** | Puts the fixture data back. |

The panel beside the phone names the screen, what it is for, and which
requirements it implements.

### All screens at once

**All screens** lays the whole build out as a contact sheet: every registered
screen rendered live into its own **iPhone 16** tile, 393 × 852, zoomable from
20% to 100% with a slider. Click any tile to jump to it. That is a presentation
size rather than an acceptance one — WF2.002's 360 × 640 is still checked on
every screen by `tools/smoke.mjs`.

**The sheet has a URL.** Opening it puts `#/screens/z40` in the address bar, and
the zoom follows as you change it, so "look at this at 70%" is a link rather
than a set of instructions. Closing it returns to the screen you came from;
opening a shared link goes to Home when you close it, because there is nothing
behind it. Browser Back works either way.

The tiles are always in **English**, because that is what a reviewer scans for.
Everything else is the live session: switch the harness to Worker, or to an
expired trial, reopen the sheet, and you are looking at what that person can
actually reach.

Two things make it safe to draw sixty-one screens into a running app. Rendering
happens under `state.ui.preview`, so render-time side effects stand down —
drawing every advice card must not mark them all as read. And tiles render as
they scroll into view, because sixty-odd synthesised satellite rasters at once is a
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
  version.js          stamped at deploy time; paired with /version.json
  imgs/logo.avif      the brand lockup — one file, cropped two ways
  core/
    dom.js            a 60-line hyperscript; the only way an element is built
    store.js          the single mutable place: session, db, nav, ui
    router.js         per-tab back stacks + an overlay layer (mobile semantics)
    i18n.js           t(), direction, bidi isolation (WF10.003), fallback (WF10.014)
    format.js         §10.4 in one module — units, dates, Hijri, currency
    status.js         WF2.009: one definition of the four-state scale
    capabilities.js   WF8.002: the capability matrix; can(), never role ===
    entitlements.js   §9: plan → feature keys; has(), lock()
    local.js          per-screen scratch state
    freshness.js      is this the build the server has? (Pages caches for 10 min)
  data/
    localise.js       WF10.014: content through the same catalogue as the UI
    survey.js         §4.10: the land use survey, and the five edits of WF4.081
    farms.json        authored fixtures (farms, plots, trees)
    activity.json     authored fixtures (advice, tasks, team, log, reports)
    content.json      authored fixtures (crops, help, glossary, plan tables)
    *.data.js         generated ES modules — see tools/json-to-module.py
    fixtures.js       derives geometry, imagery dates and time series
    selectors.js      the read layer — scoping and ordering live with the query
    actions.js        the write layer — offline queueing, deferral, worker records
  ui/                 component kit, icons, SVG map, SVG charts, boundary editor
    brand.js          the only module that knows what the label looks like
  screens/            one module per group, plus the screen registry
    workforce.js      §5.6: G1–G3, the people who never open the app
  styles/             tokens, base, components, screens, harness
  i18n/               generated catalogues + the translation sources
tools/                syntax check, smoke test, fixture and catalogue builders
                      plus pdftext.py / specdiff.py, which read the spec itself
```

`index.html` carries one inline script: the phone-or-harness decision, which has
to run before first paint. Everything else is a module.

Five decisions carry most of the weight:

- **The status scale is a module, not a convention.** `statusChip()` cannot
  render a colour without its icon and its word, so WF2.008 holds by construction.
  That is also what let the card design go quiet: a card is a hairline and a
  soft corner with no drop shadow, and status tints that hairline instead of
  running a 4 dp slab down its left edge. The icon and the word were always the
  thing carrying the meaning.
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
- **The shell owns the cross-cutting rules.** The offline and syncing strips
  (WF11.012) and the tab badges (WF3.003, WF3.004) are rendered by `shell.js`,
  so no screen can forget them. It takes the route as an argument rather than
  reading the router, which is what lets the contact sheet compose sixty-odd
  screens with the same code that composes the live one.
- **The survey result is an object, not a derivation.** `survey.js` computes
  what the algorithm found from the farm id — deterministically, so a reviewer
  running it twice sees the same farm — then materialises it and keeps the
  detected version untouched beside the working copy. WF4.081 lets the farmer
  split, join, redraw, remove and add, and a joined pair is one shape that no
  longer corresponds to anything the algorithm returned; there is no decision
  layer that can express that.

### The brand is one module

It is a *white label* app, so the label is configuration. `app/ui/brand.js`
holds the artwork and the two names, and nothing else knows what the mark looks
like; screens ask for `logo('lockup')` or `logo('mark')`. The supplied artwork
is a horizontal lockup — mark, gap, then the bilingual wordmark — and the
compact form is a **CSS crop of the same file**, not a second asset to keep in
step: the image is scaled to the element's height, and the element's width
decides how much of it shows.

Which variant goes where is not arbitrary. The wordmark is set in black, so it
reads on paper (A1, log in, the report letterhead of WF5.132) and does not read
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

python3 tools/pdftext.py in.pdf out.txt         # the specification, as text
python3 tools/specdiff.py old.txt new.txt       # requirement-by-requirement diff
```

`syntax.sh` parses every module **and checks that every stylesheet balances its
braces**. The CSS half is there because a browser recovers from a stray `}`
silently: it drops rules until it resynchronises, so a deleted block that leaves
its closing brace behind produces no console error and no failing test, just
quietly missing styles.

The smoke test drives every registered screen through three roles, then every
farm, plot, tree, advice item and task, then every plan, every connectivity
state and all five languages — about 840 renders — and fails on any console
error or empty render. It then audits every screen at 360 × 640, and again at
200% text, against WF2.002 (nothing scrolls sideways), WF2.004 (48 dp targets),
WF2.006 (16 sp body text), WF2.007 (nothing clipped or pushed off-screen),
WF2.010 (one primary action per screen) and colour contrast — WCAG AA on every
rendered string, which the specification does not name a ratio for but a farm
app read in full sun needs. It then types into a form and checks that focus, the
caret and the primary action's enabled state all keep up. Finally it opens the
contact sheet and checks that all 61 tiles drew, in English, without disturbing
the session that was running underneath.

Two checks exist because their absence hid real bugs. It asserts that **every
overlay the app declares is opened by the test** — a duplicate object key that
silently replaced one bottom sheet with another survived a green run otherwise —
and it treats a route to a **deleted screen** as a failure, which the old
character-count check could not see, because "No screen registered for B13." is
a perfectly long string.

### Reading the specification

`tools/pdftext.py` extracts the spec's text with no third-party library, and it
is more than a regex for a reason. The document is printed from Chromium, which
means every font is a subset embedded with Identity-H encoding: the bytes in the
content stream are **glyph indices**, not characters, and they only become text
through each font's `/ToUnicode` CMap. Skip that step and you get
plausible-looking garbage rather than nothing, which is worse.

`tools/specdiff.py` then compares two extracted versions requirement by
requirement. Identifiers are not stable across versions — inserting one
requirement renumbers every one after it in its section — so the useful output
is the text similarity, not the numbers.

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

### "I pushed it, but I cannot see it"

GitHub Pages serves every file with `cache-control: max-age=600`, and an ES
module is cached against its URL — there is no hash in the filename to change.
So a reviewer who visited a few minutes before a deploy is served a **mixture**:
some modules fresh, some a deploy behind. Nothing errors. The app simply renders
the previous version of itself, which looks exactly like a deploy that never
happened.

The build therefore stamps itself twice, on every deploy:

| | |
|---|---|
| `app/version.js` | a module — reaches the browser through the cache, with the rest of the code |
| `version.json` | fetched at boot with `cache: 'no-store'` — always the server's truth |

The harness bar shows the build it is running, so "which version am I looking
at" is answerable at a glance rather than by inspecting the network tab. If the
two disagree, that line gains a **newer build available** link — hover it for
both identifiers and how to force a fresh copy (**Shift + reload**, or
Ctrl/⌘ + Shift + R; a normal reload revalidates the page but can still take
modules from cache).

It says this beside the build id rather than in a bar across the top. A strip
over the mockup is in the way of the one thing the reviewer opened the page to
look at, and it would be worst at exactly the wrong moment — just after a
deploy, which is when a demo is most likely to be happening.

Locally both read `dev` and no check runs.

## What is mocked, and how

| Thing | How it is faked |
|---|---|
| Satellite imagery | Synthesised in SVG: a turbulence basemap plus a per-plot measure raster, seeded on the plot id so the same plot draws identically every time. |
| Measure values | Authored per plot with a 7-day delta; 30 dates of history are derived from them, with genuine gaps so the date stepper of WF5.023 has something to skip. |
| Maps and boundaries | The drawing space is 1000 units where 1 unit = 2 m. Area is real shoelace geometry, so the dunum readout of WF4.065 moves as you drag a corner, and self-intersection is genuinely detected (WF4.068). |
| Tree positions | Every tree gets a point from its row and position on its plot's planting grid, so the distance and bearing on B10 are computed, not written down, and "row 12" means the same place in the list and on the map. |
| The operator's position | One fixed point on the session, shared by the map, the tree locator and "Show me where". The **Location** control switches the permission off, which is a state three screens have to handle (WF5.077, WF5.086). |
| SMS codes | Any six digits continue; `000000` simulates a wrong code so the five-attempt lockout of WF4.040 can be seen. |
| Invitation codes | Any six characters join as a Worker; a leading `S` joins as a Supervisor; `EXPIRE` shows the used/expired message of WF4.116. |
| Photos, QR codes | Deterministic placeholders. QR blocks are decoration, not scannable codes — and they exist only for invitations (§4.1). A tree is found by its row and position and by the B10 locator map, never by a code on the trunk. |
| Purchases | The plan chooser changes the session's entitlement. No store, no payment. The harness's **Bought via** control switches between the three routes of §9.1.3, because which one paid decides what F5 may offer (WF5.176 against WF5.178) — and never what the user is entitled to (WF5.177). |
| Reports | A shape-of-the-PDF preview and a share sheet toast. WF5.162 puts generation on the server. |
| Notifications | A list, with the deep links of WF7.008 wired to the objects they name. Reached from **More → Alerts**: WF7.007's promise is that a message opens the exact thing it concerns, which makes it somewhere to go back to rather than a count to clear off Home. |
| Worker messages | Nothing is sent. G3 states what would go out and in which language, which is the part of §5.6 a reviewer can actually judge (WF5.066). |

Dates are fixed to **3 August 2026**, so "6 hours ago" and "due today" mean the
same thing on every visit.

## What Home is doing (§5.1)

Home is one summary and a list of farms, and the design job is making those two
read as different **kinds** of thing — otherwise the eye lands on whichever card
happens to be reddest rather than on the answer to "how is everything".

- **One bar, not four numbers.** WF5.001 counts farms by worst plot. Three of
  the four states are usually zero, and "0 Urgent" takes as much room as the
  number the farmer came for, so the counts are a single proportion bar with a
  legend of only the states that occur. `proportionBar()` renders the bar and
  the legend together in one call, because WF2.008 forbids colour on its own
  and a bar is nothing but colour — splitting them would let a screen draw the
  bar alone, which is the thing that must not happen.
- **The summary is the only brand-washed card on the screen.** Every other card
  is white with a status-tinted hairline. No shadows, no second accent.
- **A farm card is two blocks with a hairline between them**: who this is (a
  land glyph, the name, the type icon, the area and the count) and how it is
  doing (WF5.003's one-line summary, with WF5.004's imagery age indented under
  it). Before, all five facts arrived as one paragraph.
- **The land glyph is that farm's own plot outlines**, filled by each plot's
  status — `farmGlyph()`, a few polygons rather than a synthesised raster, so it
  can appear beside every farm without a stall. A farmer recognises the shape of
  their own land faster than they read a name in a list.
- **The list leads with the worst.** WF5.009 asks for severity first, then most
  recently viewed; nothing in a mockup can honestly report the second, so the
  fixture order stands in for it and the sort is stable. A survey waiting to be
  confirmed outranks everything, and a survey still running sinks below the
  farms that have data.

## Two ways to register a farm (§4.10)

A9 is a fork, and WF4.052 insists the two routes carry **equal weight** —
neither dressed as the advanced one.

**Draw my plots myself** suits a farmer who already knows which fields he wants
watched: trace each plot, say what is growing in it, name the farm, pick a plan.

**Survey my whole farm** is for land that is a mixture of orchard, open field,
sheds and a house. The farmer draws **one** line around everything, buildings
included, and the land use algorithm reads what is inside it. Because that takes
15 to 20 minutes, the farm is created straight away in a surveying state and the
farmer goes back to Home — there is no spinner to sit in front of (WF4.072). A
**Farm survey ready** notification brings them back. A survey costs nothing and
needs no payment method on file (WF4.074), which is the point: you find out what
you have before deciding what to pay for.

**A11 — What we found** shows a colour-coded map and the same areas as a list,
in three classes: open field crops including fallow, date palms and fruit trees,
and covered agriculture and structures. Structures start **excluded** (WF4.080)
— a farm with a villa and two warehouses on it should not arrive with the farmer
quoted for the roof of his own house.

Everything on that screen is editable (WF4.081): **split** what the algorithm
merged, **join** what it separated, **redraw** an outline, **remove** an area,
**add** one it missed, and include, exclude or re-classify any of them. The
earlier build refused to reshape anything and told the farmer to exclude the bad
shape and draw it again by hand, which turned one wrong corner into a detour
through two more screens.

That is why `app/data/survey.js` **materialises** the result onto the farm
rather than deriving it. The algorithm is a pure function of the farm id, so the
same farm always comes back with the same areas; but a joined pair is one shape
that no longer corresponds to anything the algorithm returned, so it cannot be
expressed as a decision layered over a derived list. The detected result is
computed once and kept untouched beside the working copy, which is exactly what
WF4.086 asks for: a corrected area records what was found, what it was changed
to, and by whom.

On confirm, every included area becomes a plot, and the farm's type, area and
tree count come from the ground rather than from the question A8 would have
asked. **A13** is then priced from the confirmed scope, per hectare of crop and
per tree, with the arithmetic printed so the farmer can follow it (WF4.099).
Before a survey is confirmed there is no price at all (WF4.091) — there is
nothing to multiply, and inventing a number is the guess the survey exists to
remove. Buying crops only keeps the tree areas on record: adding them later
needs no second survey.

Neither route is spent. Farm settings offers a survey to a farm whose plots were
drawn by hand, and offers hand-drawing to a farm that was surveyed (WF5.047).

## Where a task can come from (§5.8.1)

Worth stating on its own, because it is the strictest rule in v1.2 and the
easiest to break by adding a helpful button.

Advisory creates tasks. The only other entry point in the whole app is the ADD
button at the bottom right of E1, and WF5.107 leaves no exceptions: not on plot
detail, not on tree detail, not on the tree list, not on the map plot sheet, not
in reports. Earlier builds had all five, plus a bulk "create one task for these
70 trees" on the filtered tree list — the last exception, and WF5.055 now
removes it explicitly: filtering to a condition is an **analytics** view, and
where those trees need work the advisory layer raises it.

WF5.110 adds the reason it is safe to make manual creation this quiet: it is
expected to be rare. It is built to work, not built to be prominent.

## Deviations from the specification

Every identifier in the build and in the reviewer panel exists in v1.2, and
every inline citation lands in the section that owns the screen it sits on. The
mapping from v1.1 was made by matching requirement text across the two
documents, not by position — inserting one requirement renumbers every one after
it in its section, so the number is never the stable thing.

**The one deviation carried over from v1.1 has been resolved**: `WF5.081` puts
the search bar back on C1, visible at all times, and `WF5.083` puts a Find a
tree control on the map itself. Both are now in the build, and the map still has
no app bar — v1.2's own wireframe draws the search field on the map rather than
in a bar above it.

### When does a suggested task exist?

Review asked a sharper question than the spec answers: an advisory item arrives
"pre-packaged as a task" — does that task **exist** the moment the advice is
generated, or only once the farmer taps Assign? It changes what the task list
contains on a morning nobody has opened the app.

**The build takes the first reading.** A suggested task exists as soon as its
advice does, and E1 shows it under SUGGESTED — unassigned, undated, waiting for
disposal. Nobody has been sent anything, so it carries no badge (`WF3.004`
counts what is assigned to *you* and due), and it disappears the moment the
advice is assigned, ignored or recorded as done. The alternative leaves the task
list empty on exactly the morning it should be most useful, and turns
"pre-packaged" into a description of a form rather than of a thing.

### What differs

Six things, each a deliberate answer to review feedback, listed so the
requirement can be amended rather than quietly diverged from.

| Where | What differs | What the spec might say |
|---|---|---|
| **B1 refresh** | **No refresh control on Home**, and no pull gesture behind it. `WF5.010` asks for pull-to-refresh with a visible button as the non-gesture equivalent. | **Drop it, or say what it refreshes.** Imagery arrives on a satellite's schedule, not the user's, and `WF5.004` already prints how old it is — so the button redrew the same numbers and taught the farmer to distrust the timestamp beside them. If a manual sync is wanted, it belongs beside the pending-items count, not above the farm list. |
| **B1 connectivity** | **No online indicator on Home.** `WF11.012` asks for three states with a pending count. Offline and syncing are strips across every screen; online shows nothing. | **Two states, not three.** A green badge reporting the absence of a problem occupies the app bar all day and is read exactly once. The two states worth interrupting for still interrupt, everywhere, from `shell.js`. |
| **B9 / B10 / Show me where** | **No distance to the target tree, and no line drawn to it.** §5.7.1's identification by GPS proximity and heading stays; the readout does not. | **Nothing, but worth recording.** A dashed line across a picture of a plantation reads as a route, which it is not, and a bare "1.3" invited the obvious question with no answer worth giving at eight-metre spacing. Direction, row and position are what walk somebody to the right trunk. |
| **F2–F4** | **Removed.** `WF5.168`–`WF5.173` specify a Team and access screen. | **Fold it into §5.6.** Invitations are issued from the worker record, which is where the person is already described and where their history lives. Two lists of the same people is how an invitation code ends up with nothing to attach to. |
| **A13** | The plan cards show the monthly price only. `WF4.100` asks for **both a monthly and an annual figure** on each card. | **Drop the annual figure, or move it.** Two prices and a "two months free" line on each of two cards is four numbers competing with the one the farmer is deciding on, and the working underneath (`124 dunum × SAR 4.00`) is what makes the monthly figure trustworthy. |
| **Filters (D1, B9, C2)** | Filter chips paint at 36 dp inside a 48 dp touch target, and use a tint rather than a fill. | **Nothing, but worth confirming.** `WF2.004` is read here as "the *target* is 48 dp", not "the control looks 48 dp" — the standard reading, and what makes a filter row possible at 360 dp. Separately, its "8 dp between adjacent targets" rules out a joined segmented control anywhere in the product. |

Two judgement calls worth flagging, both made because the spec is silent rather
than because it was overruled:

- **Joining two surveyed areas takes the convex hull** of the two outlines, and
  the class of the larger member. A true polygon union would need real clipping
  for a shape the farmer then edits by hand anyway.
- **An estate is adjoining farms drawn as one continuous map**, not three
  outlines on a shared canvas. Which farms adjoin is data (`adjoins` on the farm
  record) and the geometry honours it — a neighbour is placed against its
  fence line rather than in the next grid cell — so "show me all the plots
  together for my 3 farms, because they're neighbouring" is a real view rather
  than a drawing option. It sits in the farm picker beside All farms.
- **The circular plots** on the map used to be derived from a farm's irrigation
  system being "centre pivot". WF4.096 removes that field from the schema
  entirely, so the shape is now drawn from the plot's own seed. A centre-pivot
  field really is a circle from above; only the thing it was inferred from has
  gone.

## Known limits

- All 1,324 strings are translated into all five languages, interface and
  advisory content alike (WF10.013), but the translations are machine-produced
  and **unreviewed**. WF10.012 requires a named reviewer per language before
  release. The coverage bars on F8 read from the live catalogue, and any key
  that were missing would fall back to English and be logged, exactly as
  WF10.014 specifies.
- Pinch-zoom on the map is buttons rather than gestures, since the mockup is
  driven with a mouse as often as a finger.
- The capability and entitlement checks here are client-side by necessity. In
  the product both are resolved server-side on every request (WF8.009,
  WF8.010, WF9.036).
- The advisory items are authored, not generated. The four card actions, the
  deferral and the advised-versus-applied record all behave, but nothing
  recalculates: correcting an assumption on D2 says future advice will use it
  and does not produce a new recommendation.
