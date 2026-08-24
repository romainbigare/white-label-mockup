#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   screendeck.mjs — build docs/Wafra_Farm_App_Screens.pptx.

   Four kinds of page, in this order:

     1  the cover
     2  every screen listed, with the page it is on — the way back out of a
        seventy-page deck
     3  a green divider per section of the App Map
     4  one page per screen: its code and name, the phone down the left, and the
        right two thirds left empty. It is a deck to print, write on and hand
        back, which is the only reason that space is there.

   A screen that sits on a path through the app also carries that path beside
   the phone: every step of it as its own small screenshot with its code and
   name, arrows between, and the one you are looking at at full strength while
   the rest stand back. It answers the question a printout otherwise cannot —
   what did the farmer just do, and what happens next — and it answers it in
   pictures, because a row of codes only helps somebody who already knows them.

   WHICH path, for a screen that is on several, is decided by the SECTION the
   page is filed under. B2 leads to a plot, a tree group, settings and the map;
   the page filed under My Plot prints the plot journey and the one under My
   Farm prints the farm journey. The reviewer's context picks the line.

   The strip is sized for the LONGEST path in the app and used at that size
   everywhere, so a three-step path and an eleven-step one share a rhythm and
   the deck never looks like it changed scale between pages.

   A screenshot is only the part of a screen that fits on a phone, and some of
   these screens are lists running well past the bottom of it. Where more than a
   sixth is below the fold the page says so, quietly, under the phone — and
   carries a SECOND, smaller shot of the same screen scrolled to the end. The
   note alone was what the 22 August review answered twice with "can you please
   show another screenshot", on A9 and on A13.

   Everything is read from the running app rather than kept in step by hand: the
   screen list and its order from SCREEN_GROUPS, the paths from FLOWS, the
   titles and speaker notes from the registry, the version from app/meta.js, and
   the logo photographed out of the page through the same CSS every screen's
   logo uses. Re-label the app in brand.js and the deck re-labels itself.

   Run:  npm run deck                    # docs/Wafra_Farm_App_Screens.pptx
         node tools/screendeck.mjs --out /tmp/review.pptx

   TWO THINGS ABOUT THE SCREENSHOTS, both of which cost a round to find.

   The clip is the device's bounding box while the bezel is a ROUNDED rectangle
   inside it, so the four corners show whatever is behind the phone. Two things
   were: the harness's dark green page, which lands in the deck as a black
   rectangle behind every screen, and the bezel's own 60px drop shadow, which
   the clip cuts into a grey one. Both are turned off for the capture and only
   for the capture — see WHITE_PAGE below. The same trap catches the logo: an
   element screenshot photographs whatever is behind a transparent element, so
   the lockup is laid over a white stage of its own first.

   And the page-sized ones stay PNG. reviewdoc.mjs puts its screenshots through
   JPEG because it prints two per screen at 55 mm; here one screen fills 150 mm
   of paper, the UI is flat colour and hairlines rather than photographs, and
   JPEG's ringing around 1px borders is visible at that size. The second shots
   print at 42 mm and do go through JPEG, for the same reason reviewdoc's do.
   The deck is ~26 MB as a result.
   --------------------------------------------------------------------------- */
import pptxgen from 'pptxgenjs';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, '.screendeck');
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : fallback;
};
const OUT = resolve(flag('--out', join(ROOT, 'docs', 'Wafra_Farm_App_Screens.pptx')));

const { MOCKUP_VERSION } = await import(pathToFileURL(join(ROOT, 'app', 'meta.js')));

/* Applied to the page for the capture and never saved. The phone has to sit on
   the paper the deck is printed on, not on the reviewer harness. */
const WHITE_PAGE = `
  html, body { background: #ffffff !important; background-image: none !important; }
  .stage { background: #ffffff !important; }
  .device__bezel { box-shadow: 0 0 0 2px #0b100e !important; }
`;

/* -- the page ------------------------------------------------------------- */

/* A4 landscape. The screen column is the left third; everything right of the
   phone is empty by design, which is what the deck is for. */
const W = 11.69, H = 8.27;
const MARGIN = 0.55;
const SHOT_Y = 1.55, SHOT_H = 5.60;          // leaves room under the phone for the note
const FOOT_Y = 7.68;
const FONT = 'Calibri';

/* Wafra's own tokens, so the deck and the app are the same object. */
const INK = '0D1411', MUTED = '4A5852', FAINT = '8C9A94';
const BRAND = '1B7350', DEEP = '114230', PALE = 'A9C6B6', PAPER = 'FFFFFF';

/* -- serve the repo, drive the app, photograph it -------------------------- */

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

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// deviceScaleFactor 2 puts the 390 px phone at ~300 dpi across 2.8" of paper.
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });

await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);
await page.addStyleTag({ content: WHITE_PAGE });

/* The App Map, read out of the app: SCREEN_GROUPS decides the order and the
   section each screen is filed under, FLOWS says what it comes after. Anything
   registered but ungrouped still gets a page rather than being silently
   dropped. */
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

const screens = sections.flatMap((s) => s.screens);
const known = new Set(screens.map((s) => s.id));

/* A flow naming a screen that no longer exists is a flow that has quietly
   stopped being true, which is exactly what nobody notices. */
const orphans = flows.flatMap((f) => f.ids.filter((id) => !known.has(id)).map((id) => `${f.name}: ${id}`));
if (orphans.length) {
  console.error('FLOWS names screens that are not in the registry:');
  for (const o of orphans) console.error(`  ${o}`);
  await browser.close(); server.close();
  process.exit(1);
}

/* The lockup, taken out of the page rather than kept as a second copy of the
   artwork beside it. brand.js supplies one file and the CSS decides how much of
   it shows; borrowing the same rule means a re-labelled app produces a
   re-labelled deck with nothing here to change. */
const logo = { path: join(WORK, 'logo.png') };
{
  // An element screenshot photographs whatever is behind it, and the artwork is
  // a background image on a transparent span — the first run of this took the
  // harness bar and half of A1 along with the lockup. Hence the white stage,
  // which is also the paper it ends up on.
  const rect = await page.evaluate(() => {
    const stage = document.createElement('div');
    stage.id = 'deck-logo-stage';
    stage.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#ffffff;';
    const el = document.createElement('span');
    el.id = 'deck-logo';
    el.className = 'logo logo--lockup';
    el.style.cssText = '--logo-h:400px;';
    stage.append(el);
    document.body.append(stage);
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await page.locator('#deck-logo').screenshot({ path: logo.path });
  await page.evaluate(() => document.getElementById('deck-logo-stage')?.remove());
  logo.ratio = rect.w / rect.h;
}

/* Each screen twice over: the page-sized shot, and — for the screens that sit
   on a path — a thumbnail small enough to appear ten times on thirty pages
   without the file doubling. Resized through a canvas in the browser that is
   already open, which beats adding an image library for one call.

   `hidden` is what the screenshot cannot show. Most screens fit; some are a
   list that runs well past the bottom of the phone, and a reviewer looking at
   the top third of F12 should be told that is what he is looking at. */
const inAFlow = new Set(flows.flatMap((f) => f.ids));
/* A sixth, which is what the note at the top of this file has always claimed.
   The constant said a quarter, and the gap was invisible until review 22/08
   asked for the bottom of A9 — a screen that hides 20% of itself and therefore
   fell in the crack between the rule as documented and the rule as written. */
const HIDDEN_ENOUGH = 1 / 6;
const THUMB_PX = 120;
/* The second shot prints at 1.66" against the main phone's 2.68", so it does
   not need the main phone's pixels: at 520 px it is still ~310 dpi on the page.
   And unlike the main shot it goes in as JPEG. The note at the top of this file
   explains why the big ones do not — a screen filling 150 mm of paper is flat
   colour and hairlines, and JPEG rings around a 1px border at that size. At 42
   mm it does not, which is the same call reviewdoc.mjs makes at 55 mm. Thirty
   four of these as full-resolution PNGs put ten megabytes on a deck somebody
   has to be emailed. */
const TAIL_PX = 520;

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

for (const screen of screens) {
  // resetLocal keeps a half-finished signup from one screen out of the next.
  await page.evaluate((route) => { wafra.resetLocal('signup'); wafra.jump(route); }, screen.route);
  await page.waitForTimeout(160);

  const shot = await page.evaluate(() => {
    const r = document.getElementById('device').getBoundingClientRect();
    // .app__scroll is the app's own scroller: what it can show against what it
    // holds is exactly the fraction of the screen a screenshot leaves out.
    const scroller = document.querySelector('#device .app__scroll');
    const hidden = scroller && scroller.scrollHeight > scroller.clientHeight
      ? 1 - scroller.clientHeight / scroller.scrollHeight
      : 0;
    return { clip: { x: r.x, y: r.y, width: r.width, height: r.height }, hidden };
  });

  screen.file = join(WORK, `${screen.id}.png`);
  screen.ratio = shot.clip.height / shot.clip.width;
  screen.hidden = shot.hidden;
  await page.screenshot({ path: screen.file, clip: shot.clip });

  /* THE SMALL CONTROLS THAT DO BIG THINGS. A printout cannot be tapped, so an
     icon button that opens a whole screen and one that does nothing much look
     identical in a photograph. deckMark() in app/ui/components.js lets a control
     declare itself; here we read those declarations back off the rendered page
     with their positions, and the page draws a numbered marker beside the phone
     for each one. Read at the same scroll position as the screenshot, and only
     for what the screenshot actually shows — a marker pointing at a row below
     the fold points at nothing. */
  screen.marks = await page.evaluate((clip) => {
    const seen = [];
    // ONE MARKER PER KIND OF CONTROL. B2 lists eight plots and every row has a
    // chevron into B4 and a crop pill into B5 — sixteen discs saying two things.
    // The first of each pair is the marker; the rest are the same button again.
    const already = new Set();
    for (const el of document.querySelectorAll('#device [data-deck-to], #device [data-deck-note]')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const cy = b.y + b.height / 2;
      if (cy < clip.y + 4 || cy > clip.y + clip.height - 4) continue;
      // Keyed on the class list as well as the target, so the eight identical
      // chevrons in a plot list collapse to one while B5's "New" icon and its
      // "Edit this cycle" button — both leading to B6 — stay two.
      const key = `${el.className}|${el.dataset.deckTo ?? ''}|${el.dataset.deckNote ?? ''}`;
      if (already.has(key)) continue;
      already.add(key);
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
        .trim().replace(/\s+/g, ' ');
      // A DISC WITH NOTHING TO SAY IS WORSE THAN NO DISC. A control with no
      // accessible name, no tooltip and no text produces a key line that starts
      // with a dash, and a numbered circle beside a phone that the key does not
      // explain. It goes unmarked instead — and tools/syntax.sh would rather we
      // gave it a name.
      if (!label) continue;
      seen.push({
        to: el.dataset.deckTo ?? null,
        note: el.dataset.deckNote ?? null,
        label: label.slice(0, 42),
        at: (cy - clip.y) / clip.height,
      });
    }
    return seen.sort((a, b) => a.at - b.at);
  }, shot.clip);

  /* Review 22/08 asked twice for "another screenshot" of a screen whose bottom
     the phone had cut off — A9's second route card and A13's Pro plan. Rather
     than photograph those two by hand, every screen that scrolls far enough to
     earn the note above now carries a SECOND shot of itself scrolled to the
     end. The note said what was missing; this shows it. */
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
    await page.evaluate(() => {
      const sc = document.querySelector('#device .app__scroll');
      if (sc) sc.scrollTop = 0;
    });
  }

  if (inAFlow.has(screen.id)) {
    screen.thumb = join(WORK, `${screen.id}-thumb.png`);
    await shrink(screen.file, screen.thumb);
  }
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`${problems.length} console errors while capturing:`);
  for (const p of problems.slice(0, 8)) console.error(`  ${p}`);
  process.exit(1);
}

/* -- what goes on which page ----------------------------------------------
   Laid out before anything is drawn, because the contents page has to print the
   page numbers and the pages have to print the same ones. */

const plan = [{ kind: 'cover' }, { kind: 'contents' }];
for (const section of sections) {
  plan.push({ kind: 'section', section });
  for (const screen of section.screens) plan.push({ kind: 'screen', screen, section });
}
plan.forEach((p, i) => { p.page = i + 1; });
const pageOf = new Map(plan.filter((p) => p.kind === 'screen').map((p) => [p.screen.id, p.page]));
const byId = new Map(screens.map((s) => [s.id, s]));

/* A marker that says "→ B11" in a deck with no B11 in it sends the reviewer
   looking for a page that is not there, so a control pointing at an omitted
   screen simply goes unmarked. DECK_OMIT is a deck decision and this is the
   rest of it. */
for (const screen of screens) {
  screen.marks = (screen.marks ?? []).filter((m) => !m.to || pageOf.has(m.to)).slice(0, 12);
}

/* The path to print beside a screen. Section first — see FLOWS — so a screen on
   several journeys shows the one belonging to the drawer the page is filed in,
   and any flow containing it as a fallback. */
const flowFor = (id, sectionName) => flows.find((f) => f.section === sectionName && f.ids.includes(id))
  ?? flows.find((f) => f.ids.includes(id))
  ?? null;

/* -- the filmstrip --------------------------------------------------------
   Sized for the LONGEST path in the app and then used at that size everywhere,
   so a three-step path and an eleven-step one have the same rhythm and the deck
   does not appear to change scale between pages. It starts beside the phone and
   runs to the right margin. */
const STRIP_X = MARGIN + 2.80 + 0.40;                 // clear of the phone
const STRIP_Y = SHOT_Y;                               // shares the phone's top
const ARROW = 0.14;
const MAX_STEPS = Math.max(...flows.map((f) => f.ids.length));
const TILE_W = (W - MARGIN - STRIP_X - (MAX_STEPS - 1) * ARROW) / MAX_STEPS;
const TILE_RATIO = Math.max(...screens.map((s) => s.ratio));
const THUMB_H = TILE_W * TILE_RATIO;
const STRIP_BOTTOM = STRIP_Y + THUMB_H + 0.62;        // tiles plus their captions

/* -- the markers ----------------------------------------------------------
   The review asked for the small buttons to be called out: the ones that lead
   to another screen in this deck, and the ones with a whole feature folded
   behind a 40 dp glyph. It also asked, twice over, for the calling-out to stay
   OFF the phone — nothing drawn over the picture, nothing obscuring a control
   in order to point at it.

   So the marker is a numbered disc in the GUTTER: the 0.40" of white between the
   phone's right edge and the filmstrip, which is empty on every page of the
   deck. It sits at the height of the control it names, so the eye travels
   straight across, and the key underneath the strip says what each number is —
   with the page number of the screen it opens, so a reviewer can turn to it.

   Discs are pushed apart to MARK_GAP where two controls are within a few
   millimetres of each other on the phone; the key still lists them in the order
   they appear down the screen, which is the order the numbers run. */
const PHONE_W = SHOT_H / Math.min(...screens.map((s) => s.ratio));   // the widest phone in the deck
const MARK_D = 0.25;                                  // disc diameter
const MARK_X = MARGIN + PHONE_W + (STRIP_X - MARGIN - PHONE_W - MARK_D) / 2;
const MARK_GAP = MARK_D + 0.05;

/* -- typeset -------------------------------------------------------------- */

const pres = new pptxgen();
pres.defineLayout({ name: 'A4', width: W, height: H });
pres.layout = 'A4';
pres.author = 'Wafra Greentech';
pres.title = `Wafra Farm App — UI mockup v${MOCKUP_VERSION}`;

const footer = (s, page, { onDark = false } = {}) => {
  const colour = onDark ? PALE : FAINT;
  s.addText(`Wafra Farm App · UI mockup v${MOCKUP_VERSION}`, {
    x: MARGIN, y: FOOT_Y, w: 5.5, h: 0.28, fontFace: FONT, fontSize: 9, color: colour, margin: 0,
  });
  s.addText(String(page), {
    x: W - MARGIN - 1.2, y: FOOT_Y, w: 1.2, h: 0.28, fontFace: FONT, fontSize: 9, color: colour, align: 'right', margin: 0,
  });
};

for (const item of plan) {
  const s = pres.addSlide();

  /* -- the cover ---------------------------------------------------------- */
  if (item.kind === 'cover') {
    s.background = { color: PAPER };
    const logoH = 1.0;
    s.addImage({ path: logo.path, x: MARGIN, y: 0.95, w: logoH * logo.ratio, h: logoH });
    s.addText('Wafra Farm App', {
      x: MARGIN, y: 2.55, w: 8.2, h: 1.0, fontFace: FONT, fontSize: 46, bold: true, color: INK, margin: 0,
    });
    // The description, as the two numbers it is made of.
    const stat = (x, value, label) => {
      s.addText(value, { x, y: 4.05, w: 2.4, h: 0.95, fontFace: FONT, fontSize: 54, bold: true, color: INK, margin: 0 });
      s.addText(label, { x, y: 4.98, w: 2.4, h: 0.34, fontFace: FONT, fontSize: 12, bold: true, color: BRAND, charSpacing: 1.6, margin: 0 });
    };
    stat(MARGIN, String(screens.length), 'SCREENS');
    stat(MARGIN + 2.7, MOCKUP_VERSION, 'VERSION');
    s.addText(
      `${screens.length} screens across ${sections.length} sections of the app, at version ${MOCKUP_VERSION}. `
      + 'Each page carries one screen on the left; the right-hand side is left clear for comments and notes.',
      { x: MARGIN, y: 5.95, w: 6.6, h: 0.9, fontFace: FONT, fontSize: 13, color: MUTED, lineSpacing: 20, margin: 0 },
    );
    s.addNotes(`Wafra Farm App UI mockup, version ${MOCKUP_VERSION}. ${screens.length} screens.`);
    continue;
  }

  /* -- every screen, and the page it is on --------------------------------
     Three columns of a fixed line pitch, packed section by section so a
     section is never split across two of them. Thumbnails were the other way
     to do this and are not one: fifty-nine phones on an A4 page are 14 px
     wide, which is a coloured smudge rather than a screen you can recognise —
     and there is no room left beside them for the name, which is the thing
     anyone is actually looking one up by. */
  if (item.kind === 'contents') {
    s.background = { color: PAPER };
    s.addText('Every screen', {
      x: MARGIN, y: 0.42, w: 6.0, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: INK, margin: 0,
    });
    s.addText(`${screens.length} screens · the number is the page in this deck`, {
      x: MARGIN, y: 0.92, w: 6.0, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, margin: 0,
    });

    const COLS = 3, GAP = 0.45, TOP = 1.45, LINE = 0.225;
    const colW = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
    const lines = sections.map((sec) => [{ heading: sec.name }, ...sec.screens.map((sc) => ({ screen: sc }))]);
    const target = Math.ceil(lines.flat().length / COLS);

    const columns = [[]];
    for (const block of lines) {
      const col = columns[columns.length - 1];
      if (col.length && col.length + block.length > target && columns.length < COLS) columns.push([]);
      columns[columns.length - 1].push(...block);
    }

    columns.forEach((col, c) => {
      const x = MARGIN + c * (colW + GAP);
      col.forEach((line, i) => {
        const y = TOP + i * LINE;
        if (line.heading) {
          s.addText(line.heading.toUpperCase(), {
            x, y, w: colW, h: LINE, fontFace: FONT, fontSize: 8.5, bold: true, color: BRAND, charSpacing: 1.2, valign: 'middle', margin: 0,
          });
          return;
        }
        const { id, title } = line.screen;
        s.addText(id, { x, y, w: 0.62, h: LINE, fontFace: FONT, fontSize: 8.5, bold: true, color: INK, valign: 'middle', margin: 0 });
        s.addText(title, { x: x + 0.64, y, w: colW - 1.06, h: LINE, fontFace: FONT, fontSize: 8.5, color: MUTED, valign: 'middle', margin: 0 });
        s.addText(String(pageOf.get(id)), {
          x: x + colW - 0.4, y, w: 0.4, h: LINE, fontFace: FONT, fontSize: 8.5, color: FAINT, align: 'right', valign: 'middle', margin: 0,
        });
      });
    });

    footer(s, item.page);
    s.addNotes(`Contents. ${screens.length} screens across ${sections.length} sections.`);
    continue;
  }

  /* -- a section divider --------------------------------------------------- */
  if (item.kind === 'section') {
    const { section } = item;
    const nth = sections.indexOf(section) + 1;
    s.background = { color: DEEP };
    // Not the section's own name again — where you are in the deck, which the
    // title underneath cannot tell you.
    s.addText(`SECTION ${nth} OF ${sections.length}`, {
      x: MARGIN, y: 3.05, w: 9.0, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: PALE, charSpacing: 2.2, margin: 0,
    });
    s.addText(section.name, {
      x: MARGIN, y: 3.5, w: 9.5, h: 1.1, fontFace: FONT, fontSize: 48, bold: true, color: PAPER, margin: 0,
    });
    s.addText(
      `${section.screens.length} screen${section.screens.length === 1 ? '' : 's'}  ·  `
      + section.screens.map((sc) => sc.id).join(' · '),
      { x: MARGIN, y: 4.7, w: 9.5, h: 0.4, fontFace: FONT, fontSize: 11, color: PALE, margin: 0 },
    );
    footer(s, item.page, { onDark: true });
    s.addNotes(`${section.name} — ${section.screens.length} screens.`);
    continue;
  }

  /* -- one screen ---------------------------------------------------------- */
  const { screen, section } = item;
  s.background = { color: PAPER };

  s.addText(section.name.toUpperCase(), {
    x: MARGIN, y: 0.42, w: 4.0, h: 0.28, fontFace: FONT, fontSize: 11, bold: true, color: BRAND, charSpacing: 1.6, margin: 0,
  });

  s.addText(
    [
      { text: screen.id, options: { bold: true, color: INK } },
      { text: '  ·  ', options: { bold: true, color: FAINT } },
      { text: screen.title, options: { bold: true, color: INK } },
    ],
    { x: MARGIN, y: 0.72, w: 9.5, h: 0.55, fontFace: FONT, fontSize: 26, margin: 0 },
  );

  s.addImage({ path: screen.file, x: MARGIN, y: SHOT_Y, w: SHOT_H / screen.ratio, h: SHOT_H });

  /* What the screenshot leaves out. Said quietly, under the phone, because it
     is a caveat about the picture rather than anything the app is doing. */
  if (screen.hidden >= HIDDEN_ENOUGH) {
    s.addText(`Scrolls · about ${Math.round((1 - screen.hidden) * 20) * 5}% of this screen is shown above`, {
      x: MARGIN, y: SHOT_Y + SHOT_H + 0.06, w: 3.2, h: 0.22,
      fontFace: FONT, fontSize: 8, italic: true, color: FAINT, margin: 0,
    });
  }

  /* The path this screen is on, beside the phone: every step as its own
     screenshot, with its code and name, and the one you are looking at at full
     strength while the rest stand back. */
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

  /* The rest of the screen, for anything that scrolls — review 22/08 asked for
     exactly this on A9 and A13. It sits under the filmstrip at two thirds the
     height of the main phone, which keeps it clearly secondary and keeps the
     right half of the page, the half the deck exists to leave empty, empty. */
  const belowStrip = flow ? STRIP_BOTTOM + 0.30 : SHOT_Y;
  let keyX = STRIP_X;
  if (screen.tail) {
    const tailY = belowStrip;
    // A deep tree can take the whole column. Where what is left will not hold a
    // legible second phone, the note under the first one still says the screen
    // scrolls — the picture is the bonus, not the promise.
    const tailH = Math.min(SHOT_H * 0.62, FOOT_Y - 0.24 - tailY);
    if (tailH >= 1.55) {
      s.addText('THE REST OF THIS SCREEN', {
        x: STRIP_X, y: tailY - 0.28, w: 3.0, h: 0.24,
        fontFace: FONT, fontSize: 8, bold: true, color: FAINT, charSpacing: 1.2, margin: 0,
      });
      s.addImage({ path: screen.tail, x: STRIP_X, y: tailY, w: tailH / screen.ratio, h: tailH });
      keyX = STRIP_X + tailH / screen.ratio + 0.34;   // clear of the second phone
    }
  }

  /* THE MARKERS, AND THE KEY THAT MAKES THEM MEAN ANYTHING.

     Screen pages only. The cover, the contents and the section dividers have
     already `continue`d out of this loop above, so nothing here can put a disc
     on a page that has no phone on it to point at.

     Discs first, down the gutter, at the height of the control each one names.
     Two controls a few millimetres apart on the phone would print as one blot,
     so a disc that lands within MARK_GAP of the one above is pushed down — the
     numbers still run top to bottom, which is the order the key lists them in.

     Then the key. A marker that leads somewhere carries the code AND the page,
     because "→ B11" is only useful to somebody who has the contents page open;
     one that opens something in place carries the sentence the control declared
     at its call site. */
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

    const keyW = W - MARGIN - keyX;
    const keyY = belowStrip;
    s.addText('WHAT THE SMALL BUTTONS DO', {
      x: keyX, y: keyY - 0.28, w: keyW, h: 0.24,
      fontFace: FONT, fontSize: 8, bold: true, color: FAINT, charSpacing: 1.2, margin: 0,
    });
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
          ? [{ text: `  →  ${m.to}${byId.get(m.to) ? ` ${byId.get(m.to).title}` : ''}`, options: { color: BRAND, bold: true } },
             ...(target ? [{ text: `  (page ${target})`, options: { color: FAINT } }] : [])]
          : [{ text: `  —  ${m.note}`, options: { color: MUTED } }]),
      ], {
        x: keyX + 0.30, y, w: keyW - 0.30, h: LINE_H,
        fontFace: FONT, fontSize: 8, valign: 'middle', lineSpacing: 10, margin: 0,
      });
    });
  }

  footer(s, item.page);
  // The registry's own one-liner, so whoever presents it has something to say.
  s.addNotes(`${screen.id} — ${screen.title}\n\n${screen.note}`
    + (marks.length ? `\n\n${marks.map((m, i) => `${i + 1}. ${m.label}${m.to ? ` → ${m.to}` : ` — ${m.note}`}`).join('\n')}` : '')
    + (flow ? `\n\nOn the "${flow.name}" path.` : '')
    + (screen.hidden >= HIDDEN_ENOUGH ? `\n\nThe screenshot shows ${Math.round((1 - screen.hidden) * 100)}% of this screen; the rest is below the fold.` : ''));
}

await mkdir(resolve(OUT, '..'), { recursive: true });
await pres.writeFile({ fileName: OUT });
await rm(WORK, { recursive: true, force: true });

const withFlow = screens.filter((s) => flows.some((f) => f.ids.includes(s.id))).length;
const cut = screens.filter((s) => s.hidden >= HIDDEN_ENOUGH).length;
console.log(`${plan.length} slides -> ${OUT}`);
console.log(`  cover, contents, ${sections.length} section dividers, ${screens.length} screens`);
console.log(`  ${withFlow} screens sit on one of the ${flows.length} paths; filmstrip tile ${TILE_W.toFixed(2)}" wide`);
console.log(`  ${cut} screens carry a "scrolls" note and a second shot of the rest`);
const marked = screens.reduce((n, s) => n + (s.marks?.length ?? 0), 0);
console.log(`  ${marked} small controls marked in the gutter across ${screens.filter((s) => s.marks?.length).length} screens`);
