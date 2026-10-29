/* ---------------------------------------------------------------------------
   geo.js — where farm space is on Earth.

   THE APP DRAWS IN "FARM SPACE": an abstract 0–1000 box per farm, translated
   onto a tidy grid by `farm.origin` so that "all farms" shows them side by side
   rather than stacked. Every map, the boundary editor, the tree layer and the
   label scaling all work in those units and none of them knows what a metre is.

   That was fine while the shapes were invented. Review 22/09 committed the real
   thing — 500 ADAFSA farm boundaries and 2,425 crop parcels across Abu Dhabi
   emirate, in `app/data/geo/*.js`, as GeoJSON in Web Mercator (EPSG:3857) — and
   asked for the mockup to be drawn on real ground under real satellite imagery.

   THIS MODULE IS THE ONLY PLACE THAT KNOWS BOTH COORDINATE SYSTEMS, and it is
   deliberately small: three conversions and one fitting function. Everything
   downstream keeps working in 0–1000 because `farmSpace()` hands back a
   projection into exactly that.

   WHY EACH FARM KEEPS ITS OWN BOX rather than the app moving wholesale into
   real coordinates. The six farms are up to 450 km apart. At a scale where one
   of them fills 1000 units, the emirate is three quarters of a million units
   across — mathematically fine, and it would turn C1's "all farms" into a dot
   map and blow up `labelScale`, which is `box.size / 1000`. The farms stay on
   their grid, and what changed is only what is INSIDE each box: a real outline
   and real parcels instead of generated rectangles, under imagery of that exact
   patch of ground. The app never claimed the grid was geography — there is no
   scale bar anywhere in it — and each cell of it is now true.
   --------------------------------------------------------------------------- */

/** Equatorial radius, which is the only radius Web Mercator has. */
export const EARTH_R = 6378137;

/** The scale the mockup DRAWS at: one unit of farm space is two metres. The
    boundary editor measures a drawn field's area with it, the tree locator
    sizes its scale bar with it, and the farm outline's margin and the
    kilometre between fields are counted with it — so the hectares a farmer
    reads and the gap he is told about agree. The real app draws on a real map
    in {lat, lon} and has no such constant. */
export const FARM_UNIT_M = 2;

/** WGS84 lon/lat (degrees) → Web Mercator metres. */
export function toMercator([lon, lat]) {
  return [
    (lon * Math.PI) / 180 * EARTH_R,
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * EARTH_R,
  ];
}

/** Web Mercator metres → WGS84 lon/lat (degrees). */
export function toLonLat([x, y]) {
  return [
    (x / EARTH_R) * 180 / Math.PI,
    (2 * Math.atan(Math.exp(y / EARTH_R)) - Math.PI / 2) * 180 / Math.PI,
  ];
}

/**
 * The bounding box of a GeoJSON Polygon or MultiPolygon's coordinates.
 *
 * Written as an explicit walk rather than a flat().reduce(): a farm's parcels
 * run to a few thousand points between them, and the spread form of Math.min
 * blows the stack on a list that long — the same trap map.js already carries a
 * note about.
 *
 * @returns {[number, number, number, number]} [minX, minY, maxX, maxY]
 */
export function bboxOf(geometry) {
  let minX = Infinity; let minY = Infinity;
  let maxX = -Infinity; let maxY = -Infinity;
  for (const ring of ringsOfGeometry(geometry)) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

/** Every outer ring of a Polygon or MultiPolygon, holes dropped.

    The holes are dropped on purpose. A farm boundary in this dataset is a
    simple enclosure; where a MultiPolygon carries a second ring it is a second
    PARCEL of the same holding, not a lake in the middle of the first. Treating
    them as outer rings is what makes a scattered holding draw as the several
    pieces it is — which is exactly the shape `plot.patches` already expects. */
export function ringsOfGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly[0]);
  return [];
}

/** The union bbox of several geometries. */
export function bboxOfAll(geometries) {
  const boxes = geometries.map(bboxOf).filter((b) => Number.isFinite(b[0]));
  if (!boxes.length) return null;
  return [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3])),
  ];
}

/* -- the fitting ----------------------------------------------------------- */

/**
 * A projection from Web Mercator metres into one farm's 0–1000 box.
 *
 * ONE SCALE FOR BOTH AXES, always. Fitting width and height independently would
 * stretch the farm to fill the box, and a field that is twice as long as it is
 * wide would come out square — on top of satellite imagery that is not, which
 * is the one distortion a viewer can actually see. The shorter side is centred
 * in the leftover room instead.
 *
 * AND Y FLIPS. Mercator counts north, SVG counts down the screen. This is the
 * single place that sign lives; get it wrong and every farm in the app is
 * mirrored against its own photograph, which is not a thing anybody notices
 * from a screenshot until they try to find a shed.
 *
 * `pad` is the share of the box left as margin, so a boundary does not sit on
 * the edge of its own imagery.
 *
 * @param {[number,number,number,number]} bbox in Mercator metres
 * @param {{ span?: number, pad?: number }} [opts]
 */
export function farmSpace(bbox, { span = 1000, pad = 0.06 } = {}) {
  const [minX, minY, maxX, maxY] = bbox;
  const wide = Math.max(maxX - minX, 1);
  const tall = Math.max(maxY - minY, 1);
  const inner = span * (1 - pad * 2);
  const scale = inner / Math.max(wide, tall);

  // Where the fitted shape starts, so the leftover room is split evenly.
  const offX = (span - wide * scale) / 2;
  const offY = (span - tall * scale) / 2;

  const project = ([x, y]) => [
    offX + (x - minX) * scale,
    // The flip: the northern edge of the bbox is the TOP of the box.
    offY + (maxY - y) * scale,
  ];
  /* And back: farm space to Mercator metres. C1's live map (app/ui/livemap.js)
     needs it to lay the app's drawing on real tiles; nothing else does. */
  const unproject = ([u, v]) => [
    minX + (u - offX) / scale,
    maxY - (v - offY) / scale,
  ];

  return {
    bbox,
    scale,
    project,
    unproject,
    /** Metres per farm-space unit — what a caller needs to size imagery. */
    metresPerUnit: 1 / scale,
    /** The Mercator box the whole 0–1000 square covers, imagery included. */
    coverBbox: [
      minX - offX / scale,
      maxY + offY / scale - span / scale,
      minX + (span - offX) / scale,
      maxY + offY / scale,
    ],
    project_ring: (ring) => ring.map(project),
  };
}

/* -- areas ----------------------------------------------------------------- */

/** Signed area of a ring, in the units the ring is in (Mercator m²). */
export function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum) / 2;
}

/** A ring without its closing repeat.

    GeoJSON closes a ring by repeating the first point at the end, and anything
    that walks a ring by index has to know that or it double-counts a corner.
    It is what made A14's starter a triangle: sampling six of eight points hit
    index 0 and index 7, which are the same place. */
export function openRing(ring) {
  if (ring.length > 1
    && ring[0][0] === ring[ring.length - 1][0]
    && ring[0][1] === ring[ring.length - 1][1]) return ring.slice(0, -1);
  return ring.map((p) => p);
}

/**
 * Reduce a ring to `keep` corners, dropping the ones that matter least.
 *
 * Visvalingam–Whyatt: the significance of a vertex is the area of the triangle
 * it makes with its two neighbours, and the least significant one goes, over
 * and over, until `keep` remain. Recomputing the two neighbours each round is
 * what makes it follow the shape rather than the index.
 *
 * SAMPLING EVERY NTH VERTEX IS WHAT THIS REPLACES, and the difference is the
 * whole point. A surveyed farm boundary is a quadrilateral with a handful of
 * extra vertices bunched along one edge — farm-1 carries four within fifty
 * metres of each other down its eastern side — so every-nth returned three
 * points off that one edge and lost two of the four real corners. Area-based
 * simplification keeps the corners and drops the bunching, which is what a
 * person tracing the same field by hand would do.
 */
export function simplifyRing(ring, keep = 6, minShare = 0.006) {
  const pts = openRing(ring).map((p) => [...p]);
  if (keep < 3) return pts;

  const area = (a, b, c) => Math.abs(
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]),
  ) / 2;
  /* `minShare` is what stops the count alone deciding. Asked for six corners a
     ring of seven gives up its smallest and stops — even when the one it kept
     sits two units off a straight edge, which draws as a vertex handle on top
     of another one and reads as a broken tool. Below this share of the ring's
     own area a vertex is noise in the survey rather than a corner of the field,
     and it goes whether or not the count is satisfied. */
  const floor = (ringArea(pts) || 1) * minShare;

  while (pts.length > 3) {
    let worst = 0;
    let worstArea = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const c = pts[(i + 1) % pts.length];
      const v = area(a, pts[i], c);
      if (v < worstArea) { worstArea = v; worst = i; }
    }
    if (pts.length <= keep && worstArea >= floor) break;
    pts.splice(worst, 1);
  }
  return pts;
}

/**
 * Whether a point is inside a ring. Used to keep the tree layer on the field:
 * the planting grid is laid out across a parcel's bounding box, and a real
 * parcel is not a rectangle, so without this the palms of an L-shaped block
 * stand in the sand beside it.
 */
export function pointInRing([px, py], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* -- the farm outline, from the fields (Oct 2026) -------------------------

   THERE IS NO FARM BOUNDARY FOR THE FARMER TO DRAW. Wafra's final answer to
   MMC: the farmer draws his fields, and the app works the farm's outline out
   from them — the shape round all of them (their convex hull) pushed out by
   a 20 m margin — and saves it as the farm's `boundary`, with the fields,
   under one version number. MMC measures inside the fields only and the price
   is the fields only; the outline is the farm's place on the map and the
   ground the satellite is asked to look at.

   AND ONE FARM IS ONE PLACE. Fields more than a kilometre from the rest are a
   second farm, and the app says so and saves nothing. "More than a kilometre
   apart" is read the way a farmer would draw it: fields hold together when
   each is within 1 km of another field of the group, so a row of fields 600 m
   apart is one farm, and only a group with a gap of more than 1 km round it
   is told to become a farm of its own.

   Everything here works in PLANAR METRES ([x, y]), so it can be tested with
   plain numbers. toLocalMetres() turns the {lat, lon} points the server
   stores into metres round their own middle and back; the mockup, which draws
   in farm space, scales by its drawing's metres per unit instead
   (data/actions.js). A round field arrives here as the ring of points it is
   stored as. */

/** The margin round the fields, in metres. */
export const OUTLINE_MARGIN_M = 20;
/** The widest gap between fields that still makes one farm, in metres. */
export const MAX_FIELD_GAP_M = 1000;

/** Twice the signed area: positive when the ring turns anticlockwise in its
    own axes. */
function twiceSigned(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/** The convex hull of a cloud of points (monotone chain), anticlockwise in
    the points' own axes, with no repeated closing point. Collinear points are
    dropped. */
export function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts.map((p) => [...p]);
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
  return [...half(pts), ...half([...pts].reverse())].map((p) => [...p]);
}

/**
 * A convex ring pushed out by `margin` on every side: the ring grown by a disc
 * of that radius, so the corners come out round (one point every `step`
 * radians of arc). A single point becomes a circle, two a stadium.
 */
export function bufferConvex(hull, margin, step = Math.PI / 8) {
  if (!hull.length) return [];
  if (hull.length === 1) {
    const [[x, y]] = hull;
    const n = Math.max(8, Math.ceil((2 * Math.PI) / step));
    return Array.from({ length: n }, (_, i) => [
      x + margin * Math.cos((2 * Math.PI * i) / n), y + margin * Math.sin((2 * Math.PI * i) / n)]);
  }
  const ring = hull.length > 2 && twiceSigned(hull) < 0 ? [...hull].reverse() : hull;
  // The outward normal of an anticlockwise edge p → q is its direction turned
  // a quarter to the right.
  const normalAngle = (p, q) => Math.atan2(-(q[0] - p[0]), q[1] - p[1]);
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const v = ring[i];
    const next = ring[(i + 1) % ring.length];
    const from = normalAngle(prev, v);
    let sweep = normalAngle(v, next) - from;
    while (sweep < 0) sweep += 2 * Math.PI;
    const steps = Math.max(1, Math.ceil(sweep / step));
    for (let k = 0; k <= steps; k += 1) {
      const a = from + (sweep * k) / steps;
      out.push([v[0] + margin * Math.cos(a), v[1] + margin * Math.sin(a)]);
    }
  }
  return out;
}

/** The shortest distance from a point to a segment. */
function pointSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
}

/** Whether two segments cross or touch. Two segments on one line meet only
    where they overlap, which is what the box test on the last line says. */
function segmentsMeet(a, b, c, d) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const [s1, s2, s3, s4] = [side(a, b, c), side(a, b, d), side(c, d, a), side(c, d, b)];
  if (s1 || s2 || s3 || s4) return s1 * s2 <= 0 && s3 * s4 <= 0;
  const overlap = (i) => Math.max(Math.min(a[i], b[i]), Math.min(c[i], d[i]))
    <= Math.min(Math.max(a[i], b[i]), Math.max(c[i], d[i]));
  return overlap(0) && overlap(1);
}

/** The gap between two fields: 0 when they touch, overlap or one holds the
    other, and otherwise the shortest distance between their edges. */
export function ringGap(a, b) {
  const ra = openRing(a);
  const rb = openRing(b);
  if (!ra.length || !rb.length) return Infinity;
  if (pointInRing(ra[0], rb) || pointInRing(rb[0], ra)) return 0;
  let best = Infinity;
  for (let i = 0; i < ra.length; i += 1) {
    const a1 = ra[i];
    const a2 = ra[(i + 1) % ra.length];
    for (let j = 0; j < rb.length; j += 1) {
      const b1 = rb[j];
      const b2 = rb[(j + 1) % rb.length];
      if (segmentsMeet(a1, a2, b1, b2)) return 0;
      best = Math.min(best, pointSegment(a1, b1, b2), pointSegment(a2, b1, b2),
        pointSegment(b1, a1, a2), pointSegment(b2, a1, a2));
    }
  }
  return best;
}

/** The fields that hold together, as groups of indices: two fields are in one
    group when a chain of fields, each within `maxGap` of the next, joins them. */
export function fieldGroups(rings, maxGap = MAX_FIELD_GAP_M) {
  const parent = rings.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < rings.length; i += 1) {
    for (let j = i + 1; j < rings.length; j += 1) {
      if (root(i) !== root(j) && ringGap(rings[i], rings[j]) <= maxGap) parent[root(j)] = root(i);
    }
  }
  const groups = new Map();
  rings.forEach((_, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), i]));
  return [...groups.values()];
}

/**
 * The farm's outline from its fields, every ring in metres.
 *
 * @returns {{ ring: number[][], groups: number[][], apart: boolean }}
 *   `apart` is true when the fields are more than `maxGap` apart — two farms,
 *   not one; the outline is still worked out, but it must not be saved.
 */
export function farmOutline(rings, { margin = OUTLINE_MARGIN_M, maxGap = MAX_FIELD_GAP_M } = {}) {
  const groups = fieldGroups(rings, maxGap);
  const hull = convexHull(rings.flatMap((r) => openRing(r)));
  return { ring: hull.length ? bufferConvex(hull, margin) : [], groups, apart: groups.length > 1 };
}

/* -- {lat, lon} points, as the server stores them ------------------------- */

/** Mean Earth radius, for distances on the ground. */
const GROUND_R = 6371008.8;

/**
 * Points in degrees, as metres round their own middle (an equirectangular
 * projection, true to well under a metre across a farm), and the way back.
 *
 * @param {{lat: number, lon: number}[]} points
 */
export function toLocalMetres(points) {
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / (points.length || 1);
  const lon0 = points.reduce((s, p) => s + p.lon, 0) / (points.length || 1);
  const k = (Math.PI / 180) * GROUND_R;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return {
    project: ({ lat, lon }) => [(lon - lon0) * k * cos, (lat - lat0) * k],
    unproject: ([x, y]) => ({ lat: lat0 + y / k, lon: lon0 + x / (k * cos) }),
  };
}

/** farmOutline() for fields stored as {lat, lon} points: the outline comes
    back as {lat, lon} points too. */
export function farmOutlineLatLon(fields, opts) {
  const frame = toLocalMetres(fields.flatMap((f) => f.points));
  const out = farmOutline(fields.map((f) => f.points.map(frame.project)), opts);
  return { ...out, points: out.ring.map(frame.unproject) };
}
