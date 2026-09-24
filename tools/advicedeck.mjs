#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   advicedeck.mjs — build docs/Wafra_Farm_Health_and_Advice_v<version>.pptx.

   A short deck for a partner, not a review deck: plant health, disease risk and
   the advice screens, one phone per page, each explained in plain English on
   the left and in Azerbaijani on the right. The partner in mind sends advice —
   and later its own products — to its own farmers through the app, so the deck
   ends on where those products fit.

   The words live in tools/advicedeck.data.json, the same split reviewdoc.mjs
   makes: the copy is edited as data, and this file only knows how to lay it
   out. Each screen there names a route, an optional scroll, an optional button
   to press, and up to four notes. A note points at part of the screen with a
   TARGET rather than with coordinates:

     { "sel": ".card", "has": "Active ingredient" }   the deepest .card whose
                                                      text or aria-label holds it
     { "has": "URGENT" }                              any element, deepest first
     { ..., "up": 1 }                                 then its parent
     { ..., "within": { target } }                    searched inside another
     { "union": [ target, target ] }                  the box round several

   A note's numbered disc sits just outside the left edge of what it points
   at; `"at": "right"` on the note moves it to the right edge. Nothing is
   drawn round the part itself.

   The boxes are measured on the rendered page at capture time, so a screen that
   moves a card moves its marker with it, and a target that no longer matches
   stops the build instead of numbering nothing.

   The phone keeps its bezel, and the four corners outside the bezel's rounded
   rectangle are transparent: the page is photographed with no background at
   all, so the phone sits on whatever the slide is. Same trap as screendeck.mjs,
   other fix — that deck prints on white and paints the corners white.

   The phone speaks the language named by `"lang"` at the top of the data file
   (Azerbaijani for this partner). The targets are still written in English:
   see `__deck` below for how an English target finds its element on a screen
   in another language.

   Run:  npm run advicedeck
         node tools/advicedeck.mjs --out /tmp/partner.pptx
   --------------------------------------------------------------------------- */
import pptxgen from 'pptxgenjs';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, '.advicedeck');
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : fallback;
};
const { MOCKUP_VERSION } = await import(pathToFileURL(join(ROOT, 'app', 'meta.js')));
const { default: GLYPHS } = await import(pathToFileURL(join(ROOT, 'app', 'ui', 'icons.data.js')));
const DATA = JSON.parse(await readFile(join(ROOT, 'tools', 'advicedeck.data.json'), 'utf8'));
const OUT = resolve(flag('--out', join(ROOT, 'docs', `Wafra_Farm_Health_and_Advice_v${MOCKUP_VERSION}.pptx`)));

/* -- the page ------------------------------------------------------------- */

const W = 13.333, H = 7.5;
const FONT = 'Calibri';

/* Wafra's own tokens (app/styles/tokens.css), so the deck and the app match. */
const INK = '0D1411', MUTED = '4A5852', FAINT = '5F6D66';
const DEEP = '114230', BRAND = '1B7350';
const PALE = 'BDE0D0', MINT = 'EEF7F2', CARD = '145C40', PAPER = 'FFFFFF';

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
  executablePath: process.env.WAFRA_DECK_CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// deviceScaleFactor 2 puts the phone at ~260 dpi across its 3.2" of slide.
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });

await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);

/* The lockup, photographed out of the page through the same CSS every screen's
   logo uses — see screendeck.mjs. It lands on the white cover, so a white stage
   behind it is the right background rather than a workaround. */
const logo = { path: join(WORK, 'logo.png') };
{
  const rect = await page.evaluate(() => {
    const stage = document.createElement('div');
    stage.id = 'deck-logo-stage';
    stage.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#ffffff;';
    const el = document.createElement('span');
    el.id = 'deck-logo';
    el.className = 'logo logo--lockup';
    el.style.cssText = '--logo-h:300px;';
    stage.append(el);
    document.body.append(stage);
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  await page.locator('#deck-logo').screenshot({ path: logo.path });
  await page.evaluate(() => document.getElementById('deck-logo-stage')?.remove());
  logo.ratio = rect.w / rect.h;
}

/* Only after the logo: from here the page has no background at all, so the
   phone's corners photograph as transparent. */
await page.addStyleTag({ content: `
  html, body, #harness, .stage { background: transparent !important; background-image: none !important; }
  .device__bezel { box-shadow: 0 0 0 2px #0b100e !important; }
` });

/* The app's own glyphs for the closing page, drawn through a canvas in the page
   that is already open rather than adding an image library for four icons. */
async function glyph(name, color, px = 256) {
  const inner = GLYPHS[name];
  if (!inner) throw new Error(`advicedeck: no icon called "${name}" in app/ui/icons.data.js`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="#${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const b64 = await page.evaluate(async ({ svg, px }) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = px;
    canvas.getContext('2d').drawImage(img, 0, 0, px, px);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { svg, px });
  const file = join(WORK, `icon-${name}-${color}.png`);
  await writeFile(file, Buffer.from(b64, 'base64'));
  return file;
}

/* -- finding the parts a note points at ---------------------------------
   Injected once; the app is one page and never reloads. A target is found by
   its ENGLISH text, and what comes out is a PATH — the child indices from the
   phone down to the element. The screens are the same components in every
   language, so the path found on the English screen names the same element
   on the Azerbaijani one, where the English words are nowhere to be found. */
await page.addScriptTag({ content: `globalThis.__deck = (() => {
  const device = () => document.getElementById('device');
  const pathOf = (el) => {
    const path = [];
    for (let e = el; e && e !== device(); e = e.parentElement) path.unshift([...e.parentElement.children].indexOf(e));
    return path;
  };
  const byPath = (path) => path.reduce((e, i) => e?.children[i], device());

  // What of an element the photograph actually shows: anything inside the
  // scroller is cut by it, and by the action dock that floats over its foot.
  const shown = (el) => {
    const dev = device().getBoundingClientRect();
    const scroller = device().querySelector('.app__scroll');
    const dock = device().querySelector('.actiondock');
    let top = dev.top, bottom = dev.bottom, left = dev.left, right = dev.right;
    if (scroller && scroller.contains(el)) {
      const s = scroller.getBoundingClientRect();
      top = Math.max(top, s.top); bottom = Math.min(bottom, s.bottom);
      left = Math.max(left, s.left); right = Math.min(right, s.right);
      if (dock) bottom = Math.min(bottom, dock.getBoundingClientRect().top);
    }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const box = {
      left: Math.max(r.left, left), right: Math.min(r.right, right),
      top: Math.max(r.top, top), bottom: Math.min(r.bottom, bottom),
    };
    return box.right - box.left > 2 && box.bottom - box.top > 2 ? box : null;
  };

  // The deepest visible match: a card holding "Active ingredient" and the
  // screen holding that card both contain the words, and the note means the card.
  const findEl = (t, root) => {
    const text = (e) => (e.getAttribute('aria-label') ?? '') + ' ' + e.textContent;
    const all = [...root.querySelectorAll(t.sel ?? '*')]
      .filter((e) => (!t.has || text(e).includes(t.has)) && shown(e));
    const leaves = all.filter((e) => !all.some((o) => o !== e && e.contains(o)));
    return leaves[t.nth ?? 0] ?? null;
  };
  // A target, as the list of elements it points at.
  const find = (t, scope = device()) => {
    if (t.union) {
      const parts = t.union.map((u) => find(u, scope));
      return parts.some((p) => !p) ? null : parts.flat();
    }
    const root = t.within ? find(t.within, scope)?.[0] : scope;
    let el = root && findEl(t, root);
    for (let i = 0; el && i < (t.up ?? 0); i++) el = el.parentElement;
    return el ? [el] : null;
  };

  const PAD = 5;
  return {
    pathOf, byPath,
    locate: (t) => find(t)?.map(pathOf) ?? null,
    button: (label) => [...device().querySelectorAll('button')].find((b) => b.textContent.trim() === label),
    anchor: (s) => [...device().querySelectorAll(s.sel)].find((e) => e.textContent.includes(s.has)),
    scrollTo(el, y) {
      const sc = device().querySelector('.app__scroll');
      sc.scrollTop += el.getBoundingClientRect().top - (device().getBoundingClientRect().top + y);
    },
    // The box round a list of paths, as fractions of the phone.
    box(paths) {
      const dev = device().getBoundingClientRect();
      const parts = paths.map((p) => byPath(p)).map((el) => el && shown(el));
      if (!parts.length || parts.some((p) => !p)) return null;
      const b = parts.reduce((a, c) => ({
        left: Math.min(a.left, c.left), right: Math.max(a.right, c.right),
        top: Math.min(a.top, c.top), bottom: Math.max(a.bottom, c.bottom),
      }));
      return {
        x: (b.left - PAD - dev.left) / dev.width, y: (b.top - PAD - dev.top) / dev.height,
        w: (b.right - b.left + 2 * PAD) / dev.width, h: (b.bottom - b.top + 2 * PAD) / dev.height,
      };
    },
    clip() {
      const r = device().getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
  };
})();` });

/* Open a screen in a language, in the state a page wants. */
async function open(lang, route) {
  await page.evaluate(({ lang, route }) => {
    wafra.closeOverlay?.();
    wafra.setLanguage(lang);
    wafra.state.ui.preview = true;       // no side effects: opening an advice must not mark it read
    wafra.resetLocal('signup');
    wafra.jump(route);
  }, { lang, route });
  await page.waitForTimeout(250);
}

/* Photograph one screen in LANG. The parts the notes point at are found on the
   English screen first — that is the language the data file is written in —
   and then, if LANG is another, the same screen is opened again in LANG and
   the same elements are measured and photographed there. */
async function capture(id, shot, marks = [], lang = 'en') {
  const fail = (what) => { throw new Error(`advicedeck: ${id} — ${what}`); };

  await open('en', shot.route);
  let scrollPath = null, pressPath = null;
  if (shot.scroll) {
    scrollPath = await page.evaluate((s) => {
      // The path first: scrolling can redraw the screen, and a detached
      // element has no way back up to the phone.
      const el = __deck.anchor(s);
      if (!el) return null;
      const path = __deck.pathOf(el);
      __deck.scrollTo(el, s.y);
      return path;
    }, shot.scroll);
    if (!scrollPath) fail(`cannot scroll to "${shot.scroll.has}"`);
    await page.waitForTimeout(150);
  }
  if (shot.press) {
    pressPath = await page.evaluate((label) => {
      const b = __deck.button(label);
      if (!b) return null;
      const path = __deck.pathOf(b);
      b.click();
      return path;
    }, shot.press);
    if (!pressPath) fail(`has no "${shot.press}" button to press`);
    await page.waitForTimeout(600);   // the sheet's slide-in
  }
  const paths = await page.evaluate((targets) => targets.map((t) => __deck.locate(t)), marks.map((m) => m.target));
  const lost = marks.filter((_, i) => !paths[i]);
  if (lost.length) fail(`no visible match for ${lost.map((m) => JSON.stringify(m.target)).join(', ')}`);

  if (lang !== 'en') {
    await open(lang, shot.route);
    if (scrollPath) {
      await page.evaluate(({ path, y }) => __deck.scrollTo(__deck.byPath(path), y), { path: scrollPath, y: shot.scroll.y });
      await page.waitForTimeout(150);
    }
    if (pressPath) {
      await page.evaluate((path) => __deck.byPath(path).click(), pressPath);
      await page.waitForTimeout(600);
    }
  }

  const { clip, boxes } = await page.evaluate((paths) => ({
    clip: __deck.clip(), boxes: paths.map((p) => __deck.box(p)),
  }), paths);
  const hidden = marks.filter((_, i) => !boxes[i]);
  if (hidden.length) fail(`not on screen in "${lang}": ${hidden.map((m) => JSON.stringify(m.target)).join(', ')}`);

  const file = join(WORK, `${id}.png`);
  await page.screenshot({ path: file, clip, omitBackground: true });
  return { file, ratio: clip.height / clip.width, boxes };
}

const LANG = DATA.lang ?? 'en';
const cover = await capture('cover', DATA.cover.shot, [], LANG);
const screens = [];
for (const s of DATA.screens) screens.push({ ...s, shot: await capture(s.id, s, s.marks, LANG) });
const icons = {};
for (const step of DATA.close.steps) {
  icons[step.icon] = { light: await glyph(step.icon, PAPER), dark: await glyph(step.icon, DEEP) };
}
const arrow = await glyph('forward', '8EC9AE');

await browser.close();
server.close();

if (problems.length) {
  console.error(`${problems.length} console errors while capturing:`);
  for (const p of problems.slice(0, 8)) console.error(`  ${p}`);
  process.exit(1);
}

/* -- the deck ------------------------------------------------------------- */

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Wafra';
pres.company = 'Wafra';
pres.title = `${DATA.cover.en.title} — Wafra Farm`;

const TOTAL = DATA.screens.length + 2;
const text = (slide, value, opts) => slide.addText(value, { fontFace: FONT, margin: 0, isTextBox: true, ...opts });
const pageNo = (slide, n, color = FAINT) => text(slide, `${n} / ${TOTAL}`, {
  x: W - 1.55, y: H - 0.42, w: 1.0, h: 0.25, fontSize: 9, color, align: 'right',
});

/* The numbered disc: the same object on the phone and beside the note, which is
   all that ties the two together — no leader lines across the page. */
function disc(slide, n, cx, cy, d = 0.27) {
  slide.addShape(pres.shapes.OVAL, {
    x: cx - d / 2, y: cy - d / 2, w: d, h: d,
    fill: { color: DEEP }, line: { color: PAPER, width: 1.25 },
  });
  text(slide, String(n), {
    x: cx - d / 2, y: cy - d / 2, w: d, h: d,
    fontSize: 10.5, bold: true, color: PAPER, align: 'center', valign: 'middle',
  });
}

/* -- 1: the cover --------------------------------------------------------- */
{
  const slide = pres.addSlide();
  slide.background = { color: PAPER };

  // The phone on a mint panel that runs off the right and both edges.
  const panelX = 8.35;
  slide.addShape(pres.shapes.RECTANGLE, { x: panelX, y: 0, w: W - panelX, h: H, fill: { color: MINT }, line: { color: MINT } });
  const ph = 6.3, pw = ph / cover.ratio;
  slide.addImage({ path: cover.file, x: panelX + (W - panelX - pw) / 2, y: (H - ph) / 2, w: pw, h: ph });

  const x = 0.75, w = 7.35;
  const lh = 0.62;
  slide.addImage({ path: logo.path, x, y: 0.65, w: lh * logo.ratio, h: lh });

  /* Each title on ONE line, so the two blocks are the same shape: at 27 pt the
     Azerbaijani, the longer of the two, is about 6.7" against 7.35" of room. */
  const block = (lang, tag, y) => {
    const c = DATA.cover[lang];
    text(slide, tag, { x, y, w, h: 0.28, fontSize: 10.5, bold: true, color: BRAND, charSpacing: 2 });
    text(slide, c.title, { x, y: y + 0.34, w, h: 0.55, fontSize: 27, bold: true, color: DEEP, valign: 'top', fit: 'none' });
    text(slide, c.sub, { x, y: y + 0.98, w, h: 0.36, fontSize: 17, color: INK });
    text(slide, c.for, { x, y: y + 1.38, w, h: 0.36, fontSize: 13, color: MUTED });
  };
  block('en', 'ENGLISH', 1.95);
  block('az', 'AZƏRBAYCANCA', 4.15);

  text(slide, `${DATA.cover.note.en}  ·  ${DATA.cover.note.az}`, {
    x, y: H - 0.62, w, h: 0.26, fontSize: 9.5, italic: true, color: FAINT,
  });
}

/* -- 2…n: one page per screen --------------------------------------------- */

const PH = 6.6;                          // phone height on the page
const PY = (H - PH) / 2;
const COL_W = 4.15, MARGIN = 0.55;

for (const [i, s] of screens.entries()) {
  const slide = pres.addSlide();
  slide.background = { color: PAPER };

  const pw = PH / s.shot.ratio;
  const px = (W - pw) / 2;
  slide.addImage({ path: s.shot.file, x: px, y: PY, w: pw, h: PH });

  /* The disc alone marks the part — no outline round it, which would cover the
     very UI it points at. It sits OUTSIDE the part, against its left edge near
     the top, so it never covers the first words either. Most targets start at
     the screen's own margin, which puts the disc over the bezel — room nobody
     reads. A mark with `"at": "right"` goes against the right edge instead,
     for the few that have text to their left. */
  const boxes = s.shot.boxes.map((b) => ({ x: px + b.x * pw, y: PY + b.y * PH, w: b.w * pw, h: b.h * PH }));
  const D = 0.27;
  boxes.forEach((b, n) => {
    const right = s.marks[n].at === 'right';
    disc(slide, n + 1, right ? b.x + b.w + D / 2 - 0.03 : b.x - D / 2 + 0.03, b.y + Math.min(0.17, b.h / 2), D);
  });

  const column = (lang, tag, x) => {
    const c = s[lang];
    text(slide, tag, { x, y: 0.55, w: COL_W, h: 0.26, fontSize: 10, bold: true, color: BRAND, charSpacing: 2 });
    text(slide, c.title, { x, y: 0.86, w: COL_W, h: 0.9, fontSize: 24, bold: true, color: INK, valign: 'top', fit: 'none' });
    text(slide, c.body, { x, y: 1.82, w: COL_W, h: 1.05, fontSize: 14, color: MUTED, valign: 'top', fit: 'none' });

    const top = 3.05, room = 6.95 - top;
    const step = Math.min(1.12, room / s.marks.length);
    s.marks.forEach((m, n) => {
      const y = top + n * step;
      disc(slide, n + 1, x + 0.14, y + 0.15);
      const [label, body] = m[lang];
      text(slide, [
        { text: label, options: { bold: true, color: INK, fontSize: 13.5, breakLine: true } },
        { text: body, options: { color: MUTED, fontSize: 12 } },
      ], { x: x + 0.42, y: y + 0.02, w: COL_W - 0.42, h: step - 0.08, valign: 'top', paraSpaceAfter: 2, fit: 'none' });
    });
  };
  column('en', 'ENGLISH', MARGIN);
  column('az', 'AZƏRBAYCANCA', W - MARGIN - COL_W);

  pageNo(slide, i + 2);
}

/* -- last: where the partner's products go ---------------------------------- */
{
  const c = DATA.close;
  const slide = pres.addSlide();
  slide.background = { color: DEEP };

  text(slide, c.en.title, { x: 0.75, y: 0.6, w: 11.8, h: 0.62, fontSize: 32, bold: true, color: PAPER });
  text(slide, c.az.title, { x: 0.75, y: 1.22, w: 11.8, h: 0.5, fontSize: 22, color: PALE });

  const n = c.steps.length, gap = 0.42;
  const cw = (W - 1.5 - gap * (n - 1)) / n, cy = 2.15, ch = 3.8;
  c.steps.forEach((st, k) => {
    const x = 0.75 + k * (cw + gap);
    // The partner's own step is the one in the light: it is the page's point.
    const lit = k === 2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: cy, w: cw, h: ch, rectRadius: 0.14,
      fill: { color: lit ? MINT : CARD }, line: { color: lit ? MINT : CARD },
    });
    const d = 0.74;
    slide.addShape(pres.shapes.OVAL, { x: x + 0.3, y: cy + 0.32, w: d, h: d, fill: { color: lit ? DEEP : BRAND }, line: { color: lit ? DEEP : BRAND } });
    slide.addImage({ path: icons[st.icon].light, x: x + 0.3 + 0.17, y: cy + 0.32 + 0.17, w: d - 0.34, h: d - 0.34 });
    text(slide, String(k + 1), {
      x: x + cw - 0.62, y: cy + 0.3, w: 0.35, h: 0.4, fontSize: 20, bold: true,
      color: lit ? BRAND : '8EC9AE', align: 'right',
    });

    const ink = lit ? INK : PAPER, soft = lit ? MUTED : PALE;
    text(slide, [
      { text: st.en[0], options: { bold: true, fontSize: 15, color: ink, breakLine: true } },
      { text: st.en[1], options: { fontSize: 12, color: soft } },
    ], { x: x + 0.3, y: cy + 1.25, w: cw - 0.6, h: 1.0, valign: 'top', paraSpaceAfter: 3, fit: 'none' });
    text(slide, [
      { text: st.az[0], options: { bold: true, fontSize: 14, color: ink, breakLine: true } },
      { text: st.az[1], options: { fontSize: 12, color: soft } },
    ], { x: x + 0.3, y: cy + 2.5, w: cw - 0.6, h: 1.15, valign: 'top', paraSpaceAfter: 3, fit: 'none' });

    if (k < n - 1) {
      slide.addImage({ path: arrow, x: x + cw + (gap - 0.3) / 2, y: cy + ch / 2 - 0.15, w: 0.3, h: 0.3 });
    }
  });

  text(slide, [
    { text: c.en.next, options: { bold: true, fontSize: 15, color: PAPER, breakLine: true } },
    { text: c.az.next, options: { fontSize: 14, color: PALE } },
  ], { x: 0.75, y: 6.3, w: 10.5, h: 0.75, valign: 'top', paraSpaceAfter: 3 });
  pageNo(slide, TOTAL, PALE);
}

await mkdir(resolve(OUT, '..'), { recursive: true });
await pres.writeFile({ fileName: OUT });
console.log(`${TOTAL} pages  ->  ${OUT}`);
