/* ---------------------------------------------------------------------------
   tiles.js — where the live maps get their ground, and which of it to keep.

   Two readers, and that is why this is a module of its own rather than a few
   constants in app/ui/livemap.js:
     * livemap.js, which streams tiles from these sources as the map moves;
     * tools/stamp.mjs, which writes OFFLINE_TILES into sw.js at deploy time,
       so an exhibition tablet has the ground under the farms with no wifi.
   Both must name the same URLs, byte for byte, or the worker keeps tiles the
   map never asks for. So this module imports nothing that needs a browser.

   ESRI, AND NO KEY. Esri's public tile services are free to use with
   attribution, which livemap.js shows in the corner of the map — the same
   licence the vendored photographs in app/data/geo/imagery/ are used under.
   The answer for the real product is an Esri account; for a mockup this is it.
   Both services allow cross-origin requests, which is what lets the worker
   store a tile as an ordinary response rather than an opaque one (an opaque
   response is counted as megabytes against the device's storage quota).

   Tiles are addressed {z}/{y}/{x} — Esri's order, not the usual z/x/y.
   --------------------------------------------------------------------------- */

import SELECTED_GEO from '../data/geo/selected.data.js';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const TILE_SOURCES = {
  satellite: {
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    /* Over the Al Ain block Esri flies to z19 — single palm crowns — and z20
       is its "no imagery" placeholder. Past 19 the map enlarges 19's tiles. */
    maxNativeZoom: 19,
  },
  street: {
    url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: 'Map © Esri, HERE, Garmin, OpenStreetMap contributors',
    maxNativeZoom: 19,
  },
};

/** Every tile URL starts with this; the worker uses it to tell tiles apart. */
export const TILE_ORIGIN = new URL(ESRI).origin;

/* -- what an exhibition tablet keeps --------------------------------------

   The satellite tiles over the six farms, at every zoom the map opens at or
   is likely to be pinched to, with MARGIN tiles of ground all round. Three
   tiles is a little more than half a 1280-pixel tablet screen, so a map
   centred anywhere over the farms has ground to every edge, with some room to
   pan. About 690 tiles, 12 MB, downloaded once per device — the worker keeps
   them in a cache that outlives builds (sw.js).

   Not the street map: it is the second choice on C2, and over farmland at
   these zooms it is a flat beige. Without wifi it shows what it has seen. */
const OFFLINE_ZOOMS = [12, 13, 14, 15, 16, 17, 18, 19];
const MARGIN = 3;
const EARTH_HALF = Math.PI * 6378137;   // half the Web Mercator world, in metres

/** The tile column and row holding a Web Mercator point, at zoom z. */
function tileAt([x, y], z) {
  const n = 2 ** z;
  return [
    Math.floor(((x + EARTH_HALF) / (2 * EARTH_HALF)) * n),
    Math.floor(((EARTH_HALF - y) / (2 * EARTH_HALF)) * n),
  ];
}

export const OFFLINE_TILES = (() => {
  const [minX, minY, maxX, maxY] = SELECTED_GEO.cluster.bbox;
  const urls = [];
  for (const z of OFFLINE_ZOOMS) {
    const [x0, y0] = tileAt([minX, maxY], z);    // north-west corner
    const [x1, y1] = tileAt([maxX, minY], z);    // south-east corner
    for (let y = y0 - MARGIN; y <= y1 + MARGIN; y += 1) {
      for (let x = x0 - MARGIN; x <= x1 + MARGIN; x += 1) {
        urls.push(TILE_SOURCES.satellite.url.replace('{z}', z).replace('{y}', y).replace('{x}', x));
      }
    }
  }
  return urls;
})();
