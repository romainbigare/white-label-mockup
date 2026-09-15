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

function buildGeometry(farm, plots) {
  const total = plots.reduce((n, p) => n + (p.parcels ?? 1), 0);
  // A SQUARE GRID, so the cells are square and the fields in them are not all
  // taller than they are wide. The grid used to be laid out 4 × 3 into a square
  // space, which made every cell a third taller than it was broad and every
  // parcel in it the same — a farm of identical portrait rectangles. Cells left
  // over read as ground nobody has planted, which is what they are.
  const cols = Math.ceil(Math.sqrt(total));
  const rows = cols;
  const cellW = 1000 / cols;
  const cellH = 1000 / rows;
  const cells = dealCells(plots, total);

  plots.forEach((plot) => {
    const r = rng(plot.id);
    const patches = cells.get(plot.id).map((index, i) => {
      const cx = (index % cols) * cellW + cellW / 2;
      const cy = Math.floor(index / cols) * cellH + cellH / 2;
      return ringFor(plot, cx, cy, cellW, cellH, r);
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

/* -- measure history, for the trend chart on B4 --------------------------- */

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
  const model = content.growthStages[crop?.category ?? 'other'] ?? content.growthStages.other;

  /* THE CLOCK IS THE CYCLE'S OWN, NOT THE PLANTING DATE'S.

     A plot's cycle already states when it started and when it is expected to
     be harvested, and those two dates are what B5 prints — so the stage has
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
    base: model.base,
    label: model.label,
    accumulated,
    target: model.targetGdd,
    stageId: stage.id,
    stageName: stage.name,
    stageIndex: index,
    stageCount: stages.length,
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
      // The line the strip prints, in the farmer's terms rather than a score.
      window: `${peakIn}–${peakIn + 2} days`,
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
    product: short.includes('nitrogen') ? 'Calcium nitrate 15.5-0-0'
      : short.includes('potassium') ? 'Potassium sulphate 0-0-50' : 'NPK 20-20-20',
    targets: short.length ? short : ['maintenance'],
    note: short.length
      ? 'Split across the week’s irrigations rather than applied in one dose.'
      : 'Maintenance rate only — nothing is short this week.',
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
      day.activity ??= {
        irrigation: { status: day.rainMm > 8 ? 'monitor' : 'good', message: day.rainMm > 8 ? 'Rain may reduce watering' : 'Irrigate after 18:00' },
        spraying: { status: day.windGustKph > 28 ? 'urgent' : 'good', message: day.windGustKph > 28 ? 'Do not spray: high wind' : 'Suitable for spraying' },
      };
      if (day.windGustKph > 28) day.activity.spraying = { status: 'urgent', message: 'Do not spray: high wind' };
    }
  }

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
    if (tree.status === 'monitor' || tree.status === 'monitor') tree.status = 'monitor';
    const plot = plots.find((p) => p.id === tree.plotId);
    tree.point = plot?.grid ? gridPoint(plot.grid, tree.row, tree.position) : (plot?.centroid ?? [500, 500]);
  }

  // The authored sample is intentionally small. Expand it deterministically
  // for every group so B13 never borrows another farm's records or divides by
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
    // The cycle carries the two figures a farmer reads on B5, so the crop-cycle
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
