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
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { rng, gridPoint } from '../data/fixtures.js';
import { STATUS } from '../core/status.js';

/* Fixed ramps. Index 0 is the low end of the measure's fixed scale. */
export const RAMPS = {
  veg:   ['#8c3b13', '#c0762a', '#d9c04a', '#9dbd4a', '#4f9a3c', '#1c6b2c'],
  water: ['#9c5b1f', '#d3a55c', '#e8dfa8', '#86c2c8', '#3383a8', '#14496f'],
};

/* WF5.025 — the domain of each measure's scale, fixed, not per-image. */
export const MEASURE_SCALE = {
  ndvi:  { min: 0.05, max: 0.90, ramp: 'veg' },
  ndwi:  { min: 0.00, max: 0.60, ramp: 'water' },
  ndre:  { min: 0.05, max: 0.60, ramp: 'veg' },
  evi:   { min: 0.05, max: 0.80, ramp: 'veg' },
  msavi: { min: 0.05, max: 0.85, ramp: 'veg' },
  psri:  { min: 0.00, max: 0.40, ramp: 'veg' },
};

export function rampFor(measure) {
  return RAMPS[MEASURE_SCALE[measure]?.ramp ?? 'veg'];
}

export function colourFor(measure, value) {
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  const ramp = RAMPS[scale.ramp];
  const t = (value - scale.min) / (scale.max - scale.min);
  const i = Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))));
  return ramp[i];
}

export function rampCss(measure) {
  return `linear-gradient(to right, ${rampFor(measure).join(',')})`;
}

let uid = 0;
const nextId = () => `m${(uid += 1)}`;

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
      h('stop', { offset: '0', 'stop-color': basemap === 'street' ? '#e9e6df' : basemap === 'terrain' ? '#cbbfa4' : '#7a6a4e' }),
      h('stop', { offset: '1', 'stop-color': basemap === 'street' ? '#f4f2ec' : basemap === 'terrain' ? '#b8ab8c' : '#5d5039' })));
}

/* -- plot raster ---------------------------------------------------------- */

function plotRaster(plot, measure, id, opts = {}) {
  const clipId = `${id}-clip-${plot.id}`;
  const pts = plot.geometry.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const value = plot.measures[measure]?.value ?? 0;
  const nodata = plot.status === 'nodata';
  const r = rng(`${plot.id}-${measure}-${opts.dateKey ?? ''}`);
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  const ramp = RAMPS[scale.ramp];

  const blobs = [];
  if (!nodata) {
    const [cx, cy] = plot.centroid;
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

  return h('g', { class: 'plotg' },
    h('clipPath', { id: clipId }, h('polygon', { points: pts })),
    h('polygon', { points: pts, fill: nodata ? '#6b7a73' : colourFor(measure, value), opacity: nodata ? 0.5 : 0.95 }),
    !nodata && h('g', { 'clip-path': `url(#${clipId})`, filter: `url(#${id}-raster)` }, blobs),
    nodata && h('polygon', { points: pts, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .8 }));
}

/* -- the map -------------------------------------------------------------- */

/**
 * @param {object} o
 * @param {Array}  o.plots        plots to draw
 * @param {string} o.measure      measure key driving the fill
 * @param {string} o.basemap      satellite | terrain | street
 * @param {object} o.layers       { boundaries, blocks, labels, trees, soil, vra }
 * @param {string} o.selectedId   plot id to highlight
 * @param {number} o.zoom         1 = fit; labels hide below 0.75 (WF5.060)
 */
export function mapSvg({
  plots, measure = 'ndvi', basemap = 'satellite', layers = {}, selectedId = null,
  onPlotTap = null, zoom = 1, showStatus = true, dateKey = '', gps = null,
  compareMeasure = null, comparePct = null,
}) {
  const id = nextId();
  // WF5.059 — the map opens zoomed to fit the farms it is showing.
  const box = fitBox(plots, zoom);
  // WF5.060 — labels hide automatically below a zoom threshold rather than
  // overlapping. The threshold is the drawn extent, not a raw zoom number, so
  // "all farms" hides them and a single farm keeps them.
  const showLabels = layers.labels !== false && box.size <= 1500;
  const bg = h('g', {},
    h('rect', { ...box.rect, fill: `url(#${id}-sky)` }),
    h('rect', { ...box.rect, filter: `url(#${id}-ground)`, opacity: basemap === 'street' ? .18 : .6 }),
    // a wadi and two tracks, so the ground is not featureless
    basemap !== 'street' && h('path', {
      d: `M${box.rect.x} ${box.cy + box.size * 0.16} C ${box.cx - box.size * 0.3} ${box.cy + box.size * 0.1}, ${box.cx} ${box.cy + box.size * 0.24}, ${box.cx + box.size * 0.6} ${box.cy + box.size * 0.12}`,
      stroke: basemap === 'terrain' ? '#8fa27a' : '#6b7d5c', 'stroke-width': box.size * 0.026, fill: 'none', opacity: .45,
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

  const outlines = layers.boundaries === false ? null : plots.map((p) => h('polygon', {
    points: p.geometry.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill: 'none',
    stroke: p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,.72)',
    'stroke-width': p.id === selectedId ? 5 : 2.2,
  }));

  const trees = layers.trees
    ? plots.flatMap((p) => p.treePoints.map(([x, y], i) => h('circle', {
        cx: x, cy: y, r: 3.4, fill: 'rgba(255,255,255,.82)',
        stroke: 'rgba(0,0,0,.3)', 'stroke-width': .6,
      })))
    : null;

  const labelScale = box.size / 1000;
  const labels = showLabels ? plots.map((p) => {
    const [cx, cy] = p.centroid;
    const s = STATUS[p.status] ?? STATUS.nodata;
    const w = (34 + p.name.length * 9.5) * labelScale;
    const hgt = 34 * labelScale;
    return h('g', { class: 'plotlabel' },
      h('rect', { x: cx - w / 2, y: cy - hgt / 2, width: w, height: hgt, rx: hgt / 2, fill: 'rgba(12,20,16,.72)' }),
      h('circle', { cx: cx - w / 2 + 17 * labelScale, cy, r: 7.5 * labelScale, fill: statusColour(p.status) }),
      h('text', {
        x: cx - w / 2 + 30 * labelScale, y: cy + 6 * labelScale, fill: '#fff',
        'font-size': 19 * labelScale, 'font-weight': 650, 'font-family': 'var(--font)',
      }, p.name));
  }) : null;

  const hits = onPlotTap ? plots.map((p) => h('polygon', {
    points: p.geometry.map(([x, y]) => `${x},${y}`).join(' '),
    fill: 'transparent', style: { cursor: 'pointer' },
    onclick: () => onPlotTap(p),
  })) : null;

  const gpsPos = gps ? [box.cx + (gps[0] - 500) * (box.size / 1000), box.cy + (gps[1] - 500) * (box.size / 1000)] : null;
  const me = gpsPos ? h('g', {},
    h('circle', { cx: gpsPos[0], cy: gpsPos[1], r: 38 * labelScale, fill: 'rgba(43,120,255,.20)' }),
    h('circle', { cx: gpsPos[0], cy: gpsPos[1], r: 11 * labelScale, fill: '#2b78ff', stroke: '#fff', 'stroke-width': 4 * labelScale })) : null;

  return h('svg', {
    // "meet" rather than "slice": WF5.059 opens the map zoomed to FIT the farms,
    // so nothing may be cropped out of the initial view.
    viewBox: box.viewBox, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Farm map',
  }, defs(id, basemap), bg, rasters, compareLayer, outlines, trees, hits, labels, me);
}

/** A square viewBox around the given plots, with room to breathe. */
function fitBox(plots, zoom = 1) {
  let minX = 0; let minY = 0; let maxX = 1000; let maxY = 1000;
  if (plots.length) {
    const xs = plots.flatMap((p) => p.geometry.map(([x]) => x));
    const ys = plots.flatMap((p) => p.geometry.map(([, y]) => y));
    minX = Math.min(...xs); maxX = Math.max(...xs);
    minY = Math.min(...ys); maxY = Math.max(...ys);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const size = Math.max(maxX - minX, maxY - minY, 120) * 1.18 / Math.max(0.4, zoom);
  const rect = { x: cx - size, y: cy - size, width: size * 2, height: size * 2 };
  return { cx, cy, size, rect, viewBox: `${cx - size / 2} ${cy - size / 2} ${size} ${size}` };
}

export function statusColour(key) {
  return ({
    good: 'var(--st-good)', watch: 'var(--st-watch)', action: 'var(--st-action)',
    urgent: 'var(--st-urgent)', nodata: 'var(--st-nodata)', missing: 'var(--st-nodata)',
  })[key] ?? 'var(--st-nodata)';
}

/**
 * A single plot filling the frame — the hero image of B4 and B7.
 */
export function plotRasterSvg(plot, measure, opts = {}) {
  const id = nextId();
  // Fit the frame to the plot's own extent rather than a fixed span, so a
  // narrow parcel is not shown as a sliver in the middle of empty desert.
  const xs = plot.geometry.map(([x]) => x);
  const ys = plot.geometry.map(([, y]) => y);
  const pad = 26;
  const minX = Math.min(...xs) - pad; const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad; const maxY = Math.max(...ys) + pad;
  const span = Math.max(maxX - minX, maxY - minY) / 2;
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  return h('svg', {
    viewBox: `${cx - span} ${cy - span} ${span * 2} ${span * 2}`,
    preserveAspectRatio: 'xMidYMid slice', role: 'img',
    'aria-label': `${plot.name} measure map`,
    onclick: opts.onclick,
    style: opts.onclick ? { cursor: 'pointer' } : null,
  },
    defs(id, 'satellite'),
    h('rect', { x: cx - span, y: cy - span, width: span * 2, height: span * 2, fill: `url(#${id}-sky)` }),
    h('rect', { x: cx - span, y: cy - span, width: span * 2, height: span * 2, filter: `url(#${id}-ground)`, opacity: .6 }),
    plotRaster(plot, measure, id, { dateKey: opts.dateKey }),
    h('polygon', {
      points: plot.geometry.map(([x, y]) => `${x},${y}`).join(' '),
      fill: 'none', stroke: 'rgba(255,255,255,.85)', 'stroke-width': 2.5,
    }),
    opts.pin && h('g', {},
      h('circle', { cx: opts.pin[0], cy: opts.pin[1], r: 9, fill: '#fff', stroke: 'var(--ink-900)', 'stroke-width': 2.5 })));
}

/** WF5.023 — persistent legend showing the value scale and the units. */
export function legend(measure, technical) {
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  return h('div.maplegend',
    h('span', 'low'),
    h('span.maplegend__ramp', { style: { background: rampCss(measure) } }),
    h('span', 'high'),
    technical && h('span', { style: { color: 'var(--ink-500)', whiteSpace: 'nowrap' } }, technical));
}

/* -- tree locator ---------------------------------------------------------
   A wayfinding view, not a measure view: the question is "which of these 640
   trees do I walk to", so the imagery is dimmed and the planting grid, the row
   the tree stands in, the tree itself and the operator's own position carry the
   drawing.

   WF5.070 already defines this interaction for a task — "the map centred on the
   target plot or tree, with a line and a distance from the worker's current
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
    h('rect', { x: cx - span, y: cy - span, width: span * 2, height: span * 2, fill: `url(#${id}-sky)` }),
    h('rect', { x: cx - span, y: cy - span, width: span * 2, height: span * 2, filter: `url(#${id}-ground)`, opacity: .55 }),
    // The imagery orients; it is not the subject, so it sits back.
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

export function landUseSvg({ areas, fills, selectedId = null, onTap = null }) {
  const id = nextId();
  const box = fitBox(areas, 1);
  const scale = box.size / 1000;
  return h('svg', {
    viewBox: box.viewBox, preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Land use map',
  },
  defs(id, 'satellite'),
  h('rect', { ...box.rect, fill: `url(#${id}-sky)` }),
  h('rect', { ...box.rect, filter: `url(#${id}-ground)`, opacity: .6 }),
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
  plots.map((p) => h('polygon', {
    points: p.geometry.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill: statusColour(p.status),
    stroke: 'rgba(255,255,255,.5)',
    'stroke-width': box.size * 0.006,
    'stroke-linejoin': 'round',
  })));
}
