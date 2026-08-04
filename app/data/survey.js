/* ---------------------------------------------------------------------------
   survey.js — the whole-farm land use survey (§4.9).

   The second way to register a farm. Instead of drawing every plot, the farmer
   draws one line around everything — buildings included — and MMC works out
   what is inside it. This module stands in for that algorithm.

   It is a mock, but a DETERMINISTIC one: the same farm always comes back with
   the same areas, because a survey a reviewer runs twice must not change its
   mind. Areas are laid out in the farm's own 1000 × 1000 coordinate space, the
   one plots already use, so the result draws on the same map with the same
   code and an included area can become a plot without moving.

   Three classes, and they are the whole vocabulary of the feature:

     crops       open field crops, fallow land included
     trees       date palms and fruit trees
     structures  covered agriculture and buildings

   Structures start EXCLUDED. A farm with a villa, a warehouse and two
   greenhouses on it should not arrive with the farmer being quoted for the
   roof of his own house, and asking him to opt out of paying for it is a worse
   first impression than asking him to opt in.
   --------------------------------------------------------------------------- */

import { rng } from './fixtures.js';

export const LAND_USE = ['crops', 'trees', 'structures'];

export const LAND_USE_META = {
  crops: { icon: 'sprout', fill: '#8fb85a', included: true },
  trees: { icon: 'tree', fill: '#2e8f66', included: true },
  structures: { icon: 'home', fill: '#98a5a0', included: false },
};

/* Roughly a date palm at 8 × 8 m spacing, which is what the fixtures assume. */
const TREES_PER_HA = 118;

/**
 * What the algorithm found inside the boundary. Pure, deterministic and
 * derived from the farm id, so it can be recomputed at any point rather than
 * stored — the only thing worth keeping is what the farmer decided about it.
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
    // shows all three and the screen never has an empty group to explain.
    const draw = r();
    let kind = draw < 0.44 ? 'crops' : draw < 0.79 ? 'trees' : 'structures';
    if (i === 0) kind = 'crops';
    if (i === 1) kind = 'trees';
    if (i === 2) kind = 'structures';

    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + cellH / 2;
    // A building sits on a fraction of what a field covers.
    const spread = kind === 'structures' ? 0.15 : 0.33;
    const rx = cellW * (spread + r() * 0.08);
    const ry = cellH * (spread + r() * 0.08);
    const corners = kind === 'structures' ? 4 : 4 + Math.floor(r() * 3);
    const geometry = Array.from({ length: corners }, (_, k) => {
      const a = (k / corners) * Math.PI * 2 - Math.PI / 4;
      const wobble = kind === 'structures' ? 1 : 0.82 + r() * 0.34;
      return [ox + cx + Math.cos(a) * rx * wobble * 1.25, oy + cy + Math.sin(a) * ry * wobble * 1.25];
    });

    areas.push({
      id: `${farm.id}-a${i + 1}`,
      // The algorithm does not know what anybody calls their fields, so it
      // numbers them and lets the farmer recognise them from the map. Hyphenated
      // to match P-01 and T-2841 — and because "A1" is not caught by the bidi
      // isolation in i18n.js, so it renders as "1A" in Arabic.
      label: `A-${i + 1}`,
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

/** Absolute area of a polygon, in the farm's own units. */
function shoelace(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/**
 * The farmer's decisions, kept on the farm as a map of area id → decision.
 * Anything not mentioned takes its class default, so a farm that has never
 * been opened still totals up correctly.
 */
export function decisionFor(farm, area) {
  const saved = farm.survey?.decisions?.[area.id];
  return {
    kind: saved?.kind ?? area.kind,
    included: saved?.included ?? LAND_USE_META[saved?.kind ?? area.kind].included,
  };
}

/** Areas with the farmer's decisions applied — what every total is counted from. */
export function decidedAreas(farm) {
  return surveyAreas(farm).map((area) => {
    const d = decisionFor(farm, area);
    const treeCount = d.kind === 'trees' ? Math.round(area.areaHa * TREES_PER_HA) : 0;
    return { ...area, kind: d.kind, included: d.included, treeCount };
  });
}

/** What the plan is priced from, and what B2 shows once a survey is confirmed. */
export function surveyTotals(farm) {
  const areas = decidedAreas(farm);
  const inc = areas.filter((a) => a.included);
  const cropHa = round1(inc.filter((a) => a.kind === 'crops').reduce((s, a) => s + a.areaHa, 0));
  const treeHa = round1(inc.filter((a) => a.kind === 'trees').reduce((s, a) => s + a.areaHa, 0));
  return {
    areas,
    cropHa,
    treeHa,
    treeCount: inc.reduce((s, a) => s + a.treeCount, 0),
    excludedHa: round1(areas.filter((a) => !a.included).reduce((s, a) => s + a.areaHa, 0)),
    counts: Object.fromEntries(LAND_USE.map((k) => [k, areas.filter((a) => a.kind === k).length])),
    // WF-142's family, worked out from the ground rather than from a question.
    family: cropHa > 0 && treeCount(inc) > 0 ? 'complete' : treeCount(inc) > 0 ? 'tree' : 'crop',
  };
}

function treeCount(areas) {
  return areas.reduce((s, a) => s + a.treeCount, 0);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** The farm's type, once the farmer has said what is in scope. */
export function typeFromTotals(totals) {
  if (totals.cropHa > 0 && totals.treeCount > 0) return 'mixed';
  return totals.treeCount > 0 ? 'trees' : 'crops';
}
