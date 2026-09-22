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

   ALL SIX ARE NEIGHBOURS NOW, and that is the point of this list rather than a
   coincidence of it. Review 22/09, third pass: "on C1 and C4 we have 'all
   farms' as an option, which means the mockup needs some sort of weird collage
   to show all farms together. I wonder if for this screen specifically we can
   use farms that are located next to one another so that we don't have to do
   any collage?"

   The first set were scattered across the emirate — one south of Al Ain, one
   near Liwa, one 300 km west — so "all farms" could only ever be six pictures
   of six places laid side by side with gutters between them, and the gutters
   were the app admitting it. This set is one block of holdings at 54.82 E,
   24.62 N: an Al Ain irrigation scheme of roughly 28-dunum plots on a grid,
   six of them inside 650 × 590 m. They share one photograph and one coordinate
   space, so C1 is a map rather than a collage — and every other screen is
   unchanged, because a farm still fills its own frame when it is alone in one.

   Chosen against what each mockup farm needs, because a shape has to hold the
   plots we already wrote, and — for the two that are mostly picture — against
   what they look like from the air:

     farm-1  Al Kharj North      "choose another base farm, it's not a very nice
                                 farm". 269 is: dense orchard rows across the
                                 top, green fields below, a villa and
                                 glasshouses on the lane. Three tree parcels,
                                 which is what our one Date palms plot wants.
     farm-2  Wadi Rum Alfalfa    six field-crop parcels wanted; 206 has nine, a
                                 patchwork of alfalfa, rhodes grass and tomato.
     farm-3  Al Kharj South      eleven parcels across ten plots; 188 has
                                 thirteen, which is the most in the block.
     farm-4  Sohar Date Gardens  two date-palm parcels wanted; 407 has exactly
                                 two, both large, and reads as a date garden
                                 from the air — regular rows, corner to corner.
     farm-5  Buraydah Home Farm  no plots in the mockup, so these are outline
     farm-6  Tabuk River Estate  and ground only: 223's green strips and 247's
                                 close-planted trees.

   ONE COMPROMISE, AND IT IS FARM-3'S. Its ten plots include five of trees, and
   no holding in this block carries eleven parcels AND five tree ones — the big
   parcel counts here are vegetable farms. So farm-3's olives, oranges, lemons,
   limes and mangoes are drawn on crop ground. At 0.45 m a pixel an olive row
   and a rhodes-grass field are not told apart, which is why this is the corner
   worth cutting rather than farm-1's: a plot called "Date palms" over bare sand
   is a mistake anybody can see, and dealParcels() still spends the real tree
   parcels on tree plots first.

   WHY THE CROP UNDER A TREE PLOT MATTERS AT ALL. Under a generated basemap a
   polygon could sit anywhere. Under a photograph you can count the rows. */
const PICKS = {
  'farm-1': 'Farm Owner 269',
  'farm-2': 'Farm Owner 206',
  'farm-3': 'Farm Owner 188',
  'farm-4': 'Farm Owner 407',
  'farm-5': 'Farm Owner 223',
  'farm-6': 'Farm Owner 247',
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

/* -- WHAT GETS PHOTOGRAPHED, AND AT WHAT SIZE -----------------------------

   BLEED is how much ground either side of a box gets photographed. An SVG with
   preserveAspectRatio="meet" letterboxes its viewBox inside whatever shape the
   container is, and content beyond the viewBox keeps drawing into the
   letterbox — so on a TALL map the frame reaches about 1.9 times the viewBox
   vertically. C3 is exactly that: a full-height map with a sheet over the
   bottom of it, and photographed to its box alone it left a dark band.

   WANT_PX is how many pixels the whole bled box gets. For a farm the target is
   what a full-screen map of it consumes at 2×: the farm fills about 780 device
   pixels and is 1/BLEED of the picture, so ~1,700 across. z18 over this ground
   is 0.45 m/px and lands near there on its own.

   TWO PICTURES PER JOB, since the farms became neighbours. The cluster photo is
   the whole block and is what a map of more than one farm lays down — seamless,
   because it IS one photograph. A farm's own photo is the same ground at three
   times the detail, for the screens that show one farm and fill the phone with
   it. Drawing six farm photos on C1 instead would work, and would decode six
   large JPEGs to show what one covers. */
const BLEED = 2.3;

/** Grow a Mercator bbox outwards by `factor`, about its own centre. */
function bleed([minX, minY, maxX, maxY], factor) {
  const gx = ((maxX - minX) * (factor - 1)) / 2;
  const gy = ((maxY - minY) * (factor - 1)) / 2;
  return [minX - gx, minY - gy, maxX + gx, maxY + gy];
}

/** Fetch, composite, downscale and write one photograph of a Mercator bbox. */
async function shoot(name, box, wantPx) {
  const [minX, minY, maxX, maxY] = box;
  const z = await deepestReal(
    (minX + maxX) / 2, (minY + maxY) / 2,
    zoomFor(Math.max(maxX - minX, maxY - minY), wantPx),
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
  }, { tiles, x0, y0, crop, TILE, want: wantPx });

  const bytes = Buffer.from(jpeg, 'base64');
  await writeFile(join(GEO, 'imagery', `${name}.jpg`), bytes);
  const px = Math.min(Math.round(crop.w), wantPx);
  console.log(`${`${name}.jpg`.padEnd(14)} z${z}  ${String(tiles.length).padStart(3)} tiles  ${px}×${px}px  ${String(Math.round(bytes.length / 1024)).padStart(4)} KB${blank ? `  ⚠ ${blank} blank` : ''}`);
  // A frame that is mostly nothing is a broken picture, not a quiet farm. The
  // centre probe cannot see a corner that falls off the edge of the survey.
  if (blank > tiles.length / 4) throw new Error(`${name}: ${blank}/${tiles.length} tiles have no imagery at z${z}`);
}

/* -- the shared space -----------------------------------------------------

   ONE PROJECTION FOR ALL SIX, which is what makes C1 a map. Every farm's rings
   go through farmSpace(CLUSTER) rather than a box of its own, so each lands at
   its true position relative to the others and `farm.origin` — the tidy 2×N
   grid the app used to lay farms out on — is [0, 0] for all of them.

   The app re-derives this projection from `cluster.bbox`; only Mercator travels
   in the data file, so the padding and the span can change without re-running
   this tool. The boxes below are the exception: they say where a PHOTOGRAPH
   sits, and a photograph has already been taken. */
const CLUSTER = bboxOfAll(Object.values(selected).map(
  (f) => ({ type: 'MultiPolygon', coordinates: f.boundary.map((r) => [r]) }),
));
const space = farmSpace(CLUSTER);
const boxOf = (b) => {
  const [x0, y1] = space.project([b[0], b[3]]);   // north-west
  const [x1, y0] = space.project([b[2], b[1]]);   // south-east
  return [+x0.toFixed(1), +y1.toFixed(1), +(x1 - x0).toFixed(1), +(y0 - y1).toFixed(1)];
};

out.cluster = {
  bbox: CLUSTER.map((v) => +v.toFixed(1)),
  span: [
    Math.round(CLUSTER[2] - CLUSTER[0]),
    Math.round(CLUSTER[3] - CLUSTER[1]),
  ],
  imageBox: boxOf(bleed(space.coverBbox, BLEED)),
};
console.log(`\ncluster  ${out.cluster.span.join('×')} m across ${Object.keys(selected).length} holdings`);

await shoot('cluster', bleed(space.coverBbox, BLEED), 2400);

for (const [farmId, farm] of Object.entries(selected)) {
  // The farm's own square inside the shared space — what `cover` frames on the
  // screens that draw over one farm, and what the farm's photo is centred on.
  const own = bleed(farm.bbox, 1.14);
  out[farmId].fit = boxOf(own);
  out[farmId].imageBox = boxOf(bleed(own, BLEED));
  await shoot(farmId, bleed(own, BLEED), 1800);
}

await browser.close();

await writeFile(join(GEO, 'selected.data.js'), `/* GENERATED by tools/build-geo.mjs — do not edit.

   Six real ADAFSA holdings, picked out of app/data/geo/plots.js and crops.js.
   They are NEIGHBOURS — one block of an Al Ain irrigation scheme — so the app
   projects all of them through one space derived from \`cluster.bbox\` and
   "all farms" is a map rather than a collage.

   Coordinates are Web Mercator (EPSG:3857) metres; the projection into the
   app's 0–1000 space lives in app/core/geo.js. \`fit\` and \`imageBox\` are the
   exception and are already in that space, because they say where a photograph
   sits and the photograph has been taken. */
export default ${JSON.stringify(out)};
`);
console.log(`\nselected.data.js  ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);

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
