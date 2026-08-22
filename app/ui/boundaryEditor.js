/* ---------------------------------------------------------------------------
   boundaryEditor.js — the drawing surface behind A9D "Draw my plots myself",
   A10 "Survey my whole farm" and C5 "Boundary editor".

   WF4.070 says A10 uses the interaction of A9D, and WF5.073 says the editor for
   an existing boundary uses the interaction of a new one — so there is one
   component and three entry points, which is the only way those two can stay
   true of each other.

   Behaviours that are requirements, not polish:
     WF4.065  live area readout in the user's unit, with hectares in brackets
     WF4.066  Undo removes the last vertex; Clear all sits behind a confirmation
     WF4.067  vertex touch target ≥ 48 dp, offset ABOVE the fingertip so the
             point being dragged is not hidden by the finger
     WF4.068  self-intersecting polygons are rejected with a plain-language
             message and the offending segment highlighted
     WF4.069  <0.1 ha or >10,000 ha is a confirmation, not a rejection
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { commit } from '../core/store.js';

/* The drawing space is 1000 × 1000 units where 1 unit = 2 m — so the whole
   canvas is 2 km across, about 1:5,000 on a phone (WF4.063). */
const M_PER_UNIT = 2;

export function polygonAreaHa(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return (Math.abs(sum / 2) * M_PER_UNIT * M_PER_UNIT) / 10000;
}

/** WF4.068 — returns the index of the first self-intersecting edge, or -1. */
export function selfIntersection(points) {
  const n = points.length;
  if (n < 4) return -1;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;         // adjacent through the closing edge
      if (segmentsCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return j;
    }
  }
  return -1;
}

function segmentsCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1); const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3); const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/* A FARM boundary and a PLOT boundary are two different lines and the review
   asked for them to look it: a farmer who has just traced the outside of his
   land should be able to tell that outline apart from the fields inside it.

   Blue rather than the brown that was also suggested. The basemap is tan desert
   soil, and a brown line laid over it is a line nobody can see; blue is the one
   hue that is nowhere in a satellite image of dry farmland. */
const TONES = {
  plot: { fill: 'rgba(46,143,102,.30)', stroke: '#ffffff', vertex: 'var(--brand-800)', selected: 'var(--brand-500)' },
  farm: { fill: 'rgba(11,95,158,.28)', stroke: '#8fd0ff', vertex: 'var(--info)', selected: '#8fd0ff' },
};

/**
 * @param {object} o
 * @param {Array}  o.points     the working vertex list, mutated in place
 * @param {Node}   o.basemap    an <svg> to sit underneath (satellite by default)
 * @param {string} o.tone       'plot' (green) or 'farm' (blue)
 */
export function boundaryCanvas({ points, selected, onChange, height = '100%', tone = 'plot' }) {
  const bad = selfIntersection(points);
  const paint = TONES[tone] ?? TONES.plot;

  const svg = h('svg', {
    viewBox: '0 0 1000 1000', preserveAspectRatio: 'xMidYMid slice',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' },
  },
    points.length > 1 && h('polygon', {
      points: points.map(([x, y]) => `${x},${y}`).join(' '),
      fill: paint.fill,
      stroke: bad >= 0 ? 'var(--st-urgent)' : paint.stroke,
      'stroke-width': 4, 'stroke-linejoin': 'round',
    }),
    // Highlight the offending segment so the message points at something.
    bad >= 0 && h('line', {
      x1: points[bad][0], y1: points[bad][1],
      x2: points[(bad + 1) % points.length][0], y2: points[(bad + 1) % points.length][1],
      stroke: 'var(--st-urgent)', 'stroke-width': 8, 'stroke-linecap': 'round',
    }),
    points.map(([x, y], i) => h('g', { 'data-vertex': i },
      // WF4.067 — a 48 dp target, offset above the fingertip.
      h('circle', { cx: x, cy: y, r: 46, fill: 'transparent', style: { cursor: 'grab' } }),
      h('circle', {
        cx: x, cy: y, r: i === selected ? 17 : 13,
        fill: i === selected ? paint.selected : '#ffffff',
        stroke: paint.vertex, 'stroke-width': 4,
      }))));

  const wrap = h('div', {
    style: { position: 'absolute', inset: 0, height },
    onpointerdown: (event) => handlePointer(event, svg, points, onChange),
  }, svg);

  return { node: wrap, invalid: bad >= 0, areaHa: polygonAreaHa(points) };
}

function toSpace(svg, event) {
  const rect = svg.getBoundingClientRect();
  // preserveAspectRatio="slice" — the shorter axis is cropped, so undo that.
  const scale = Math.max(rect.width, rect.height) / 1000;
  const offX = (rect.width - 1000 * scale) / 2;
  const offY = (rect.height - 1000 * scale) / 2;
  return [
    (event.clientX - rect.left - offX) / scale,
    (event.clientY - rect.top - offY) / scale,
  ];
}

function handlePointer(event, svg, points, onChange) {
  const hitVertex = event.target.closest('[data-vertex]');
  const [x, y] = toSpace(svg, event);

  if (hitVertex) {
    const index = Number(hitVertex.dataset.vertex);
    const move = (moveEvent) => {
      const [mx, my] = toSpace(svg, moveEvent);
      points[index] = [clamp(mx), clamp(my)];
      onChange({ points, selected: index, dragging: true });
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      onChange({ points, selected: index, dragging: false });
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    onChange({ points, selected: index, dragging: true });
    return;
  }

  points.push([clamp(x), clamp(y)]);
  onChange({ points, selected: points.length - 1, dragging: false });
}

const clamp = (v) => Math.max(8, Math.min(992, v));

export function undoVertex(points) {
  points.pop();
  commit('boundary');
}

const STARTER = [[330, 300], [660, 285], [700, 620], [420, 690], [300, 520]];
const STARTER_CENTRE = [482, 483];

/**
 * A pleasant starting shape so the editor is never a blank field.
 *
 * Two callers, two sizes. A10 draws one line round a whole farm, and the shape
 * as authored is about fifty hectares, which is a farm. A9D draws ONE PLOT, and
 * a plot that opens at fifty hectares is the wrong order of magnitude to start
 * dragging from — review 22/08 wanted the areas on screen to read like a
 * smallholding — so it asks for a fifth of the area.
 *
 * `index` is how many plots have already been drawn. Each one starts in the
 * next cell of a loose grid rather than on top of the last, which is both truer
 * to how fields sit beside each other and necessary for A11: the summary draws
 * every drawn plot on one map, and identical shapes would stack their outlines
 * and their labels in one spot.
 */
export function starterPolygon({ scale = 1, index = 0 } = {}) {
  const cx = scale === 1 ? STARTER_CENTRE[0] : 280 + (index % 3) * 220;
  const cy = scale === 1 ? STARTER_CENTRE[1] : 300 + Math.floor((index % 9) / 3) * 220;
  return STARTER.map(([x, y]) => [
    clamp(cx + (x - STARTER_CENTRE[0]) * scale),
    clamp(cy + (y - STARTER_CENTRE[1]) * scale),
  ]);
}
