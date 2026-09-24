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
import { scoreFromValue, statusFromScore, overallHealthScore } from '../core/health.js';
import { farmSpace, bboxOf, pointInRing } from '../core/geo.js';
import SELECTED_GEO from './geo/selected.data.js';

/* The block the six real holdings sit in, in Web Mercator metres. Every one of
   them projects through this, so "all farms" is one piece of ground. */
const CLUSTER_SPACE = SELECTED_GEO.cluster.bbox;

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
/* Farms get a tidy grid of parcels. Coordinates are in an abstract 0–1000 farm
   space; the map component maps that into its viewBox.

   EVERY PARCEL IS A RECTANGLE, on the review's instruction and against the
   evidence of the fixtures it replaced. Those drew wobbling five- and six-sided
   blobs, with a quarter of the open-field plots as centre-pivot circles, on the
   argument that real cadastre is irregular — and the review's answer, from
   somebody who has walked these farms, is that it is not: an Abu Dhabi holding
   is laid out in rectangles, and the wobble was making a satellite mockup look
   like a hand drawing. Parcels still differ in size and proportion, because
   fields do.

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

function ringFor(plot, cx, cy, cellW, cellH, r) {
  // Half-extents, varied per parcel so a farm is not a sheet of graph paper:
  // some fields are wide and shallow, some nearly square, none identical.
  // Fields nearly fill their cell, with a track's width between them. The
  // variation is what stops a farm reading as graph paper: some parcels are
  // broad and shallow, some almost square, none identical.
  const rx = cellW * (0.34 + r() * 0.10);
  const ry = cellH * (0.30 + r() * 0.14);
  return {
    shape: 'rect', rx, ry, cx, cy,
    ring: [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]],
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

/* WHERE A FARM'S PATCHES COME FROM, and there are two answers since review
   22/09 committed the real geometry.

   A farm named in app/data/geo/selected.data.js is drawn on the ADAFSA holding
   it was matched to: its own boundary, its own parcels, under a photograph of
   that exact ground. Everything else — the six mockup farms' names, crops,
   health, prices, weather and advice — is still ours, which is what the review
   asked for: "reuse our mockup names, reuse all our placeholder data, but use
   real outline location in the world".

   A farm NOT in that file keeps the generated grid below. That path is not
   legacy: it is what A13 builds when a farmer draws his own boundary, and every
   farm added inside the app goes through it.

   BOTH PATHS HAND BACK THE SAME SHAPE — { shape, cx, cy, rx, ry, ring } per
   patch — so everything after this point is written once. cx/cy/rx/ry are the
   patch's bounding box, which is all the planting grid and the label anchor
   ever wanted from a rectangle. */
function buildGeometry(farm, plots) {
  const real = SELECTED_GEO[farm.id];
  const patchesByPlot = real ? realPatches(farm, plots, real) : gridPatches(plots);

  plots.forEach((plot) => {
    const patches = patchesByPlot.get(plot.id) ?? [];
    if (!patches.length) return;
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
          Math.ceil(Math.min(plot.treeCount, 90) / patches.length), rng(`${plot.id}-t${i}`), patch.ring))
      : [];
  });
}

/** The generated grid — see the note above ringFor(). */
function gridPatches(plots) {
  const total = plots.reduce((n, p) => n + (p.parcels ?? 1), 0);
  // A SQUARE GRID, so the cells are square and the fields in them are not all
  // taller than they are wide. The grid used to be laid out 4 × 3 into a square
  // space, which made every cell a third taller than it was broad and every
  // parcel in it the same — a farm of identical portrait rectangles. Cells left
  // over read as ground nobody has planted, which is what they are.
  const cols = Math.ceil(Math.sqrt(total));
  const cellW = 1000 / cols;
  const cellH = 1000 / cols;
  const cells = dealCells(plots, total);
  return new Map(plots.map((plot) => {
    const r = rng(plot.id);
    return [plot.id, cells.get(plot.id).map((index) => {
      const cx = (index % cols) * cellW + cellW / 2;
      const cy = Math.floor(index / cols) * cellH + cellH / 2;
      return ringFor(plot, cx, cy, cellW, cellH, r);
    })];
  }));
}

/* -- the real thing -------------------------------------------------------- */

/** A patch, described the way the grid path describes one, from a real ring. */
function patchOf(ring) {
  const [minX, minY, maxX, maxY] = bboxOf({ type: 'Polygon', coordinates: [ring] });
  return {
    shape: 'poly', ring,
    cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
    rx: (maxX - minX) / 2, ry: (maxY - minY) / 2,
  };
}

/**
 * Deal the holding's real parcels to the plots we wrote, and project both the
 * parcels and the boundary into this farm's 0–1000 box.
 *
 * TREE PLOTS TAKE TREE PARCELS FIRST. Under a generated basemap a polygon could
 * sit anywhere; under a photograph you can count the palm rows, so an outline
 * labelled "Date palms" lying across a bare alfalfa field is a mistake anybody
 * can see. The dataset's own top-level class says which parcels are planted
 * with trees, and those are dealt to the plots whose `kind` is 'trees'. When a
 * holding runs out of the right sort, the rest come from the other pool rather
 * than the plot going undrawn — a farm with no outline at all is worse.
 *
 * WITHIN EACH POOL, BIGGEST FIRST, in the order the plots are written. So the
 * plot listed first gets the field you can see, which is also the one the
 * screens open on.
 */
function realPatches(farm, plots, real) {
  /* ONE PROJECTION FOR ALL SIX FARMS, not one per farm.

     Review 22/09, third pass — "on C1 and C4 we have 'all farms' as an option,
     which means the mockup needs some sort of weird collage… can we use farms
     that are located next to one another so that we don't have to do any
     collage?" The six holdings are now one block of an Al Ain scheme, and
     projecting them all through the CLUSTER bbox is what turns that fact into
     geometry: each lands at its true position relative to the others, so a map
     of all of them is a map and not six pictures laid side by side.

     It is also why `farm.origin` is [0, 0] for these — the tidy 2×N grid the
     app laid farms out on has nothing left to do. See originFor(). */
  const space = farmSpace(CLUSTER_SPACE);

  /* The farm's own outline, which is the first time this app has had one that
     was not inferred. map.js's farmBoundary() prefers farm.boundary over the
     convex hull of the plots, and that preference was written for A13's traced
     line; a surveyed title deed uses the same door. */
  const rings = real.boundary.map((ring) => space.project_ring(ring));
  farm.boundary = rings.reduce((a, b) => (a.length >= b.length ? a : b), []);
  farm.boundaryRings = rings;

  /* EVERY parcel, projected, kept on the farm — not just the ones our plots
     claimed. A16's survey is supposed to report what the satellite found on the
     ground, and what is on the ground is the whole holding; the plots we wrote
     are a subset somebody chose. surveyAreas() reads this instead of inventing
     a grid of rectangles. They are shifted onto the farm grid by the caller,
     along with the boundary. */
  farm.parcels = real.parcels.map((p) => ({
    ring: space.project_ring(p.ring), ha: p.ha, crop: p.crop, tree: p.tree,
  }));

  const pools = {
    trees: real.parcels.filter((p) => p.tree),
    crops: real.parcels.filter((p) => !p.tree),
  };
  const take = (plot, n) => {
    const first = plot.kind === 'trees' ? 'trees' : 'crops';
    const second = first === 'trees' ? 'crops' : 'trees';
    const got = pools[first].splice(0, n);
    if (got.length < n) got.push(...pools[second].splice(0, n - got.length));
    return got;
  };

  return new Map(plots.map((plot) => [
    plot.id,
    take(plot, plot.parcels ?? 1).map((parcel) => patchOf(space.project_ring(parcel.ring))),
  ]));
}

/* `ring`, when given, is the patch this grid belongs to. The grid is laid out
   across the patch's BOUNDING BOX, and a real parcel is not a rectangle — so
   without the test the palms of an L-shaped block stand in the sand beside it.
   Points outside are dropped rather than moved: a planting grid with a bite out
   of it is what an irregular field looks like from the air.

   AND THE GRID IS SOWN DENSER WHEN IT WILL BE CLIPPED. A real parcel fills
   about half to two thirds of its own bounding box, so asking for exactly
   `count` points and then throwing some away leaves a tree layer a third as
   dense as the one next to it on the same map. The spacing tightens instead —
   the loop still stops at `count`, so a parcel that happens to be rectangular
   gets the same number of trees it always did, just in a slightly finer grid. */
function treeGrid(grid, count, r, ring = null) {
  const per = ring ? Math.ceil(grid.per * 1.45) : grid.per;
  const sown = { ...grid, per };
  const pts = [];
  for (let row = 1; row <= per && pts.length < count; row += 1) {
    for (let pos = 1; pos <= per && pts.length < count; pos += 1) {
      const [x, y] = gridPoint(sown, row, pos);
      const pt = [x + (r() - 0.5) * 4, y + (r() - 0.5) * 4];
      if (ring && !pointInRing(pt, ring)) continue;
      pts.push(pt);
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

/* -- measure history, for the trend chart on B2 --------------------------- */

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
      return { date: d.date, value: scoreFromValue(key, Number(v.toFixed(3))) };
    });
    points[points.length - 1].value = scoreFromValue(key, target);
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

/* -- what the 13/09 catalogue round added ---------------------------------

   Six derived facts per plot, all of them the same kind of thing the file
   already derives: a reading nobody hand-wrote, keyed off the plot id so it
   is the same on every render and in every screenshot.

   None of it is a new SOURCE of truth. Soil moisture follows the water-stress
   reading the plot already carries; growth stage follows its crop and its
   planting date; the yield forecast follows the stage; disease risk follows
   the crop's own entry in the directory and the weather the farm already has.
   A mockup that invented each of these independently would show a plot with
   a wet root zone, a thirsty canopy and a mildew warning in dry heat, and no
   reviewer could say which of the three to believe. */

/* 604 — the root zone, read from radar. Derived from NDWI rather than drawn
   separately: a canopy that is short of water is standing in ground that is
   short of water, give or take the lag this adds between them. */
function buildMoisture(plot) {
  const r = rng(`${plot.id}-moisture`);
  const canopy = plot.measures?.ndwi?.value ?? 0.3;
  // Heavy ground holds what it is given; sand loses it. The plot already says
  // which it is.
  const holds = /clay/i.test(plot.soil ?? '') ? 1.18 : /sand/i.test(plot.soil ?? '') ? 0.84 : 1;
  const value = Math.max(0.04, Math.min(0.46, canopy * 0.62 * holds + (r() - 0.5) * 0.05));
  return { value: Number(value.toFixed(3)), delta: Number(((r() - 0.5) * 0.07).toFixed(3)) };
}

/* 802 — the same measure past today. Seven days of it, falling with crop use
   and stepping up on the days the forecast carries rain, so the line a farmer
   reads forward is made of the same two things his irrigation advice is. */
function buildMoistureForecast(plot, farm) {
  const r = rng(`${plot.id}-moisture-fc`);
  const days = (farm?.weather?.forecast ?? []).slice(0, 7);
  let v = plot.measures.moisture.value;
  return days.map((day) => {
    const use = 0.012 + (day.hiC > 40 ? 0.006 : 0) + r() * 0.004;
    const rain = (day.rainMm ?? 0) / 100;
    v = Math.max(0.03, Math.min(0.48, v - use + rain));
    return { date: day.date, value: scoreFromValue('moisture', Number(v.toFixed(3))), rainMm: day.rainMm ?? 0 };
  });
}

/* 407 / 501 — where the crop is against the curve it is supposed to follow.

   GDD is accumulated from the planting date at the family's own base
   temperature, which is what makes it comparable between a winter wheat and a
   summer tomato; the stage is simply which threshold that total has passed.
   `aheadDays` is the part a farmer acts on: the model's own idea of how far
   off the expected pace this plot is running. */
function buildGrowth(plot, content, cycle = null, now = new Date('2026-08-03T00:00:00Z')) {
  const crop = content.crops.find((c) => c.id === plot.cropId);
  // The family is kept on the result because it is half of a stage's name:
  // "fill" is grain fill on wheat and fruit fill on a tomato, so a stage is
  // translated by family and id together.
  const family = content.growthStages[crop?.category] ? crop.category : 'other';
  const model = content.growthStages[family];

  /* THE CLOCK IS THE CYCLE'S OWN, NOT THE PLANTING DATE'S.

     A plot's cycle already states when it started and when it is expected to
     be harvested, and those two dates are what B3 prints — so the stage has
     to be read off the same span, or the screen says "sown in February, due
     in November" over a widget claiming the crop is finished. Where there is
     no cycle the crop's own season length stands in, and elapsed time WRAPS
     inside it: alfalfa planted last year is not 500 days into a 30-day cut,
     and a date palm is not 4,000 days into its season — each is somewhere
     inside the cycle it is running now. */
  const start = new Date(`${cycle?.startDate ?? plot.plantedOn ?? '2026-02-12'}T00:00:00Z`);
  const due = cycle?.expectedHarvest ? new Date(`${cycle.expectedHarvest}T00:00:00Z`) : null;
  const season = due
    ? Math.max(30, Math.round((due - start) / 86400000))
    : (crop?.guide?.seasonDays ?? 140);
  const elapsed = Math.max(1, Math.round((now - start) / 86400000));
  const days = due
    ? Math.min(elapsed, Math.round(season * 1.02))
    : ((elapsed - 1) % Math.round(season * 1.02)) + 1;
  const r = rng(`${plot.id}-gdd`);
  // Mean daily accumulation for this family in this climate, nudged per plot.
  const perDay = (model.targetGdd / season) * (0.9 + r() * 0.2);
  const accumulated = Math.round(Math.min(model.targetGdd * 1.04, perDay * days));
  const stages = model.stages;
  const index = Math.max(0, stages.filter((s) => accumulated >= s.gdd).length - 1);
  const stage = stages[index] ?? stages[0];
  const next = stages[index + 1] ?? null;
  // Expected: where a plot of this crop, planted on this date, should be today.
  const expected = Math.round((model.targetGdd / season) * days);
  const aheadDays = Math.round((accumulated - expected) / Math.max(1, perDay));
  return {
    family,
    base: model.base,
    label: model.label,
    accumulated,
    target: model.targetGdd,
    stageId: stage.id,
    stageName: stage.name,
    stageIndex: index,
    stageCount: stages.length,
    nextStageId: next?.id ?? null,
    nextStageName: next?.name ?? null,
    gddToNext: next ? Math.max(0, next.gdd - accumulated) : 0,
    daysToNext: next ? Math.max(0, Math.round((next.gdd - accumulated) / Math.max(1, perDay))) : 0,
    aheadDays,
    kc: stage.kc,
    // The curve the chart draws behind the measured line: the whole season's
    // expected accumulation, with the plot's own position marked on it.
    curve: stages.map((s) => ({ name: s.name, gdd: s.gdd, reached: accumulated >= s.gdd })),
  };
}

/* 801 — a RANGE, never one number. MMC quotes ~90% accuracy for annual crops
   and the 13/09 call was explicit that date palms need another season's work,
   so the width of the band is the honest part of this feature: it is wider
   early in the season, wider again on trees, and it narrows as the crop fills. */
function buildYieldForecast(plot, growth, content) {
  const crop = content.crops.find((c) => c.id === plot.cropId);
  const r = rng(`${plot.id}-yield`);
  const isTree = plot.kind === 'trees';
  const progress = Math.min(1, growth.accumulated / Math.max(1, growth.target));
  // Base expectation per hectare, scaled by how the canopy is actually reading.
  const health = (plot.healthScore ?? 70) / 100;
  const typical = isTree ? 85 : crop?.category === 'forage' ? 18 : crop?.category === 'cereals' ? 6.5 : 30;
  const mid = typical * (0.72 + health * 0.45) * (0.96 + r() * 0.08);
  // Early season and trees both widen it; a crop at fill narrows to ±7%.
  const spread = (isTree ? 0.26 : 0.2) - progress * 0.11;
  return {
    low: Number((mid * (1 - spread)).toFixed(isTree ? 0 : 1)),
    high: Number((mid * (1 + spread)).toFixed(isTree ? 0 : 1)),
    unit: isTree ? 'kg/tree' : 't/ha',
    confidence: progress < 0.45 ? 'low' : progress < 0.75 ? 'fair' : 'good',
    // The caveat the call asked to be carried rather than buried: the palm
    // model is being refined against the April–September season.
    refining: isTree,
  };
}

/* 702 / 706 — the fortnight ahead, per plot, drawn only from the directory
   entries that actually name this crop. A wheat plot is never warned about
   red palm weevil, which is the failure mode a generic risk score has. */
function buildDiseaseRisk(plot, farm, content) {
  const r = rng(`${plot.id}-risk`);
  const entries = content.diseases.filter((x) => x.crops.includes(plot.cropId));
  if (!entries.length) return [];
  const humid = (farm?.weather?.humidityPct ?? 40) / 100;
  const hot = (farm?.weather?.forecast ?? []).some((day) => day.hiC >= 42);
  const wet = (farm?.weather?.forecast ?? []).some((day) => (day.rainMm ?? 0) > 2);
  return entries.map((entry) => {
    // Each kind of trouble has its own weather. Mildews want humidity, mites
    // want dry heat, and a soil-borne wilt does not care what the sky does.
    const mildew = /mildew|blight/.test(entry.id);
    const dry = /mite|weevil|dubas/.test(entry.id);
    let risk = 18 + r() * 22;
    if (mildew) risk += humid * 55 + (wet ? 14 : 0);
    if (dry) risk += hot ? 34 : 10;
    if (entry.severity === 'urgent') risk += 8;
    risk = Math.max(4, Math.min(96, Math.round(risk)));
    const peakIn = 2 + Math.floor(r() * 9);
    return {
      diseaseId: entry.id,
      name: entry.name,
      kind: entry.kind,
      risk,
      band: risk >= 65 ? 'urgent' : risk >= 40 ? 'monitor' : 'good',
      peakIn,
      // The days the risk peaks across, as numbers: the strip puts them into
      // the farmer's words, in his language, rather than a score.
      window: [peakIn, peakIn + 2],
      rising: risk >= 40 && r() > 0.3,
    };
  }).sort((a, b) => b.risk - a.risk);
}

/* 803 — what the soil holds, which is the fact D3's advice has always been
   implying and never stated. Read against the crop's demand at its current
   stage, so "low" means low for what this plant is doing this week. */
function buildNutrients(plot, growth) {
  const r = rng(`${plot.id}-npk`);
  const draw = growth.kc;                       // heavier demand at peak growth
  const mk = (base, spread) => Math.round(base + (r() - 0.5) * spread);
  const n = mk(28 - draw * 8, 22);
  const p = mk(19, 14);
  const k = mk(160, 90);
  const band = (v, low, high) => (v < low ? 'urgent' : v < high ? 'monitor' : 'good');
  return {
    sampledOn: '2026-07-21',
    nitrogen: { value: Math.max(3, n), unit: 'ppm', band: band(n, 12, 22) },
    phosphorus: { value: Math.max(3, p), unit: 'ppm', band: band(p, 10, 18) },
    potassium: { value: Math.max(30, k), unit: 'ppm', band: band(k, 110, 170) },
    ph: Number((7.4 + (r() - 0.5) * 1.1).toFixed(1)),
    ecDsM: Number((2.1 + r() * 2.6).toFixed(1)),
    organicPct: Number((0.6 + r() * 0.9).toFixed(1)),
  };
}

/* 602 — fertigation only exists where the plumbing carries it, so the method
   is decided first and the plan follows only for drip and micro. Anything on
   a pivot or flooded gets its nutrients broadcast, which is D3's business and
   not the irrigation schedule's. */
/* 603/606 — EFFICIENCY HAS TO VARY, OR THE MAP IS ONE COLOUR.

   Every plot in the authored fixtures carries 85%, which was fine while the
   figure appeared once on an advice screen and is useless the moment it is
   painted across a farm: a layer whose whole job is to show you the bad plot
   cannot show all sixteen the same green. So the authored value is treated as
   the FARM's nominal figure and each plot varies around it by the thing that
   actually decides efficiency in the field — how the water is delivered.

   The spread is not random dressing. Drip loses least, a pivot loses to wind
   and evaporation in this heat, and a flooded field loses most; that ordering
   is what makes the map teach something rather than decorate. */
function buildEfficiency(plot, nominal = 85) {
  const r = rng(`${plot.id}-eff`);
  const byMethod = { drip: 6, pivot: -6, flood: -18 }[plot.irrigationMethod] ?? 0;
  const value = nominal + byMethod + Math.round((r() - 0.5) * 16);
  return Math.max(48, Math.min(96, value));
}

function buildIrrigationMethod(plot) {
  const r = rng(`${plot.id}-method`);
  // Basin flooding is still how a good many older Gulf date gardens are
  // watered, and leaving it out of the fixtures would have meant the
  // efficiency map never had a plot worth finding — every holding uniformly
  // green is a layer that teaches nothing.
  if (plot.kind === 'trees') return r() > 0.62 ? 'flood' : 'drip';
  if (plot.cropId === 'alfalfa' || plot.cropId === 'rhodes-grass') return 'pivot';
  return r() > 0.45 ? 'drip' : 'pivot';
}

function buildFertigation(plot, growth, nutrients) {
  if (plot.irrigationMethod !== 'drip') return null;
  const short = ['nitrogen', 'phosphorus', 'potassium'].filter((k) => nutrients[k].band !== 'good');
  const perEvent = Math.round(6 + growth.kc * 9);
  return {
    // Injected with the water the schedule already advises, which is the whole
    // point of the feature: one visit to the pump, not two.
    events: 3,
    kgPerEventPerHa: perEvent,
    // The product is authored content and is localised where it is read
    // (lPlot); what the farmer is told to do with it follows from `targets`
    // and is written on D2.
    product: short.includes('nitrogen') ? 'Calcium nitrate 15.5-0-0'
      : short.includes('potassium') ? 'Potassium sulphate 0-0-50' : 'NPK 20-20-20',
    targets: short.length ? short : ['maintenance'],
  };
}

/* Advised-vs-applied history, WF5.101 / WF5.131. */
function buildIrrigationRecord(plot) {
  const r = rng(`${plot.id}-irrig`);
  return Array.from({ length: 8 }, (_, i) => {
    const advised = Math.round(180 + r() * 520);
    const skipped = r() > 0.86;
    const applied = skipped ? 0 : Math.round(advised * (0.72 + r() * 0.42));
    return {
      week: 24 + i,                     // the chart labels it, in the reader's language
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

/* The whole block, as one photograph. A map showing more than one farm lays
   this down instead of six overlapping farm pictures — it is seamless because
   it IS one picture, and it decodes one JPEG rather than six. */
export const CLUSTER_IMAGERY = {
  href: 'app/data/geo/imagery/cluster.jpg',
  box: SELECTED_GEO.cluster.imageBox,
  fit: [0, 0, 1000, 1000],
};

export function loadFixtures() {
  const farms = structuredClone(farmsRaw.farms);
  const plots = structuredClone(farmsRaw.plots);
  const trees = structuredClone(farmsRaw.trees);
  const activity = structuredClone(activityRaw);
  const content = structuredClone(contentRaw);

  // Normalize the review's farmer-facing model once, at fixture load time.
  // Screens never need to know whether a score was authored or derived.
  for (const plot of plots) {
    // 604 — the fifth measure, derived before scores are taken so it picks up
    // the same normalisation as the four the JSON authors.
    plot.measures ??= {};
    plot.measures.moisture ??= buildMoisture(plot);
    for (const [key, reading] of Object.entries(plot.measures ?? {})) {
      reading.score ??= scoreFromValue(key, reading.value);
    }
    plot.healthScore = overallHealthScore(plot);
    plot.healthStatus = statusFromScore(plot.healthScore);
    if (plot.status === 'monitor' || plot.status === 'monitor') plot.status = 'monitor';
    plot.treeHealthDisplay ??= plot.treeCount > 120 ? 'area' : plot.treeCount ? 'trees' : 'nodata';
  }
  for (const farm of farms) {
    if (farm.status === 'monitor' || farm.status === 'monitor') farm.status = 'monitor';
    for (const [index, day] of (farm.weather?.forecast ?? []).entries()) {
      if (farm.id === 'farm-1' && index === 1) { day.windKph = 28; day.windGustKph = 40; }
      day.windKph ??= farm.weather.windKph ?? 12;
      day.windGustKph ??= day.windKph + 7;
      day.rainProbabilityPct ??= day.rainMm > 0 ? 70 : 0;
      /* 406 — REFERENCE EVAPOTRANSPIRATION, PER DAY, ON THE FARM'S OWN
         WEATHER. ET₀ is what the atmosphere would take off a standard grass
         surface, so it is a property of the day rather than of the crop: heat
         and wind drive it up, cloud and rain pull it down. Every plot's own
         demand is this figure times its crop coefficient, which is why it is
         derived once here and multiplied per plot on the screens. */
      day.et0Mm ??= Number(Math.max(1.8, Math.min(13,
        (day.hiC - 8) * 0.19 + (day.windKph ?? 12) * 0.045
        - (day.rainMm > 0 ? 1.4 : 0) - (day.condition === 'Cloudy' ? 1.1 : 0),
      )).toFixed(1));
      /* What the day means for each job: a verdict and the REASON for it, not
         a sentence. D2–D4 put the reason into words in the reader's language
         (CONDITION_TEXT in advice.js); an English sentence written here would
         be English on every screen that printed it. */
      day.activity ??= {
        irrigation: day.rainMm > 8 ? { status: 'monitor', reason: 'rain' } : { status: 'good', reason: 'evening', afterHour: 18 },
        spraying: day.windGustKph > 28 ? { status: 'urgent', reason: 'wind' } : { status: 'good', reason: 'calm' },
      };
      if (day.windGustKph > 28) day.activity.spraying = { status: 'urgent', reason: 'wind' };
    }
  }

  farms.forEach((farm, index) => {
    const own = plots.filter((p) => p.farmId === farm.id);
    buildGeometry(farm, own);
    // Farms are laid out on a grid so that "all farms" on the map shows them
    // side by side rather than stacked on top of each other. Geometry is stored
    // already translated; the map fits its viewBox to whatever it is given.
    /* A REAL FARM IS ALREADY WHERE IT BELONGS. Its rings came out of the shared
       cluster projection, so shifting it onto the layout grid would move it off
       its own photograph. The grid is for farms the app made up — one added
       inside the app, one drawn by hand — and originFor() keeps those clear of
       the block. */
    farm.origin = SELECTED_GEO[farm.id] ? [0, 0] : originFor(farm, farms, index);
    const [originX, originY] = farm.origin;
    const shift = (ring) => ring.map(([x, y]) => [x + originX, y + originY]);
    for (const plot of own) {
      plot.patches = plot.patches.map(shift);
      plot.geometry = shift(plot.geometry);
      plot.centroid = [plot.centroid[0] + originX, plot.centroid[1] + originY];
      plot.treePoints = shift(plot.treePoints);
      if (plot.grid) { plot.grid.cx += originX; plot.grid.cy += originY; }
    }
    /* THE OUTLINE AND THE PHOTOGRAPH MOVE WITH THE PLOTS, and they are new here
       because until review 22/09 a farm had neither. A boundary left in local
       coordinates would draw round the wrong farm on any map showing more than
       one; imagery left behind would put the second farm's fields on the first
       farm's ground, which is the same bug wearing a picture.

       The image box is the whole 0–1000 square rather than the boundary's own
       extent: that is exactly what tools/build-geo.mjs photographed, padding
       included, and the padding is where a farmer looks to see that his
       neighbour's field is not his. */
    const real = SELECTED_GEO[farm.id];
    if (farm.boundary) {
      farm.boundary = shift(farm.boundary);
      farm.boundaryRings = (farm.boundaryRings ?? []).map(shift);
      farm.parcels = (farm.parcels ?? []).map((p) => ({ ...p, ring: shift(p.ring) }));
      /* `imageBox` and `fit` are already in the shared space — build-geo.mjs
         projected them there, because they say where a photograph sits and the
         photograph has been taken. Nothing to shift: these farms are at the
         origin. `fit` is the farm's own extent, which is what "fit the farm"
         means on a screen with nothing else to fit to (A13), and what the
         drawing canvases frame. */
      farm.imagery = {
        href: `app/data/geo/imagery/${farm.id}.jpg`,
        box: real.imageBox,
        fit: real.fit,
      };
    }
    farm.imageryDates = buildImageryDates(farm);
  });

  // Each tree gets its own point, from its row and position on its plot's
  // planting grid — so B6 can show the operator exactly which tree to walk to.
  for (const tree of trees) {
    if (tree.status === 'monitor' || tree.status === 'monitor') tree.status = 'monitor';
    const plot = plots.find((p) => p.id === tree.plotId);
    tree.point = plot?.grid ? gridPoint(plot.grid, tree.row, tree.position) : (plot?.centroid ?? [500, 500]);
  }

  // The authored sample is intentionally small. Expand it deterministically
  // for every group so B5 never borrows another farm's records or divides by
  // an empty sample.
  const authoredByGroup = new Map();
  for (const tree of trees) authoredByGroup.set(tree.plotId, [...(authoredByGroup.get(tree.plotId) ?? []), tree]);
  for (const plot of plots.filter((p) => p.kind === 'trees' && (p.treeCount ?? 0) > 0)) {
    if (authoredByGroup.has(plot.id)) continue;
    const r = rng(`${plot.id}-trees`);
    const count = Math.min(plot.treeCount ?? 30, 60);
    for (let i = 0; i < count; i += 1) {
      const score = Math.max(0, Math.min(100, (plot.healthScore ?? 70) + Math.round((r() - 0.5) * 24)));
      const status = score >= 80 ? 'good' : score >= 60 ? 'monitor' : 'urgent';
      const row = (i % (plot.grid?.per ?? 8)) + 1;
      const position = Math.floor(i / (plot.grid?.per ?? 8)) + 1;
      trees.push({
        id: `${plot.id}-tree-${String(i + 1).padStart(3, '0')}`,
        farmId: plot.farmId, plotId: plot.id, species: plot.species ?? 'fruit-tree',
        variety: plot.variety ?? 'Mixed', row, position, status, score, health: score,
        water: Math.max(0, Math.min(100, score + Math.round((r() - 0.5) * 16))),
        chlorophyll: Math.max(0, Math.min(100, score + Math.round((r() - 0.5) * 12))),
        declining: status !== 'good' && r() > 0.45, note: '',
      });
    }
  }

  for (const plot of plots) {
    const farm = farms.find((f) => f.id === plot.farmId);
    plot.series = buildSeries(plot, farm.imageryDates);
    plot.yearComparison = buildYearComparison(plot);
    plot.irrigationRecord = buildIrrigationRecord(plot);
    plot.cropCycles = buildCropCycles(plot);

    /* THE 13/09 CATALOGUE ROUND, in dependency order — each of these reads the
       one before it, which is what keeps a plot's story consistent across six
       screens. Moisture comes off the water-stress reading, the forecast off
       moisture, the stage off the crop and the planting date, and the yield,
       the nutrient draw and the fertigation plan all off the stage. */
    plot.moistureForecast = buildMoistureForecast(plot, farm);
    const cycle = plot.cropCycles.find((c) => c.state === 'current') ?? null;
    plot.growth = buildGrowth(plot, content, cycle);
    plot.yieldForecast = buildYieldForecast(plot, plot.growth, content);
    plot.diseaseRisk = buildDiseaseRisk(plot, farm, content);
    plot.nutrients = buildNutrients(plot, plot.growth);
    plot.irrigationMethod = buildIrrigationMethod(plot);
    // The authored 85% becomes the farm's nominal figure; the plot's own
    // delivery method moves it from there.
    plot.irrigationEfficiencyPct = buildEfficiency(plot, plot.irrigationEfficiencyPct ?? 85);
    plot.fertigation = buildFertigation(plot, plot.growth, plot.nutrients);
    // The cycle carries the two figures a farmer reads on B3, so the crop-cycle
    // screen does not have to know where they came from.
    if (cycle) {
      cycle.growth = plot.growth;
      cycle.yieldForecast = plot.yieldForecast;
    }
  }

  return {
    farms, plots, trees,
    // §5.6 — worker records. People, not accounts.
    workers: structuredClone(farmsRaw.workers ?? []),
    accounts: structuredClone(activity.accounts ?? [
      { id: 'user-1', email: 'khaled@example.com', phone: '+966500000001', credentialsCreated: true, name: 'Khaled Al-Amri' },
    ]),
    farmAccess: structuredClone(activity.farmAccess ?? [
      { farmId: 'farm-1', accountId: 'user-1', role: 'primary-owner', status: 'active' },
    ]),
    farmInvitations: structuredClone(activity.farmInvitations ?? [{ id: 'invite-1', farmId: 'farm-1', role: 'co-owner', code: '482193', qrToken: 'invite-1-token', status: 'active', expiresAt: '2026-09-18T12:00:00Z', createdBy: 'user-1' }]),
    workforceContacts: structuredClone(activity.workforceContacts ?? activity.team ?? []),
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
    notes: '', cutsDone: 4, cutsMonitor: 8, yieldSoFar: '14.2 t',
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
      notes: '', cutsDone: null, cutsMonitor: null, yieldSoFar: null,
    });
  });
  return cycles;
}
