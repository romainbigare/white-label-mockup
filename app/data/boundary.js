/* ---------------------------------------------------------------------------
   boundary.js — a farm's `boundary`, the record the server keeps of its
   fields (Oct 2026, Wafra's final answer to MMC).

   farms/{id}.boundary = {
     points     the farm's outline: the shape round all its fields plus a
                20 m margin, worked out by the app, never drawn
     fields     [{ id, number, kind: 'crops'|'trees', crop (crops only), points }]
                every field as drawn, a round one as the ring it is stored as
     areaHa     the fields' own area, added up: what is measured and priced
     version    one number for the outline and the fields together; every new
                drawing is the next one, and a rename is not a drawing
     updatedAt, updatedBy
   }

   The rules — the hull, the margin, the kilometre — are core/geo.js's, in
   metres. This module only does what the mockup has to: it reads the fields
   off the plot records, which are drawn in farm space, scaled by the
   drawing's metres per unit; the real app stores {lat, lon} points and calls
   farmOutlineLatLon() instead. The fixtures build every farm's boundary with
   it at load, and the write layer every time fields are drawn (actions.js).
   --------------------------------------------------------------------------- */

import { farmOutline, FARM_UNIT_M } from '../core/geo.js';

/** Every ring a field covers, in farm space: one for a drawn field, several
    for a fixture tree field laid over several real parcels. */
function ringsOfField(plot) {
  return (plot.patches?.length ? plot.patches : [plot.geometry]).filter((ring) => ring?.length >= 3);
}

const toMetres = (ring) => ring.map(([x, y]) => [x * FARM_UNIT_M, y * FARM_UNIT_M]);
const toUnits = (ring) => ring.map(([x, y]) => [x / FARM_UNIT_M, y / FARM_UNIT_M]);

/**
 * The outline round these fields, in farm space, and whether they are too far
 * apart to be one farm.
 *
 * @returns {{ points: number[][], apart: boolean }}
 */
export function outlineOfFields(plots) {
  const { ring, apart } = farmOutline(plots.flatMap(ringsOfField).map(toMetres));
  return { points: toUnits(ring), apart };
}

/** A farm's boundary record for these fields, at a version. */
export function boundaryRecord(plots, { version, at, by }) {
  return {
    points: outlineOfFields(plots).points,
    fields: plots.map((p) => ({
      id: p.id, number: p.number, kind: p.kind,
      ...(p.kind === 'trees' ? {} : { crop: p.cropId }),
      points: p.geometry,
    })),
    areaHa: Math.round(plots.reduce((sum, p) => sum + (p.areaHa ?? 0), 0) * 10) / 10,
    version, updatedAt: at, updatedBy: by,
  };
}
