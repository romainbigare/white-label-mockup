/* ---------------------------------------------------------------------------
   map.js — the fake satellite map.

   There is no tile server here, so imagery is synthesised: a turbulence-based
   basemap for the ground, and per-plot measure rasters built from the plot's
   own seed so the same plot draws the same mottling every time. That matters
   for a mockup — a map that reshuffles on every render reads as noise.

   Two spec behaviours are baked into the renderer rather than left to callers:
     * WF5.025 — the legend scale is FIXED per measure, never auto-scaled to the
       current image, so week-to-week comparison stays valid.
     * plots carry their name and crop on a label, shown from about one
       farm's zoom inwards and never overlapping another (WF5.060).

   A PLOT IS A LIST OF RINGS, NOT A RING. A tree group is one record standing
   for trees in three separate corners of the farm, so everything that draws a
   plot draws `ringsOf(plot)` and everything that measures one measures all of
   them. `plot.geometry` is still the largest ring and is what a label, a hero
   image or a boundary editor anchors to — one shape can be pointed at, and a
   scattered group has to be pointed at somewhere.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state } from '../core/store.js';
import { rng, gridPoint, CLUSTER_IMAGERY } from '../data/fixtures.js';
import { t } from '../core/i18n.js';
import { MEASURE_SCALE, bandOf, scoreFromValue } from '../core/health.js';
import { FARM_UNIT_M } from '../core/geo.js';

/* WF5.025 — a fixed scale per measure, and since v1.7.2 one set of colours
   for all of them: red is bad, green is good, and blue is too much water on
   the two metrics where too much is possible. core/health.js owns the bands;
   a plot is painted in the colour of the band its reading falls in, which is
   the colour the legend under every map names. */
export function colourFor(measure, value) {
  return bandOf(measure, scoreFromValue(measure, value))?.colour ?? '#6b7a73';
}

let uid = 0;
const nextId = () => `m${(uid += 1)}`;

/* Math.min(...xs) blows the stack on a long list, and a tree group's parcels
   can carry a few hundred points between them. */
const minOf = (ns) => ns.reduce((a, b) => (b < a ? b : a), Infinity);
const maxOf = (ns) => ns.reduce((a, b) => (b > a ? b : a), -Infinity);

/** Every ring a plot occupies. One for an ordinary plot, several for a group. */
export function ringsOf(plot) {
  return plot.patches?.length ? plot.patches : [plot.geometry];
}

const pointsOf = (ring) => ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/* -- the farm's own outline ------------------------------------------------

   Review 01/09 — "on all the maps, let's show the farm boundary (if available)".
   Every map in the app draws plots; none of them drew the line round the
   outside, so a farmer looking at eight rectangles on a desert had no way to see
   where his holding stopped and the neighbour's began.

   It is answered in ONE place — inside mapSvg, from the plots it was given —
   rather than by seventeen callers each remembering to pass a boundary.

   SINCE OCT 2026 THERE IS ONE SOURCE: the outline saved on the farm. Nobody
   draws a farm boundary any more; the app works it out from the fields the
   farmer drew — round all of them, 20 m out — and saves it with them
   (data/boundary.js). So this reads `farm.boundary.points` and invents
   nothing: the line on the map is the line on the record.

   The line is DASHED AND BLUE, which is the same pair the boundary editor uses
   for a farm outline and never uses for a plot. Two solid white lines round the
   same field would read as two plots. */
export function farmBoundary(farmId) {
  const farm = (state.db?.farms ?? []).find((f) => f.id === farmId);
  return (farm?.boundary?.points?.length ?? 0) >= 3 ? farm.boundary.points : null;
}

/* -- basemap filters ------------------------------------------------------ */

function defs(id, basemap) {
  return h('defs',
    h('filter', { id: `${id}-ground`, x: '-10%', y: '-10%', width: '120%', height: '120%' },
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.014 0.019', numOctaves: 4, seed: 7, result: 'n' }),
      h('feColorMatrix', { in: 'n', type: 'saturate', values: '0.15' }),
      h('feComponentTransfer', {}, h('feFuncA', { type: 'linear', slope: '0.55' }))),
    h('filter', { id: `${id}-raster`, x: '-20%', y: '-20%', width: '140%', height: '140%' },
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05', numOctaves: 3, seed: 19, result: 'n' }),
      h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 16, xChannelSelector: 'R', yChannelSelector: 'G' }),
      h('feGaussianBlur', { stdDeviation: 3 })),
    h('filter', { id: `${id}-grain`, x: '0', y: '0', width: '100%', height: '100%' },
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: 2, seed: 3 }),
      h('feColorMatrix', { type: 'saturate', values: '0' })),
    h('linearGradient', { id: `${id}-sky`, x1: '0', y1: '0', x2: '1', y2: '1' },
      h('stop', { offset: '0', 'stop-color': basemap === 'street' ? '#e9e6df' : '#7a6a4e' }),
      h('stop', { offset: '1', 'stop-color': basemap === 'street' ? '#f4f2ec' : '#5d5039' })));
}

/* -- plot raster ---------------------------------------------------------- */

/* A TREE IS A DOT, PAINTED WITH THE METRIC, since v1.7.3. One dot per
   tree: never a filled area, never crown outlines (those are for Wafra's
   own checks, not the farmer's map). The October meeting gave each species a
   colour; the reviews after it took the species colours away and asked for
   the trees to be colour-coded by the metric picked, like the fields — so
   each dot takes the band of the group's reading, mottled a little tree by
   tree the way a field's raster is, and the legend under the map reads for
   both. With no metric chosen the dots are one quiet colour. */
const TREE_DOT = '#eef2ee';

/* The trees of one group, as dots in the colour of the metric. */
function treeDots(plot, measure, ls = 1) {
  const value = measure ? plot.measures?.[measure]?.value : null;
  const nodata = plot.status === 'nodata' || value == null;
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  const r = rng(`${plot.id}-${measure}-dots`);
  return (plot.treePoints ?? []).map(([x, y]) => {
    const v = nodata ? null
      : Math.max(scale.min, Math.min(scale.max, value + (r() - 0.5) * (scale.max - scale.min) * 0.12));
    return h('circle', {
      cx: x, cy: y, r: 3.4 * ls, fill: !measure ? TREE_DOT : nodata ? '#9aa69f' : colourFor(measure, v),
      stroke: 'rgba(0,0,0,.55)', 'stroke-width': .8 * ls,
    });
  });
}

/* A TREE GROUP'S OUTLINE, IN ITS METRIC'S COLOUR (v1.7.3, second review).
   The group is still never an area — no fill, so the dots and the ground
   show through — but the line round it is painted, like its dots, with the
   band its reading falls in, so a tree group reads on the map the way a field does. A dark
   casing under the colour keeps it visible over canopy and sand alike; a
   group in several places is dashed, as its parcels always were. */
function treeOutline(plot, measure, ls = 1, selected = false) {
  const rings = ringsOf(plot);
  const value = plot.measures?.[measure]?.value;
  const colour = !measure ? 'rgba(255,255,255,.8)'
    : plot.status === 'nodata' || value == null ? '#9aa69f' : colourFor(measure, value);
  const width = (selected ? 4.6 : 3.2) * ls;
  const dash = rings.length > 1 ? `${14 * ls} ${9 * ls}` : null;
  return rings.flatMap((ring) => [
    h('polygon', { points: pointsOf(ring), fill: 'none', stroke: 'rgba(8,14,11,.55)', 'stroke-width': width + 2.2 * ls, 'stroke-linejoin': 'round', 'stroke-dasharray': dash }),
    h('polygon', { points: pointsOf(ring), fill: 'none', stroke: colour, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-dasharray': dash }),
  ]);
}

/* A TREE FIELD STILL BEING COUNTED (v1.7.4): its shape, lit and pulsing like
   a loading skeleton — the field is drawn and paid for, and its trees are on
   their way. No dots and no metric colour until the count is in. */
function countingShape(plot, ls = 1, labelScale = 1, pill = true) {
  const [cx, cy] = plot.centroid ?? [0, 0];
  const words = t('count.label', 'Counting trees…');
  const w = (words.length * 7.2 + 18) * labelScale;
  return [
    ...ringsOf(plot).map((ring) => h('g', { class: 'counting' },
      h('polygon', {
        points: pointsOf(ring), fill: '#ffffff', 'fill-opacity': 0.4, stroke: 'none',
      }, h('animate', { attributeName: 'fill-opacity', values: '0.18;0.55;0.18', dur: '1.6s', repeatCount: 'indefinite' })),
      h('polygon', {
        points: pointsOf(ring), fill: 'none', stroke: '#ffffff', 'stroke-width': 3 * ls, 'stroke-linejoin': 'round',
      }))),
    // The words on the field itself when the map shows no labels (B1); where it
    // does, the field's own label already says it.
    pill && h('g', {},
      h('rect', { x: cx - w / 2, y: cy - 12 * labelScale, width: w, height: 24 * labelScale, rx: 12 * labelScale, fill: 'rgba(12,20,16,.7)' }),
      h('text', {
        x: cx, y: cy + 4.5 * labelScale, 'text-anchor': 'middle', fill: '#fff',
        'font-size': 12.5 * labelScale, 'font-weight': 700, 'font-family': 'var(--font)',
      }, words)),
  ];
}

/* A field with no metric painted on it: the outline's own pale fill, for a
   map that only says where the plots are. */
function plainField(plot) {
  return h('g', { class: 'plotg' },
    ringsOf(plot).map((ring) => h('polygon', { points: pointsOf(ring), fill: 'rgba(255,255,255,.22)' })));
}

function plotRaster(plot, measure, id, opts = {}) {
  // A tree group is its dots and its coloured outline, both drawn by the
  // caller — never a filled area. A map with no metric draws fields plain.
  if (plot.kind === 'trees') return null;
  if (!measure) return plainField(plot);
  const clipId = `${id}-clip-${plot.id}`;
  const rings = ringsOf(plot);
  const value = plot.measures[measure]?.value ?? 0;
  const nodata = plot.status === 'nodata';
  const r = rng(`${plot.id}-${measure}-${opts.dateKey ?? ''}`);
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;

  const blobs = [];
  if (!nodata) {
    for (const ring of rings) {
    const cx = ring.reduce((n, [x]) => n + x, 0) / ring.length;
    const cy = ring.reduce((n, [, y]) => n + y, 0) / ring.length;
    for (let i = 0; i < 14; i += 1) {
      // Mottle around the plot's own value; stressed plots get a clear
      // directional gradient so the "east side is drying" reading is visible.
      const bias = (r() - 0.42) * 0.28;
      // A third of the swing it used to have: the bands are wide now, and a
      // plot whose own reading is "good" should mottle within good and its
      // neighbours rather than across the whole legend.
      const v = Math.max(scale.min, Math.min(scale.max, value + bias * (scale.max - scale.min) * 0.5));
      blobs.push(h('ellipse', {
        cx: cx + (r() - 0.5) * 130, cy: cy + (r() - 0.5) * 130,
        rx: 20 + r() * 55, ry: 18 + r() * 48,
        fill: colourFor(measure, v), opacity: 0.75,
        transform: `rotate(${Math.round(r() * 180)} ${cx} ${cy})`,
      }));
    }
    }
  }

  return h('g', { class: 'plotg' },
    h('clipPath', { id: clipId }, rings.map((ring) => h('polygon', { points: pointsOf(ring) }))),
    rings.map((ring) => h('polygon', { points: pointsOf(ring), fill: nodata ? '#6b7a73' : colourFor(measure, value), opacity: nodata ? 0.5 : 0.95 })),
    !nodata && h('g', { 'clip-path': `url(#${clipId})`, filter: `url(#${id}-raster)` }, blobs),
    nodata && rings.map((ring) => {
      const ls = opts.lineScale ?? 1;
      return h('polygon', { points: pointsOf(ring), fill: 'none', stroke: '#ffffff', 'stroke-width': 2 * ls, 'stroke-dasharray': `${8 * ls} ${7 * ls}`, opacity: .8 });
    }));
}

/* Which photograph a map lays down.

   Normally the one belonging to the farm its plots are on; `imageryOf` is for a
   caller whose plots cannot say — A13, A14 and B9 are all drawing on ground the
   farmer has not finished describing yet.

   MORE THAN ONE FARM MEANS THE CLUSTER PICTURE, not one per farm. The six real
   holdings are neighbours in one block, projected through one space, so the
   ground between them is real ground and there is a single photograph of the
   lot. Laying down six overlapping farm pictures would show the same thing and
   decode six large JPEGs to do it.

   That replaces the clipping this used to need. While the farms were scattered,
   each picture had to be cut to its own square or the margins lay across the
   neighbours with a hard seam through both — and the gutter that left between
   them was the collage review 22/09 asked us to get rid of. */
export function photosFor(plots, imageryOf, basemap = 'satellite') {
  if (basemap === 'street') return [];
  const ids = imageryOf ? [imageryOf].flat() : [...new Set(plots.map((p) => p.farmId))];
  const own = ids
    .map((farmId) => (state.db?.farms ?? []).find((f) => f.id === farmId)?.imagery)
    .filter(Boolean);
  if (own.length > 1) return [CLUSTER_IMAGERY];
  return own;
}

/* The ground layer, in one place, for the three builders that draw one.

   mapSvg draws farms, plotRasterSvg draws one field and treeLocatorSvg draws
   forty metres around one tree — three different jobs over the same photograph,
   and before this they each carried their own copy of the generated fallback.

   `rect` is whatever the caller wants painted when there is no photograph: it
   must be big enough to cover the letterbox an SVG leaves around its viewBox,
   which is why every caller passes something larger than its own frame. */
function groundLayer(id, photos, rect, basemap = 'satellite') {
  if (!photos.length) {
    return h('g', {},
      h('rect', { ...rect, fill: `url(#${id}-sky)` }),
      h('rect', { ...rect, filter: `url(#${id}-ground)`, opacity: basemap === 'street' ? .18 : .6 }));
  }
  /* THE SURROUND, AND WHY IT IS NOT A BLACK BAND ANY MORE.

     Each photograph covers a fixed patch of ground — its farm's square plus a
     bleed — and the frame over it is not fixed: it follows the plots, the zoom
     and the shape of the phone. A 390 x 725 map is 1.86 times as tall as it is
     wide, and a farm's picture is only 2.3 times its own square, so the moment
     the frame is fitted to one farm the top and bottom of the screen run off
     the end of the ground. That was drawn as the flat dark under the picture —
     "what Google shows outside its own coverage" — and review 22/09 called it
     what it looked like: "screen C1 still shows black band at the top and
     bottom for missing part of the satellite images."

     Two hard bands across a satellite screen read as a broken image, not as the
     edge of a survey. So the same photograph is drawn TWICE: once enlarged to
     cover everything the frame can possibly show, blurred and dimmed, and once
     sharp and in its right place on top. The surround is out of focus, which is
     the language every map and every photo viewer uses for "this is backdrop,
     not content", and it carries the colour and the grain of the ground it
     surrounds rather than a colour we chose.

     `slice` on the backdrop and `none` on the sharp copy are both deliberate:
     the backdrop must cover the rect whatever its aspect, and the sharp one
     must land on the exact box it was photographed for, or every boundary in
     the app is a few metres off its own field.

     One filter per ground layer, keyed off the caller's id, because several
     maps can be on one screen (B1's farm map and C3's sheet) and a filter id
     is document-wide. */
  const blur = rect.width * 0.011;
  return h('g', {},
    h('filter', {
      id: `${id}-haze`, x: '-6%', y: '-6%', width: '112%', height: '112%',
      'color-interpolation-filters': 'sRGB',
    }, h('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blur })),
    h('rect', { ...rect, fill: '#20262a' }),
    ...photos.map((img) => h('image', {
      href: img.href, 'xlink:href': img.href,
      ...rect, preserveAspectRatio: 'xMidYMid slice',
      filter: `url(#${id}-haze)`, opacity: .55,
    })),
    ...photos.map((img) => h('image', {
      href: img.href, 'xlink:href': img.href,
      x: img.box[0], y: img.box[1], width: img.box[2], height: img.box[3],
      preserveAspectRatio: 'none',
    })));
}

/** The Esri credit. A licence condition, so it travels with the picture rather
    than with each of the callers that draws one.

    A WATERMARK, NOT A BAR: a full-width dark strip lands across the middle of a
    picture whose viewBox is letterboxed, and reads as a piece of the interface.
    Two copies of the text, a dark one drawn thick underneath and a white one on
    top, is how a caption survives an arbitrary photograph without putting a
    shape on it. */
function imageryCredit(photos, x, y, size) {
  if (!photos.length) return null;
  const at = { x, y, 'font-size': size, 'font-weight': 500 };
  const words = 'Imagery © Esri, Maxar, Earthstar Geographics';
  return h('g', { 'aria-hidden': 'true' },
    h('text', {
      ...at, fill: 'none', stroke: 'rgba(8,18,14,.75)',
      'stroke-width': size * 0.42, 'stroke-linejoin': 'round',
    }, words),
    h('text', { ...at, fill: '#ffffff', opacity: .95 }, words));
}

/* -- the map -------------------------------------------------------------- */

/**
 * @param {object} o
 * @param {Array}  o.plots        plots to draw
 * @param {string} o.measure      measure key driving the fill
 * @param {string} o.basemap      satellite | street (the two C2 offers)
 * @param {object} o.layers       { boundaries, labels, trees }
 * @param {string} o.selectedId   plot id to highlight
 * @param {number} o.zoom         1 = fit
 * @param {boolean} o.pin          drop a marker on the centre of the frame
 * @param {string|string[]} o.imageryOf  farm id(s) whose satellite photograph to
 *                                   lay down, when the plots cannot say
 * @param {object} o.live         set by app/ui/livemap.js only — see LIVE below
 */
export function mapSvg({
  plots, measure = 'ndvi', basemap = 'satellite', layers = {}, selectedId = null,
  onPlotTap = null, zoom = 1, showStatus = true, dateKey = '', gps = null,
  compareMeasure = null, comparePct = null, pin = false, imageryOf = null,
  cover = false, live = null,
}) {
  const id = nextId();

  /* LIVE: THIS DRAWING LAID OVER REAL TILES. C1, B1, B2 and B5 have Leaflet
     maps now (app/ui/livemap.js), and what they lay over the tiles is this
     function's own output, so a plot looks the same on a live map as on every
     picture of it. Leaflet decides the frame, so `live` brings everything the frame
     would otherwise decide:
       extent      [x, y, w, h] in farm space — exactly the ground the SVG is
                   stretched over, hence no letterboxing ("none" below);
       labelScale  in place of `box.size / 1000`, chosen so labels and the
                   blue dot are the same size on screen at every zoom;
       lineScale   the same for outlines, which are drawn in farm units and
                   would otherwise thicken as the map zooms in;
       gps         the blue dot, already in farm space.
     There is no photograph and no credit: the tiles are the ground, and
     Leaflet carries their attribution. */
  const photos = live ? [] : photosFor(plots, imageryOf, basemap);
  const ls = live?.lineScale ?? 1;

  /* WF5.059 — the map opens zoomed to fit the farms it is showing, and the
     PHOTOGRAPH IS NOT ONE OF THE THINGS IT IS SHOWING. It is background: it
     extends past the frame on purpose, the way a basemap does, so the map can
     be zoomed and panned without running out of ground.

     Letting it into the fit was tried and reverted inside one screenshot. A
     farm's plots never fill its holding, and the holding does not fill the
     padded box that was photographed — so fitting to the picture zoomed every
     map out by about a third, which C3 could least afford: its map is full
     height with a sheet over the bottom of it, and the farm ended up a sliver
     above the sheet.

     The exception is a map with NO plots at all, which is A13: nothing to fit
     to, and the picture is the entire content of the screen. */
  /* `cover` IS FOR THE SCREENS WITH A DRAWING CANVAS OVER THE MAP, and it
     exists because those two layers were in different coordinate systems.

     boundaryCanvas draws in the farm's own square with preserveAspectRatio
     "slice"; mapSvg fits a box of its own with "meet". So on A14 and B9 the
     traced outline and the photograph under it were scaled and offset
     differently — the shape was on the right FARM and not on the right FIELD,
     which is most of what review 22/09's "align the placeholder shape to the
     actual farm location and outline" was asking about.

     Given the frame, this map adopts it exactly — same viewBox, same fitting —
     so a point at (300, 290) is the same pixel in both layers.

     BOTH FIT WITH "MEET", which is also what makes the whole farm visible.
     "Slice" fills the frame by cropping, and on a phone that leaves only the
     middle 630 units of the square: a trace of the real boundary is nine
     hundred units wide, so five of its six corners were off the screen. Under
     "meet" the square fits and letterboxes — and the letterbox is not empty,
     because the photograph bleeds 2.2× past the farm square (see BLEED in
     tools/build-geo.mjs). The picture still runs to every edge of the frame,
     which is the other half of that review. */
  const box = live ? liveBox(live.extent) : cover
    ? coverBox(cover === true ? (photos[0]?.fit ?? [0, 0, 1000, 1000]) : cover)
    : keepOnGround(
      // `fit` is the farm's own square; `box` is the wider ground photographed
      // around it. A map with nothing to fit to fits the farm, not the bleed.
      fitBox(plots, zoom, plots.length ? [] : photos.map((img) => img.fit ?? img.box)),
      photos,
    );
  /* WHEN LABELS SHOW: ALWAYS, since v1.7.3. v1.7.2 put them on always, its
     last pass took that back — "labels are still too big and cover most
     plots" — and hid them below a zoom level and wherever two clashed. The
     review after the October meeting settled it the other way: every plot is
     labelled, at every zoom, and a label that would cover its plot is drawn
     smaller instead, down to unreadable if it must (placeLabels()).

     The maps in a page pass `labels: false`: B2 and B5 draw one plot they name
     in their title, and B1's card is a thumbnail of the farm whose plots are
     listed right under it. */
  const showLabels = layers.labels !== false;
  /* THE GROUND IS A PHOTOGRAPH NOW — review 22/09: "use a real map provider
     with satellite imagery for the base map."

     What was here was an feTurbulence fractal under a gradient, with a hand-
     drawn wadi and two tracks so it was not featureless. It was a good fake and
     it was a fake: every farm in the app stood on the same invented sand.

     Each farm carries one vendored JPEG of exactly the ground its 0–1000 box
     covers (tools/build-geo.mjs, Esri World Imagery), so the imagery layer is
     one <image> per farm on the map, placed at that farm's own box. A map
     showing two farms shows two photographs side by side — which is what the
     farm grid has always been: a contact sheet, at a scale the app has never
     claimed was geography.

     `imageryOf` lets a caller with no plots ask for a farm's picture anyway.
     A13 needs it: the farmer is looking for ground he has not drawn yet.

     THE GENERATED GROUND STAYS BEHIND THE PHOTOGRAPHS, not as decoration but
     as what shows where there is no photograph: a farm added inside the app,
     a boundary being traced on A14, the survey areas on A16. Those have no
     imagery and never will, and an empty white frame would read as broken. */
  /* The generated ground stays for a map with no photograph at all: a farm
     added inside the app, the boundary being traced on A14, the survey areas on
     A16. Those have no imagery and never will, and an empty frame reads as
     broken — so it keeps its wadi and its two tracks as well. */
  const bg = live ? null : photos.length
    ? groundLayer(id, photos, box.rect)
    : h('g', {},
      groundLayer(id, [], box.rect, basemap),
      basemap !== 'street' && h('path', {
        d: `M${box.rect.x} ${box.cy + box.size * 0.16} C ${box.cx - box.size * 0.3} ${box.cy + box.size * 0.1}, ${box.cx} ${box.cy + box.size * 0.24}, ${box.cx + box.size * 0.6} ${box.cy + box.size * 0.12}`,
        stroke: '#6b7d5c', 'stroke-width': box.size * 0.026, fill: 'none', opacity: .45,
      }),
      h('path', { d: `M${box.rect.x} ${box.cy - box.size * 0.28} L ${box.rect.x + box.rect.width} ${box.cy - box.size * 0.31}`, stroke: '#efe7d5', 'stroke-width': box.size * (basemap === 'street' ? .01 : .005), opacity: basemap === 'street' ? .95 : .5 }),
      h('path', { d: `M${box.cx - box.size * 0.18} ${box.rect.y} L ${box.cx - box.size * 0.14} ${box.rect.y + box.rect.height}`, stroke: '#efe7d5', 'stroke-width': box.size * (basemap === 'street' ? .01 : .005), opacity: basemap === 'street' ? .95 : .5 }));

  const rasters = plots.map((p) => plotRaster(p, measure, id, { dateKey, lineScale: ls }));

  /* WF5.067 — compare mode: a second raster clipped by a vertical divider.
     The rect starts at the left edge of the viewBox, so a percentage width
     resolves to exactly that share of the drawn extent — which lets the clip
     follow --split live while the divider is dragged, without re-rendering the
     map (see compareStage() in components.js). The computed attribute stays as
     the value it falls back to. */
  const compareLayer = compareMeasure && comparePct != null
    ? h('g', { 'clip-path': `url(#${id}-cmp)` },
        h('clipPath', { id: `${id}-cmp` }, h('rect', {
          x: box.cx - box.size / 2, y: box.cy - box.size / 2,
          width: box.size * (comparePct / 100), height: box.size,
          style: { width: 'var(--split, 50%)' },
        })),
        plots.map((p) => plotRaster(p, compareMeasure, id, { dateKey: 'cmp' })))
    : null;

  /* The farm outline, under the plots, once per farm on the map. It follows the
     same layer switch the plot boundaries do: a farmer who has turned outlines
     off wants the picture, and the farm's line is an outline too. */
  /* Review 06/09 — "add farm boundary(ies)?", written across the whole of C1's
     map. The honest answer was that the line was drawn and could not be seen:
     one pale blue dash, four units wide, over ground that runs from bright sand
     to dark green in the same frame. It is drawn twice now — a dark casing
     underneath and the pale dash on top of it — which is how a route line
     survives an arbitrary background on every map anyone has ever used.

     AND IT IS FAINT, since Oct 2026: Wafra asked for the outline "faintly,
     only if it helps". It is the app's working-out, not a line the farmer
     drew, and nothing is measured between it and the fields — so it is
     thinner and paler than any field's own line. */
  const farmLines = layers.boundaries === false ? null
    : [...new Set(plots.map((p) => p.farmId))].flatMap((farmId) => {
      const ring = farmBoundary(farmId);
      if (!ring) return [];
      const shape = (props) => h('polygon', {
        points: pointsOf(ring), fill: 'none', 'stroke-linejoin': 'round', ...props,
      });
      // No blue wash inside the line any more (v1.7.3): a tinted farm read as
      // a land-use area, and those belong to a planning map, not this one.
      return [
        shape({ stroke: 'rgba(6,38,66,.3)', 'stroke-width': 5 * ls }),
        shape({ stroke: 'rgba(191,230,255,.8)', 'stroke-width': 2.5 * ls, 'stroke-dasharray': `${14 * ls} ${10 * ls}` }),
      ];
    });

  // Fields get a white line round their painted area; a tree group, which is
  // never painted, gets its line in its metric's colour instead (treeOutline).
  const outlines = layers.boundaries === false ? null : plots.flatMap((p) => p.kind === 'trees'
    ? (p.counting ? countingShape(p, ls, live ? live.labelScale : box.size / 1000, !showLabels) : treeOutline(p, measure, ls, p.id === selectedId))
    : ringsOf(p).map((ring) => h('polygon', {
    points: pointsOf(ring),
    fill: 'none',
    stroke: p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,.72)',
    'stroke-width': (p.id === selectedId ? 5 : 2.2) * ls,
    // A group's parcels are drawn dashed between them so three outlines read as
    // one holding rather than as three plots nobody named.
    'stroke-dasharray': ringsOf(p).length > 1 ? `${14 * ls} ${9 * ls}` : null,
  })));

  const trees = layers.trees === false ? null
    : plots.filter((p) => p.kind === 'trees').flatMap((p) => treeDots(p, measure, ls));

  const labelScale = live ? live.labelScale : box.size / 1000;
  /* NAME OVER CROP, in a see-through pill on the plot. The short name — "Plot
     3" — because the farm is the outline round it. A field the satellite
     watched being cleared says so rather than naming the crop that came off.

     EVERY PLOT GETS ITS LABEL, AND NO LABEL COVERS ITS PLOT. Each is
     measured in the drawing's own units (labelScale turns its on-screen size
     into farm units) and, where that is wider or taller than the plot under
     it, drawn smaller until it fits — so zoomed out the labels shrink with the
     plots rather than burying them, and zoomed in they grow back to full
     size. Each sits inside its own plot, so two labels cannot overlap. */
  const labels = showLabels ? placeLabels(plots, labelScale).map(({ p, x, y, w, hgt, name, crop, k }) => {
    const ks = labelScale * k;
    const text = (ty, words, size, weight, fill) => h('text', {
      // Centred, so the text's own direction can stand: an Arabic name reads
      // right to left inside its pill without running out of it.
      x, y: ty, fill, 'text-anchor': 'middle',
      stroke: 'rgba(8,14,11,.45)', 'stroke-width': 2 * ks, 'paint-order': 'stroke',
      'font-size': size * ks, 'font-weight': weight, 'font-family': 'var(--font)',
    }, words);
    return h('g', { class: 'plotlabel', 'data-plot': p.id },
      // Half see-through, so the plot's colour shows through the pill; a thin
      // dark edge on the letters keeps them readable over a bright field.
      h('rect', { x: x - w / 2, y: y - hgt / 2, width: w, height: hgt, rx: 9 * ks, fill: 'rgba(12,20,16,.45)' }),
      crop
        ? [text(y - 2 * ks, name, LABEL.name, 700, '#fff'),
          text(y + 13 * ks, crop, LABEL.crop, 550, 'rgba(255,255,255,.88)')]
        : text(y + 5 * ks, name, LABEL.name, 700, '#fff'));
  }) : null;

  const hits = onPlotTap ? plots.flatMap((p) => ringsOf(p).map((ring) => h('polygon', {
    points: pointsOf(ring),
    // pointer-events by name: on the live map the SVG itself lets events
    // through to the map underneath, so a drag pans, and only plots take a tap.
    fill: 'transparent', style: { cursor: 'pointer', pointerEvents: 'auto' },
    onclick: () => onPlotTap(p),
  }))) : null;

  const gpsPos = live ? live.gps : gps ? [box.cx + (gps[0] - 500) * (box.size / 1000), box.cy + (gps[1] - 500) * (box.size / 1000)] : null;
  const me = gpsPos ? h('g', {},
    h('circle', { cx: gpsPos[0], cy: gpsPos[1], r: 38 * labelScale, fill: 'rgba(43,120,255,.20)' }),
    h('circle', { cx: gpsPos[0], cy: gpsPos[1], r: 11 * labelScale, fill: '#2b78ff', stroke: '#fff', 'stroke-width': 4 * labelScale })) : null;

  /* THE PIN, AND WHY IT IS NOT THE BLUE DOT ABOVE.

     The blue dot is the phone: where the person holding it is standing. The pin
     is a place the map has been moved to — a search result, or a position the
     farmer has accepted as his farm — and it is the answer A13 needs, since a
     farmer looking for his land on a satellite photograph is asking the app to
     say WHICH PATCH it thinks he means.

     Drawn at the centre of the frame because that is where a map puts the thing
     it is centred on, and sized as a FRACTION OF THE FRAME rather than off
     labelScale: the plot labels scale with the extent because they belong to
     plots that scale with it, and this belongs to the viewport. A13 draws it
     over an empty map, where the extent is the 1180-unit default and a
     label-scaled pin came out seven pixels tall. The stem ends exactly on the
     point: a marker whose tip is not on the thing it marks is a marker pointing
     somewhere else. */
  const marker = pin ? (() => {
    const u = box.size * 0.028;
    const tipY = box.cy + u * 0.4;
    const headY = tipY - u * 2.4;
    return h('g', {},
      // The shadow on the ground, so the pin reads as standing on the photo
      // rather than printed over it.
      h('ellipse', { cx: box.cx, cy: tipY, rx: u * 0.62, ry: u * 0.22, fill: 'rgba(0,0,0,.35)' }),
      h('path', {
        d: `M${box.cx} ${tipY} C ${box.cx - u * 1.15} ${headY + u * 0.9}, ${box.cx - u} ${headY - u * 0.55}, ${box.cx} ${headY - u * 0.55} C ${box.cx + u} ${headY - u * 0.55}, ${box.cx + u * 1.15} ${headY + u * 0.9}, ${box.cx} ${tipY} Z`,
        fill: '#e8453c', stroke: '#ffffff', 'stroke-width': u * 0.2, 'stroke-linejoin': 'round',
      }),
      h('circle', { cx: box.cx, cy: headY - u * 0.05, r: u * 0.36, fill: '#ffffff' }));
  })() : null;

  /* Bottom-left of the drawn extent, scaled off it so the credit is the same
     size on a plot and on a farm. Esri World Imagery is free and needs no key,
     on the condition that it is attributed where it is shown. */
  const creditSize = box.size * 0.022;
  const credit = imageryCredit(photos,
    box.cx - box.size / 2 + creditSize * 0.6,
    box.cy + box.size / 2 - creditSize * 0.6,
    creditSize);

  return h('svg', {
    // "meet" rather than "slice": WF5.059 opens the map zoomed to FIT the farms,
    // so nothing may be cropped out of the initial view. A live map's SVG is
    // stretched over exactly its extent, so there is nothing to fit.
    viewBox: box.viewBox, preserveAspectRatio: live ? 'none' : 'xMidYMid meet',
    role: 'img', 'aria-label': t('a11y.farmmap', 'Farm map'),
  }, defs(id, basemap), bg, rasters, compareLayer, farmLines, outlines, trees, hits, labels, me, marker, credit);
}

/* Label type sizes, in label units (× labelScale: on a live map one unit is
   0.75 px, so the name is 12 px and the crop 10). */
const LABEL = { name: 16, crop: 13 };

/** Every plot's label, at its centre, shrunk by `k` where it would not fit the plot. */
function placeLabels(plots, scale) {
  return plots.map((p) => {
    const [x, y] = p.centroid;
    const name = p.shortName ?? p.name;
    const crop = p.counting ? t('count.label', 'Counting trees…')
      : p.harvestDetectedOn ? t('b4.nocrop', 'No crop set') : (p.cropName ?? '');
    const fullW = (18 + Math.max(name.length * LABEL.name * 0.56, crop.length * LABEL.crop * 0.55)) * scale;
    const fullH = (crop ? 36 : 24) * scale;
    // The plot the label stands on: the patch it is centred in.
    const ring = p.geometry ?? ringsOf(p)[0];
    const plotW = maxOf(ring.map(([rx]) => rx)) - minOf(ring.map(([rx]) => rx));
    const plotH = maxOf(ring.map(([, ry]) => ry)) - minOf(ring.map(([, ry]) => ry));
    const k = Math.min(1, (plotW * 0.9) / fullW, (plotH * 0.9) / fullH);
    return { p, x, y, w: fullW * k, hgt: fullH * k, name, crop, k };
  });
}

/** The same shape again, for the extent a live map stretches its SVG over. */
function liveBox([x, y, w, h]) {
  return {
    cx: x + w / 2, cy: y + h / 2, size: Math.max(w, h),
    rect: { x, y, width: w, height: h },
    viewBox: `${x} ${y} ${w} ${h}`,
  };
}

/** The same shape fitBox hands back, for a frame somebody else decided. */
function coverBox([x, y, w, h]) {
  const size = Math.max(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    cx, cy, size,
    rect: { x: cx - size, y: cy - size, width: size * 2, height: size * 2 },
    viewBox: `${x} ${y} ${w} ${h}`,
  };
}

/* PAN THE FRAME BACK ONTO THE PHOTOGRAPH, when there is one photograph and it
   is big enough to hold the frame.

   Outside a farm's picture there is no ground, and the honest thing to draw
   there is the flat dark — which is what Google shows outside its own coverage.
   But a frame fitted to the PLOTS is centred on the plots, and a farm whose
   fields sit in one corner of the holding pushes the frame off the edge of its
   own photograph for no reason: the ground is there, a few metres sideways.

   So the frame is translated, per axis, by the least that puts it back inside
   the picture. Never scaled — the zoom is WF5.059's and not this function's —
   and never moved when the frame is larger than the picture, because then there
   is no position that helps and the dark band is the truth. */
function keepOnGround(box, photos) {
  if (photos.length !== 1) return box;
  const [bx, by, bw, bh] = photos[0].box;
  const half = box.size / 2;
  let { cx, cy } = box;
  if (box.size <= bw) cx = Math.min(Math.max(cx, bx + half), bx + bw - half);
  if (box.size <= bh) cy = Math.min(Math.max(cy, by + half), by + bh - half);
  if (cx === box.cx && cy === box.cy) return box;
  return {
    ...box, cx, cy,
    rect: { x: cx - box.size, y: cy - box.size, width: box.size * 2, height: box.size * 2 },
    viewBox: `${cx - half} ${cy - half} ${box.size} ${box.size}`,
  };
}

/** A square viewBox around the given plots and photographs, with room to breathe.

    `boxes` are [x, y, w, h] imagery rectangles. They count towards the fit
    because since review 22/09 a farm IS its photograph as much as its plots —
    see the note at the call site. */
function fitBox(plots, zoom = 1, boxes = []) {
  let minX = 0; let minY = 0; let maxX = 1000; let maxY = 1000;
  const xs = plots.flatMap((p) => ringsOf(p).flatMap((ring) => ring.map(([x]) => x)));
  const ys = plots.flatMap((p) => ringsOf(p).flatMap((ring) => ring.map(([, y]) => y)));
  for (const [bx, by, bw, bh] of boxes) { xs.push(bx, bx + bw); ys.push(by, by + bh); }
  if (xs.length) {
    minX = minOf(xs); maxX = maxOf(xs);
    minY = minOf(ys); maxY = maxOf(ys);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const size = Math.max(maxX - minX, maxY - minY, 120) * 1.18 / Math.max(0.4, zoom);
  const rect = { x: cx - size, y: cy - size, width: size * 2, height: size * 2 };
  return { cx, cy, size, rect, viewBox: `${cx - size / 2} ${cy - size / 2} ${size} ${size}` };
}

/** The blue dot in farm space. `gps` is a position in the frame (0–1000 each
    way) of the map fitted to these plots at zoom 1, which is where a static map
    draws it; C1's live map needs the same spot as a place on the ground. */
export function gpsPoint(plots, gps) {
  const box = fitBox(plots, 1);
  return [box.cx + (gps[0] - 500) * (box.size / 1000), box.cy + (gps[1] - 500) * (box.size / 1000)];
}

export function statusColour(key) {
  return ({
    good: 'var(--st-good)', monitor: 'var(--st-monitor)',
    urgent: 'var(--st-urgent)', nodata: 'var(--st-nodata)', missing: 'var(--st-nodata)',
  })[key] ?? 'var(--st-nodata)';
}

/**
 * A single plot filling the frame — the hero image of B2.
 */
export function plotRasterSvg(plot, measure, opts = {}) {
  const id = nextId();
  // Fit the frame to the plot's own extent rather than a fixed span, so a
  // narrow parcel is not shown as a sliver in the middle of empty desert.
  //
  // THE BOX IS THE PLOT, and nothing else. It used to be squared off to the
  // longer axis, which on a frame wider than it is tall left a band of empty
  // desert down each side of the field the farmer came to look at. With the box
  // set to the plot's own extent, "slice" scales to COVER the frame: the short
  // axis overflows and gets cropped, so what fills the picture is the field.
  const rings = ringsOf(plot);
  const xs = rings.flatMap((ring) => ring.map(([x]) => x));
  const ys = rings.flatMap((ring) => ring.map(([, y]) => y));
  // Enough ground round the plot to see where it sits. It was 10 units — 20 m —
  // which put the boundary hard against the frame and left the farmer looking
  // at a field with no edges; the review asked to pull back a little. The pad
  // scales with the plot so a 7 ha field and a 70 ha one both get a margin
  // rather than a fixed number of metres that means two different things.
  const spread = Math.max(maxOf(xs) - minOf(xs), maxOf(ys) - minOf(ys));
  const pad = Math.max(16, spread * (opts.zoomOut ? 0.42 : 0.14));
  const minX = minOf(xs) - pad; const maxX = maxOf(xs) + pad;
  const minY = minOf(ys) - pad; const maxY = maxOf(ys) + pad;
  const spanX = (maxX - minX) / 2;
  const spanY = (maxY - minY) / 2;
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  return h('svg', {
    viewBox: `${cx - spanX} ${cy - spanY} ${spanX * 2} ${spanY * 2}`,
    preserveAspectRatio: opts.zoomOut ? 'xMidYMid meet' : 'xMidYMid slice', role: 'img',
    'aria-label': t('a11y.plotmap', '{name} measure map', { name: plot.name }),
    onclick: opts.onclick,
    style: opts.onclick ? { cursor: 'pointer' } : null,
  },
    defs(id, 'satellite'),
    /* THE FIELD'S OWN GROUND, since review 22/09's second pass: "it doesn't
       look like the satellite imagery extends all the way to the end of the
       screen, instead showing the old noisy brown background."

       This was the loudest case. The hero on B2 is a close crop of ONE plot, it
       is the biggest picture on the screen, and it was the fractal desert with a
       coloured polygon floating on it — so the one screen that shows a farmer
       his own field showed him invented sand.

       The rect passed for the fallback is drawn at DOUBLE the frame, because
       this SVG uses "slice" in one mode and "meet" in the other: under "meet"
       the viewBox is letterboxed and a rect the size of the frame leaves the
       bars bare. The photograph does not need the help — it bleeds 2.2× past
       the farm square already.

       IT IS SOFTER THAN THE FARM VIEW and that is the imagery, not the code.
       Esri tops out at z18 over this ground — 0.45 m a pixel — so a 290-metre
       field crops to about 640 pixels for a 780-pixel hero. A real satellite
       app looks exactly like this when you zoom past what was flown. */
    groundLayer(id, photosFor([plot], null), {
      x: cx - spanX * 2, y: cy - spanY * 2, width: spanX * 4, height: spanY * 4,
    }),
    plotRaster(plot, measure, id, { dateKey: opts.dateKey }),
    plot.kind === 'trees'
      ? [treeOutline(plot, measure), treeDots(plot, measure)]
      : rings.map((ring) => h('polygon', {
        points: pointsOf(ring),
        fill: 'none', stroke: 'rgba(255,255,255,.85)', 'stroke-width': 2.5,
        'stroke-dasharray': rings.length > 1 ? '14 9' : null,
      })),
    opts.pin && h('g', {},
      h('circle', { cx: opts.pin[0], cy: opts.pin[1], r: 9, fill: '#fff', stroke: 'var(--ink-900)', 'stroke-width': 2.5 })),
    imageryCredit(photosFor([plot], null),
      cx - spanX + spanX * 0.045, cy + spanY - spanY * 0.045, spanX * 0.055));
}

/* THE LEGEND IS ui/metric.js's metricLegend() since v1.7.2: five named
   colours, the same under every map. */

/* -- tree locator ---------------------------------------------------------
   A wayfinding view, not a measure view: the question is "which of these 640
   trees do I walk to", so the imagery is dimmed and the planting grid, the row
   the tree stands in, the tree itself and the operator's own position carry the
   drawing.

   WF5.070 already defines this interaction — "the map centred on the target
   plot or tree, with a line and a distance from the operator's current
   position. Not a routing engine." The straight line is deliberate: a farm has
   no road network to route along, and a bearing plus a distance is what a person
   walking a plantation grid actually uses.
   ------------------------------------------------------------------------- */


export function metresBetween(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) * FARM_UNIT_M;
}

/** Compass bearing from a to b, as one of the eight points. */
export function bearingBetween(a, b) {
  const angle = (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(((angle + 360) % 360) / 45) % 8];
}

/** Half-frame, in farm units, for a locator on this plot. Exported so the HTML
    chrome can draw a scale bar that matches what the SVG actually shows. */
export function locatorSpan(plot) {
  const grid = plot.grid;
  const extent = grid ? Math.max(grid.rx, grid.ry) : 60;
  // Enough of the planting grid to count rows against, clamped so a very small
  // or very large parcel still frames sensibly.
  return Math.max(34, Math.min(150, extent * 0.72));
}

export function treeLocatorSvg({ plot, tree, gps, label, spanUnits }) {
  const id = nextId();
  const [cx, cy] = tree.point;
  const span = spanUnits ?? locatorSpan(plot);   // half-frame, in units (2 m each)
  const u = span / 40;                           // glyph scale
  const grid = plot.grid;

  /* The frame stays close on the tree — about 160 m across — because the
     question this map answers is "which of these trees", and that needs the
     planting grid legible. Where the operator is further out than the frame
     reaches, their marker pins to the edge they are beyond and points back the
     way they must walk. Zooming out to fit both would show two dots in a field.

     There is deliberately NO line drawn between the two, and no distance. A
     dashed line across a picture of a plantation reads as a route, which it is
     not, and the number beside it invited the obvious question — 1.3 what? —
     with no answer worth giving at this range. What the operator needs is which
     tree, and the frame answers that. */
  const inFrame = gps && Math.abs(gps[0] - cx) < span * 0.92 && Math.abs(gps[1] - cy) < span * 0.92;
  let edge = null;
  if (gps && !inFrame) {
    const dx = gps[0] - cx;
    const dy = gps[1] - cy;
    const scale = Math.min(dx ? span / Math.abs(dx) : Infinity, dy ? span / Math.abs(dy) : Infinity) * 0.8;
    edge = [cx + dx * scale, cy + dy * scale];
  }

  const rowGuide = grid ? (() => {
    const [x1, y1] = gridPoint(grid, tree.row, 1);
    const [x2, y2] = gridPoint(grid, tree.row, grid.per);
    return h('line', {
      x1, y1, x2, y2, stroke: 'rgba(255,255,255,.78)',
      'stroke-width': 2 * u, 'stroke-dasharray': `${5 * u} ${3.5 * u}`,
    });
  })() : null;

  const neighbours = plot.treePoints.map(([x, y]) => h('circle', {
    cx: x, cy: y, r: 1.9 * u, fill: 'rgba(255,255,255,.66)',
  }));

  return h('svg', {
    viewBox: `${cx - span} ${cy - span} ${span * 2} ${span * 2}`,
    preserveAspectRatio: 'xMidYMid slice',
    role: 'img', 'aria-label': label ?? t('a11y.treemap', 'Where {id} stands', { id: tree.id }),
  },
    defs(id, 'satellite'),
    /* THE REAL GROUND HERE TOO, and this is the frame that asks most of it.
       About 160 m across at z18 is three hundred and fifty pixels for a
       seven-hundred-pixel box, so it is drawn soft — which is what a satellite
       app looks like at the bottom of its imagery, and is still the operator's
       own plantation rather than a fractal.

       The dark wash over it is not decoration. The subject of this picture is
       which of forty identical dots to walk to, and a photograph of a date
       plantation is forty thousand identical dots; the markers have to win. */
    groundLayer(id, photosFor([plot], null), {
      x: cx - span * 2, y: cy - span * 2, width: span * 4, height: span * 4,
    }),
    when(photosFor([plot], null).length, () => h('rect', {
      x: cx - span * 2, y: cy - span * 2, width: span * 4, height: span * 4,
      fill: 'rgba(12,22,18,.34)',
    })),
    // No area and no outline round the group (v1.7.3): the trees are the
    // group, one dot each, and the row they stand in is what orients.
    rowGuide,
    neighbours,

    // The operator, either where they stand or pinned to the edge they are
    // beyond, pointing back the way they must walk.
    inFrame && h('g', {},
      h('circle', { cx: gps[0], cy: gps[1], r: 9 * u, fill: 'rgba(43,120,255,.22)' }),
      h('circle', { cx: gps[0], cy: gps[1], r: 3.4 * u, fill: '#2b78ff', stroke: '#fff', 'stroke-width': 1.5 * u })),
    edge && h('g', { transform: `rotate(${(Math.atan2(edge[1] - cy, edge[0] - cx) * 180) / Math.PI + 90} ${edge[0]} ${edge[1]})` },
      h('circle', { cx: edge[0], cy: edge[1], r: 6.2 * u, fill: '#2b78ff', stroke: '#fff', 'stroke-width': 1.6 * u }),
      h('path', {
        d: `M${edge[0]} ${edge[1] - 3.2 * u} L${edge[0] + 2.4 * u} ${edge[1] + 1.6 * u} L${edge[0] - 2.4 * u} ${edge[1] + 1.6 * u} Z`,
        fill: '#fff',
      })),

    // The target last, so nothing can sit on top of it.
    h('circle', { cx, cy, r: 11 * u, fill: 'none', stroke: '#fff', 'stroke-width': 1.8 * u, opacity: .9 }),
    h('circle', { cx, cy, r: 4.4 * u, fill: statusColour(tree.status), stroke: '#fff', 'stroke-width': 2 * u }));
}

/**
 * The small sigil beside a farm's name on Home: that farm's own plot outlines,
 * filled by each plot's status.
 *
 * It is not a map — there is no basemap, no scale and no north — which is why
 * it costs a few polygons rather than a synthesised raster and can appear
 * beside every farm in a list without a stall. What it does carry is
 * recognition: a farmer knows the shape of their own land at a glance, in a way
 * no name in a list matches, and the fill means the same thing here as
 * everywhere else (WF2.009).
 *
 * The colour is never alone: the card beneath it names the status in words.
 */
export function farmGlyph(plots) {
  const box = fitBox(plots, 1.28);
  return h('svg', {
    viewBox: box.viewBox, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-hidden': 'true', focusable: 'false',
  },
  h('rect', { ...box.rect, fill: 'var(--ink-800)' }),
  plots.flatMap((p) => ringsOf(p).map((ring) => h('polygon', {
    points: pointsOf(ring),
    fill: statusColour(p.status),
    stroke: 'rgba(255,255,255,.5)',
    'stroke-width': box.size * 0.006,
    'stroke-linejoin': 'round',
  }))));
}
