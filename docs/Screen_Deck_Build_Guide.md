# Building a screen deck from a running app

A technical account of how `tools/screendeck.mjs` turns the Wafra Farm App mockup
into `docs/Wafra_Farm_App_Screens_v1.5.7.pptx` — 58 A4 landscape pages: a cover,
a contents page, six section dividers and one page per screen, all of it built
from the running app with nothing maintained by hand.

It is written to be portable. Everything Wafra-specific is marked as such, and
§11 is a checklist for pointing the same machinery at a different app. Read §2
first: most of the work of porting is deciding what the new app will expose, and
the rest follows from it.

---

## 0. What you are building, and why it has that shape

The deck exists to be **printed, written on, and handed back**. That single fact
decides nearly every layout choice below, so it is worth stating before any code:

- **One screen per page.** A reviewer's comment has to attach to something.
- **The phone lives in the left third.** The right two thirds are deliberately
  empty. That empty space is the product, not wasted margin.
- **Nothing is ever drawn on top of the screenshot.** Callouts, arrows and
  annotations sit in the white around the phone. A picture with a green
  rectangle across it is a picture the reviewer can no longer read.
- **Everything derives from the running app.** The screen list, the ordering,
  the journeys, the titles, the speaker notes, the version number and even the
  logo are read out of the live page. Nothing drifts, because nothing is copied.

Four kinds of page, in this order:

| # | Page kind | Count in Wafra | Purpose |
|---|-----------|----------------|---------|
| 1 | Cover | 1 | Name, version, screen count |
| 2 | Contents | 1 | Every screen with its page number — the way back out of a 58-page deck |
| 3 | Section divider | 6 | A dark green full-bleed page per section of the app map |
| 4 | Screen page | 50 | The phone, its journey, its callouts, and white space |

---

## 1. The pipeline

```
  static file server (node:http, ephemeral port)
        ↓
  Playwright Chromium, 1500×1000 @ deviceScaleFactor 2
        ↓
  inject WHITE_PAGE stylesheet  ──────────────  §3.3, the one that costs a round to find
        ↓
  read structure out of the page   (SCREEN_GROUPS, FLOWS, registry)   §4
        ↓
  for each screen: jump → settle → clip-screenshot → measure fold → tail shot → thumbnail   §3
        ↓
  close browser, close server, fail the build on any console error
        ↓
  build the page plan and assign page numbers   §5
        ↓
  typeset with pptxgenjs   §6–8
        ↓
  write .pptx, delete the working directory
```

Dependencies are three: `pptxgenjs`, `playwright`, and the app itself. There is
no image library, no headless-browser wrapper, no template file. The deck is a
single 733-line script.

Note the ordering: **all capture finishes before any typesetting begins.** The
browser is closed before `pptxgen` is instantiated. This keeps the two halves of
the script independent and makes the failure modes distinct — a capture problem
never surfaces as a layout problem.

---

## 2. The contract: what the app must expose

This is the part to design first for a new app. The deck builder needs six
things from the page, and nothing else.

### 2.1 A handle on the running app

```js
globalThis.wafra = {
  state, render, SCREENS, OVERLAYS,
  jump: router.jump, go: router.go, openSheet: router.openSheet,
  setLanguage: i18n.setLanguage,
  resetLocal, commit, sel, can,
};
```

Deliberate, and used by three separate tools (the deck, the smoke test, the
review-document builder). The deck needs `jump(route)` to land directly on a
screen without walking there, and `resetLocal(...)` to keep a half-finished
signup from one screen leaking into the next.

If the target app is a React/Vue/Next app, the equivalent is a small
dev-only module that exposes a navigate function and a store reset. Do not try
to drive the app by clicking through it — a 50-screen deck built by simulated
navigation is a deck that breaks whenever a button moves.

### 2.2 A screen registry

```js
const S = (id, title, note, reqs, render, { route } = {}) =>
  [id, { id, title, note, reqs, render, route }];

export const SCREENS = Object.fromEntries([
  S('A1', 'Language',
    'The first thing anyone sees, once, on the first launch. Choose Arabic or '
    + 'Pashto and the whole app turns round to read right to left.',
    ['WF4.011', 'WF4.012'], onboarding.A1),
  // ...
]);
```

Four fields matter to the deck: `id` (the code printed on the page), `title`,
`note` (which becomes the speaker note), and an optional `route` for screens
whose hash route differs from their id. The requirement IDs are Wafra's own —
drop them or replace them with whatever traceability the new app has.

### 2.3 Sections — how screens are filed

```js
export const SCREEN_GROUPS = [
  { name: 'First run', ids: ['A1', 'A3', 'A5', 'A6', 'A9', /* ... */] },
  { name: 'Log in',    ids: ['A3', 'FORGOT', 'A15'] },
  { name: 'My Farm',   ids: ['B2', 'B11', 'B4', 'B5', 'B6', 'B13', 'B10'] },
  { name: 'Map',       ids: ['C1', 'C2', 'C3', 'C4', 'C5'] },
  { name: 'Advice',    ids: ['D1', 'D2', 'D3', 'D4', 'D6', 'D7'] },
  { name: 'More',      ids: ['F0', 'F1', 'F15', /* ... */] },
];
```

Order within a group is the order of the pages. **A screen may appear in more
than one group**, and A3 does: it is the last screen of the registration walk
for somebody who already has an account, and the first screen of the Log in
section. It gets a page in each, so a reviewer reading one section never has to
remember a page number from another. §4.1 covers the deduplication this forces.

### 2.4 An omission list

```js
export const DECK_OMIT = ['B11'];
```

Which screens the *printed review* skips. This is a decision about the review,
not about the app, so it is stated once and explicitly rather than by quietly
leaving something out of the index. Anything registered but not in any group
still gets a page, filed under `Other` — the only way out of the deck is to say
so here.

### 2.5 Flows — the journeys through the app

```js
export const FLOWS = [
  {
    section: 'First run',
    name: 'Signing up, and we survey the whole farm',
    ids: ['A1', 'A3', 'A5', 'A6', 'A9', 'A9B', 'A10', 'A12', 'A11', 'A13', 'A14'],
  },
  { section: 'My Farm', name: 'From the farm to one plot, and what is growing on it',
    ids: ['B2', 'B4', 'B5', 'B6'] },
  { section: 'Map', name: 'Comparing two dates', ids: ['C1', 'C4'] },
  // ...
];
```

Three properties worth copying exactly:

**A flow is a line, not a tree.** This was briefly a branching graph, and the
graph was the wrong answer to a real question. The app does branch; the trouble
is that a diagram of every branch from a screen is a diagram of the whole
product, and the reviewer holding page 21 wants to know what *he* just did and
what happens next. Six tiles of one journey say that. Twenty tiles of a tree say
it less well and take four times the paper.

**Each flow declares its section.** A busy screen sits on several journeys — the
farm screen leads to a plot, a tree group, settings and the map. Which one prints
beside it? The one belonging to the section the page is filed under. The section
is the reviewer's context, and the flow follows it:

```js
const flowFor = (id, sectionName) =>
  flows.find((f) => f.section === sectionName && f.ids.includes(id))
  ?? flows.find((f) => f.ids.includes(id))
  ?? null;
```

**Order within a section is a tiebreak.** A screen on two flows of the same
section takes the first declared. That is why the whole-farm registration route
is declared before the drawn-plots one, and why the guided tour is declared last.

**Name them the way a user would describe what they are doing**, not the way the
app map labels them. "Signing up, and we survey the whole farm" earns its place
on the page in a way that "Flow A" does not.

### 2.6 Deck marks — controls that declare themselves

A printout cannot be tapped, so a small icon button that opens a whole screen
and one that does nothing much look identical in a photograph. The app lets a
control declare itself:

```js
/* THIS IS NOT AN ANNOTATION IN THE APP. Nothing here renders: they are data
   attributes, invisible on screen and read only by the deck builder. The app
   declares the truth once, where the control is; the paper draws it. */
export function deckMark({ deckTo, deckNote } = {}) {
  const out = {};
  if (deckTo)   out['data-deck-to']   = deckTo;    // the screen code it leads to
  if (deckNote) out['data-deck-note'] = deckNote;  // what it opens, in place
  return out;
}
```

Used at the call site, spread into the element's props:

```js
export function barAction(iconName, label, onclick, opts = {}) {
  return h('button.iconbtn', {
    onclick, 'aria-label': label, title: label,
    ...deckMark(opts),
  }, icon(iconName, 22), h('span.iconbtn__label', label));
}
```

The review was explicit that a user must never read "(D1)" on a button. Data
attributes keep the declaration next to the truth it describes and out of the
interface entirely.

### 2.7 Two DOM requirements

- **A stable device element** (`#device`) whose bounding box is exactly what to
  photograph.
- **A named app scroller** (`.app__scroll`) — a single element whose
  `scrollHeight` against `clientHeight` gives the fraction of a screen that a
  screenshot cannot show. Without this, §3.5 has nothing to measure.

---

## 3. Capture

### 3.1 Serving the app

The app is `file://`-hostile because it uses ES modules, so the script serves the
repo itself on an ephemeral port. Twenty lines, no dependency:

```js
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.avif': 'image/avif', '.png': 'image/png',
};
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = join(ROOT, url === '/' ? 'index.html' : url);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
```

For an app with a build step, run its dev server or serve `dist/` instead — but
keep the ephemeral port and the tear-down, so two runs never collide.

### 3.2 The browser

```js
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// deviceScaleFactor 2 puts the 390px phone at ~300 dpi across 2.8" of paper.
const page = await browser.newPage({
  viewport: { width: 1500, height: 1000 },
  deviceScaleFactor: 2,
});

const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });

await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);
```

The **console error collector** matters more than it looks. Fifty screens are
rendered unattended; without this, a screen that throws halfway through its
render is photographed mid-collapse and nobody notices until the deck is
printed. Errors are collected during capture and the build fails after the
browser closes, so the message is complete rather than truncated at the first
failure:

```js
if (problems.length) {
  console.error(`${problems.length} console errors while capturing:`);
  for (const p of problems.slice(0, 8)) console.error(`  ${p}`);
  process.exit(1);
}
```

**Resolution arithmetic.** The device is 390 × 844 CSS px plus a 14 px bezel on
each side — 418 × 872. At `deviceScaleFactor: 2` the clip is 836 × 1744 real
pixels, printed 2.69″ wide, which is 311 dpi. That is the number to aim for; work
backwards from your own device metrics and print width.

### 3.3 The white page — the trap that costs a round to find

```js
/* Applied to the page for the capture and never saved. The phone has to sit on
   the paper the deck is printed on, not on the reviewer harness. */
const WHITE_PAGE = `
  html, body { background: #ffffff !important; background-image: none !important; }
  .stage { background: #ffffff !important; }
  .device__bezel { box-shadow: 0 0 0 2px #0b100e !important; }
`;
await page.addStyleTag({ content: WHITE_PAGE });
```

Two distinct bugs, one cause. **The clip is the device's bounding box, but the
bezel is a rounded rectangle inside it**, so the four corners of every screenshot
show whatever is behind the phone. In the harness that is a dark green page,
which lands in the deck as four black wedges around every screen. And the bezel's
own 60 px drop shadow, which the clip slices into a grey smear along the edges.

Both are turned off for the capture and only for the capture. The same trap
catches the logo (§3.8): an element screenshot photographs whatever is behind a
transparent element.

If you take one thing from this document into a new app, take this: **before
photographing anything, neutralise the background behind it.**

### 3.4 One screen at a time

```js
for (const screen of screens) {
  // A second filing of the same screen borrows the first one's photographs
  // rather than taking them again — same route, same app, same picture.
  const twin = firstFiling.get(screen.id);
  if (twin !== screen && twin.file) {
    Object.assign(screen, {
      file: twin.file, ratio: twin.ratio, hidden: twin.hidden,
      tail: twin.tail, thumb: twin.thumb, marks: twin.marks,
    });
    continue;
  }

  // resetLocal keeps a half-finished signup from one screen out of the next.
  await page.evaluate((route) => { wafra.resetLocal('signup'); wafra.jump(route); }, screen.route);
  await page.waitForTimeout(160);

  const shot = await page.evaluate(() => {
    const r = document.getElementById('device').getBoundingClientRect();
    const scroller = document.querySelector('#device .app__scroll');
    const hidden = scroller && scroller.scrollHeight > scroller.clientHeight
      ? 1 - scroller.clientHeight / scroller.scrollHeight
      : 0;
    return { clip: { x: r.x, y: r.y, width: r.width, height: r.height }, hidden };
  });

  screen.file  = join(WORK, `${screen.id}.png`);
  screen.ratio = shot.clip.height / shot.clip.width;
  screen.hidden = shot.hidden;
  await page.screenshot({ path: screen.file, clip: shot.clip });
  // ... tail shot, thumbnail, marks
}
```

The fixed 160 ms settle is crude and works because the app renders
synchronously. An app with data fetching or entry animations wants
`waitForFunction` on a render-complete signal instead — a flag the app sets, or
`waitForLoadState('networkidle')` per screen.

### 3.5 How much of a screen is below the fold

A screenshot is only the part of a screen that fits on the phone, and some
screens are lists running well past the bottom of it. The app's own scroller
gives the answer exactly: what it can show against what it holds.

```js
const HIDDEN_ENOUGH = 1 / 6;
```

Above that threshold the page carries a quiet note under the phone:

```js
if (screen.hidden >= HIDDEN_ENOUGH) {
  s.addText(`Scrolls · about ${Math.round((1 - screen.hidden) * 20) * 5}% of this screen is shown above`, {
    x: MARGIN, y: SHOT_Y + SHOT_H + 0.06, w: 3.2, h: 0.22,
    fontFace: FONT, fontSize: 8, italic: true, color: FAINT, margin: 0,
  });
}
```

Two details worth carrying over. `Math.round(x * 20) * 5` rounds to the nearest
5%, because a printed caption reading "about 63%" implies a precision the number
does not have. And it states the share that **is** shown rather than the share
hidden, because the other way round is easy to misread — "85% hidden" is nearer
seven times more content, not 85% more.

One caution from experience: the threshold constant and the prose describing it
drifted apart. The comment said a sixth, the constant said a quarter, and the
gap stayed invisible until a review asked for the bottom of a screen that hides
exactly 20% of itself. If a rule is stated in prose, assert it in code.

### 3.6 The tail shot

A note saying content is missing is weaker than showing it. Every screen past
the threshold carries a second, smaller shot of itself scrolled to the end:

```js
if (shot.hidden >= HIDDEN_ENOUGH) {
  await page.evaluate(() => {
    const sc = document.querySelector('#device .app__scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  });
  await page.waitForTimeout(120);
  const full = join(WORK, `${screen.id}-tail-full.png`);
  await page.screenshot({ path: full, clip: shot.clip });
  screen.tail = join(WORK, `${screen.id}-tail.jpg`);
  await shrink(full, screen.tail, TAIL_PX, 'image/jpeg');
  await page.evaluate(() => {                       // put it back for the marks pass
    const sc = document.querySelector('#device .app__scroll');
    if (sc) sc.scrollTop = 0;
  });
}
```

The scroll reset at the end is not optional — the marker pass (§4.3) reads
positions off the rendered page and must see the same view the main screenshot
did.

### 3.7 Resizing without an image library

The browser is already open and has a canvas. That beats adding a dependency for
one call:

```js
async function shrink(src, out, width = THUMB_PX, mime = 'image/png') {
  const b64 = (await readFile(src)).toString('base64');
  const small = await page.evaluate(async ({ data, width, mime }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round((width * img.height) / img.width);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime, 0.84).split(',')[1];
  }, { data: b64, width, mime });
  await writeFile(out, Buffer.from(small, 'base64'));
}
```

Two sizes are produced: `THUMB_PX = 120` for filmstrip tiles, and `TAIL_PX = 520`
for the second shot. Thumbnails are only made for screens that actually appear
in a flow (`if (inAFlow.has(screen.id))`), which is what holds the deck to 118
distinct images rather than one per screen per size.

### 3.8 Photographing the logo out of the page

The brand mark is not kept as a second copy of the artwork beside the deck
builder. It is photographed out of the running app through the same CSS every
screen's logo uses, so a re-labelled app produces a re-labelled deck with nothing
here to change:

```js
const rect = await page.evaluate(() => {
  const stage = document.createElement('div');
  stage.id = 'deck-logo-stage';
  stage.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#ffffff;';
  const el = document.createElement('span');
  el.id = 'deck-logo';
  el.className = 'logo logo--lockup';
  el.style.cssText = '--logo-h:400px;';       // large, so the deck downsamples rather than upscales
  stage.append(el);
  document.body.append(stage);
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
await page.locator('#deck-logo').screenshot({ path: logo.path });
await page.evaluate(() => document.getElementById('deck-logo-stage')?.remove());
logo.ratio = rect.w / rect.h;
```

The white stage is the §3.3 trap again: the artwork is a background image on a
transparent span, and the first run of this took the harness bar and half of the
first screen along with the lockup.

The brand side of the contract is one module:

```js
export const BRAND = {
  name: 'Wafra',                                    // short form, for app bars
  product: 'Wafra Farm App',                        // long form
  art: { width: 416, height: 133, markWidth: 134 }, // geometry of the asset
};
```

with the aspect ratio mirrored in CSS, so `--logo-h` drives the width:

```css
.logo--lockup { width: calc(var(--logo-h, 40px) * 416 / 133); }
.logo--mark   { width: calc(var(--logo-h, 40px) * 134 / 133); }
```

---

## 4. Reading the structure out of the app

One `page.evaluate` pulls the whole map across:

```js
const { sections, flows } = await page.evaluate(async () => {
  const { SCREEN_GROUPS, FLOWS, DECK_OMIT } = await import('/app/screens/index.js');
  const registry = wafra.SCREENS;
  const omit = new Set(DECK_OMIT);
  const pick = (s, group) => ({ id: s.id, title: s.title, note: s.note, route: s.route ?? s.id, group });
  const keep = (ids) => ids.filter((id) => registry[id] && !omit.has(id));

  const out = SCREEN_GROUPS
    .map((g) => ({ name: g.name, screens: keep(g.ids).map((id) => pick(registry[id], g.name)) }))
    .filter((g) => g.screens.length);

  // Anything registered but ungrouped still gets a page rather than being
  // silently dropped — the only way out of the deck is to say so in DECK_OMIT.
  const listed = new Set([...out.flatMap((g) => g.screens.map((s) => s.id)), ...omit]);
  const rest = Object.values(registry).filter((s) => !listed.has(s.id)).map((s) => pick(s, 'Other'));
  if (rest.length) out.push({ name: 'Other', screens: rest });

  return { sections: out, flows: FLOWS.map((f) => ({ name: f.name, section: f.section, ids: [...f.ids] })) };
});
```

Note that only plain data crosses the boundary — the render functions stay in the
page. Anything returned from `page.evaluate` must be structured-cloneable.

### 4.1 One entry per filing, deduped by id

Because a screen can be filed in two sections, `screens` holds **one entry per
filing** and anything keyed by screen id has to dedupe:

```js
const screens = sections.flatMap((s) => s.screens);
const known = new Set(screens.map((s) => s.id));
const firstFiling = new Map();
for (const s of screens) if (!firstFiling.has(s.id)) firstFiling.set(s.id, s);

// What the cover counts: screens, not pages. A3 has two pages and is one screen.
const DISTINCT = firstFiling.size;
```

Three consequences run through the rest of the script:

1. The photograph is taken once and shared (§3.4).
2. The cover counts distinct screens; the contents page lists filings, so a
   twice-filed screen appears twice with the right page number each time.
3. Marker arrays must be **copied** per filing, or laying out one page's discs
   moves the other page's:
   ```js
   for (const screen of screens) screen.marks = screen.marks.map((m) => ({ ...m }));
   ```

### 4.2 The orphan check

A flow naming a screen that no longer exists is a flow that has quietly stopped
being true, which is exactly what nobody notices. The build refuses:

```js
const orphans = flows.flatMap((f) =>
  f.ids.filter((id) => !known.has(id)).map((id) => `${f.name}: ${id}`));
if (orphans.length) {
  console.error('FLOWS names screens that are not in the registry:');
  for (const o of orphans) console.error(`  ${o}`);
  await browser.close(); server.close();
  process.exit(1);
}
```

This is the single highest-value check in the file. Copy it.

### 4.3 Reading the deck marks back off the page

The hardest twenty lines in the script. Read at the same scroll position as the
screenshot, and only for what the screenshot actually shows:

```js
screen.marks = await page.evaluate((clip) => {
  const seen = [];
  // ONE MARKER PER KIND OF CONTROL. A plot list with eight rows has a chevron
  // and a crop pill on every row — sixteen discs saying two things. The first
  // of each pair is the marker; the rest are the same button again.
  const already = new Set();

  for (const el of document.querySelectorAll('#device [data-deck-to], #device [data-deck-note]')) {
    // A `.snapshot` is a PICTURE of another screen, carried by the guided tour.
    // Its controls are photographed, not offered.
    if (el.closest('.snapshot')) continue;

    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;

    const cy = b.y + b.height / 2;
    if (cy < clip.y + 4 || cy > clip.y + clip.height - 4) continue;   // below the fold points at nothing

    // Keyed on the class list as well as the target, so eight identical chevrons
    // collapse to one while two differently-styled controls to the same screen
    // stay two.
    const key = `${el.className}|${el.dataset.deckTo ?? ''}|${el.dataset.deckNote ?? ''}`;
    if (already.has(key)) continue;
    already.add(key);

    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
      .trim().replace(/\s+/g, ' ');

    // A DISC WITH NOTHING TO SAY IS WORSE THAN NO DISC. A control with no
    // accessible name produces a key line starting with a dash and a numbered
    // circle the key does not explain. It goes unmarked instead.
    if (!label) continue;

    seen.push({
      to: el.dataset.deckTo ?? null,
      note: el.dataset.deckNote ?? null,
      label: label.slice(0, 42),
      at: (cy - clip.y) / clip.height,        // 0..1 down the phone — resolution-independent
    });
  }
  return seen.sort((a, b) => a.at - b.at);
}, shot.clip);
```

`at` as a **fraction of the clip** rather than a pixel offset is what lets the
layout place a disc at any print size without re-deriving anything.

Two later passes finish the job:

```js
// A marker saying "→ B11" in a deck with no B11 sends the reviewer looking for a
// page that is not there. DECK_OMIT is a deck decision and this is the rest of it.
for (const screen of screens) {
  screen.marks = (screen.marks ?? []).filter((m) => !m.to || pageOf.has(m.to)).slice(0, 12);
}
```

The cap of 12 is the page's own limit — beyond that the key runs into the footer.

**A suggested addition for a new app:** a lint rule that fails the build when an
element carries a deck mark and has no accessible name. Wafra relies on the
silent skip above; asserting it would be better.

---

## 5. The page plan and numbering

Laid out completely before anything is drawn, because the contents page has to
print page numbers and the pages have to print the same ones:

```js
const plan = [{ kind: 'cover' }, { kind: 'contents' }];
for (const section of sections) {
  plan.push({ kind: 'section', section });
  for (const screen of section.screens) plan.push({ kind: 'screen', screen, section });
}
plan.forEach((p, i) => { p.page = i + 1; });

// Each FILING knows its own page, so the contents can print two entries for a
// twice-filed screen and send the reader to the right one of them.
for (const p of plan) if (p.kind === 'screen') p.screen.page = p.page;

// A marker pointing at a twice-filed screen goes to the FIRST of its pages,
// which is the one filed where the journey actually runs.
const pageOf = new Map();
for (const p of plan) if (p.kind === 'screen' && !pageOf.has(p.screen.id)) pageOf.set(p.screen.id, p.page);

const byId = new Map(screens.map((s) => [s.id, s]));
```

Separating "plan, then draw" is what makes cross-references possible at all. Any
deck with internal page references needs this two-pass shape.

---

## 6. Geometry

### 6.1 The page

```js
const W = 11.69, H = 8.27;          // A4 landscape, inches
const MARGIN = 0.55;
const SHOT_Y = 1.55, SHOT_H = 5.60; // leaves room under the phone for the scroll note
const FOOT_Y = 7.68;
const FONT = 'Calibri';

const pres = new pptxgen();
pres.defineLayout({ name: 'A4', width: W, height: H });
pres.layout = 'A4';
pres.author = 'Wafra Greentech';
pres.title = `Wafra Farm App — UI mockup v${MOCKUP_VERSION}`;
```

pptxgenjs works in inches by default. A4 landscape is not one of its presets, so
`defineLayout` is required — the alternative, US Letter, wastes 18 mm of height
on an A4 printer and crops on a US one.

### 6.2 The columns

Everything horizontal derives from three numbers and the widest phone in the
deck:

```js
const STRIP_X = MARGIN + 2.80 + 0.40;                              // clear of the phone
const STRIP_Y = SHOT_Y;                                            // shares the phone's top
const ARROW = 0.14;
const MAX_STEPS = Math.max(...flows.map((f) => f.ids.length));
const TILE_W = (W - MARGIN - STRIP_X - (MAX_STEPS - 1) * ARROW) / MAX_STEPS;
const TILE_RATIO = Math.max(...screens.map((s) => s.ratio));
const THUMB_H = TILE_W * TILE_RATIO;
const STRIP_BOTTOM = STRIP_Y + THUMB_H + 0.62;                     // tiles plus captions

const PHONE_W = SHOT_H / Math.min(...screens.map((s) => s.ratio)); // the widest phone in the deck
const MARK_D = 0.25;                                               // marker disc diameter
const MARK_X = MARGIN + PHONE_W + (STRIP_X - MARGIN - PHONE_W - MARK_D) / 2;
const MARK_GAP = MARK_D + 0.05;
```

Resolved for Wafra (a 418 × 872 device, ratio 2.086, longest flow 11 steps):

| Quantity | Value | Notes |
|---|---|---|
| Phone width | 2.69″ | `SHOT_H / 2.086` |
| Gutter (phone → strip) | 0.52″ | Where the marker discs live |
| Marker disc centre | x = 3.37″ | Centred in whatever gutter is actually left |
| Filmstrip tile | 0.54″ × 1.14″ | 11 tiles + 10 arrows fill to the right margin |
| Strip bottom | y = 3.31″ | Where the tail shot and the key begin |

**The filmstrip is sized for the longest path in the app and then used at that
size everywhere.** A three-step path and an eleven-step one share a rhythm, and
the deck never appears to change scale between pages. This is worth the wasted
space on short flows.

Note the small inconsistency in `STRIP_X`: it reserves a nominal 2.80″ phone
column, while the real phone is 2.69″. The marker maths uses the measured
`PHONE_W`, so the disc is centred correctly regardless. If you port this, either
derive `STRIP_X` from `PHONE_W` too, or keep the nominal reserve and accept a
slightly wider gutter.

---

## 7. Style

Six colours, taken from the app's own design tokens so the deck and the product
are visibly the same object:

```js
const INK = '0D1411', MUTED = '4A5852', FAINT = '8C9A94';
const BRAND = '1B7350', DEEP = '114230', PALE = 'A9C6B6', PAPER = 'FFFFFF';
```

| Token | Hex | Used for |
|---|---|---|
| `INK` | `#0D1411` | Titles, screen codes, key labels |
| `MUTED` | `#4A5852` | Body text, screen names in the contents |
| `FAINT` | `#8C9A94` | Page numbers, separators, captions, the scroll note |
| `BRAND` | `#1B7350` | Section eyebrows, marker discs, cross-references |
| `DEEP` | `#114230` | Section-divider background |
| `PALE` | `#A9C6B6` | Text on the dark dividers |

Type is Calibri throughout — one face, and one that is present on every Windows
machine a reviewer will open the file on. Embedding a brand face is possible but
adds weight and a licensing question for a document that exists to be printed
and scribbled on.

The scale, in points:

| Role | Size | Weight | Notes |
|---|---|---|---|
| Cover title | 46 | bold | |
| Cover statistic | 54 | bold | The number, with a 12 pt tracked label under it |
| Section divider name | 48 | bold | |
| Screen title | 26 | bold | `id · title`, mixed-colour rich text |
| Contents heading | 24 | bold | |
| Section eyebrow | 11 | bold | `charSpacing: 1.6`, uppercase, brand green |
| Flow name | 10 | italic | |
| Contents line | 8.5 | mixed | Code bold, title muted, page number faint |
| Marker key | 8 | mixed | |
| Filmstrip code | 7.5 | bold | |
| Filmstrip title | 6 | regular | `lineSpacing: 8` to fit two lines |

Uppercase plus `charSpacing` (1.2–2.2) is the deck's one recurring device for
labels. It reads as a system rather than as decoration, and it keeps small text
legible at 8 pt.

The footer is one helper, with a variant for the dark pages:

```js
const footer = (s, page, { onDark = false } = {}) => {
  const colour = onDark ? PALE : FAINT;
  s.addText(`Wafra Farm App · UI mockup v${MOCKUP_VERSION}`, {
    x: MARGIN, y: FOOT_Y, w: 5.5, h: 0.28,
    fontFace: FONT, fontSize: 9, color: colour, margin: 0,
  });
  s.addText(String(page), {
    x: W - MARGIN - 1.2, y: FOOT_Y, w: 1.2, h: 0.28,
    fontFace: FONT, fontSize: 9, color: colour, align: 'right', margin: 0,
  });
};
```

`margin: 0` appears on nearly every text box in the file. pptxgenjs applies
internal padding by default, which quietly shifts everything a few points off the
grid. Set it to zero and position deliberately.

---

## 8. The four page kinds

One loop over the plan, with each kind `continue`-ing out. That structure means
the marker code at the bottom cannot possibly put a disc on a page with no phone
on it.

### 8.1 The cover

```js
s.background = { color: PAPER };
const logoH = 1.0;
s.addImage({ path: logo.path, x: MARGIN, y: 0.95, w: logoH * logo.ratio, h: logoH });
s.addText('Wafra Farm App', {
  x: MARGIN, y: 2.55, w: 8.2, h: 1.0,
  fontFace: FONT, fontSize: 46, bold: true, color: INK, margin: 0,
});

// The description, as the two numbers it is made of.
const stat = (x, value, label) => {
  s.addText(value, { x, y: 4.05, w: 2.4, h: 0.95, fontFace: FONT, fontSize: 54, bold: true, color: INK, margin: 0 });
  s.addText(label, { x, y: 4.98, w: 2.4, h: 0.34, fontFace: FONT, fontSize: 12, bold: true, color: BRAND, charSpacing: 1.6, margin: 0 });
};
stat(MARGIN, String(DISTINCT), 'SCREENS');
stat(MARGIN + 2.7, MOCKUP_VERSION, 'VERSION');
```

Left-aligned on the page margin rather than centred, which matches the screen
pages and gives the eye one vertical line through the whole deck.

### 8.2 The contents — three columns, packed by section

Thumbnails were the other way to do this, and they lose. Fifty phones on one A4
page come out under 20 mm wide — a coloured smudge rather than a screen anyone
could recognise — and there is no room left beside them for the name, which is
the thing people actually look a screen up by. A list gives every screen its
code, its name and its page number on one line, and fits three columns of them
with room to spare.

The packer keeps a section whole rather than balancing columns exactly:

```js
const COLS = 3, GAP = 0.45, TOP = 1.45, LINE = 0.225;
const colW = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;

// One block per section: its heading, then its screens.
const lines = sections.map((sec) => [{ heading: sec.name }, ...sec.screens.map((sc) => ({ screen: sc }))]);
const target = Math.ceil(lines.flat().length / COLS);

const columns = [[]];
for (const block of lines) {
  const col = columns[columns.length - 1];
  if (col.length && col.length + block.length > target && columns.length < COLS) columns.push([]);
  columns[columns.length - 1].push(...block);
}
```

Greedy, and deliberately so: a section is never split across two columns, which
matters more than perfectly even column lengths. The `columns.length < COLS`
guard means the last column absorbs any overflow rather than a fourth column
appearing off the page.

Each line is three text boxes on a fixed pitch — code, title, page number:

```js
s.addText(id,    { x,             y, w: 0.62,        h: LINE, fontSize: 8.5, bold: true, color: INK,   valign: 'middle', margin: 0 });
s.addText(title, { x: x + 0.64,   y, w: colW - 1.06, h: LINE, fontSize: 8.5,             color: MUTED, valign: 'middle', margin: 0 });
s.addText(String(line.screen.page), {
  x: x + colW - 0.4, y, w: 0.4, h: LINE, fontSize: 8.5, color: FAINT, align: 'right', valign: 'middle', margin: 0 });
```

Separate boxes rather than one rich-text line, because the page number has to
right-align against the column edge while the title flows from the left.

### 8.3 The section divider

```js
const nth = sections.indexOf(section) + 1;
s.background = { color: DEEP };
// Not the section's own name again — WHERE YOU ARE in the deck, which the title
// underneath cannot tell you.
s.addText(`SECTION ${nth} OF ${sections.length}`, {
  x: MARGIN, y: 3.05, w: 9.0, h: 0.4,
  fontFace: FONT, fontSize: 12, bold: true, color: PALE, charSpacing: 2.2, margin: 0,
});
s.addText(section.name, {
  x: MARGIN, y: 3.5, w: 9.5, h: 1.1,
  fontFace: FONT, fontSize: 48, bold: true, color: PAPER, margin: 0,
});
s.addText(
  `${section.screens.length} screen${section.screens.length === 1 ? '' : 's'}  ·  `
  + section.screens.map((sc) => sc.id).join(' · '),
  { x: MARGIN, y: 4.7, w: 9.5, h: 0.4, fontFace: FONT, fontSize: 11, color: PALE, margin: 0 },
);
footer(s, item.page, { onDark: true });
```

A full-bleed dark page is the one moment of contrast in the deck, and it is what
makes it navigable in a thumb-flip. The eyebrow says *where you are*, which the
section name alone cannot.

### 8.4 The screen page

**Header.** A tracked, uppercase section eyebrow in brand green, then the title
as one rich-text run so the code, the separator and the name can differ in
colour on a shared baseline:

```js
s.addText([
  { text: screen.id,  options: { bold: true, color: INK } },
  { text: '  ·  ',    options: { bold: true, color: FAINT } },
  { text: screen.title, options: { bold: true, color: INK } },
], { x: MARGIN, y: 0.72, w: 9.5, h: 0.55, fontFace: FONT, fontSize: 26, margin: 0 });
```

**The phone.** Height is fixed; width follows the measured aspect ratio, so a
different device or a tablet screen still sits on the same baseline:

```js
s.addImage({ path: screen.file, x: MARGIN, y: SHOT_Y, w: SHOT_H / screen.ratio, h: SHOT_H });
```

**The filmstrip.** Every step of the journey as its own tile, with the current
one at full strength and the rest standing back:

```js
const flow = flowFor(screen.id, section.name);
if (flow) {
  s.addText(flow.name, {
    x: STRIP_X, y: 0.42, w: W - MARGIN - STRIP_X, h: 0.28,
    fontFace: FONT, fontSize: 10, italic: true, color: MUTED, margin: 0,
  });

  flow.ids.forEach((id, i) => {
    const step = byId.get(id);
    if (!step) return;
    const x = STRIP_X + i * (TILE_W + ARROW);
    const here = id === screen.id;

    if (i) {
      s.addText('→', {
        x: x - ARROW, y: STRIP_Y + THUMB_H / 2 - 0.12, w: ARROW, h: 0.24,
        fontFace: FONT, fontSize: 10, color: FAINT, align: 'center', valign: 'middle', margin: 0,
      });
    }

    s.addImage({
      path: step.thumb, x, y: STRIP_Y, w: TILE_W, h: THUMB_H,
      // Where you are stands out by everything else standing back, which is
      // quieter than drawing a box round it.
      ...(here ? {} : { transparency: 62 }),
    });

    s.addText(id, {
      x, y: STRIP_Y + THUMB_H + 0.05, w: TILE_W, h: 0.16,
      fontFace: FONT, fontSize: 7.5, bold: true, color: here ? BRAND : MUTED,
      align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(step.title, {
      x: x - 0.06, y: STRIP_Y + THUMB_H + 0.21, w: TILE_W + 0.12, h: 0.42,
      fontFace: FONT, fontSize: 6, color: here ? MUTED : FAINT,
      align: 'center', valign: 'top', lineSpacing: 8, margin: 0,
    });
  });
}
```

`transparency: 62` on every tile but the current one is the whole emphasis
mechanism. A highlight box around the current tile was the alternative and is
louder for no more information. The title box is deliberately 0.12″ wider than
its tile and starts 0.06″ to the left, so a two-word screen name can breathe
past the tile edge without colliding with its neighbour.

**The tail shot**, under the strip, at 62% of the main phone's height so it reads
as secondary — and skipped entirely if what is left of the column will not hold
a legible one:

```js
const belowStrip = flow ? STRIP_BOTTOM + 0.30 : SHOT_Y;
let keyX = STRIP_X;
if (screen.tail) {
  const tailY = belowStrip;
  const tailH = Math.min(SHOT_H * 0.62, FOOT_Y - 0.24 - tailY);
  if (tailH >= 1.55) {                       // the note under the phone still says it scrolls
    s.addText('THE REST OF THIS SCREEN', { /* 8pt, bold, FAINT, charSpacing 1.2 */ });
    s.addImage({ path: screen.tail, x: STRIP_X, y: tailY, w: tailH / screen.ratio, h: tailH });
    keyX = STRIP_X + tailH / screen.ratio + 0.34;   // push the key clear of the second phone
  }
}
```

The picture is the bonus, not the promise. The note under the main phone carries
the fact; the second shot is shown when there is room for it.

**The markers.** Numbered discs in the gutter, at the height of the control each
one names, with collision push-down:

```js
const marks = screen.marks ?? [];
if (marks.length) {
  let lastY = -Infinity;
  marks.forEach((m, i) => {
    const wanted = SHOT_Y + m.at * SHOT_H - MARK_D / 2;
    const y = Math.min(FOOT_Y - MARK_D - 0.1, Math.max(wanted, lastY + MARK_GAP));
    lastY = y;
    m.y = y;
    s.addText(String(i + 1), {
      shape: pres.ShapeType.ellipse,
      x: MARK_X, y, w: MARK_D, h: MARK_D,
      fill: { color: BRAND }, line: { color: PAPER, width: 1 },
      fontFace: FONT, fontSize: 9, bold: true, color: PAPER,
      align: 'center', valign: 'middle', margin: 0,
    });
  });
```

Two controls a few millimetres apart on the phone would print as one blot, so a
disc landing within `MARK_GAP` of the one above is pushed down. Because the marks
are already sorted by `at`, one pass with a running `lastY` is enough, and the
numbers still run top to bottom — which is the order the key lists them in.

`shape: pres.ShapeType.ellipse` on an `addText` call is the pptxgenjs idiom for a
filled shape with a centred label. It is one object rather than a shape plus a
text box, which keeps the disc and its number from ever separating.

**The key** that makes the discs mean anything:

```js
  const keyW = W - MARGIN - keyX;
  const keyY = belowStrip;
  s.addText('WHAT THE SMALL BUTTONS DO', { /* 8pt bold FAINT, charSpacing 1.2 */ });

  const LINE_H = 0.30;
  marks.forEach((m, i) => {
    const y = keyY + i * LINE_H;
    if (y + LINE_H > FOOT_Y - 0.1) return;           // never run into the footer

    s.addText(String(i + 1), {
      shape: pres.ShapeType.ellipse,
      x: keyX, y: y + 0.015, w: 0.22, h: 0.22,
      fill: { color: BRAND }, line: { color: PAPER, width: 0.5 },
      fontFace: FONT, fontSize: 8, bold: true, color: PAPER,
      align: 'center', valign: 'middle', margin: 0,
    });

    const target = m.to ? pageOf.get(m.to) : null;
    s.addText([
      { text: m.label || m.to || '', options: { bold: true, color: INK } },
      ...(m.to
        ? [{ text: `  →  ${m.to}${byId.get(m.to) ? ` ${byId.get(m.to).title}` : ''}`,
             options: { color: BRAND, bold: true } },
           ...(target ? [{ text: `  (page ${target})`, options: { color: FAINT } }] : [])]
        : [{ text: `  —  ${m.note}`, options: { color: MUTED } }]),
    ], { x: keyX + 0.30, y, w: keyW - 0.30, h: LINE_H, fontFace: FONT, fontSize: 8, valign: 'middle', lineSpacing: 10, margin: 0 });
  });
}
```

A marker that leads somewhere carries the code **and the page number**, because
"→ B11" is only useful to somebody with the contents page open. One that opens
something in place carries the sentence the control declared at its call site.

**Speaker notes**, assembled from what the registry already knows:

```js
s.addNotes(`${screen.id} — ${screen.title}\n\n${screen.note}`
  + (marks.length ? `\n\n${marks.map((m, i) => `${i + 1}. ${m.label}${m.to ? ` → ${m.to}` : ` — ${m.note}`}`).join('\n')}` : '')
  + (flow ? `\n\nOn the "${flow.name}" path.` : '')
  + (screen.hidden >= HIDDEN_ENOUGH
      ? `\n\nThe screenshot shows ${Math.round((1 - screen.hidden) * 100)}% of this screen; the rest is below the fold.`
      : ''));
```

Free, because the app already carries a one-liner per screen, and it gives
whoever presents the deck something to say.

---

## 9. Image format, and why the file is 25 MB

A deliberate split:

- **Page-sized screenshots stay PNG.** One screen fills about 150 mm of paper,
  and the interface is flat colour and hairlines rather than photography. JPEG
  rings visibly around a 1 px border at that size.
- **Tail shots and thumbnails go through JPEG at quality 0.84.** They print at
  42 mm and 14 mm, where the ringing does not show. Thirty-four full-resolution
  PNG tail shots put ten megabytes on a deck somebody has to be emailed.

**pptxgenjs stores one copy of an image per placement, not per file.** The
v1.5.7 deck contains 336 media entries of which only 118 are distinct — the
filmstrip alone accounts for around 259 placements, because every tile on every
page is written out again. This is the single biggest lever on file size, and it
is why thumbnails are 120 px rather than 300. If a deck ever needs to be smaller
than this technique allows, post-processing the `.pptx` to collapse identical
media and rewrite the relationship XML would roughly halve it.

The result for Wafra v1.5.7: 58 slides, 336 media placements over 118 distinct
images (49 screen shots, 42 thumbnails, 26 tail shots, 1 logo), 23 MB of media,
a 24 MB file. **The output is not committed** in the general case — it is a
snapshot of HEAD rather than a record of anything. Versioned copies are kept only
for the rounds that were actually reviewed.

If size becomes a problem before quality does, the lever is
`deviceScaleFactor`. Dropping from 2 to 1.5 costs about 44% of the pixels and
takes the main shots to ~230 dpi, which is still comfortably above what an office
printer resolves.

---

## 10. Failure modes worth anticipating

| Symptom | Cause | Fix |
|---|---|---|
| Black or coloured wedges in the screenshot corners | The clip is a rectangle; the bezel is rounded | §3.3 — force the page background white for the capture |
| A grey smear along one or two edges | The device's drop shadow, sliced by the clip | Flatten `box-shadow` in the capture stylesheet |
| The logo arrives with the page furniture behind it | An element screenshot photographs whatever is behind a transparent element | Lay it over a white stage of its own first |
| A screen photographed mid-render | No settle, or an async fetch | Collect console errors; wait on a render-complete signal rather than a timeout |
| State from one screen appearing on the next | Shared local state | `resetLocal(...)` before every `jump` |
| Sixteen discs on a list page | One marker per element rather than per kind of control | Dedupe on `className + target + note` |
| A disc pointing at a row below the fold | Marks read without a clip test | Reject marks whose centre lies outside the clip |
| Two discs printing as one blot | No collision handling | Push down to `MARK_GAP`, one pass, marks pre-sorted |
| A cross-reference to a page that does not exist | A marker aimed at an omitted screen | Filter marks against `pageOf` after the plan is built |
| A journey that quietly stopped being true | A flow naming a deleted screen | §4.2 — fail the build |
| Everything a few points off the grid | pptxgenjs default text-box padding | `margin: 0` on every text box |
| The deck appears to change scale between pages | Filmstrip sized per flow | Size once for the longest flow, use everywhere |

---

## 11. Porting checklist

Working order for pointing this at a different app.

**In the app**

1. Expose a dev handle: `globalThis.<app> = { SCREENS, jump, resetLocal }`.
2. Build a screen registry — `id`, `title`, a one-line `note`, optional `route`.
3. Declare `SCREEN_GROUPS` (sections, in page order). Let a screen appear twice
   if two sections both need it.
4. Declare `DECK_OMIT` for anything the printed review should skip.
5. Declare `FLOWS` as lines, each with a `section` and a human-sounding `name`.
6. Give the device wrapper a stable id and the app's scroller a stable class.
7. Add `deckMark({ deckTo, deckNote })` and use it on icon buttons and any
   control that hides a feature behind a glyph. Give every one of them an
   accessible name.
8. Put the brand mark behind CSS driven by a single height variable.

**In the deck builder**

9. Copy `screendeck.mjs` and change: `ROOT`, the module path in the structure
   `page.evaluate`, the global name, the DOM selectors, `WHITE_PAGE`, the colour
   tokens, `FONT`, and the cover and footer strings.
10. Re-derive the geometry. Measure the device, compute `PHONE_W` from `SHOT_H`
    and the aspect ratio, and check `STRIP_X` still clears the phone. If the new
    app has a much longer flow, confirm `TILE_W` is still legible — below about
    0.45″ the tiles stop being readable and the flow wants splitting.
11. Set `HIDDEN_ENOUGH`, `THUMB_PX` and `TAIL_PX` from your own print sizes,
    aiming for 300 dpi at the main size and ≥ 200 dpi at the small ones.
12. Run it. Print pages 1, 2, a divider, a screen with a long flow, and a screen
    with a tail shot. Everything wrong will be visible on those five.

**What to keep even if you change everything else**

- The orphan check (§4.2).
- The console error gate (§3.2).
- Plan first, draw second (§5).
- Nothing drawn on top of a screenshot (§0).
- The right two thirds empty (§0).

---

## 12. Calibration numbers from the Wafra build

| | |
|---|---|
| Source | 50 registered screens, 6 sections, 13 flows |
| Deck omissions | 1 screen (`DECK_OMIT`) |
| Output | 58 slides — cover, contents, 6 dividers, 50 screen pages |
| Distinct screens | 49 (one screen filed in two sections) |
| Longest flow | 11 steps, which sets the filmstrip scale |
| Screens appearing on a flow | 42 |
| Screens carrying a tail shot | 26 |
| Media | 336 placements, 118 distinct images |
| File size | 24 MB |
| Page | A4 landscape, 11.69" x 8.27", 0.55" margins |
| Capture | Chromium, 1500 x 1000, `deviceScaleFactor: 2` |
| Main screenshot | 836 x 1744 px printed at 2.69" — 311 dpi |
| Filmstrip tile | 0.54" x 1.14", 120 px source — 220 dpi |
| Tail shot | 1.66" wide, 520 px source — 312 dpi |
| Runtime | A few minutes, dominated by the per-screen settle |

The script prints its own summary, which is the fastest way to notice something
has gone quietly wrong:

```
58 slides -> docs/Wafra_Farm_App_Screens.pptx
  cover, contents, 6 section dividers, 50 screen pages (49 screens)
  43 screens sit on one of the 13 paths; filmstrip tile 0.54" wide
  26 screens carry a "scrolls" note and a second shot of the rest
  N small controls marked in the gutter across M screens
```

(The last line's counts depend on how many controls carry a `deckMark`, so they
move with the app rather than with the deck. The others are checked against the
v1.5.7 build. Note that the third line counts filings while the header counts
distinct screens, which is why 43 and 42 differ by the twice-filed screen.)


---

## Reference

- `tools/screendeck.mjs` — the whole builder, 733 lines, heavily commented.
- `app/screens/index.js` — the registry, `SCREEN_GROUPS`, `FLOWS`, `DECK_OMIT`.
- `app/ui/components.js` — `deckMark()` and the controls that use it.
- `app/ui/brand.js` — the brand contract.
- `app/main.js` — the `globalThis` handle.
- `tools/reviewdoc.mjs` — a sibling tool that builds a before/after PDF from the
  same capture technique, useful if the new app also needs change documents.
- `npm run deck` — build it. `--out <path>` to write elsewhere.
