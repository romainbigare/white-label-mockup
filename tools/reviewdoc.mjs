#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   reviewdoc.mjs — build docs/Mockup_Review_Changes.pdf.

   One screen per block: the app as it stood BEFORE a given commit and as it
   stands now, side by side, with the changes listed underneath. What each
   screen's notes say lives in tools/reviewdoc.data.json, keyed by screen id, so
   the document is edited as data rather than as markup.

   The "before" half needs a second checkout, because both halves are captured
   by driving a running app rather than by diffing source:

     git worktree add /tmp/before <ref>
     ln -s "$PWD/node_modules" /tmp/before/node_modules
     node tools/reviewdoc.mjs --before /tmp/before
     git worktree remove /tmp/before

   Without --before it builds the same document with the After column only,
   which is what a first pass on a new review looks like.

   Screenshots go through JPEG at 640 px. The synthesised satellite basemap is
   high-frequency noise that PNG cannot compress — the same document with PNGs
   is 18 MB rather than 5 — and at 55 mm printed this is still past 300 dpi.
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = join(ROOT, '.reviewdoc');
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : fallback;
};
// One tool, one document per review round: --data says which notes to typeset
// and --out where the PDF goes, so a new round does not overwrite the record of
// the last one.
const DATA = resolve(flag('--data', join(ROOT, 'tools', 'reviewdoc.data.json')));
const OUT = resolve(flag('--out', join(ROOT, 'docs', 'Mockup_Review_Changes.pdf')));
const BEFORE_ROOT = flag('--before', null) ? resolve(flag('--before')) : null;

const data = JSON.parse(await readFile(DATA, 'utf8'));
const WANTED = data.sections.flatMap((s) => s.screens.map((x) => x.id));
const logoB64 = (await readFile(join(ROOT, 'app', 'imgs', 'logo.avif'))).toString('base64');
const LOGO_URI = `data:image/avif;base64,${logoB64}`;

/* -- capture --------------------------------------------------------------- */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.avif': 'image/avif',
};

async function serve(root) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    // The extension comes off the RESOLVED file, not the URL: "/" has none, and
    // a response typed application/octet-stream makes the browser download the
    // page instead of rendering it.
    const file = join(root, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, base: `http://127.0.0.1:${server.address().port}/` };
}

/* Overlays are not routes, so they are opened by name. Some exist in only one
   of the two versions, and some changed the parameter they take — which is
   itself a change worth a page, so the table is per version.

   `from` is the screen the sheet is photographed over, and it has to be a
   screen that can actually open it: a sheet floating above Home that Home has
   no way of reaching reads as a claim about where the feature lives. Sheets
   reachable from anywhere keep the default. */
const OVERLAYS = {
  after: {
    MEASURE_PICKER: { from: 'B4:plot-04' },
    ASSUMPTIONS: { from: 'B4:plot-04', params: { plotId: 'plot-04' } },
    AREA_TOOL: { from: 'A11:farm-6', params: { farmId: 'farm-6', tool: 'join' } },
    AUTO_ASSIGN: { from: 'D1', params: { farmId: 'all' } },
    LOCATION_BLOCKED: { from: 'A9D' },
  },
  before: {
    MEASURE_PICKER: { from: 'B4:plot-04' },
    ASSUMPTIONS: { from: 'B4:plot-04', params: { adviceId: 'adv-01' } },
  },
};

async function capture(root, which, outDir) {
  await mkdir(outDir, { recursive: true });
  const { server, base } = await serve(root);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 2 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!globalThis.wafra);
  await page.evaluate(() => {
    wafra.state.device.presetId = 'iphone-16-pro-max';
    wafra.state.session.role = 'owner';
    wafra.commit('doc');
  });

  // Ids read off the running build rather than written down here, so both
  // versions shoot the same advice item and the same plot.
  const ids = await page.evaluate(() => ({
    D3: wafra.SCREENS.D3?.route ?? 'D3',
    D4: wafra.SCREENS.D4?.route ?? 'D4',
    mismatch: (wafra.state.db.plots.find((p) => (p.cropCycles ?? []).some((c) => c.detectedCropName))
      ?? wafra.state.db.plots.find((p) => p.treeCount === 0) ?? wafra.state.db.plots[0]).id,
  }));

  const ROUTES = {
    A11: 'A11:farm-6', B2: 'B2:farm-1', B3: 'B3:farm-1', B4: 'B4:plot-04',
    B5: `B5:${ids.mismatch}`, B6: `B6:${ids.mismatch}`,
    B9: 'B9:farm-1', B10: 'B10:T-2841', D2: 'D2:adv-01', D3: ids.D3, D4: ids.D4,
    E2: 'E2:task-01',
  };

  const clip = () => page.evaluate(() => {
    const r = document.getElementById('device').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const shot = async (id) => {
    const overlay = OVERLAYS[which][id];
    if (overlay) {
      await page.evaluate(([v, p, from]) => { wafra.jump(from); wafra.openSheet(v, p); },
        [id, overlay.params ?? {}, ROUTES[overlay.from] ?? overlay.from ?? 'B1']);
      await page.waitForTimeout(220);
      if (!await page.evaluate(() => !!document.querySelector('.overlay .sheet, .overlay .modal'))) return false;
    } else if (id in OVERLAYS.after || id in OVERLAYS.before) {
      return false;                                   // an overlay this version does not have
    } else {
      await page.evaluate(([r]) => {
        wafra.state.ui.overlay = null;
        Object.assign(wafra.state.ui, { adviceTab: 'needs', farmFilter: 'all', plotFilter: 'all' });
        wafra.jump(r);
      }, [ROUTES[id] ?? id]);
      await page.waitForTimeout(220);
      // A screen the OTHER version has and this one does not renders the
      // shell's "no screen registered" marker. That is an absence, not a
      // screenshot — photographing it put a deleted screen in the document as
      // if it still existed, with an error page for a picture.
      if (await page.evaluate(() => !!document.querySelector('#app [data-missing-screen]'))) return false;
      if (await page.evaluate(() => (document.getElementById('app')?.textContent ?? '').trim().length < 12)) return false;
    }
    await page.screenshot({ path: join(outDir, `${id}.png`), clip: await clip() });
    return true;
  };

  let n = 0;
  for (const id of WANTED) if (await shot(id)) n += 1;
  await browser.close();
  server.close();
  console.log(`  ${which}: ${n}/${WANTED.length} screens`);
}

/* -- assemble -------------------------------------------------------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function jpeg(dir, id) {
  const src = join(dir, `${id}.png`);
  if (!existsSync(src)) return null;
  // Re-encoded in the browser rather than with an image library, so the tool
  // needs nothing beyond the playwright the smoke test already installs.
  return encodePage.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const scale = Math.min(1, 640 / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.84);
  }, (await readFile(src)).toString('base64'));
}

console.log('Building the review document…');
await rm(WORK, { recursive: true, force: true });
if (BEFORE_ROOT) await capture(BEFORE_ROOT, 'before', join(WORK, 'before'));
await capture(ROOT, 'after', join(WORK, 'after'));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const encodePage = await browser.newPage();
await encodePage.goto('about:blank');

let count = 0;
const blocks = [];
for (const section of data.sections) {
  blocks.push(`<h2 class="group">${esc(section.group)}</h2>`);
  for (const s of section.screens) {
    count += 1;
    // A missing shot means two opposite things depending on which side it is
    // missing from: a screen this review ADDED has no before, and one it
    // DELETED has no after. Saying "did not exist before" on both was how a
    // deleted screen came to read as a new one.
    const cell = (src, label, tone) => (src
      ? `<figure class="shot"><img src="${src}" alt="${esc(s.id)} ${label}"><figcaption class="${tone}">${label}</figcaption></figure>`
      : `<figure class="shot"><div class="none">${tone === 'before' ? 'Did not exist<br>before this review' : 'Deleted by<br>this review'}</div><figcaption class="${tone}">${label}</figcaption></figure>`);
    blocks.push(`
<section class="screen">
  <h3><span class="code">${esc(s.id)}</span> ${esc(s.name)}</h3>
  <div class="shots">${cell(await jpeg(join(WORK, 'before'), s.id), 'Before', 'before')}${cell(await jpeg(join(WORK, 'after'), s.id), 'After', 'after')}</div>
  <ul class="notes">
    ${s.notes.map(([ref, text]) => `<li><span class="ref">${esc(ref)}</span><span class="text">${esc(text)}</span></li>`).join('\n    ')}
  </ul>
</section>`);
  }
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(data.title)}</title>
<style>
  @page { size: A4; margin: 14mm 13mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1b2420; font-size: 9.4pt; line-height: 1.45; -webkit-print-color-adjust: exact; }
  .cover { height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .logo { width: 36mm; margin-bottom: 10mm; }
  .cover h1 { font-size: 30pt; margin: 0 0 6mm; letter-spacing: -.4pt; color: #0d3327; }
  .cover p { font-size: 11pt; line-height: 1.55; margin: 0 0 5mm; max-width: 135mm; color: #2f3b36; }
  .cover .author { font-size: 10pt; color: #2f3b36; margin-top: 2mm; }
  .cover .meta { font-size: 9pt; color: #5f6d66; margin-top: 8mm; }
  .cover .rule { height: 3px; background: #145c40; width: 42mm; margin: 0 0 8mm; }
  h2.group { font-size: 8pt; letter-spacing: 1.4pt; text-transform: uppercase; color: #145c40;
    border-bottom: 1.5px solid #145c40; padding-bottom: 2mm; margin: 0 0 5mm;
    page-break-after: avoid; page-break-before: always; }
  h2.group:first-of-type { page-break-before: avoid; }
  section.screen { page-break-inside: avoid; margin: 0 0 9mm; }
  section.screen h3 { font-size: 13pt; margin: 0 0 3mm; color: #0d3327; font-weight: 600; page-break-after: avoid; }
  .code { display: inline-block; background: #145c40; color: #fff; border-radius: 3px;
    padding: 0.6mm 2mm; font-size: 9pt; font-weight: 700; margin-right: 2mm;
    letter-spacing: .3pt; vertical-align: 1px; }
  .shots { display: flex; gap: 7mm; align-items: flex-start; margin: 0 0 4.5mm; }
  figure.shot { margin: 0; width: 55mm; }
  figure.shot img { width: 100%; display: block; border: 1px solid #dde3e0; border-radius: 2mm; }
  figcaption { font-size: 7.4pt; font-weight: 700; letter-spacing: .7pt; text-transform: uppercase;
    padding-top: 1.6mm; text-align: center; }
  figcaption.before { color: #8a6d3b; }
  figcaption.after  { color: #145c40; }
  .none { width: 100%; aspect-ratio: 836 / 1744; border: 1px dashed #c2ccc7; border-radius: 2mm;
    display: flex; align-items: center; justify-content: center; text-align: center;
    color: #93a19a; font-size: 8pt; line-height: 1.4; }
  ul.notes { margin: 0; padding: 0; list-style: none; }
  ul.notes li { display: flex; gap: 3mm; margin-bottom: 2.2mm; page-break-inside: avoid; }
  .ref { flex: 0 0 24mm; font-size: 7.6pt; font-weight: 700; color: #145c40; padding-top: .5mm; letter-spacing: .2pt; }
  .text { flex: 1; }
</style></head><body>
<div class="cover">
  <img class="logo" src="${LOGO_URI}" alt="Wafra">
  <div class="rule"></div>
  <h1>${esc(data.title)}</h1>
  <p>${esc(data.subtitle)}</p>
  <p>${esc(data.blurb ?? 'Each screen is shown before and after, with the list of changes underneath. A dashed frame means the screen did not exist in v1.2.')}</p>
  <div class="author">Romain Bigare</div>
  <div class="meta">Wafra Farm App · ${count} screens · iPhone 16 Pro Max, English, Owner role, Combined Pro plan</div>
</div>
${blocks.join('\n')}
</body></html>`;

const htmlPath = join(WORK, 'review.html');
await writeFile(htmlPath, html);
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
await page.pdf({
  path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:7pt;color:#93a19a;padding:0 13mm;
    font-family:Helvetica,Arial,sans-serif;display:flex;justify-content:space-between;">
    <span>${esc(data.title)}</span><span class="pageNumber"></span></div>`,
  margin: { top: '14mm', bottom: '16mm', left: '13mm', right: '13mm' },
});
await browser.close();
await rm(WORK, { recursive: true, force: true });
console.log(`  ${count} screens -> ${OUT}`);
