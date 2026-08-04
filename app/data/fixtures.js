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
   into its viewBox. Centre-pivot crop plots are drawn as circles instead.      */

function buildGeometry(farm, plots) {
  const cols = Math.ceil(Math.sqrt(plots.length * 1.35));
  const rows = Math.ceil(plots.length / cols);
  const cellW = 1000 / cols;
  const cellH = 1000 / rows;

  plots.forEach((plot, index) => {
    const r = rng(plot.id);
    const cx = (index % cols) * cellW + cellW / 2;
    const cy = Math.floor(index / cols) * cellH + cellH / 2;
    const pivot = farm.irrigation === 'Centre pivot' && plot.treeCount === 0;
    const rx = cellW * (0.30 + r() * 0.10);
    const ry = cellH * (0.30 + r() * 0.10);

    if (pivot) {
      const radius = Math.min(rx, ry);
      plot.shape = 'circle';
      plot.geometry = Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
      });
    } else {
      const corners = 4 + Math.floor(r() * 3);          // 4–6 sided parcels
      plot.shape = 'polygon';
      plot.geometry = Array.from({ length: corners }, (_, i) => {
        const a = (i / corners) * Math.PI * 2 - Math.PI / 4;
        const wobble = 0.82 + r() * 0.34;
        return [cx + Math.cos(a) * rx * wobble * 1.25, cy + Math.sin(a) * ry * wobble * 1.25];
      });
    }
    plot.centroid = [cx, cy];
    // The planting grid, kept on the plot rather than thrown away, because a
    // tree's row and position have to land on the SAME grid the map draws —
    // otherwise "row 12" points at one place in the list and another on the map.
    plot.grid = plot.treeCount > 0
      ? { cx, cy, rx, ry, per: Math.ceil(Math.sqrt(Math.min(plot.treeCount, 90))) }
      : null;
    // Tree points for the tree layer (WF-256).
    plot.treePoints = plot.grid ? treeGrid(plot.grid, Math.min(plot.treeCount, 90), rng(`${plot.id}-t`)) : [];
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

/* -- imagery dates, WF-216 ------------------------------------------------ */
/* Dates with no imagery are SKIPPED by the stepper, so the fixture must have
   genuine gaps — cloud cover in the record, not evenly spaced samples.        */

function buildImageryDates(farm) {
  // A farm added but not yet on the watchlist genuinely has no imagery. The
  // empty list is the honest representation; screens render their empty state
  // rather than inventing a date (WF-011, WF-216).
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

/* Multi-year comparison for B8 / WF-224 — same calendar weeks, 5 prior years. */
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

/* Advised-vs-applied history, WF-292 / WF-319. */
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
    const originX = (index % 2) * 1250;
    const originY = Math.floor(index / 2) * 1250;
    farm.origin = [originX, originY];
    for (const plot of own) {
      plot.geometry = plot.geometry.map(([x, y]) => [x + originX, y + originY]);
      plot.centroid = [plot.centroid[0] + originX, plot.centroid[1] + originY];
      plot.treePoints = plot.treePoints.map(([x, y]) => [x + originX, y + originY]);
      if (plot.grid) { plot.grid.cx += originX; plot.grid.cy += originY; }
    }
    farm.imageryDates = buildImageryDates(farm);
    farm.blocks = farm.blocks || [];
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
  const isTree = plot.treeCount > 0;
  if (isTree) {
    // A perennial orchard has one long-running cycle, opened at planting.
    return [{
      id: `${plot.id}-cyc-1`, plotId: plot.id, state: 'current',
      cropId: plot.cropId, cropName: plot.cropName, variety: plot.variety,
      startDate: plot.plantedOn, expectedHarvest: '2026-09-15', actualHarvest: null,
      targetYield: `${(28 + r() * 12).toFixed(0)} kg/tree`, actualYield: null,
      irrigation: plot.irrigation, notes: 'Perennial planting. Season records are kept per harvest.',
      cutsDone: null, cutsPlanned: null, yieldSoFar: null,
    }];
  }
  const cycles = [{
    id: `${plot.id}-cyc-1`, plotId: plot.id, state: 'current',
    cropId: plot.cropId, cropName: plot.cropName, variety: plot.variety,
    startDate: '2026-02-12', expectedHarvest: '2026-11-04', actualHarvest: null,
    targetYield: '18 t/ha', actualYield: null, irrigation: plot.irrigation,
    notes: '', cutsDone: 4, cutsPlanned: 8, yieldSoFar: '14.2 t',
    nextCut: '2026-08-18',
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
      targetYield: null, actualYield: entry.yield, irrigation: plot.irrigation,
      notes: '', cutsDone: null, cutsPlanned: null, yieldSoFar: null,
    });
  });
  return cycles;
}
