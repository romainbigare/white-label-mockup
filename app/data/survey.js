/* ---------------------------------------------------------------------------
   survey.js — the whole-farm land use survey (WF4.070 … WF4.094).

   The second way to register a farm. Instead of drawing every plot, the farmer
   draws one line around everything — buildings included — and MMC works out
   what is inside it. This module stands in for that algorithm.

   TWO classes, and they are the whole vocabulary of the feature:

     crops   open field crops, fallow land included
     trees   date palms and fruit trees

   There used to be a third — covered agriculture and structures — arriving
   excluded so the farmer was not quoted for the roof of his own house. It has
   gone entirely, and not because excluding it by default was wrong. Reading
   buildings off satellite imagery is a government-level service, not a farm
   one: the farmer is not buying it, cannot act on it, and a villa listed among
   his fields is a row he has to think about and then dismiss. So the survey
   does not report structures at all, and the boundary is simply read for what
   is growing inside it.

   ARCHITECTURE — why the result is materialised rather than derived

   The algorithm is a pure function of the farm id, so the same farm always
   comes back with the same areas: a survey a reviewer runs twice must not
   change its mind. But WF4.081 now lets the farmer SPLIT, JOIN, EDIT, REMOVE
   and ADD, and none of those can be expressed as a decision layered over a
   derived list — a joined pair is one shape that no longer corresponds to
   anything the algorithm returned.

   So the detected result is computed once and materialised onto the farm, and
   every edit mutates that copy. `detected` is kept beside it untouched, which
   is what WF4.086 asks for: a corrected area records what was found, what it
   was changed to, and by whom.
   --------------------------------------------------------------------------- */

import { rng } from './fixtures.js';

export const LAND_USE = ['crops', 'trees'];

export const LAND_USE_META = {
  crops: { icon: 'sprout', fill: '#8fb85a', included: true },
  trees: { icon: 'tree', fill: '#2e8f66', included: true },
};

/* Roughly a date palm at 8 × 8 m spacing, which is what the fixtures assume. */
export const TREES_PER_HA = 118;

/* -- what the algorithm returned ------------------------------------------ */

/**
 * The detected land use inside the boundary. Pure and deterministic, derived
 * from the farm id. This is the algorithm's answer and nothing here is ever
 * the farmer's.
 */
export function surveyAreas(farm) {
  const r = rng(`survey-${farm.id}`);
  const count = 7 + Math.floor(r() * 4);                 // 7–10 areas
  const cols = Math.ceil(Math.sqrt(count * 1.35));
  const rows = Math.ceil(count / cols);
  const cellW = 1000 / cols;
  const cellH = 1000 / rows;
  const [ox, oy] = farm.origin ?? [0, 0];

  const areas = [];
  for (let i = 0; i < count; i += 1) {
    // Classes are drawn per cell but the mix is forced below, so every survey
    // shows both and the screen never has an empty group to explain.
    let kind = r() < 0.55 ? 'crops' : 'trees';
    if (i === 0) kind = 'crops';
    if (i === 1) kind = 'trees';

    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + cellH / 2;
    const rx = cellW * (0.33 + r() * 0.08);
    const ry = cellH * (0.33 + r() * 0.08);
    const corners = 4 + Math.floor(r() * 3);
    const geometry = Array.from({ length: corners }, (_, k) => {
      const a = (k / corners) * Math.PI * 2 - Math.PI / 4;
      const wobble = 0.82 + r() * 0.34;
      return [ox + cx + Math.cos(a) * rx * wobble * 1.25, oy + cy + Math.sin(a) * ry * wobble * 1.25];
    });

    areas.push({
      id: `${farm.id}-a${i + 1}`,
      // These are the names the areas will carry as plots, so the farmer sees
      // on this screen what he will see on every screen afterwards. The farm's
      // own name is prefixed at render time, not stored here.
      label: `P${i + 1}`,
      kind,
      geometry,
      centroid: [ox + cx, oy + cy],
      shapeArea: shoelace(geometry),
    });
  }

  // Share out the boundary's real area in proportion to what was drawn, so the
  // hectares on screen add up to the hectares the farmer traced.
  const total = areas.reduce((sum, a) => sum + a.shapeArea, 0) || 1;
  for (const a of areas) {
    a.areaHa = Math.round((a.shapeArea / total) * farm.areaHa * 10) / 10;
    a.treeCount = a.kind === 'trees' ? Math.round(a.areaHa * TREES_PER_HA) : 0;
  }
  return areas;
}

/* -- the working copy the farmer edits ------------------------------------ */

/**
 * Materialise the survey onto the farm the first time it is opened, and hand
 * back the working areas. Takes the RAW farm: this writes.
 */
export function ensureSurvey(farm) {
  const s = farm.survey ??= { state: 'ready' };
  if (!s.areas) {
    const detected = surveyAreas(farm);
    // WF4.086 — the algorithm's answer is kept whole, beside the working copy.
    s.detected = detected.map((a) => ({ id: a.id, kind: a.kind, areaHa: a.areaHa }));
    s.areas = detected.map((a) => ({
      ...a,
      geometry: a.geometry.map((p) => [...p]),
      // WF4.080 — what starts included is what the farmer asked us to cover,
      // and he said so before the survey ran. A date grower who chose "trees
      // only" should not open this screen quoted for four fallow fields.
      included: coversKind(farm, a.kind),
      origin: 'survey',
      correctedBy: null,
    }));
  }
  return s.areas;
}

/** Does this farm's chosen coverage take in this class of land? */
export function coversKind(farm, kind) {
  const type = farm.type ?? 'mixed';
  if (type === 'crops') return kind === 'crops';
  if (type === 'trees') return kind === 'trees';
  return true;
}

/** Areas with every farmer edit applied — what all totals are counted from. */
export function decidedAreas(farm) {
  return farm.survey?.areas ?? ensureSurvey(farm);
}

/* -- the five edits of WF4.081 -------------------------------------------- */

/** WF4.083 — reclassify, and record that a person did it. */
export function setAreaKind(farm, id, kind) {
  const a = find(farm, id);
  if (!a) return;
  a.kind = kind;
  a.treeCount = kind === 'trees' ? Math.round(a.areaHa * TREES_PER_HA) : 0;
  a.correctedBy = 'farmer';
}

/** WF4.083 — include or exclude. Any class may be either. */
export function setAreaIncluded(farm, id, included) {
  const a = find(farm, id);
  if (!a) return;
  a.included = included;
  a.correctedBy = 'farmer';
}

/** WF4.081 — split an area the survey read as one. */
export function splitArea(farm, id) {
  const areas = decidedAreas(farm);
  const i = areas.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const a = areas[i];
  const [ax, ay] = extent(a.geometry);
  // Cut across the SHORTER side, so the two halves are the more natural shape.
  const vertical = ax >= ay;
  const [cx, cy] = centroid(a.geometry);
  const halves = [-1, 1].map((side) => ({
    ...a,
    id: `${a.id}-${side < 0 ? 's1' : 's2'}`,
    label: `${a.label}${side < 0 ? 'a' : 'b'}`,
    geometry: a.geometry.map(([x, y]) => (vertical
      ? [side < 0 ? Math.min(x, cx) : Math.max(x, cx), y]
      : [x, side < 0 ? Math.min(y, cy) : Math.max(y, cy)])),
    areaHa: Math.round((a.areaHa / 2) * 10) / 10,
    treeCount: a.kind === 'trees' ? Math.round((a.areaHa / 2) * TREES_PER_HA) : 0,
    origin: 'split',
    correctedBy: 'farmer',
  }));
  for (const half of halves) half.centroid = centroid(half.geometry);
  areas.splice(i, 1, ...halves);
  return halves;
}

/** WF4.081 — join areas the survey separated. */
export function joinAreas(farm, ids) {
  const areas = decidedAreas(farm);
  const members = areas.filter((a) => ids.includes(a.id));
  if (members.length < 2) return null;
  const first = areas.findIndex((a) => a.id === members[0].id);
  const geometry = hull(members.flatMap((a) => a.geometry));
  // A joined shape takes the class of the largest member: joining a big field
  // to a shed should not turn the field into a shed.
  const lead = [...members].sort((x, y) => y.areaHa - x.areaHa)[0];
  const areaHa = Math.round(members.reduce((s, a) => s + a.areaHa, 0) * 10) / 10;
  const joined = {
    id: `${members[0].id}-j`,
    label: members.map((a) => a.label).join('+'),
    kind: lead.kind,
    geometry,
    centroid: centroid(geometry),
    areaHa,
    treeCount: lead.kind === 'trees' ? Math.round(areaHa * TREES_PER_HA) : 0,
    included: members.some((a) => a.included),
    origin: 'join',
    correctedBy: 'farmer',
  };
  for (const m of members) areas.splice(areas.indexOf(m), 1);
  areas.splice(Math.min(first, areas.length), 0, joined);
  return joined;
}

/** WF4.081 — remove an area outright. */
export function removeArea(farm, id) {
  const areas = decidedAreas(farm);
  const i = areas.findIndex((a) => a.id === id);
  if (i >= 0) areas.splice(i, 1);
}

/** WF4.081 — add a plot the survey missed. */
export function addArea(farm, { kind = 'crops', geometry, areaHa } = {}) {
  const areas = decidedAreas(farm);
  const [ox, oy] = farm.origin ?? [0, 0];
  // Somewhere visible but out of the way of what is already drawn.
  const g = geometry ?? [[ox + 120, oy + 820], [ox + 320, oy + 820], [ox + 320, oy + 960], [ox + 120, oy + 960]];
  const ha = areaHa ?? Math.round((farm.areaHa / Math.max(areas.length, 1)) * 10) / 10;
  const added = {
    id: `${farm.id}-a${areas.length + 1}-new`,
    label: `P${areas.length + 1}`,
    kind,
    geometry: g,
    centroid: centroid(g),
    areaHa: ha,
    treeCount: kind === 'trees' ? Math.round(ha * TREES_PER_HA) : 0,
    included: true,
    origin: 'farmer',
    correctedBy: 'farmer',
  };
  areas.push(added);
  return added;
}

/** WF4.082 — the outline itself, edited with the A9 interaction. */
export function setAreaGeometry(farm, id, geometry, areaHa) {
  const a = find(farm, id);
  if (!a) return;
  a.geometry = geometry.map((p) => [...p]);
  a.centroid = centroid(a.geometry);
  if (areaHa != null) {
    a.areaHa = Math.round(areaHa * 10) / 10;
    a.treeCount = a.kind === 'trees' ? Math.round(a.areaHa * TREES_PER_HA) : 0;
  }
  a.correctedBy = 'farmer';
}

function find(farm, id) {
  return decidedAreas(farm).find((a) => a.id === id);
}

/* -- totals --------------------------------------------------------------- */

/** WF4.084 — what the plan is priced from, recomputed on every change. */
export function surveyTotals(farm) {
  const areas = decidedAreas(farm);
  const inc = areas.filter((a) => a.included);
  const cropHa = round1(inc.filter((a) => a.kind === 'crops').reduce((s, a) => s + a.areaHa, 0));
  const treeHa = round1(inc.filter((a) => a.kind === 'trees').reduce((s, a) => s + a.areaHa, 0));
  const trees = inc.reduce((s, a) => s + a.treeCount, 0);
  return {
    areas,
    cropHa,
    treeHa,
    treeCount: trees,
    excludedHa: round1(areas.filter((a) => !a.included).reduce((s, a) => s + a.areaHa, 0)),
    includedHa: round1(inc.reduce((s, a) => s + a.areaHa, 0)),
    counts: Object.fromEntries(LAND_USE.map((k) => [k, areas.filter((a) => a.kind === k).length])),
    // WF4.093 — the service, worked out from the ground rather than from a question.
    family: cropHa > 0 && trees > 0 ? 'combined' : trees > 0 ? 'tree' : 'crop',
  };
}

/** The farm's type, once the farmer has said what is in scope. */
export function typeFromTotals(totals) {
  if (totals.cropHa > 0 && totals.treeCount > 0) return 'mixed';
  return totals.treeCount > 0 ? 'trees' : 'crops';
}

/* -- geometry ------------------------------------------------------------- */

function shoelace(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function centroid(points) {
  const n = points.length || 1;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

function extent(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

/* Andrew's monotone chain. Joining two fields should give back one shape that
   contains both, and the convex hull is the honest cheap answer — a true union
   would need real polygon clipping for a result the farmer then edits anyway. */
function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...build(pts), ...build([...pts].reverse())];
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
