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

   A screen that sits on a path through the app also carries that path across
   the top right — the whole flow, arrows and all, with the screen you are
   looking at picked out. It answers the question a printout otherwise cannot:
   what did the farmer just do, and what happens next.

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

   And they stay PNG. reviewdoc.mjs puts its screenshots through JPEG because it
   prints two per screen at 55 mm; here one screen fills 150 mm of paper, the UI
   is flat colour and hairlines rather than photographs, and JPEG's ringing
   around 1px borders is visible at that size. The deck is ~18 MB as a result.
   --------------------------------------------------------------------------- */
import pptxgen from 'pptxgenjs';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
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
const SHOT_Y = 1.55, SHOT_H = 5.85;          // 5.85 leaves 0.28" above the footer
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
  const { SCREEN_GROUPS, FLOWS } = await import('/app/screens/index.js');
  const registry = wafra.SCREENS;
  const pick = (s, group) => ({ id: s.id, title: s.title, note: s.note, route: s.route ?? s.id, group });
  const out = SCREEN_GROUPS
    .map((g) => ({ name: g.name, screens: g.ids.filter((id) => registry[id]).map((id) => pick(registry[id], g.name)) }))
    .filter((g) => g.screens.length);
  const listed = new Set(out.flatMap((g) => g.screens.map((s) => s.id)));
  const rest = Object.values(registry).filter((s) => !listed.has(s.id)).map((s) => pick(s, 'Other'));
  if (rest.length) out.push({ name: 'Other', screens: rest });
  return { sections: out, flows: FLOWS.map((f) => ({ name: f.name, ids: [...f.ids] })) };
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

for (const screen of screens) {
  // resetLocal keeps a half-finished signup from one screen out of the next.
  await page.evaluate((route) => { wafra.resetLocal('signup'); wafra.jump(route); }, screen.route);
  await page.waitForTimeout(160);
  const clip = await page.evaluate(() => {
    const r = document.getElementById('device').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  screen.file = join(WORK, `${screen.id}.png`);
  screen.ratio = clip.height / clip.width;
  await page.screenshot({ path: screen.file, clip });
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

/* The path a screen sits on. A screen can be on several — A12 is on both
   registration routes — and the strip has room for one, so it takes the first,
   which is why FLOWS declares the two registration paths first. */
const flowOf = (id) => flows.find((f) => f.ids.includes(id));

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

  /* The path this screen is on, across the top right and picked out where you
     are standing. Right-aligned so it grows leftwards into the empty half
     rather than towards the section label, and small enough that the longest
     flow in the app stays on one line. */
  const flow = flowOf(screen.id);
  if (flow) {
    const runs = [{ text: `${flow.name} — `, options: { color: FAINT, italic: true } }];
    flow.ids.forEach((id, i) => {
      if (i) runs.push({ text: ' → ', options: { color: FAINT } });
      runs.push(id === screen.id
        ? { text: id, options: { color: BRAND, bold: true } }
        : { text: id, options: { color: MUTED } });
    });
    s.addText(runs, {
      x: W - MARGIN - 6.6, y: 0.40, w: 6.6, h: 0.3, fontFace: FONT, fontSize: 9, align: 'right', valign: 'middle', margin: 0,
    });
  }

  s.addText(
    [
      { text: screen.id, options: { bold: true, color: INK } },
      { text: '  ·  ', options: { bold: true, color: FAINT } },
      { text: screen.title, options: { bold: true, color: INK } },
    ],
    { x: MARGIN, y: 0.72, w: 9.5, h: 0.55, fontFace: FONT, fontSize: 26, margin: 0 },
  );

  s.addImage({ path: screen.file, x: MARGIN, y: SHOT_Y, w: SHOT_H / screen.ratio, h: SHOT_H });

  footer(s, item.page);
  // The registry's own one-liner, so whoever presents it has something to say.
  s.addNotes(`${screen.id} — ${screen.title}\n\n${screen.note}`
    + (flow ? `\n\nOn the ${flow.name} path: ${flow.ids.join(' → ')}` : ''));
}

await mkdir(resolve(OUT, '..'), { recursive: true });
await pres.writeFile({ fileName: OUT });
await rm(WORK, { recursive: true, force: true });

const withFlow = screens.filter((s) => flowOf(s.id)).length;
console.log(`${plan.length} slides -> ${OUT}`);
console.log(`  cover, contents, ${sections.length} section dividers, ${screens.length} screens`);
console.log(`  ${withFlow} of ${screens.length} screens sit on one of the ${flows.length} paths in FLOWS`);
