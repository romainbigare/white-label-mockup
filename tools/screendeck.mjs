#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   screendeck.mjs — build docs/Wafra_Farm_App_Screens.pptx.

   A title page and then one A4 landscape page per screen, in App Map order:
   the screen's code and name at the top, the phone down the left-hand side, and
   the rest of the page deliberately empty. It is a deck to print, write on and
   hand back — which is the only reason the right two thirds are blank.

   Everything on it is read from the running app rather than kept in step by
   hand: the screen list and its order come from SCREEN_GROUPS, the titles from
   the registry, the version from app/meta.js, and the logo is screenshotted out
   of the page through the same CSS every screen's logo uses. Re-label the app
   in brand.js and the deck re-labels itself.

   Run:  npm run deck                    # docs/Wafra_Farm_App_Screens.pptx
         node tools/screendeck.mjs --out /tmp/review.pptx

   TWO THINGS ABOUT THE SCREENSHOTS, both of which cost a round to find.

   The clip is the device's bounding box while the bezel is a ROUNDED rectangle
   inside it, so the four corners show whatever is behind the phone. Two things
   were: the harness's dark green page, which lands in the deck as a black
   rectangle behind every screen, and the bezel's own 60px drop shadow, which
   the clip cuts into a grey one. Both are turned off for the capture and only
   for the capture — see WHITE_PAGE below.

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

/* Wafra's own tokens, so the deck and the app are the same object. */
const INK = '0D1411', MUTED = '4A5852', FAINT = '8C9A94';
const BRAND = '1B7350', PAPER = 'FFFFFF';

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

/* The screen list IS the App Map: SCREEN_GROUPS decides the order and the
   section each screen is filed under. Anything registered but ungrouped still
   gets a page rather than being silently dropped. */
const screens = await page.evaluate(async () => {
  const { SCREEN_GROUPS } = await import('/app/screens/index.js');
  const registry = wafra.SCREENS;
  const out = [];
  for (const group of SCREEN_GROUPS) {
    for (const id of group.ids) {
      const s = registry[id];
      if (s) out.push({ id: s.id, title: s.title, note: s.note, route: s.route ?? s.id, group: group.name });
    }
  }
  const listed = new Set(out.map((s) => s.id));
  for (const s of Object.values(registry)) {
    if (!listed.has(s.id)) out.push({ id: s.id, title: s.title, note: s.note, route: s.route ?? s.id, group: 'Other' });
  }
  return out;
});

/* The lockup, taken out of the page rather than kept as a second copy of the
   artwork beside it. brand.js supplies one file and the CSS decides how much of
   it shows; borrowing the same rule means a re-labelled app produces a
   re-labelled deck with nothing here to change. */
const logo = { path: join(WORK, 'logo.png') };
{
  // The artwork is a background image on a transparent span, and an element
  // screenshot photographs whatever is behind it — the first run of this took
  // the harness bar and half of A1 along with the lockup. So it is laid over a
  // white stage of its own, which is also the paper it ends up on.
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

/* -- typeset -------------------------------------------------------------- */

const pres = new pptxgen();
pres.defineLayout({ name: 'A4', width: W, height: H });
pres.layout = 'A4';
pres.author = 'Wafra Greentech';
pres.title = `Wafra Farm App — UI mockup v${MOCKUP_VERSION}`;

{
  const s = pres.addSlide();
  s.background = { color: PAPER };

  const logoH = 1.0;
  s.addImage({ path: logo.path, x: MARGIN, y: 0.95, w: logoH * logo.ratio, h: logoH });

  s.addText('Wafra Farm App', {
    x: MARGIN, y: 2.55, w: 8.2, h: 1.0, fontFace: 'Calibri', fontSize: 46, bold: true, color: INK, margin: 0,
  });

  // The description, as the two numbers it is made of.
  const stat = (x, value, label) => {
    s.addText(value, { x, y: 4.05, w: 2.4, h: 0.95, fontFace: 'Calibri', fontSize: 54, bold: true, color: INK, margin: 0 });
    s.addText(label, { x, y: 4.98, w: 2.4, h: 0.34, fontFace: 'Calibri', fontSize: 12, bold: true, color: BRAND, charSpacing: 1.6, margin: 0 });
  };
  const sections = new Set(screens.map((s2) => s2.group)).size;
  stat(MARGIN, String(screens.length), 'SCREENS');
  stat(MARGIN + 2.7, MOCKUP_VERSION, 'VERSION');

  s.addText(
    `${screens.length} screens across ${sections} sections of the app, at version ${MOCKUP_VERSION}. `
    + 'Each page carries one screen on the left; the right-hand side is left clear for comments and notes.',
    { x: MARGIN, y: 5.95, w: 6.6, h: 0.9, fontFace: 'Calibri', fontSize: 13, color: MUTED, lineSpacing: 20, margin: 0 },
  );
  s.addNotes(`Wafra Farm App UI mockup, version ${MOCKUP_VERSION}. ${screens.length} screens.`);
}

screens.forEach((screen, i) => {
  const s = pres.addSlide();
  s.background = { color: PAPER };

  s.addText(screen.group.toUpperCase(), {
    x: MARGIN, y: 0.42, w: 6.0, h: 0.28, fontFace: 'Calibri', fontSize: 11, bold: true, color: BRAND, charSpacing: 1.6, margin: 0,
  });
  s.addText(
    [
      { text: screen.id, options: { bold: true, color: INK } },
      { text: '  ·  ', options: { bold: true, color: FAINT } },
      { text: screen.title, options: { bold: true, color: INK } },
    ],
    { x: MARGIN, y: 0.72, w: 9.5, h: 0.55, fontFace: 'Calibri', fontSize: 26, margin: 0 },
  );

  s.addImage({ path: screen.file, x: MARGIN, y: SHOT_Y, w: SHOT_H / screen.ratio, h: SHOT_H });

  s.addText(`Wafra Farm App · UI mockup v${MOCKUP_VERSION}`, {
    x: MARGIN, y: FOOT_Y, w: 5.5, h: 0.28, fontFace: 'Calibri', fontSize: 9, color: FAINT, margin: 0,
  });
  s.addText(String(i + 1), {
    x: W - MARGIN - 1.2, y: FOOT_Y, w: 1.2, h: 0.28, fontFace: 'Calibri', fontSize: 9, color: FAINT, align: 'right', margin: 0,
  });

  // The registry's own one-liner, so whoever presents it has something to say.
  s.addNotes(`${screen.id} — ${screen.title}\n\n${screen.note}`);
});

await mkdir(resolve(OUT, '..'), { recursive: true });
await pres.writeFile({ fileName: OUT });
await rm(WORK, { recursive: true, force: true });

const shotW = (SHOT_H / screens[0].ratio).toFixed(2);
console.log(`${screens.length + 1} slides -> ${OUT}`);
console.log(`A4 landscape · screen ${shotW}" wide at x=${MARGIN}" · notes area from ${(MARGIN + Number(shotW) + 0.5).toFixed(2)}" to ${(W - MARGIN).toFixed(2)}"`);
