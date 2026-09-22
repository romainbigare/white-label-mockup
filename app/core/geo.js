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

  return {
    bbox,
    scale,
    project,
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
