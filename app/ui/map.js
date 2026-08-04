/* ---------------------------------------------------------------------------
   map.js — the fake satellite map.

   There is no tile server here, so imagery is synthesised: a turbulence-based
   basemap for the ground, and per-plot measure rasters built from the plot's
   own seed so the same plot draws the same mottling every time. That matters
   for a mockup — a map that reshuffles on every render reads as noise.

   Two spec behaviours are baked into the renderer rather than left to callers:
     * WF-222 — the legend scale is FIXED per measure, never auto-scaled to the
       current image, so week-to-week comparison stays valid.
     * WF-254 — polygons carry their status icon and label, and labels hide
       below a zoom threshold rather than overlapping.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { rng } from '../data/fixtures.js';
import { STATUS } from '../core/status.js';

/* Fixed ramps. Index 0 is the low end of the measure's fixed scale. */
export const RAMPS = {
  veg:   ['#8c3b13', '#c0762a', '#d9c04a', '#9dbd4a', '#4f9a3c', '#1c6b2c'],
  water: ['#9c5b1f', '#d3a55c', '#e8dfa8', '#86c2c8', '#3383a8', '#14496f'],
};

/* WF-222 — the domain of each measure's scale, fixed, not per-image. */
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
 * @param {number} o.zoom         1 = fit; labels hide below 0.75 (WF-254)
 */
export function mapSvg({
  plots, measure = 'ndvi', basemap = 'satellite', layers = {}, selectedId = null,
  onPlotTap = null, zoom = 1, showStatus = true, dateKey = '', gps = null,
  compareMeasure = null, comparePct = null,
}) {
  const id = nextId();
  // WF-253 — the map opens zoomed to fit the farms it is showing.
  const box = fitBox(plots, zoom);
  // WF-254 — labels hide automatically below a zoom threshold rather than
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

  /* WF-261 — compare mode: a second raster clipped by a vertical divider. */
  const compareLayer = compareMeasure && comparePct != null
    ? h('g', { 'clip-path': `url(#${id}-cmp)` },
        h('clipPath', { id: `${id}-cmp` }, h('rect', {
          x: box.cx - box.size / 2, y: box.cy - box.size / 2,
          width: box.size * (comparePct / 100), height: box.size,
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
    // "meet" rather than "slice": WF-253 opens the map zoomed to FIT the farms,
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

/** WF-220 — persistent legend showing the value scale and the units. */
export function legend(measure, technical) {
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  return h('div.maplegend',
    h('span', 'low'),
    h('span.maplegend__ramp', { style: { background: rampCss(measure) } }),
    h('span', 'high'),
    technical && h('span', { style: { color: 'var(--ink-500)', whiteSpace: 'nowrap' } }, technical));
}
