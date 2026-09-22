/* ---------------------------------------------------------------------------
   map.js — the fake satellite map.

   There is no tile server here, so imagery is synthesised: a turbulence-based
   basemap for the ground, and per-plot measure rasters built from the plot's
   own seed so the same plot draws the same mottling every time. That matters
   for a mockup — a map that reshuffles on every render reads as noise.

   Two spec behaviours are baked into the renderer rather than left to callers:
     * WF5.025 — the legend scale is FIXED per measure, never auto-scaled to the
       current image, so week-to-week comparison stays valid.
     * WF5.060 — polygons carry their status icon and label, and labels hide
       below a zoom threshold rather than overlapping.

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
import { STATUS } from '../core/status.js';
import { t } from '../core/i18n.js';
import { MEASURE_SCALE as HEALTH_MEASURE_SCALE, overallHealthScore } from '../core/health.js';

/* Fixed ramps. Index 0 is the low end of the measure's fixed scale. */
export const RAMPS = {
  veg:   ['#8c3b13', '#c0762a', '#d9c04a', '#9dbd4a', '#4f9a3c', '#1c6b2c'],
  water: ['#9c5b1f', '#d3a55c', '#e8dfa8', '#86c2c8', '#3383a8', '#14496f'],
  health: ['#c43b32', '#e36f3d', '#d7a63b', '#9fc85a', '#4f9a3c', '#176b2d'],
};

/* WF5.025 — the domain of each measure's scale, fixed, not per-image. */
export const MEASURE_SCALE = {
  ...HEALTH_MEASURE_SCALE,
};

/* 603 — three bands, not a continuous ramp. Efficiency is a decision — leave
   it, look at it, fix it — and a gradient invites a farmer to read a
   difference between 81% and 84% that no measurement supports. The thresholds
   are the ones D2 already states in words on the advice itself. */
export const EFFICIENCY_BANDS = [
  { id: 'poor', min: 0, fill: '#c0532c', stroke: '#8f3a1c' },
  { id: 'fair', min: 70, fill: '#d9a441', stroke: '#a97c21' },
  { id: 'good', min: 82, fill: '#3f8f5e', stroke: '#256b41' },
];

export function efficiencyBand(pct = 85) {
  return [...EFFICIENCY_BANDS].reverse().find((b) => pct >= b.min) ?? EFFICIENCY_BANDS[0];
}

export function rampFor(measure) {
  return RAMPS[MEASURE_SCALE[measure]?.ramp ?? 'veg'];
}

export function colourFor(measure, value) {
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  const ramp = RAMPS[scale.ramp];
  const ratio = (value - scale.min) / (scale.max - scale.min);
  const i = Math.max(0, Math.min(ramp.length - 1, Math.round(ratio * (ramp.length - 1))));
  return ramp[i];
}

export function rampCss(measure) {
  return `linear-gradient(to right, ${rampFor(measure).join(',')})`;
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
   rather than by seventeen callers each remembering to pass a boundary. Two
   sources, in order:

     the line the farmer drew    A13 stores it on the farm, so the outline on
                                 A16 and on every map afterwards is the same
                                 shape he traced, not a redrawing of it.
     the plots themselves        for the fixture farms, which have no traced
                                 boundary: the convex hull of their plots,
                                 pushed out a little so it does not sit on top
                                 of the outermost field. "If available" is the
                                 reviewer's own hedge and this is the second
                                 reading of it — a farm with plots does have a
                                 shape, even if nobody drew it.

   The line is DASHED AND BLUE, which is the same pair the boundary editor uses
   for a farm outline and never uses for a plot. Two solid white lines round the
   same field would read as two plots. */
export function farmBoundary(farmId) {
  const farm = (state.db?.farms ?? []).find((f) => f.id === farmId);
  if ((farm?.boundary?.length ?? 0) >= 3) return farm.boundary;
  const points = (state.db?.plots ?? [])
    .filter((p) => p.farmId === farmId)
    .flatMap((p) => ringsOf(p).flat());
  return outlineOf(points);
}

/**
 * The same second reading, for callers holding the shapes rather than a farm id
 * — A16 draws the survey's areas before any of them is a plot record.
 */
export function outlineOf(points) {
  if (points.length < 3) return null;
  // Review 06/09 asked, of C1, "add farm boundary(ies)?" — the line was already
  // there and sitting 7% out from the plots, close enough that it read as one
  // more plot outline rather than as the edge of the holding. It stands further
  // off now, which is the cheapest way to make a shape look like a container.
  return expand(convexHull(points), 1.16);
}

/** Monotone chain. Points come in unsorted from several plots. */
function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (source) => {
    const out = [];
    for (const p of source) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Push a ring out from its own centre, so it clears what it encloses. */
function expand(ring, by) {
  const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length;
  const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
  return ring.map(([x, y]) => [cx + (x - cx) * by, cy + (y - cy) * by]);
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

function plotRaster(plot, measure, id, opts = {}) {
  const clipId = `${id}-clip-${plot.id}`;
  const rings = ringsOf(plot);
  const overall = measure === 'overall';
  const value = overall ? (overallHealthScore(plot) ?? 0) : (plot.measures[measure]?.value ?? 0);
  const nodata = plot.status === 'nodata';
  const r = rng(`${plot.id}-${measure}-${opts.dateKey ?? ''}`);
  const scale = overall ? { min: 0, max: 100, ramp: 'health' } : (MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi);
  const ramp = RAMPS[scale.ramp];

  const blobs = [];
  if (!nodata) {
    for (const ring of rings) {
    const cx = ring.reduce((n, [x]) => n + x, 0) / ring.length;
    const cy = ring.reduce((n, [, y]) => n + y, 0) / ring.length;
    for (let i = 0; i < 14; i += 1) {
      // Mottle around the plot's own value; stressed plots get a clear
      // directional gradient so the "east side is drying" reading is visible.
      const bias = (r() - 0.42) * 0.28;
      const v = Math.max(scale.min, Math.min(scale.max, value + bias));
      const tRel = (v - scale.min) / (scale.max - scale.min);
      const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(tRel * (ramp.length - 1))));
      blobs.push(h('ellipse', {
        cx: cx + (r() - 0.5) * 130, cy: cy + (r() - 0.5) * 130,
        rx: 20 + r() * 55, ry: 18 + r() * 48,
        fill: ramp[idx], opacity: 0.75,
        transform: `rotate(${Math.round(r() * 180)} ${cx} ${cy})`,
      }));
    }
    }
  }

  return h('g', { class: 'plotg' },
    h('clipPath', { id: clipId }, rings.map((ring) => h('polygon', { points: pointsOf(ring) }))),
    rings.map((ring) => h('polygon', { points: pointsOf(ring), fill: nodata ? '#6b7a73' : colourFor(measure, value), opacity: nodata ? 0.5 : 0.95 })),
    !nodata && h('g', { 'clip-path': `url(#${clipId})`, filter: `url(#${id}-raster)` }, blobs),
    nodata && rings.map((ring) => h('polygon', { points: pointsOf(ring), fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .8 })));
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
  /* The dark under the pictures is what shows where none of them reaches, which
     on a satellite app is the honest thing — it is what Google draws outside
     its own coverage. photosFor() hands back at most one photograph now (the
     cluster picture stands in for the six), so there is nothing to clip: the
     margins of two pictures of the same block agree, because they are the same
     ground at the same scale from the same survey. */
  return h('g', {},
    h('rect', { ...rect, fill: '#20262a' }),
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
 * @param {object} o.layers       { boundaries, blocks, labels, trees, soil, vra }
 * @param {string} o.selectedId   plot id to highlight
 * @param {number} o.zoom         1 = fit; labels hide below 0.75 (WF5.060)
 * @param {boolean} o.pin          drop a marker on the centre of the frame
 * @param {string|string[]} o.imageryOf  farm id(s) whose satellite photograph to
 *                                   lay down, when the plots cannot say
 */
export function mapSvg({
  plots, measure = 'ndvi', basemap = 'satellite', layers = {}, selectedId = null,
  onPlotTap = null, zoom = 1, showStatus = true, dateKey = '', gps = null,
  compareMeasure = null, comparePct = null, pin = false, imageryOf = null,
  cover = false,
}) {
  const id = nextId();

  const photos = photosFor(plots, imageryOf, basemap);

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
  const box = cover
    ? coverBox(cover === true ? (photos[0]?.fit ?? [0, 0, 1000, 1000]) : cover)
    : keepOnGround(
      // `fit` is the farm's own square; `box` is the wider ground photographed
      // around it. A map with nothing to fit to fits the farm, not the bleed.
      fitBox(plots, zoom, plots.length ? [] : photos.map((img) => img.fit ?? img.box)),
      photos,
    );
  /* WF5.060 — labels hide automatically rather than overlapping, and the test
     is now HOW MANY FARMS are drawn rather than how wide the frame is.

     The extent used to say the same thing by accident: farms were laid out on a
     grid 1,250 units apart, so "all farms" was 2,900 units across and cleared
     the 1,500 threshold. Since the six became neighbours in one block, all of
     them fit inside 1,180 units — and twenty plot labels landed on top of each
     other. What the rule was always reaching for is the farm count: one farm's
     plots have room for their names, and several farms' do not. */
  const showLabels = layers.labels !== false
    && new Set(plots.map((p) => p.farmId)).size <= 1;
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
  const bg = photos.length
    ? groundLayer(id, photos, box.rect)
    : h('g', {},
      groundLayer(id, [], box.rect, basemap),
      basemap !== 'street' && h('path', {
        d: `M${box.rect.x} ${box.cy + box.size * 0.16} C ${box.cx - box.size * 0.3} ${box.cy + box.size * 0.1}, ${box.cx} ${box.cy + box.size * 0.24}, ${box.cx + box.size * 0.6} ${box.cy + box.size * 0.12}`,
        stroke: '#6b7d5c', 'stroke-width': box.size * 0.026, fill: 'none', opacity: .45,
      }),
      h('path', { d: `M${box.rect.x} ${box.cy - box.size * 0.28} L ${box.rect.x + box.rect.width} ${box.cy - box.size * 0.31}`, stroke: '#efe7d5', 'stroke-width': box.size * (basemap === 'street' ? .01 : .005), opacity: basemap === 'street' ? .95 : .5 }),
      h('path', { d: `M${box.cx - box.size * 0.18} ${box.rect.y} L ${box.cx - box.size * 0.14} ${box.rect.y + box.rect.height}`, stroke: '#efe7d5', 'stroke-width': box.size * (basemap === 'street' ? .01 : .005), opacity: basemap === 'street' ? .95 : .5 }));

  const rasters = plots.map((p) => plotRaster(p, measure, id, { dateKey }));

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
     survives an arbitrary background on every map anyone has ever used. */
  const farmLines = layers.boundaries === false ? null
    : [...new Set(plots.map((p) => p.farmId))].flatMap((farmId) => {
      const ring = farmBoundary(farmId);
      if (!ring) return [];
      const shape = (props) => h('polygon', {
        points: pointsOf(ring), fill: 'none', 'stroke-linejoin': 'round', ...props,
      });
      return [
        h('polygon', { points: pointsOf(ring), fill: 'rgba(11,95,158,.10)', stroke: 'none' }),
        shape({ stroke: 'rgba(6,38,66,.55)', 'stroke-width': 8 }),
        shape({ stroke: '#bfe6ff', 'stroke-width': 4, 'stroke-dasharray': '18 12' }),
      ];
    });

  /* 603 — THE IRRIGATION MAP, AND WHY IT IS A FLAT FILL RATHER THAN A RASTER.

     An irrigation-efficiency layer was drawn here once and taken out, on the
     argument that a heat map washed across a whole farm is not a thing anybody
     can act on. The 13/09 review put the feature back with that objection
     answered in its own wording: per-plot efficiency, painted on the plot's own
     boundary, at both farm and plot scope.

     So this deliberately does NOT go through plotRaster(). The mottle there
     says "the satellite read this ground and it varies across it", which is
     true of a vegetation index and false of efficiency: efficiency is one
     number per plot, a property of the system watering it rather than of the
     soil under it. A flat fill with a hard edge says exactly that, and it is
     also what tells the two layers apart at a glance when a farmer switches
     between them. */
  const efficiency = layers.efficiency
    ? plots.flatMap((p) => {
      const band = efficiencyBand(p.irrigationEfficiencyPct);
      return ringsOf(p).map((ring) => h('polygon', {
        points: pointsOf(ring), fill: band.fill, opacity: .82,
        stroke: band.stroke, 'stroke-width': 3,
      }));
    })
    : null;

  const outlines = layers.boundaries === false ? null : plots.flatMap((p) => ringsOf(p).map((ring) => h('polygon', {
    points: pointsOf(ring),
    fill: 'none',
    stroke: p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,.72)',
    'stroke-width': p.id === selectedId ? 5 : 2.2,
    // A group's parcels are drawn dashed between them so three outlines read as
    // one holding rather than as three plots nobody named.
    'stroke-dasharray': ringsOf(p).length > 1 ? '14 9' : null,
  })));

  const trees = layers.trees
    ? plots.flatMap((p) => p.treeHealthDisplay === 'area' ? [] : p.treePoints.map(([x, y], i) => h('circle', {
        cx: x, cy: y, r: 3.4, fill: statusColour(p.status),
        stroke: 'rgba(0,0,0,.3)', 'stroke-width': .6,
      })))
    : null;

  const labelScale = box.size / 1000;
  // The label is the SHORT name unless the map spans farms. "Al Kharj South
  // Plot 1" repeated eight times across one farm is the farm's own name printed
  // eight times, in a box too small to hold it. (With labels now shown only on
  // a single-farm map this is always true; it stays because a caller can force
  // labels on, and because the two rules are about different things.)
  const oneFarm = new Set(plots.map((p) => p.farmId)).size <= 1;
  const labels = showLabels ? plots.map((p) => {
    const [cx, cy] = p.centroid;
    const s = STATUS[p.status] ?? STATUS.nodata;
    const name = oneFarm ? (p.shortName ?? p.name) : p.name;
    const w = (34 + name.length * 9.5) * labelScale;
    const hgt = 34 * labelScale;
    return h('g', { class: 'plotlabel' },
      h('rect', { x: cx - w / 2, y: cy - hgt / 2, width: w, height: hgt, rx: hgt / 2, fill: 'rgba(12,20,16,.72)' }),
      h('circle', { cx: cx - w / 2 + 17 * labelScale, cy, r: 7.5 * labelScale, fill: statusColour(p.status) }),
      h('text', {
        x: cx - w / 2 + 30 * labelScale, y: cy + 6 * labelScale, fill: '#fff',
        'font-size': 19 * labelScale, 'font-weight': 650, 'font-family': 'var(--font)',
      }, name));
  }) : null;

  const hits = onPlotTap ? plots.flatMap((p) => ringsOf(p).map((ring) => h('polygon', {
    points: pointsOf(ring),
    fill: 'transparent', style: { cursor: 'pointer' },
    onclick: () => onPlotTap(p),
  }))) : null;

  const gpsPos = gps ? [box.cx + (gps[0] - 500) * (box.size / 1000), box.cy + (gps[1] - 500) * (box.size / 1000)] : null;
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
    // so nothing may be cropped out of the initial view.
    viewBox: box.viewBox, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Farm map',
  }, defs(id, basemap), bg, rasters, compareLayer, efficiency, farmLines, outlines, trees, hits, labels, me, marker, credit);
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
    'aria-label': `${plot.name} measure map`,
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
    rings.map((ring) => h('polygon', {
      points: pointsOf(ring),
      fill: 'none', stroke: 'rgba(255,255,255,.85)', 'stroke-width': 2.5,
      'stroke-dasharray': rings.length > 1 ? '14 9' : null,
    })),
    opts.pin && h('g', {},
      h('circle', { cx: opts.pin[0], cy: opts.pin[1], r: 9, fill: '#fff', stroke: 'var(--ink-900)', 'stroke-width': 2.5 })),
    imageryCredit(photosFor([plot], null),
      cx - spanX + spanX * 0.045, cy + spanY - spanY * 0.045, spanX * 0.055));
}

/** WF5.023 — persistent legend showing the value scale.

    Review 06/09 took the index name off the end of it. It was the second half
    of the legend — "low ▬▬ high  NDWI / water-stress measure" — and a layer is
    not one index, so the name was both noise and slightly untrue. */
export function legend(measure) {
  return h('div.maplegend',
    h('span', 'low'),
    h('span.maplegend__ramp', { style: { background: rampCss(measure) } }),
    h('span', 'high'));
}

/** 603's own key, which a gradient cannot serve: three bands, each named. It
    replaces the measure legend while the layer is on rather than sitting beside
    it, because two scales under one map is two readings of the same colours. */
export function efficiencyLegend() {
  const swatch = (band, label) => h('span', {
    style: { display: 'inline-flex', alignItems: 'center', gap: '5px' },
  },
  h('i', {
    style: {
      width: '12px', height: '12px', borderRadius: '3px',
      background: band.fill, border: `1px solid ${band.stroke}`,
    },
  }),
  h('span', label));
  return h('div.maplegend', { style: { gap: '12px' } },
    swatch(EFFICIENCY_BANDS[2], t('c1.eff.good', 'Good')),
    swatch(EFFICIENCY_BANDS[1], t('c1.eff.fair', 'Fair')),
    swatch(EFFICIENCY_BANDS[0], t('c1.eff.poor', 'Poor')));
}

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

/** 1 unit of farm space = 2 m, the same scale the boundary editor measures in. */
export const M_PER_UNIT = 2;

export function metresBetween(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) * M_PER_UNIT;
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

export function treeLocatorSvg({ plot, tree, gps, measure = 'ndvi', label, spanUnits }) {
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
    role: 'img', 'aria-label': label ?? `Where ${tree.id} stands`,
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
    // The measure raster orients; it is not the subject, so it sits back.
    h('g', { opacity: .42 }, plotRaster(plot, measure, id)),
    h('polygon', {
      points: plot.geometry.map(([x, y]) => `${x},${y}`).join(' '),
      fill: 'none', stroke: 'rgba(255,255,255,.65)', 'stroke-width': 1.4 * u,
    }),
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

/* -- the land use survey map (WF4.049 / WF4.050) --------------------------
   Not a measure map: the fill is what the area IS, not how it is doing, so
   there is no ramp and no legend of values. Excluded areas keep their outline
   and lose their fill, which is the whole point of the screen — the farmer can
   see what he has left out, not just what he has kept. */

export function landUseSvg({ areas, fills, selectedId = null, onTap = null, boundary = null, imageryOf = null }) {
  const id = nextId();
  // Review 01/09 — the outline the farmer drew on A13 is the reference point
  // this map was missing, so it is part of the extent the map fits to: a plot
  // the survey found outside the line has to be visible as being outside it.
  const box = keepOnGround(
    fitBox(boundary?.length >= 3 ? [...areas, { geometry: boundary, centroid: boundary[0] }] : areas, 1),
    photosFor(areas, imageryOf),
  );
  const scale = box.size / 1000;
  /* THE SAME GROUND THE FARMER HAS BEEN LOOKING AT SINCE A13. This screen shows
     what the survey found inside a boundary he traced two screens ago, and it
     drew that over generated sand while A13 and A14 showed a photograph — so
     the one screen where he checks the satellite's work was the one screen not
     on the satellite's picture. */
  const photos = photosFor(areas, imageryOf);
  return h('svg', {
    viewBox: box.viewBox, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Land use map',
  },
  defs(id, 'satellite'),
  photos.length
    ? h('g', {}, h('rect', { ...box.rect, fill: '#20262a' }),
      ...photos.map((img) => h('image', {
        href: img.href, 'xlink:href': img.href,
        x: img.box[0], y: img.box[1], width: img.box[2], height: img.box[3],
        preserveAspectRatio: 'none',
      })))
    : h('g', {},
      h('rect', { ...box.rect, fill: `url(#${id}-sky)` }),
      h('rect', { ...box.rect, filter: `url(#${id}-ground)`, opacity: .6 })),
  // Under the plots, in the farm tone, so it reads as the line round them
  // rather than as a ninth plot.
  when(boundary?.length >= 3, () => h('polygon', {
    points: boundary.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill: 'rgba(11,95,158,.10)', stroke: '#8fd0ff',
    'stroke-width': 3.4 * scale, 'stroke-dasharray': `${18 * scale} ${12 * scale}`,
    'stroke-linejoin': 'round',
  })),
  areas.map((a) => {
    const pts = a.geometry.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const fill = fills?.[a.kind] ?? '#98a5a0';
    return h('g', {
      style: onTap ? { cursor: 'pointer' } : null,
      onclick: onTap ? () => onTap(a) : null,
    },
    h('polygon', {
      points: pts,
      fill: a.included ? fill : 'none',
      opacity: a.included ? .82 : 1,
      stroke: a.id === selectedId ? '#ffffff' : 'rgba(255,255,255,.6)',
      'stroke-width': a.id === selectedId ? 5 * scale : 2.2 * scale,
      'stroke-dasharray': a.included ? null : `${9 * scale} ${7 * scale}`,
    }),
    h('text', {
      x: a.centroid[0], y: a.centroid[1] + 6 * scale, fill: '#fff',
      'text-anchor': 'middle', 'font-size': 22 * scale, 'font-weight': 700,
      'font-family': 'var(--font)', style: { pointerEvents: 'none' },
    }, a.label));
  }));
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
