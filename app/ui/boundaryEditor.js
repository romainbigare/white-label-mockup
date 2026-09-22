/* ---------------------------------------------------------------------------
   boundaryEditor.js — the drawing surface behind B9 "Draw my plots myself",
   A13 "Survey my whole farm" and C5 "Boundary editor".

   WF4.070 says A13 uses the interaction of B9, and WF5.073 says the editor for
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
import { state } from '../core/store.js';

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
/* THE FRAME IS THE SAME SQUARE THE MAP UNDERNEATH IS SHOWING.

   It used to be hard-coded to 0–1000, which is one farm's box — and every farm
   but the first sits somewhere else on the farm grid (farm-3's origin is
   [1000, 0]). Editing a plot on any of them put the outline entirely off the
   canvas; it only ever looked right because the screens that use this are
   first-run screens, and first-run is farm-1, which is at the origin.

   Passing the frame in is also what keeps the trace ON the photograph: mapSvg
   takes the same box through `cover` and fits it the same way, so a point here
   is the same pixel there. */
export function boundaryCanvas({
  points, selected, onChange, height = '100%', tone = 'plot',
  frame = [0, 0, 1000, 1000],
}) {
  const bad = selfIntersection(points);
  const paint = TONES[tone] ?? TONES.plot;

  /* "MEET", NOT "SLICE", SINCE THE GROUND BECAME A PHOTOGRAPH. The canvas used
     to fill its box by cropping, which on a phone showed only the middle 630 of
     the 1000 units — fine for an authored hexagon drawn to sit in that band,
     and wrong for a trace of a real holding that spans nine hundred of them.
     The map underneath fits the same square the same way (see `cover` in
     mapSvg), so a point here is the same pixel there. */
  const svg = h('svg', {
    viewBox: frame.join(' '), preserveAspectRatio: 'xMidYMid meet',
    'data-frame': frame.join(' '),
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
    onpointerdown: (event) => handlePointer(event, svg, points, onChange, frame),
  }, svg);

  return { node: wrap, invalid: bad >= 0, areaHa: polygonAreaHa(points) };
}

function toSpace(svg, event, frame) {
  const [fx, fy, fw, fh] = frame;
  const rect = svg.getBoundingClientRect();
  // preserveAspectRatio="meet" — the longer axis is letterboxed, so undo that.
  const scale = Math.min(rect.width / fw, rect.height / fh);
  const offX = (rect.width - fw * scale) / 2;
  const offY = (rect.height - fh * scale) / 2;
  return [
    fx + (event.clientX - rect.left - offX) / scale,
    fy + (event.clientY - rect.top - offY) / scale,
  ];
}

function handlePointer(event, svg, points, onChange, frame = [0, 0, 1000, 1000]) {
  const hitVertex = event.target.closest('[data-vertex]');
  const [x, y] = toSpace(svg, event, frame);
  const hold = (v, axis) => clampTo(v, frame[axis], frame[axis + 2]);

  if (hitVertex) {
    const index = Number(hitVertex.dataset.vertex);
    const move = (moveEvent) => {
      const [mx, my] = toSpace(svg, moveEvent, frame);
      points[index] = [hold(mx, 0), hold(my, 1)];
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

  points.push([hold(x, 0), hold(y, 1)]);
  onChange({ points, selected: points.length - 1, dragging: false });
}

/* A corner stays a few units inside its frame, so a vertex handle is never half
   off the canvas and a polygon never has a side exactly on the edge. */
const clampTo = (v, origin, span) => Math.max(origin + span * 0.008, Math.min(origin + span * 0.992, v));
const clamp = (v) => clampTo(v, 0, 1000);

export function undoVertex(points) {
  points.pop();
  commit('boundary');
}

/* SIX CORNERS, AND NONE OF THEM REGULAR — and this is the second time this
   shape has changed hands.

   The v1.5.4 review made it a rectangle: fields here are laid out in rectangles,
   and a five-cornered starter was teaching the farmer to trace an irregular one.
   The 01/09 review reversed that on both A13 and B9, and gave the reason the
   rectangle could not answer — a four-cornered box teaches the farmer that four
   corners is what the tool expects, and most farm boundaries are not boxes:
   "the example provided to the user should have a minimum of five corners. This
   will tell him that he is not limited to a perfect square."

   It also ruled out the obvious way to satisfy that — "the shape should not be
   a perfect pentagon" — because a regular polygon teaches its own wrong lesson,
   that corners come evenly spaced. So the shape below is six corners at
   irregular intervals: a rectangle with one side stepped in and one corner cut,
   which is what a field bounded by a track and a neighbour actually looks like.
   Every corner still drags, and Undo still takes them off one at a time. */
const STARTER = [[300, 290], [690, 300], [700, 520], [560, 560], [575, 690], [300, 670]];
const STARTER_CENTRE = [521, 505];

/* -- and where it is drawn, since the ground became real --------------------

   Review 22/09, second pass: "for 'draw your plot' and 'draw your farm', can
   you align the placeholder shape to the actual farm location and outline?"

   Which the photograph made necessary. While the basemap was invented, an
   authored hexagon could sit anywhere on it and look like a farm; over a
   picture of a real holding it sat across a road and two neighbours, and the
   first thing the screen said was that the app did not know where the farm was.

   THE STARTER IS STILL A ROUGH TRACE, NOT A DETECTED BOUNDARY. Review 21/09
   ruled out pre-drawing the outline for the farmer — "let's not over-automate
   this for now" — and that rule is about the app claiming to have found the
   answer. So the shape below is the real outline SIMPLIFIED to six or so
   corners and pulled in from the edge: it lands on the right field, and it is
   visibly not the field's actual line, which is the difference between a
   starting point and a claim. Every corner still drags and Undo still takes
   them off one at a time.

   `ANCHOR` is the farm the first-run screens are looking at — the same one A13
   centres its pin on and A14 draws over. */
const ANCHOR = 'farm-1';

const anchorFarm = () => (state.db?.farms ?? []).find((f) => f.id === ANCHOR);

/** Back out of the farm grid into the plain 0–1000 canvas both editors use. */
const localise = (ring, origin) => ring.map(([x, y]) => [x - origin[0], y - origin[1]]);

/* Keep every nth corner, so a fifty-point cadastral ring becomes something a
   person could have tapped out. The first and last are always kept, which is
   what stops a simplified ring from losing the corner that makes it that farm
   rather than a rectangle. */
function roughen(ring, corners = 6) {
  if (ring.length <= corners) return ring.map((p) => [...p]);
  const step = ring.length / corners;
  return Array.from({ length: corners }, (_, i) => [...ring[Math.round(i * step) % ring.length]]);
}

/** Pull a ring in towards its own centre, so it reads as inside the field. */
function shrinkTo(ring, factor) {
  const cx = ring.reduce((n, [x]) => n + x, 0) / ring.length;
  const cy = ring.reduce((n, [, y]) => n + y, 0) / ring.length;
  return ring.map(([x, y]) => [clamp(cx + (x - cx) * factor), clamp(cy + (y - cy) * factor)]);
}

/* The fraction of the authored shape one PLOT opens at.

   Review 01/09 — "the plot example seems small compared to the map area". It
   was two fifths of the farm shape, which put a 160-unit field in the middle of
   a 1000-unit map and left the farmer looking at a stamp on a desert. At 0.55
   it covers about a quarter of the frame and still reads as one field of about
   sixteen hectares rather than as a holding. */
export const PLOT_SCALE = 0.55;

/**
 * A pleasant starting shape so the editor is never a blank field.
 *
 * Two callers, two sizes. A13 draws one line round a whole farm, and the shape
 * as authored is about fifty hectares, which is a farm. B9 draws ONE PLOT, and
 * a plot that opens at fifty hectares is the wrong order of magnitude to start
 * dragging from — review 22/08 wanted the areas on screen to read like a
 * smallholding — so it asks for PLOT_SCALE of it.
 *
 * `index` is how many plots have already been drawn. Each one starts in the
 * next cell of a loose grid rather than on top of the last, which is both truer
 * to how fields sit beside each other and necessary for A16: the summary draws
 * every drawn plot on one map, and identical shapes would stack their outlines
 * and their labels in one spot.
 */
export function starterPolygon({ scale = 1, index = 0 } = {}) {
  const farm = anchorFarm();
  if (farm?.boundary?.length >= 3) {
    const origin = farm.origin ?? [0, 0];
    /* A WHOLE FARM (scale 1) traces the holding; a PLOT takes one of the
       holding's own parcels. Both are what the farmer is looking at through the
       photograph, which is the whole point of aligning them. `index` walks the
       parcels so a second plot does not open on top of the first — the same job
       the grid of cells did, done with real fields. */
      const source = scale === 1
        ? farm.boundary
        : (farm.parcels ?? []).map((p) => p.ring)[index % Math.max(1, (farm.parcels ?? []).length)];
    if (source?.length >= 3) {
      // 0.88 for a farm and 0.8 for a plot: enough daylight between the trace
      // and the real edge to read as a first attempt, not enough to land the
      // shape on the neighbour.
      return shrinkTo(roughen(localise(source, origin), scale === 1 ? 6 : 5), scale === 1 ? 0.88 : 0.8);
    }
  }

  /* NO FARM TO ALIGN TO — a farm added inside the app, or fixtures that never
     loaded. The authored hexagon then, laid out as it always was.

     THE GRID IS INSIDE THE FRAME, which it was not once the shape grew.
     The canvas is a 1000-unit square shown with `slice`, so on a phone the
     LEFT AND RIGHT of it are cropped and only about 194–806 is ever visible.
     The first cell used to sit at 280, which was inside the frame for a plot
     two fifths of the authored size and half outside it at PLOT_SCALE. The row
     starts further in and lower, which also clears the search bar overlaying
     the top of the map. */
  const cx = scale === 1 ? STARTER_CENTRE[0] : 330 + (index % 3) * 180;
  const cy = scale === 1 ? STARTER_CENTRE[1] : 420 + Math.floor((index % 9) / 3) * 200;
  return STARTER.map(([x, y]) => [
    clamp(cx + (x - STARTER_CENTRE[0]) * scale),
    clamp(cy + (y - STARTER_CENTRE[1]) * scale),
  ]);
}
