#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   tourshots.mjs — photograph the six screens the guided tour illustrates
   itself with, and write them into app/imgs/tour/.

   Review 01/09 (second pass) — "use actual pictures of the screen, generated,
   cropped, with light border."

   The panels used to mount the real screens live and scale them down, which had
   one virtue — the tour could not drift from the app — and three costs the
   review's answer removes. A live screen inside a tour panel is a page with
   three primary buttons on it and sixty touch targets under 36 dp; it renders
   six more screens every time the tour is opened; and on paper the deck ends up
   photographing a screenshot of a screenshot. A picture is a picture.

   The drift is handled by making the pictures a BUILD STEP rather than an asset
   somebody remembers to update: `npm run tourshots` regenerates all six from
   the running app, and it is the first thing to run when one of those screens
   changes. The files are checked in, because the app has no build step and
   index.html has to work from a file:// URL.

   CROPPED FROM THE TOP, at the phone's own width. A tour panel shows two of
   these side by side in about a third of the screen's height, and a whole 852 px
   phone squeezed into that is a picture of nothing. The crop keeps the app bar
   and the first two or three cards — enough to recognise the screen — which is
   what a cropped screenshot in an app store listing shows too.

   Run:  npm run tourshots
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'app', 'imgs', 'tour');

/* The screens, and the routes that open them in the state worth photographing.
   They are the ones named in the reviewer's copy for panels 3, 4 and 5 — the
   advice inbox and the notification settings, the two kinds of advice, and the
   crop cycle screens. */
const SHOTS = [
  { id: 'D1', route: 'D1' },
  { id: 'F9', route: 'F9' },
  { id: 'D2', route: 'D2:adv-01' },
  { id: 'D3', route: 'D3:adv-05' },
  { id: 'B5', route: 'B5:plot-23' },
  { id: 'B6', route: 'B6:plot-23' },
];

/* How much of the phone each picture keeps. Two-thirds is the app bar and the
   first cards under it, which is where every one of these screens says what it
   is; below that they are all list. */
const KEEP = 0.62;

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

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// Twice the phone's pixels, so the picture still holds up where the deck prints
// it at 300 dpi. The tour shows it at about 130 CSS px wide.
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));

await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);

/* The phone sits on the reviewer harness, which is dark green, and the device
   has a rounded bezel — so the corners of any rectangular clip photograph the
   page behind it. The screen alone is what is wanted here: no bezel, no shadow,
   no chrome. Same trap, same fix, as screendeck.mjs. */
await page.addStyleTag({ content: `
  html, body, .stage { background: #ffffff !important; background-image: none !important; }
  .device__bezel { box-shadow: none !important; border-radius: 0 !important; }
  .device__screen { border-radius: 0 !important; }
  .device__buttons { display: none !important; }
` });

// English, and no side effects: photographing the advice inbox must not mark
// every advice in it as read.
await page.evaluate(() => { wafra.setLanguage('en'); wafra.state.ui.preview = true; });

for (const shot of SHOTS) {
  await page.evaluate((route) => { wafra.resetLocal('signup'); wafra.jump(route); }, shot.route);
  await page.waitForTimeout(180);
  const clip = await page.evaluate((keep) => {
    const r = document.querySelector('#device .device__screen').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: Math.round(r.height * keep) };
  }, KEEP);
  const file = join(OUT, `${shot.id}.png`);
  await page.screenshot({ path: file, clip });
  console.log(`  ${shot.id.padEnd(3)} ${Math.round(clip.width)}×${Math.round(clip.height)} css  ->  app/imgs/tour/${shot.id}.png`);
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`\n${problems.length} page errors while photographing:`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`\n${SHOTS.length} tour pictures written to app/imgs/tour/`);
