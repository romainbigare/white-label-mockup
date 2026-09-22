#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   build-geo.mjs — pick the real farms, and photograph them.

   Review 22/09 committed three GeoJSON extracts to app/data/geo/: 500 ADAFSA
   farm boundaries, 2,425 crop parcels and 5,320 land-use polygons across Abu
   Dhabi emirate, in Web Mercator (EPSG:3857). Together they are 4.4 MB of
   JavaScript, which is more than this whole mockup weighs, and the app needs
   six farms out of them.

   So they are treated the way lucide-static is treated by build-icons.mjs: the
   big files stay in the repo as the source of truth, a tool reads them, and
   what ships is a small generated module. Nothing in app/ imports the 4.4 MB.

   This tool writes two things:

     app/data/geo/selected.data.js    the six farms' boundaries and parcels,
                                      still in Mercator metres — the projection
                                      into farm space belongs to the app (see
                                      app/core/geo.js), so the padding and the
                                      span can change without re-running this.

     app/data/geo/imagery/<id>.jpg    one satellite photograph per farm, of
                                      exactly the ground its 0–1000 box covers.

   THE IMAGERY IS VENDORED, for the reason icons.js already gives about icons:
   this app is opened from file:// by reviewers and photographed by two headless
   browsers, and a network round trip is a way for any of those to come back
   with a page of empty boxes. A deck build alone would otherwise pull several
   hundred tiles.

   Source: Esri World Imagery, which is free to use with attribution and needs
   no key. The attribution is drawn on the map by app/ui/map.js — it is not
   optional and it is not a comment.

   Run:  npm run geo
   --------------------------------------------------------------------------- */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { bboxOf, bboxOfAll, ringsOfGeometry, ringArea, farmSpace, toLonLat } from '../app/core/geo.js';

const ROOT = resolve(import.meta.dirname, '..');
const GEO = join(ROOT, 'app', 'data', 'geo');

/* -- WHICH REAL FARM EACH MOCKUP FARM IS DRAWN ON --------------------------

   The names, crops, health, prices, weather and advice all stay ours — "reuse
   our mockup names, reuse all our placeholder data" — and what comes from the
   real data is the SHAPE and the GROUND under it.

   The owner names are the dataset's own anonymised labels. Each was chosen
   against what the mockup farm actually needs, because a shape has to be able
   to hold the plots we already wrote:

     farm-1  Al Kharj North      3 date-palm parcels wanted; 447 has five, in a
                                 block of palm farms south of Al Ain.
     farm-2  Wadi Rum Alfalfa    six field-crop parcels wanted; 19 is 4.4 ha of
                                 alfalfa and sorghum in twenty-five of them,
                                 with a seventeen-corner boundary.
     farm-3  Al Kharj South      eleven parcels across ten plots, four of them
                                 trees; 418 is the most genuinely mixed holding
                                 in the set — lettuce, tomato, fig, banana.
     farm-4  Sohar Date Gardens  two date-palm parcels wanted; 214 has three and
                                 nothing else, so both land on real palms.
     farm-5  Buraydah Home Farm  no plots in the mockup, so only the outline is
     farm-6  Tabuk River Estate  used: 486 and 139 have the two most
                                 characterful boundaries in the dataset, at
                                 twenty and twenty-eight corners.

   WHY THE CROP UNDER A TREE PLOT MATTERS NOW. Under a generated basemap a
   polygon could sit anywhere. Under real imagery you can see the palm rows, so
   a plot called "Date palms" drawn over a bare alfalfa field is a mistake
   anybody can see. dealParcels() below prefers tree parcels for tree plots. */
const PICKS = {
  'farm-1': 'Farm Owner 447',
  'farm-2': 'Farm Owner 19',
  'farm-3': 'Farm Owner 418',
  'farm-4': 'Farm Owner 214',
  'farm-5': 'Farm Owner 486',
  'farm-6': 'Farm Owner 139',
};

/* The dataset's own top-level classes. Two of the five are trees. */
const TREE_CLASSES = new Set(['Date Palm', 'Fruit Trees']);

const plots = (await import(`file://${join(GEO, 'plots.js')}`)).default;
const crops = (await import(`file://${join(GEO, 'crops.js')}`)).default;

/* -- selection ------------------------------------------------------------- */

const selected = {};
for (const [farmId, owner] of Object.entries(PICKS)) {
  const outlines = plots.features.filter((f) => f.properties.name === owner);
  if (!outlines.length) throw new Error(`${farmId}: no boundary for ${owner}`);

  // Every outer ring of the holding. Most are one; the dataset carries a few
  // farms split across two titles.
  const boundary = outlines.flatMap((f) => ringsOfGeometry(f.geometry));

  const parcels = crops.features
    .filter((f) => f.properties.owner_name === owner)
    .flatMap((f) => ringsOfGeometry(f.geometry).map((ring) => ({
      ring,
      ha: ringArea(ring) / 10000,
      crop: f.properties.level_3,
      tree: TREE_CLASSES.has(f.properties.level_1),
    })))
    // Biggest first: fixtures deals them to our plots in the order our plots
    // are written, so the plot listed first gets the field you can see.
    .sort((a, b) => b.ha - a.ha);

  const bbox = bboxOfAll(outlines.map((f) => f.geometry));
  const [lon, lat] = toLonLat([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]);

  selected[farmId] = {
    owner,
    bbox,
    lon: +lon.toFixed(5),
    lat: +lat.toFixed(5),
    boundary,
    parcels,
  };
  const size = `${Math.round(bbox[2] - bbox[0])}×${Math.round(bbox[3] - bbox[1])} m`;
  console.log(`${farmId}  ${owner.padEnd(16)} ${size.padEnd(13)} ${boundary.length} ring(s), ${parcels.length} parcels, ${parcels.filter((p) => p.tree).length} of them trees`);
}

/* Coordinates are rounded to 0.1 m before they are written. The source carries
   four decimals of a metre, which is a tenth of a millimetre of Abu Dhabi and
   three quarters of the file size. */
const round = (ring) => ring.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]);
const out = Object.fromEntries(Object.entries(selected).map(([id, f]) => [id, {
  owner: f.owner,
  bbox: f.bbox.map((v) => +v.toFixed(1)),
  lon: f.lon,
  lat: f.lat,
  boundary: f.boundary.map(round),
  parcels: f.parcels.map((p) => ({ ring: round(p.ring), ha: +p.ha.toFixed(3), crop: p.crop, tree: p.tree })),
}]));


/* -- imagery --------------------------------------------------------------- */

/* Esri's World Imagery tile scheme is the usual Web Mercator one: z/y/x, 256px
   tiles, the world 256·2^z pixels across at zoom z. */
const TILE = 256;
const WORLD = 20037508.342789244;
const tileXY = (x, y, z) => {
  const n = 2 ** z;
  return [((x + WORLD) / (2 * WORLD)) * n, ((WORLD - y) / (2 * WORLD)) * n];
};

/* ZOOM IS CAPPED AT 18, which is a decision about the pictures and not about
   the arithmetic.

   Esri serves z19 over almost none of this ground: five of the six farms return
   the "Map data not yet available" placeholder there — a 2,521-byte grey tile,
   byte-identical everywhere, which composites into a perfectly clean mosaic of
   nothing. The first run of this tool produced exactly that for farm-1 and
   nobody would have noticed from the file size alone.

   The sixth farm does have z19, and it showed the other reason: two capture
   dates met across the middle of the frame, one bleached and one green, with a
   hard horizontal seam between them. Esri's pyramid is stitched from many
   surveys and the newest, highest level is where they disagree most.

   At z18 a pixel is 0.45 m and a 500-metre holding is eleven hundred pixels
   across, which is more than a phone screenshot can use. There is nothing to
   buy at z19 and two ways to lose. */
const MAX_ZOOM = 18;

/** Esri's "Map data not yet available" tile — the same bytes at every z/x/y. */
const PLACEHOLDER_BYTES = 2521;

/** The shallowest zoom that gives AT LEAST `want` pixels across the box.

    Rounding up and then downscaling, rather than rounding down. A cap that
    rounds down hands every farm a different resolution — the picture is drawn
    at the same size on screen whatever the holding measures, so the big farms
    came out softest, which is backwards. Every farm gets the same pixel count
    now; the ones whose ground is large simply start from a deeper zoom. */
function zoomFor(spanMetres, want = 1280) {
  for (let z = 10; z <= MAX_ZOOM; z += 1) {
    const mpp = (2 * WORLD) / (TILE * 2 ** z);
    if (spanMetres / mpp >= want) return z;
  }
  return MAX_ZOOM;
}

async function getTile(z, x, y) {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* retried below */ }
    await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  }
  throw new Error(`tile ${z}/${x}/${y} would not come`);
}

const isPlaceholder = (buf) => buf.length === PLACEHOLDER_BYTES;

/** The deepest zoom at or below `from` that actually has imagery here. */
async function deepestReal(mercX, mercY, from) {
  for (let z = from; z >= 12; z -= 1) {
    const [tx, ty] = tileXY(mercX, mercY, z);
    if (!isPlaceholder(await getTile(z, Math.floor(tx), Math.floor(ty)))) return z;
  }
  return 12;
}

await mkdir(join(GEO, 'imagery'), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.WAFRA_DECK_CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();

for (const [farmId, farm] of Object.entries(selected)) {
  /* THE PHOTOGRAPH COVERS MORE THAN THE FARM BOX, and the multiplier is not a
     margin of taste.

     The app draws one image per farm filling that farm's 0–1000 square. An SVG
     with preserveAspectRatio="meet" letterboxes its viewBox inside whatever
     shape the container is, and content beyond the viewBox keeps drawing into
     the letterbox — so on a TALL map the frame reaches about 1.9 times the
     viewBox vertically. C3 is exactly that: a full-height map with a sheet over
     the bottom of it. Photographed to the farm box alone, its picture stopped
     short of the top of the screen and left a dark band.

     BLEED is how much ground either side of the square gets photographed, so
     the picture runs off every edge of every frame the app can make of it. 2.2
     covers the tallest case with room over.

     WANT_PX is how many pixels the whole bleed box gets. It was 1,150, on the
     arithmetic that a 390 dp phone cannot show more of a FARM than that — and
     that arithmetic was about the wrong picture. B2 crops to a single plot, a
     quarter of the farm or less, and a quarter of 1,150 pixels stretched across
     a 780-device-pixel hero is a blur. So the target is what a full-screen map
     of the farm actually consumes at 2×: the farm square is 1000 of the 2,200
     bleed units and fills 780 device pixels, which wants about 1,700 across the
     box. z18 over this ground is 0.45 m/px and lands there on its own, so in
     practice this asks for the tiles at native resolution and stops. */
  const BLEED = 2.2;
  const WANT_PX = 1800;

  const space = farmSpace(farm.bbox);
  const [cMinX, cMinY, cMaxX, cMaxY] = space.coverBbox;
  const growX = ((cMaxX - cMinX) * (BLEED - 1)) / 2;
  const growY = ((cMaxY - cMinY) * (BLEED - 1)) / 2;
  const [minX, minY, maxX, maxY] = [cMinX - growX, cMinY - growY, cMaxX + growX, cMaxY + growY];
  const z = await deepestReal(
    (minX + maxX) / 2, (minY + maxY) / 2,
    zoomFor(Math.max(maxX - minX, maxY - minY), WANT_PX),
  );

  const [tx0, ty0] = tileXY(minX, maxY, z);
  const [tx1, ty1] = tileXY(maxX, minY, z);
  const x0 = Math.floor(tx0); const y0 = Math.floor(ty0);
  const x1 = Math.ceil(tx1); const y1 = Math.ceil(ty1);

  const tiles = [];
  let blank = 0;
  for (let x = x0; x < x1; x += 1) {
    for (let y = y0; y < y1; y += 1) {
      const buf = await getTile(z, x, y);
      if (isPlaceholder(buf)) blank += 1;
      tiles.push({ x, y, b64: buf.toString('base64') });
    }
  }

  // Crop, in pixels of the mosaic, from its top-left tile corner.
  const crop = {
    x: (tx0 - x0) * TILE, y: (ty0 - y0) * TILE,
    w: (tx1 - tx0) * TILE, h: (ty1 - ty0) * TILE,
  };

  const jpeg = await page.evaluate(async ({ tiles: ts, x0: ox, y0: oy, crop: c, TILE: T, want }) => {
    const full = document.createElement('canvas');
    full.width = Math.round(c.w);
    full.height = Math.round(c.h);
    const ctx = full.getContext('2d');
    for (const t of ts) {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${t.b64}`;
      await img.decode();
      ctx.drawImage(img, (t.x - ox) * T - c.x, (t.y - oy) * T - c.y);
    }
    // Down to the target, in one high-quality step. The mosaic is assembled at
    // whatever the tiles are so no tile seam is resampled twice.
    if (full.width <= want) return full.toDataURL('image/jpeg', 0.78).split(',')[1];
    const small = document.createElement('canvas');
    small.width = want;
    small.height = Math.round((full.height / full.width) * want);
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(full, 0, 0, small.width, small.height);
    return small.toDataURL('image/jpeg', 0.78).split(',')[1];
  }, { tiles, x0, y0, crop, TILE, want: WANT_PX });

  // Where this picture sits in the farm's own 0–1000 coordinates, so fixtures
  // can place it without re-deriving BLEED.
  selected[farmId].imageBox = [
    +(-(BLEED - 1) / 2 * 1000).toFixed(1),
    +(-(BLEED - 1) / 2 * 1000).toFixed(1),
    +(BLEED * 1000).toFixed(1),
    +(BLEED * 1000).toFixed(1),
  ];
  out[farmId].imageBox = selected[farmId].imageBox;

  const file = join(GEO, 'imagery', `${farmId}.jpg`);
  await writeFile(file, Buffer.from(jpeg, 'base64'));
  console.log(`${farmId}.jpg  z${z}  ${tiles.length} tiles  ${Math.min(Math.round(crop.w), WANT_PX)}×${Math.min(Math.round(crop.h), WANT_PX)}px  ${(Buffer.from(jpeg, 'base64').length / 1024).toFixed(0)} KB${blank ? `  ⚠ ${blank} blank` : ''}`);
  // A frame that is mostly nothing is a broken picture, not a quiet farm. The
  // centre probe cannot see a corner that falls off the edge of the survey.
  if (blank > tiles.length / 4) throw new Error(`${farmId}: ${blank}/${tiles.length} tiles have no imagery at z${z}`);
}

await writeFile(join(GEO, 'selected.data.js'), `/* GENERATED by tools/build-geo.mjs — do not edit.
   Six real ADAFSA holdings, picked out of app/data/geo/plots.js and
   crops.js. Coordinates are Web Mercator (EPSG:3857) metres; the projection
   into the app's 0–1000 farm space lives in app/core/geo.js. */
export default ${JSON.stringify(out)};
`);
console.log(`\nselected.data.js  ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);

await browser.close();

/* The licence travels with the pictures, the way build-icons.mjs sends Lucide's
   with the glyphs. */
await writeFile(join(GEO, 'imagery', 'SOURCE.md'), `# Satellite imagery

Generated by \`tools/build-geo.mjs\` (\`npm run geo\`). One JPEG per farm,
covering exactly the ground that farm's 0–1000 box covers.

Source: **Esri World Imagery**
\`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer\`

Esri World Imagery is free to use with attribution. The app draws the credit on
every satellite map — see \`mapSvg()\` in \`app/ui/map.js\`. Do not remove it.

Farms, and the ADAFSA holdings they are drawn on:

${Object.entries(selected).map(([id, f]) => `- \`${id}\` — ${f.owner}, ${f.lat}, ${f.lon}`).join('\n')}
`);
console.log('\nimagery/SOURCE.md written');
