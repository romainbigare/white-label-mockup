#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   build-appicon.mjs — the home-screen icon, cut from the brand artwork.

   Installing the mockup as an app (manifest.webmanifest) needs square PNGs.
   They are not drawn: they are the MARK — the left `markWidth` pixels of
   app/imgs/logo.avif, the same crop the app bars use (brand.js) — centred on
   white. Re-labelling stays a file swap: replace the artwork, then run this.

   One set of files serves both purposes the manifest lists. Android cuts a
   "maskable" icon to a circle, a squircle or a rounded square and keeps only
   the middle 80% for sure; the mark fills the middle 64%, so no shape clips
   it, and the same square on white also reads as an ordinary icon.

   Run:  npm run appicon        # after replacing app/imgs/logo.avif
   --------------------------------------------------------------------------- */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { BRAND } from '../app/ui/brand.js';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'app/imgs');
const MARK = 0.64;          // the mark's share of the icon's width
const BACKGROUND = '#ffffff';

/* 192 and 512 are what Android asks for; 180 is the iPad's
   "Add to Home Screen" (apple-touch-icon in index.html). */
const SIZES = [180, 192, 512];

const logo = `data:image/avif;base64,${(await readFile(resolve(ROOT, 'app/imgs/logo.avif'))).toString('base64')}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();

for (const size of SIZES) {
  const png = await page.evaluate(async ({ logo, art, size, MARK, BACKGROUND }) => {
    const img = new Image();
    img.src = logo;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, size, size);
    // The artwork may be supplied at any resolution; brand.js gives its
    // proportions, so scale the crop to the file's real width.
    const k = img.naturalWidth / art.width;
    const w = size * MARK;
    const h = w * art.height / art.markWidth;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, art.markWidth * k, art.height * k, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { logo, art: BRAND.art, size, MARK, BACKGROUND });
  await writeFile(resolve(OUT, `appicon-${size}.png`), Buffer.from(png, 'base64'));
  console.log(`wrote app/imgs/appicon-${size}.png`);
}

await browser.close();
