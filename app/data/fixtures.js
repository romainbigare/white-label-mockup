/* ---------------------------------------------------------------------------
   fixtures.js — assembles the working data set.

   The authored JSON files hold the *facts* (which farms, which plots, which
   advice). Everything geometric or time-series is DERIVED here, deterministically
   from the record's id, because a mockup needs 32 plausible plot boundaries and
   sixty days of imagery dates without anyone hand-writing them.

   Deterministic matters: the same plot must draw the same polygon on every
   render and in every screenshot, so the seeded PRNG below is keyed on the id
   and never on Math.random().
   --------------------------------------------------------------------------- */

import farmsRaw from './farms.data.js';
import activityRaw from './activity.data.js';
import contentRaw from './content.data.js';

/* -- deterministic PRNG (mulberry32 over an FNV-1a hash of the id) -------- */

function seedOf(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function rng(key) {
  let a = seedOf(key);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* -- plot geometry -------------------------------------------------------- */
/* Farms get a tidy grid of parcels; each parcel is jittered into an irregular
   polygon so the map reads like real cadastre rather than graph paper.
   Coordinates are in an abstract 0–1000 farm space; the map component maps that
   into its viewBox. Centre-pivot crop plots are drawn as circles instead.

   A TREE GROUP IS NOT ONE PIECE OF GROUND, which is the whole reason it exists
   as a record. A farm's lemon trees are ten behind the animal shed, twenty in
   front of the villa and fifty at the back; the group is what the app advises
   and bills on, and the parcels are where those trees actually stand. So a plot
   carries `patches` — a list of rings — rather than one polygon, and its
   `parcels` count says how many cells of the farm grid it claims.

   The cells a tree group claims are deliberately NOT adjacent: they are picked
   spread across the whole grid, so a group reads on the map as scattered
   planting rather than as one field drawn in three pieces.

   `geometry` stays: it is the largest patch, and it is what everything that
   only ever needed one ring — the label anchor, the planting grid, the plot
   hero image — still uses. Nothing had to learn about patches to keep working;
   only the map, which draws all of them. */

function ringFor(plot, cx, cy, cellW, cellH, r, seedKey) {
  const pivot = plot.kind === 'crops' && rng(`${seedKey}-shape`)() < 0.28;
  const rx = cellW * (0.30 + r() * 0.10);
  const ry = cellH * (0.30 + r() * 0.10);
  if (pivot) {
    const radius = Math.min(rx, ry);
    return {
      shape: 'circle', rx, ry, cx, cy,
      ring: Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
      }),
    };
  }
  const corners = 4 + Math.floor(r() * 3);              // 4–6 sided parcels
  return {
    shape: 'polygon', rx, ry, cx, cy,
    ring: Array.from({ length: corners }, (_, i) => {
      const a = (i / corners) * Math.PI * 2 - Math.PI / 4;
      const wobble = 0.82 + r() * 0.34;
      return [cx + Math.cos(a) * rx * wobble * 1.25, cy + Math.sin(a) * ry * wobble * 1.25];
    }),
  };
}

/* Which grid cells each plot gets. Multi-parcel groups are dealt first and
   take cells spread across the whole pool; everything else fills what is left,
   in order, so a farm of ordinary plots lays out exactly as it always did. */
function dealCells(plots, total) {
  const pool = Array.from({ length: total }, (_, i) => i);
  const claim = new Map();
  for (const plot of plots) {
    const n = plot.parcels ?? 1;
    if (n < 2) continue;
    const taken = [];
    for (let i = 0; i < n; i += 1) {
      const at = Math.min(pool.length - 1, Math.round((i * pool.length) / n));
      taken.push(pool.splice(at, 1)[0]);
    }
    claim.set(plot.id, taken.sort((a, b) => a - b));
  }
  for (const plot of plots) {
    if (claim.has(plot.id)) continue;
    claim.set(plot.id, [pool.shift() ?? 0]);
  }
  return claim;
}

function buildGeometry(farm, plots) {
  const total = plots.reduce((n, p) => n + (p.parcels ?? 1), 0);
  const cols = Math.ceil(Math.sqrt(total * 1.35));
  const rows = Math.ceil(total / cols);
  const cellW = 1000 / cols;
  const cellH = 1000 / rows;
  const cells = dealCells(plots, total);

  plots.forEach((plot) => {
    const r = rng(plot.id);
    const patches = cells.get(plot.id).map((index, i) => {
      const cx = (index % cols) * cellW + cellW / 2;
      const cy = Math.floor(index / cols) * cellH + cellH / 2;
      return ringFor(plot, cx, cy, cellW, cellH, r, `${plot.id}-${i}`);
    });
    // The biggest patch speaks for the group: it carries the label, the hero
    // image and the planting grid, because a centroid averaged over scattered
    // parcels lands in the desert between them.
    const main = patches.reduce((a, b) => (a.rx * a.ry >= b.rx * b.ry ? a : b));
    plot.patches = patches.map((p) => p.ring);
    plot.shape = main.shape;
    plot.geometry = main.ring;
    plot.centroid = [main.cx, main.cy];
    // The planting grid, kept on the plot rather than thrown away, because a
    // tree's row and position have to land on the SAME grid the map draws —
    // otherwise "row 12" points at one place in the list and another on the map.
    plot.grid = plot.treeCount > 0
      ? { cx: main.cx, cy: main.cy, rx: main.rx, ry: main.ry, per: Math.ceil(Math.sqrt(Math.min(plot.treeCount, 90))) }
      : null;
    // Tree points for the tree layer (WF5.062) — spread over every parcel, not
    // just the one the grid is pinned to, or a scattered group would draw as
    // one dense block and two empty outlines.
    plot.treePoints = plot.treeCount > 0
      ? patches.flatMap((patch, i) => treeGrid(
          { cx: patch.cx, cy: patch.cy, rx: patch.rx, ry: patch.ry, per: Math.ceil(Math.sqrt(Math.min(plot.treeCount, 90) / patches.length)) },
          Math.ceil(Math.min(plot.treeCount, 90) / patches.length), rng(`${plot.id}-t${i}`)))
      : [];
  });
}

function treeGrid(grid, count, r) {
  const pts = [];
  for (let row = 1; row <= grid.per && pts.length < count; row += 1) {
    for (let pos = 1; pos <= grid.per && pts.length < count; pos += 1) {
      const [x, y] = gridPoint(grid, row, pos);
      pts.push([x + (r() - 0.5) * 4, y + (r() - 0.5) * 4]);
    }
  }
  return pts;
}

/** Where row R, position P sits inside a plot's planting grid. Deterministic. */
export function gridPoint(grid, row, position) {
  const span = grid.per - 1 || 1;
  const i = (row - 1) % grid.per;
  const j = (position - 1) % grid.per;
  return [
    grid.cx - grid.rx * 0.8 + (i / span) * grid.rx * 1.6,
    grid.cy - grid.ry * 0.8 + (j / span) * grid.ry * 1.6,
  ];
}

/* -- imagery dates, WF5.019 ------------------------------------------------ */
/* Dates with no imagery are SKIPPED by the stepper, so the fixture must have
   genuine gaps — cloud cover in the record, not evenly spaced samples.        */

function buildImageryDates(farm) {
  // A farm added but not yet on the watchlist genuinely has no imagery. The
  // empty list is the honest representation; screens render their empty state
  // rather than inventing a date (WF2.011, WF5.019).
  if (!farm.imageryDate) return [];
  const r = rng(`${farm.id}-imagery`);
  const end = new Date(`${farm.imageryDate}T00:00:00Z`);
  const dates = [];
  let cursor = new Date(end);
  for (let i = 0; i < 30; i += 1) {
    dates.push({
      date: cursor.toISOString().slice(0, 10),
      cloudy: false,
      source: r() > 0.72 ? 'S2 · 3 m' : 'S2 · 10 m',
    });
    const gap = r() > 0.78 ? 8 + Math.floor(r() * 6) : 2 + Math.floor(r() * 4);
    cursor = new Date(cursor.getTime() - gap * 86400000);
  }
  return dates.reverse();               // oldest → newest
}

/* -- measure history, for the trend charts of B4 / B8 --------------------- */

function buildSeries(plot, dates) {
  const series = {};
  if (!dates.length) {
    for (const key of Object.keys(plot.measures)) series[key] = [];
    return series;
  }
  for (const key of Object.keys(plot.measures)) {
    const r = rng(`${plot.id}-${key}`);
    const target = plot.measures[key].value;
    const delta = plot.measures[key].delta;
    let v = Math.max(0.05, target - delta * 6 - r() * 0.1);
    const points = dates.map((d, i) => {
      const seasonal = Math.sin((i / dates.length) * Math.PI * 1.6) * 0.09;
      const drift = ((target - v) / Math.max(1, dates.length - i)) * 1.5;
      v = Math.min(0.95, Math.max(0.04, v + drift + (r() - 0.5) * 0.045 + seasonal * 0.12));
      return { date: d.date, value: Number(v.toFixed(3)) };
    });
    points[points.length - 1].value = target;
    series[key] = points;
  }
  return series;
}

/* Multi-year comparison for B8 / WF5.027 — same calendar weeks, 5 prior years. */
function buildYearComparison(plot) {
  const r = rng(`${plot.id}-years`);
  const base = plot.measures.ndvi.value;
  return [2026, 2025, 2024, 2023, 2022, 2021].map((year, i) => ({
    year,
    points: Array.from({ length: 26 }, (_, w) => ({
      week: w + 1,
      value: Number(Math.max(0.08, Math.min(0.92,
        base + Math.sin((w / 26) * Math.PI) * 0.22 - i * 0.015 + (r() - 0.5) * 0.06)).toFixed(3)),
    })),
  }));
}

/* Advised-vs-applied history, WF5.101 / WF5.131. */
function buildIrrigationRecord(plot) {
  const r = rng(`${plot.id}-irrig`);
  return Array.from({ length: 8 }, (_, i) => {
    const advised = Math.round(180 + r() * 520);
    const skipped = r() > 0.86;
    const applied = skipped ? 0 : Math.round(advised * (0.72 + r() * 0.42));
    return {
      week: `W${24 + i}`,
      dateFrom: new Date(Date.UTC(2026, 5, 8 + i * 7)).toISOString().slice(0, 10),
      advisedM3: advised,
      appliedM3: applied,
      note: skipped ? 'Not applied — pump failure' : null,
    };
  });
}

/* -- assembly ------------------------------------------------------------- */

/* -- where each farm sits in the shared drawing space ----------------------
   Farms sit on a grid so that "all farms" shows them side by side. Farms that
   ADJOIN each other get NO gap: an owner whose holdings share a fence wants to
   see one estate, not two outlines drawn near each other, and that has to be
   true of the geometry rather than of a drawing option laid over it.

   Placing a neighbour by hand means the grid can no longer be computed from the
   index alone — the shifted farm occupies a cell somebody else was going to get
   — so cells are handed out from a pool with the taken ones removed. */

const CELL = 1250;
const FARM_SPAN = 1000;          // every farm draws into a 1000 × 1000 space

function overlaps([ax, ay], [bx, by]) {
  return Math.abs(ax - bx) < FARM_SPAN && Math.abs(ay - by) < FARM_SPAN;
}

function originFor(farm, farms, index) {
  const placed = farms.slice(0, index).filter((f) => f.origin);
  const neighbour = placed.find((f) => (farm.adjoins ?? []).includes(f.id));
  // Immediately to the right of the farm it adjoins, sharing the fence line.
  if (neighbour) return [neighbour.origin[0] + FARM_SPAN, neighbour.origin[1]];

  // Boxes already spoken for: the farms placed so far, plus the cell each of
  // them will push an adjoining farm into. Comparing EXTENTS rather than cell
  // keys is the point — a farm shifted to sit against its neighbour lands
  // between two grid cells and overlaps a farm that "owns" neither of them.
  const busy = [];
  for (const f of placed) {
    busy.push(f.origin);
    if ((f.adjoins ?? []).length) busy.push([f.origin[0] + FARM_SPAN, f.origin[1]]);
  }
  for (let i = 0; i < farms.length * 6; i += 1) {
    const cell = [(i % 2) * CELL, Math.floor(i / 2) * CELL];
    if (!busy.some((b) => overlaps(cell, b))) return cell;
  }
  return [(index % 2) * CELL, Math.floor(index / 2) * CELL];
}

export function loadFixtures() {
  const farms = structuredClone(farmsRaw.farms);
  const plots = structuredClone(farmsRaw.plots);
  const trees = structuredClone(farmsRaw.trees);
  const activity = structuredClone(activityRaw);
  const content = structuredClone(contentRaw);

  farms.forEach((farm, index) => {
    const own = plots.filter((p) => p.farmId === farm.id);
    buildGeometry(farm, own);
    // Farms are laid out on a grid so that "all farms" on the map shows them
    // side by side rather than stacked on top of each other. Geometry is stored
    // already translated; the map fits its viewBox to whatever it is given.
    farm.origin = originFor(farm, farms, index);
    const [originX, originY] = farm.origin;
    for (const plot of own) {
      plot.patches = plot.patches.map((ring) => ring.map(([x, y]) => [x + originX, y + originY]));
      plot.geometry = plot.geometry.map(([x, y]) => [x + originX, y + originY]);
      plot.centroid = [plot.centroid[0] + originX, plot.centroid[1] + originY];
      plot.treePoints = plot.treePoints.map(([x, y]) => [x + originX, y + originY]);
      if (plot.grid) { plot.grid.cx += originX; plot.grid.cy += originY; }
    }
    farm.imageryDates = buildImageryDates(farm);
  });

  // Each tree gets its own point, from its row and position on its plot's
  // planting grid — so B10 can show the operator exactly which tree to walk to.
  for (const tree of trees) {
    const plot = plots.find((p) => p.id === tree.plotId);
    tree.point = plot?.grid ? gridPoint(plot.grid, tree.row, tree.position) : (plot?.centroid ?? [500, 500]);
  }

  for (const plot of plots) {
    const farm = farms.find((f) => f.id === plot.farmId);
    plot.series = buildSeries(plot, farm.imageryDates);
    plot.yearComparison = buildYearComparison(plot);
    plot.irrigationRecord = buildIrrigationRecord(plot);
    plot.cropCycles = buildCropCycles(plot);
  }

  return {
    farms, plots, trees,
    // §5.6 — worker records. People, not accounts.
    workers: structuredClone(farmsRaw.workers ?? []),
    ...activity,
    ...content,
    // Session-scoped collections the user adds to while clicking around.
    photos: [],
    syncQueue: [],
    seenAdvice: new Set(),
  };
}

/* -- crop cycles, §5.4.3 — a first-class record, not a field on the plot -- */

function buildCropCycles(plot) {
  const r = rng(`${plot.id}-cycles`);
  // A TREE GROUP HAS NO CROP CYCLE. Citrus is citrus: there is nothing to sow,
  // nothing to close and nothing to rotate to, and the review that made trees a
  // group rather than a plot took the cycle off them in the same breath. What a
  // tree group has instead is a planting date and a count, both on the record.
  if (plot.kind === 'trees') return [];
  const cycles = [{
    id: `${plot.id}-cyc-1`, plotId: plot.id, state: 'current',
    cropId: plot.cropId, cropName: plot.cropName, variety: plot.variety,
    startDate: '2026-02-12', expectedHarvest: '2026-11-04', actualHarvest: null,
    targetYield: '18 t/ha', actualYield: null,
    notes: '', cutsDone: 4, cutsPlanned: 8, yieldSoFar: '14.2 t',
    nextCut: '2026-08-18',
    // WF5.030 / review C291–C297 — the satellite reads the canopy about thirty
    // days after sowing, and sometimes it disagrees with what the farmer typed.
    // One plot in the fixtures disagrees, so the mismatch state is reachable
    // rather than theoretical. It is a DISAGREEMENT, not a correction: the app
    // shows both answers and the farmer decides which is right.
    detectedCropName: r() < 0.18 ? 'Onion' : null,
  }];
  const history = [
    { crop: 'Wheat', cropId: 'wheat', variety: 'Yecora Rojo', from: '2024-11-05', to: '2025-04-18', yield: '6.1 t/ha' },
    { crop: 'Potato', cropId: 'potato', variety: 'Spunta', from: '2023-09-12', to: '2024-01-26', yield: '32 t/ha' },
    { crop: 'Barley', cropId: 'barley', variety: 'Gusto', from: '2022-11-01', to: '2023-04-02', yield: '4.4 t/ha' },
  ];
  history.forEach((entry, i) => {
    cycles.push({
      id: `${plot.id}-cyc-${i + 2}`, plotId: plot.id, state: 'closed',
      cropId: entry.cropId, cropName: entry.crop, variety: entry.variety,
      startDate: entry.from, expectedHarvest: entry.to, actualHarvest: entry.to,
      targetYield: null, actualYield: entry.yield,
      notes: '', cutsDone: null, cutsPlanned: null, yieldSoFar: null,
    });
  });
  return cycles;
}
