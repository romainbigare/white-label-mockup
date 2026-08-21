# Wafra Farm App — interactive UI mockup

An interactive mockup of every screen in the **White Label Farm App Build
Specification** (`specifications/`). It is user interface and user experience
only: no backend, no real authentication, no real satellite imagery. Anything
that could not be mocked without a server is pretended, visibly and
consistently.

The bar reads **mockup v1.5 · spec v1.5**, and the two numbers answer different
questions even when they agree. **The first is this build of the screens** —
three rounds of review applied, the latest being the comments on the 21 August
deck. **The second is the requirement set it is built against**: v1.2 is the
last specification issued as a document, and the reviews have amended it since.
The requirement identifiers throughout are still v1.2's, for the reason given
under [Deviations](#deviations-from-the-specification); v1.5 is the requirement
set as it now stands, not a PDF in `specifications/`. Both are set in one place,
`app/meta.js`, and the markup carries no copy of either.

**Live:** enable GitHub Pages (see below) and open
`https://<owner>.github.io/white-label-mockup/`

---

## What is in it

Every screen in the App Map of §3.2, keyed by its specification identifier:

| Group | Screens |
|---|---|
| First run | A1 language · A2 get started · A3 log in · A4 guided tour · A5 sign up · A6 verify code · A9 add your first farm (name it, then the fork) · A10 survey my whole farm · A9D draw my own plots · A12 what should our satellite survey · A11 what we found · A13 your plan and price · A14 you're ready · A15 join a farm · reset password |
| Home | B1 my farms · B2 farm detail · B3 plots · B11 farm settings · B12 add farm |
| Plots | B4 plot detail · B5 crop cycles · B6 add/edit cycle · B7 measure viewer · B8 compare |
| Trees | B9 tree list · B10 tree detail (with the locator map) |
| Workforce | G1 workforce · G2 add a worker · G3 worker record |
| Map | C1 map · C2 layers · C3 plot sheet · C4 compare dates · C5 boundary editor |
| Advice | D1 inbox · D2 irrigation · D3 nutrition · D4 crop protection · D6 weather · D7 record what you did |
| Tasks | E1 tasks / my work · E2 task detail · E3 new task · E4 complete task · E6 field observation · E7 photo disease check |
| More | F1 reports · F5 subscription · F6 compare plans · F7–F10 settings · F11 activity log · F12 help · F13 contact · F14 profile |

Two codes are not in the App Map: **A9D**, the drawing canvas behind A9's "draw
my own plots" route, which §4.10.1 describes but does not number; and
**FORGOT**, reached from A3's "forgot your password?".

**The App Map is two lists.** `SCREEN_GROUPS` says which drawer a screen is
filed in — First run, Home, Plots — and `FLOWS`, beside it, says what it comes
after and what it leads to. They answer different questions: the first is how
the deck and the harness index are ordered, the second is what a farmer actually
walks through, which is why registration appears there twice. Every step in
`FLOWS` is a route the code takes, traced from the `go()` calls rather than from
the document, and not every screen is on one — Settings and the map are places
you go rather than steps you pass through.

**Two versions, and they are not the same thing.** `app/meta.js` holds both, and
the harness bar prints both — `mockup v1.5 · spec v1.5`. `MOCKUP_VERSION` is
this build of the screens and moves when they do; `SPEC_VERSION` is the
requirement set they are built against. They agree today and will not always: a
screen can be redrawn without a rule changing, and a rule can change without a
screen moving. A comment about a screen and a comment about a requirement have
to be tellable apart six weeks later.

**A12 has moved twice and changed its question.** It used to sit after the
survey and ask for the farm's name and what was on it. It asks one thing now —
crops, trees or both — which is what decides the scope the survey comes back
with and what the plan pages are filtered to; and since the 21 August review it
asks it **last**, over a boundary that has already been drawn, which is also
where the quote is asked for. The farm's name went the other way, up to A9,
where it is now the first thing on the flow and required.

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

Two things make it safe to draw sixty screens into a running app. Rendering
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
npm run deck                      # docs/Wafra_Farm_App_Screens.pptx — one A4
                                  #   landscape page per screen, right side blank

git worktree add /tmp/before <ref>            # a review document: before and after,
ln -s "$PWD/node_modules" /tmp/before/        #   one block per screen
node tools/reviewdoc.mjs --before /tmp/before \
     --data tools/reviewdoc.180826.json \    #   which notes to typeset
     --out docs/PowerPoint_Comments_180826.pdf
git worktree remove /tmp/before               # both default to the v1.3 round

python3 tools/pdftext.py in.pdf out.txt         # the specification, as text
python3 tools/specdiff.py old.txt new.txt       # requirement-by-requirement diff
```

`npm run deck` builds the screen deck — 70 pages: a cover, every screen listed
with the page it is on, a green divider per section, and then one page per
screen with the phone down the left and the right two thirds left empty to write
on. A screen that sits on a path through the app also carries that path across
the top right, arrows and all, with the screen you are looking at picked out;
`FLOWS` in `screens/index.js` is where those paths are declared, and the tool
refuses to build if one of them names a screen that no longer exists.

Nothing in it is maintained by hand — the screen list and its order come from
`SCREEN_GROUPS`, the paths from `FLOWS`, the titles and speaker notes from the
registry, the version from `app/meta.js`, and the logo is photographed out of
the running page through the same CSS every screen's logo uses, so a re-labelled
app produces a re-labelled deck. The output is **not committed**: it is 18 MB
and it is a snapshot of HEAD rather than a record of anything, unlike the review
documents beside it. Run the command when you need a copy.

The contents page is a list rather than a wall of thumbnails, which was the
other way to do it and is not one: fifty-nine phones on an A4 page are 14 px
wide — a coloured smudge rather than a screen anyone could recognise — and there
is no room left beside them for the name, which is what a screen gets looked up
by.

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
contact sheet and checks that all 60 tiles drew, in English, without disturbing
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
| SMS codes | Any four digits continue; `0000` simulates a wrong code so the five-attempt lockout of WF4.040 can be seen. |
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
  farms that have data. The severity is the farm's **worst plot**, not the
  `status` field on the record — that field only means anything for a farm with
  no plots at all, and sorting on it put every farm that had data into one
  undifferentiated block.
- **All farms and By farm are two views, not a filter.** WF5.007 makes the
  combined view first class: *All farms* is one row carrying the totals and a
  map toggle, then every plot across every holding in a single list, worst
  first; *By farm* is the farm cards. Switching is one tap on the screen you are
  already on, which is the part WF5.007 is actually protecting. WF5.008's map
  toggle sits on both — beside each farm, and beside the All farms row — and
  sets the map's own farm filter rather than passing a route parameter, because
  the map is a tab with its own stack and a filter is what it already
  understands.
- **A card is a box, not a button.** A second control on a card that is itself
  one big target means a button inside a button, which the DOM will not stand.
  So the card's content is one full-width button and the map toggle is lifted
  out of its flow and pinned to the corner.

## One person, two stages (§5.6)

The biggest structural idea in the build, and the one most easily got wrong: a
**person record and an app account are the same identity at different moments**,
and the mobile number is what joins them.

- **Saving a record looks the number up.** If an account already holds it, this
  record *is* that person, so it attaches — and G2 says whose account it is, by
  name, before anything is written. If the owner did not mean that person, the
  number is wrong, and that is worth interrupting for. If no account holds it, a
  standalone record is made: no account, no invitation, nothing installed.
- **Registering later attaches too**, as does redeeming an invitation. The code
  is bound to the person record, which is what makes redemption an *attachment*
  rather than a registration — their language, notification preferences and
  everything they have finished are already on the record, so nothing has to be
  carried across. Nobody ever appears twice.
- **The delivery pipe falls out of it.** `deliveryFor()` answers SMS/WhatsApp
  while `accountId` is null and push once it is set. Same record, same task,
  different pipe — and no screen has to ask what kind of person it is holding.
- **History follows the person, not the id.** `identityIds()` returns every id
  that has ever meant this person, and `tasksForAssignee()` takes the set, so
  work assigned before someone had an account still shows on their record after
  they get one. In the fixtures, Ahmed Rahman's record carries the three tasks
  assigned to `user-3`.

`tools/smoke.mjs` checks all four: that some record is attached at all, that no
name appears twice in the assignee list, that the task count is the same whether
you ask by record id or by account id, and that the pipe follows the attachment
rather than the channel toggles.

The **job title** is still a field. No requirement defends it any more; it stays
because it is what the owner searches on — "who do I send the spraying to" is
answered by a job far faster than by a list of names.

## Two ways to register a farm (§4.10)

A9 is a fork, and WF4.052 insists the two routes carry **equal weight** —
neither dressed as the advanced one. Each card says **when to choose it**, in
those words — "Choose this option if you want all cultivated areas monitored on
your farm" — because equal weight is not the same as equal clarity: the two
routes answer different questions, and a farmer who picks the wrong one pays for
land he did not want watched. Both cards are drawn by one component that A9 and
B12 share, so the second farm cannot come to be described in different words
from the first.

**The farm is named first, and the name is required.** Everything under it is a
decision about one particular farm, and a farmer with two of them decides
differently for each; until there is a name, neither route card can be tapped.
The placeholder still shows the number the farm would have been given, so the
field says what a good answer looks like without taking silence as one.

**The land unit is asked here** too, above the fork: dunum or hectare,
pre-selected from the country (WF4.043). It used to be the tail of A7, "tell us
about you", which is where it went wrong — a unit is not a fact about the
farmer, it is how he reads an area, and it now stands one screen before the
first area the app prints.

**Draw my own plots** suits a farmer who already wants two particular fields
looked at: trace each plot, give it a name, pick a plan. It does not ask what is
growing there — the survey detects that, and a question whose answer we already
hold is a chance to be wrong.

**Survey my whole farm** is for land that is a mixture of orchard, open field,
sheds and a house. The farmer draws **one** line around the growing land, and
the land use algorithm reads what is inside it. Because that takes 15 to 20
minutes, the farm is created straight away in a surveying state and the farmer
goes back to Home — there is no spinner to sit in front of (WF4.072). A **Farm
survey ready** notification brings them back. A survey costs nothing and needs
no payment method on file (WF4.074), which is the point: you find out what you
have before deciding what to pay for.

**A10 is a map, one sentence and one button.** The instruction lives in the app
bar, over the farm's name, because that is where the farmer is already reading;
the panel that used to sit under the map — an area readout and the same
instruction again — has gone. The area was the running total of a bill nobody
had been quoted for yet, printed twice the size of the sentence explaining what
to draw, and A13 is where a number about money belongs. The button says
**Continue**, because A10 no longer ends anything.

**Both drawing screens carry the farm's name**, given on A9, so nobody traces a
boundary for a farm he cannot see the name of. A9D's bar reads **Farm 1 · Plot
1** over *Trace your plot boundary*; A10's reads the farm name over the drawing
instruction.

**A12 asks one question, and asks it last**: what to look at — crops, trees, or
both. Not "what is growing here" — the imagery answers that — but what the
farmer wants **covered**, which is a commercial question no algorithm can
answer. Asking before the survey runs is what stops the result coming back full
of fallow ground a date grower then has to switch off one row at a time. Each
option says how it is **priced**, per area or per tree, because that is the half
of the choice the farmer is actually making. It is also where the quote is asked
for — **Send a quote**, with the 15-to-20-minute wait under it on the route that
actually waits — because by then the farmer has drawn his land and said what he
wants watched, which is everything the price is made of.

**The two boundaries are different colours.** A plot outline is green; a farm
outline is blue. They are drawn by the same component with a `tone`, and the
distinction matters on the one screen where a farmer has just drawn one and is
about to draw the other. Blue rather than brown: the basemap is tan desert soil,
and a brown line over it is a line nobody can see.

**Nobody knows their coordinates.** The map search used to offer "a place or
coordinates"; it now opens the three ways in that people actually have — search
on the map, enter a town or locality, or use the phone's own position.

**A11 — What we found** shows a colour-coded map and the same areas as a list,
in two classes: open field crops including fallow, and date palms and fruit
trees. **There is no third class.** Covered agriculture and structures used to
be one, arriving excluded so that nobody was quoted for the roof of his own
house — but reading buildings off satellite imagery is a government-level
service rather than a farm one. The farmer is not buying it, cannot act on it,
and a villa listed among his fields is a row he has to think about and then
dismiss.

Each row reads left to right — what it is, then **Keep**, **Remove**, **Edit**.
Removing greys the row rather than deleting it, and Keep puts it straight back,
because a farmer taking four fields off a quote should be able to change his
mind without redoing the survey. The five edits of WF4.081 are a **toolbar** —
Join, Split, Remove, Add on one line — and choosing a tool asks which plots it
applies to. Before, joining meant discovering that tapping a second row while a
first was selected silently built a set, which is a gesture nobody performs by
accident and therefore nobody performed at all.

**A tree farm gets none of that.** A date grower with 8,000 palms across nine
blocks does not want a plot-by-plot menu; he wants to know how many trees were
found and of which kinds. So where the coverage is trees only, A11 is a count
and a choice of tree type.

**No price appears on A11**, on a tree farm or any other. `WF4.091` holds
without exception: pricing follows a confirmed scope and never runs alongside
one. Every Keep, Remove and Join on this screen changes the quantities, so a
figure printed beside them is one the farmer could reasonably hold us to and
that we would then have to revise — which is the whole failure the rule exists
to prevent.

That is why `app/data/survey.js` **materialises** the result onto the farm
rather than deriving it. The algorithm is a pure function of the farm id, so the
same farm always comes back with the same areas; but a joined pair is one shape
that no longer corresponds to anything the algorithm returned, so it cannot be
expressed as a decision layered over a derived list. The detected result is
computed once and kept untouched beside the working copy, which is exactly what
WF4.086 asks for: a corrected area records what was found, what it was changed
to, and by whom.

On confirm, every included area becomes a plot carrying the name it already had
on A11, and the farm's area and tree count come from the ground. **A13** is
priced from the confirmed scope, per hectare of crop and per tree, with the
arithmetic printed so the farmer can follow it (WF4.099). Before a survey is
confirmed there is no price at all (WF4.091) — there is nothing to multiply, and
inventing a number is the guess the survey exists to remove. Buying crops only
keeps the tree areas on record: adding them later needs no second survey.

Neither route is spent. Farm settings offers a survey to a farm whose plots were
drawn by hand, and offers hand-drawing to a farm that was surveyed (WF5.047).

## What a plot is called (§5.3)

Every plot is named after the farm it belongs to and numbered — **Al Kharj
North Plot 1**, **Al Kharj North Plot 2**. The farm half is looked up at render
time rather than stored, so renaming a farm renames its plots; a copy of the
name on 32 plot records is a copy that goes stale. Screens already inside one
farm show the short form (`Plot 1`) and every list that crosses farms shows the
whole thing, which is what makes a plot name mean something on Home.

The number is spelled out. `P1` saved four characters in a list and cost the
farmer the word that said what he was looking at, and the review asked for it
back: the field where he names a plot he has just traced offers **Plot 1**, and
so does everything downstream of it.

The **crop is never part of the name.** A seasonal plot grows tomatoes this
month and onions the next, and a name that has to be rewritten every season is
not a name.

## Where a task can come from (§5.8.1)

Worth stating on its own, because it is the easiest rule in the product to break
by adding a helpful button.

Advisory creates tasks. The only other entry point in the whole app is the ADD
button at the bottom right of E1: not on plot detail, not on tree detail, not on
the tree list, not on the map plot sheet, not in reports. Earlier builds had all
five, plus a bulk "create one task for these 70 trees" on the filtered tree
list — filtering to a condition is an **analytics** view, and where those trees
need work the advisory layer raises it.

**The spec no longer states this as a blanket rule**, so nothing in the document
would catch the sixth screen to grow a create-task button. `tools/syntax.sh`
catches it instead: it asserts that the only modules in the build which open E3
are `advice.js` and `tasks.js`, and fails naming the file that broke it. A
withdrawn requirement is a fine reason to stop citing a number, and a poor
reason to lose the guarantee.

Manual creation is quiet because it is expected to be rare. It is built to work,
not built to be prominent.

## Deviations from the specification

> **The identifiers are v1.2's.** The specification has moved on since — A8 is
> gone, soil and the irrigation rule have left A12, the estate view and four
> task-origin requirements have been withdrawn, and §5.6 has been rebuilt. The
> screens here follow all of that. The `WF…` numbers do not yet, because
> deleting a requirement renumbers every one after it in its section and the
> mapping can only be made against the document. Where a requirement is known to
> be withdrawn its citation has been dropped rather than left pointing at
> whatever now holds that number; the rest await the next PDF.

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

### What the 18 August review changed in the requirements

**`WF4.038` now asks for a four-digit code.** It asked for six; the review asked
for four "unless there is a strong security reason to have 6 digits", and there
is not one that survives the rest of the rule: the code lives for ten minutes,
five wrong tries lock the account for fifteen (`WF4.040`), and the attacker's
budget against a four-digit code under those two constraints is five guesses in
ten thousand. What two extra digits buy is a longer thing to hold in your head
while switching apps to read it. The requirement is updated rather than deviated
from, and if a supplier's SMS provider or a market regulator ever requires six
it is one constant — `OTP_LENGTH` in `onboarding.js`.

**A7 no longer exists, and §4.8's requirements are spread across three
screens.** `WF4.041` (name mandatory), `WF4.042` (show/hide on the password) and
`WF4.044` (workers need no password) sit on **A5**, because they are what
creating an account consists of and splitting them across a code entry made the
account a two-part form for no reason. `WF4.043` (the land unit, pre-selected
from the country) sits on **A9**, one screen before the app first prints an
area. `WF4.045` — reaching the app through Create an account makes you an Owner
— is now the signup branch of **A6**. Nothing in §4.8 has been dropped; the
screen that carried them has.

### What the 21 August review changed in the requirements

**A password reset goes to the registered mobile number only.** `WF4.023` is
read here as a reset by code, not as a reset by *either* identifier: FORGOT used
to take a number or an email and send the code to whichever was typed, which
made an address the app never verifies (`WF4.033` collects it; nothing checks
it) a way into an account. The number is the one thing registration proves, and
in this market it is the thing tied to a government ID. Logging in is unchanged
— **A3 still takes either**, because an identifier is not a second factor.

The consequence is that a farmer who has lost the number cannot reset at all, so
the screen carries the way round it: the support address and the WhatsApp number,
which are now in `content.json` beside the rest of what F13 tells the farmer is
loaded from our servers, rather than written out twice in `overlays.js`.

**`WF4.072` and `WF4.073` moved from A10 to A12.** The farm record is still
created the moment the quote is asked for and the farmer still goes straight
back to work with the wait stated — it is just that the quote is now asked for
one screen later, after he has said what he wants covered.

### When does a task exist?

Review asked a sharper question than the spec answers: an advisory item arrives
"pre-packaged as a task" — does that task **exist** the moment the advice is
generated, or only once the farmer taps Assign? It changes what the task list
contains on a morning nobody has opened the app.

**A task is an advice that has been assigned.** Assigning is not a property set
on a task that already exists; it is the event that brings the task into being.
An earlier build took the other reading, materialised a suggested task per open
advice and listed them on E1 under SUGGESTED — which put the same item on two
screens with two sets of buttons, and made "3 tasks today" a number that
included work nobody had been sent.

Everything follows from the rule, and it is worth stating as three rules because
each of them is a button somewhere:

- **Assign and Ignore appear on advice surfaces only** — the D1 card, the
  advice detail dock, and nowhere else.
- **Mark as complete appears on task surfaces only.** It is not on an advice
  card, not in the advice ⋯ menu, and not on the advice detail screen. Closing
  an advice from there shut it behind the back of the worker still holding the
  job, and left the task open with nothing to close it.
- **D7 "Record what you did" is reached from the task**, not from the advice.
  Where a task came from advisory, Mark as done opens D7 rather than E4, because
  the question worth asking about advice is whether the advised amount was the
  amount applied — which is what feeds advised-versus-applied on the plot.

`assignAllAdvice()` is the one bulk path, and it goes through `createTask()`
like every other assignment, so a batch of fourteen differs from one by hand in
nothing but the number of forms the farmer had to open.

### What differs

Six things, each a deliberate answer to review feedback, listed so the
requirement can be amended rather than quietly diverged from.

| Where | What differs | What the spec might say |
|---|---|---|
| **B1 refresh** | **No refresh control on Home**, and no pull gesture behind it. `WF5.010` asks for pull-to-refresh with a visible button as the non-gesture equivalent. | **Drop it, or say what it refreshes.** Imagery arrives on a satellite's schedule, not the user's, and `WF5.004` already prints how old it is — so the button redrew the same numbers and taught the farmer to distrust the timestamp beside them. If a manual sync is wanted, it belongs beside the pending-items count, not above the farm list. |
| **B1 connectivity** | **No online indicator on Home.** `WF11.012` asks for three states with a pending count. Offline and syncing are strips across every screen; online shows nothing. | **Two states, not three.** A green badge reporting the absence of a problem occupies the app bar all day and is read exactly once. The two states worth interrupting for still interrupt, everywhere, from `shell.js`. |
| **B9 / B10 / Show me where** | **No distance to the target tree, and no line drawn to it.** §5.7.1's identification by GPS proximity and heading stays; the readout does not. | **Nothing, but worth recording.** A dashed line across a picture of a plantation reads as a route, which it is not, and a bare "1.3" invited the obvious question with no answer worth giving at eight-metre spacing. Direction, row and position are what walk somebody to the right trunk. |
| **F2–F4** | **Removed.** `WF5.168`–`WF5.173` specify a Team and access screen. | **Fold it into §5.6.** Invitations are issued from the worker record, which is where the person is already described and where their history lives. Two lists of the same people is how an invitation code ends up with nothing to attach to. |
| **A13** | The plan cards lead with the monthly price and state the annual one as a discount off it — "or SAR 8,150 a year, 15% off" — rather than as a second headline figure. `WF4.100` asks for **both figures** on each card. | **Say it as a discount.** Two headline prices on each of two cards is four numbers competing with the one the farmer is deciding on. As a discount it is one number qualifying another, which is also what it is. |
| **Filters (D1, B9, C2)** | Filter chips paint at 36 dp inside a 48 dp touch target, and use a tint rather than a fill. | **Nothing, but worth confirming.** `WF2.004` is read here as "the *target* is 48 dp", not "the control looks 48 dp" — the standard reading, and what makes a filter row possible at 360 dp. Separately, its "8 dp between adjacent targets" rules out a joined segmented control anywhere in the product. |

Two judgement calls worth flagging, both made because the spec is silent rather
than because it was overruled:

- **Joining two surveyed areas takes the convex hull** of the two outlines, and
  the class of the larger member. A true polygon union would need real clipping
  for a shape the farmer then edits by hand anyway.
- **The circular plots** on the map used to be derived from a farm's irrigation
  system being "centre pivot". That field is not in the schema, so the shape is
  drawn from the plot's own seed instead. A centre-pivot field really is a
  circle from above; only the thing it was inferred from has gone.

## What the review changed

[`docs/Mockup_Review_Changes.md`](docs/Mockup_Review_Changes.md) is the written
record of the first review: every comment id in the action list, what was asked,
what was built and where. [`docs/Mockup_Review_Changes.pdf`](docs/Mockup_Review_Changes.pdf)
is the same work as before/after screenshots, one block per screen — rebuild it
with `tools/reviewdoc.mjs`.

[`docs/Session_Changes_180826.md`](docs/Session_Changes_180826.md) lists
everything the second round changed, screen by screen — including the parts no
comment asked for, like the tooling and the translation catalogue.
[`docs/PowerPoint_Comments_180826.md`](docs/PowerPoint_Comments_180826.md) is
that round comment by comment: the thirty comments pencilled onto the 18 August deck, slide by
slide, each with the change it produced and the file it landed in. Three of them
were structural — A7 deleted, the land unit moved to A9, the farm name moved to
the top of A12 — and the rest are wording, colour and one screen that stopped
asking for coordinates.

[`docs/PowerPoint_Comments_210826.md`](docs/PowerPoint_Comments_210826.md) is
the third round, on the 21 August deck: twenty-nine comments across eight
screens. Three of them are structural again — **the middle of registration is
reordered** so the farm is named, then drawn, then asked what to cover; **a
password reset goes to the registered mobile number and nowhere else**; and
**the Find your land sheet is gone**, its two redundant routes folded back into
the map screen that already offered them.

## Open questions from the review

Five items in the review log are not UI changes, or are not settled by one.
They are recorded here because a decision that never got written down is a
decision that gets made again.

| From | Question | Where it stands |
|---|---|---|
| 21 Aug, A5 | **Are all country codes available?** The stated market is MENA from Morocco to Oman, with Africa and Central Asia possible. | **Partly answered.** The picker held nineteen countries — the GCC, Jordan, and the places the workforce comes from — which left Morocco, Algeria, Tunisia, Libya, Iraq and Lebanon out of a list whose own market description names them. It now carries fifty-three: the GCC and Jordan on top (`WF4.035`), then the rest of MENA, sub-Saharan Africa, Central Asia and the Caucasus, and South and South-East Asia. That is a sales footprint, not a complete list — a real registration form should carry every ISO country, and the fixture is the wrong place to decide which farmer is out of scope. |
| `S33` | **Is an annual subscription even offered by the App Store?** The pricing page now states one, at 15% off. | Not verified. Both stores do support annual auto-renewing subscriptions as a product type, but what matters is whether the supplier's own store configuration carries one — and if it does not, the annual line on A13 and F5 is advertising something the purchase flow cannot sell. Worth confirming before this page is shown to a customer. |
| `C438` | **Can a supervisor be asked for task status over WhatsApp, and can a reply drive the app?** | Not built and not mocked. Outbound WhatsApp is already how work reaches a worker without the app (§5.6). Inbound is a different thing entirely: it needs the WhatsApp Business API, a template approval for anything the farm initiates, and a way to bind a reply to a task id. It is a project, not a screen. |
| `C322` | **Should the section be called "workforce notification" or something else?** | Left as **Workforce**. On B2 it sits beside Plots and Trees and carries a headcount — it is the list of people, and the notification settings that go out to them live in F9. If the intent was to name the settings rather than the people, that is F9's title and worth restating. |
| `C354` | **The "irrigation recommendations" label is hard to read.** | No label of that name exists in the current build; the plot page reaches irrigation advice through its primary action, and D2's headings were rebuilt at full contrast in this pass. If the label is still somewhere on a build being reviewed, it is an older one — worth re-checking against this version. |

## Known limits

- 1,357 of the app's 1,397 strings are translated into all five languages,
  interface and advisory content alike (WF10.013), but the translations are
  machine-produced and **unreviewed**. WF10.012 requires a named reviewer per
  language before release. The 40 keys short of the full set are the
  ones the 18 and 21 August reviews reworded or introduced: a translation of the
  sentence that used to be there is not a translation of the one that is, so
  those were dropped rather than left to read plausibly and say the wrong thing.
  They fall back to English and are logged, exactly as WF10.014 specifies, and
  the coverage bars on F8 read the gap from the live catalogue.
- Pinch-zoom on the map is buttons rather than gestures, since the mockup is
  driven with a mouse as often as a finger.
- The capability and entitlement checks here are client-side by necessity. In
  the product both are resolved server-side on every request (WF8.009,
  WF8.010, WF9.036).
- The advisory items are authored, not generated. Assigning, deferring and the
  advised-versus-applied record all behave, but nothing recalculates: correcting
  the efficiency, soil or flow rate on B4 says future advice will use it and
  does not produce a new recommendation.
