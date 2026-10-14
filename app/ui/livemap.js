/* ---------------------------------------------------------------------------
   livemap.js — C1's map, live: real tiles that pan, pinch and stream.

   Every other map in the app is a picture (map.js): the vendored photograph of
   the farms with the plots drawn on it, fitted once. That is right for a card,
   a hero image or a slide. On C1 a tablet demo wants what a farmer's phone
   would do — drag the ground, pinch into one palm, pan to the neighbour — so
   this module puts the SAME drawing on a Leaflet map over Esri tiles
   (core/tiles.js). The plots, rasters, outlines and labels are still mapSvg's;
   only the ground and the frame are Leaflet's.

   THREE THINGS MAKE IT WORK, and each is a place to look when it does not:

   1. ONE MAP FOR THE LIFE OF THE PAGE. The shell rebuilds a screen's DOM on
      every commit, and a Leaflet map rebuilt every commit would forget where
      it was looking and fetch its tiles again. So the map and its element live
      here, and liveMap() hands the same element back to every render, which
      mounts it again; the map's view survives. A render only updates what to
      draw. Leaving C1 detaches the element; coming back re-measures it.

   2. FARM SPACE IS PUT BACK ON EARTH THROUGH ONE PROJECTION. All six real
      farms were projected into farm space through FARM_SPACE (fixtures.js),
      a scale and an offset from Web Mercator — and Leaflet's own plane is Web
      Mercator. So an SVG whose viewBox is a farm-space rectangle lands exactly
      on the ground when it is stretched over that rectangle's two corners:
      no reprojection of any point, just the corners.

   3. THE DRAWING IS REDRAWN AT EVERY ZOOM. Leaflet scales the SVG while a
      zoom animates, which would scale the labels and lines with it; at the end
      of each zoom the SVG is drawn again with `labelScale` and `lineScale`
      worked out from the new zoom, so names and outlines are the same size on
      screen at every zoom, as they are on any map (mapSvg's LIVE note).

   WHEN IT IS NOT USED, C1 draws the picture as before:
     * in a preview — the screen grid and every screenshot tool render C1 into
       their own hosts, and there is only one live map to go round;
     * with ?map=static in the address — for the tools that photograph the
       app and want the same picture every time, not whatever tiles loaded.
   And if Leaflet itself cannot load, the picture is drawn into the map's place.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { toLonLat } from '../core/geo.js';
import { TILE_SOURCES } from '../core/tiles.js';
import { FARM_SPACE } from '../data/fixtures.js';
import { mapSvg, ringsOf, gpsPoint } from './map.js';

const STATIC = new URLSearchParams(globalThis.location?.search ?? '').get('map') === 'static';

/* Screen pixels per farm-space unit of a label, and of a line. mapSvg sizes
   both in farm units (a label's text is 19 of them, a farm outline's casing 8);
   these make that 14 px text and a 7 px casing at every zoom. */
const LABEL_PX = 0.75;
const LINE_PX = 0.9;
/* WF5.060: names show once a farm-space unit is at most this many pixels'
   worth, which is about one zoom step in from all six farms — the scale at
   which "Plot 1" fits inside a plot. */
const LABELS_FROM_UNITS_PER_PX = 1.1;
/* A tap that lands this soon after a drag is the end of the drag, which a
   mouse turns into a click on whatever plot it was released over. */
const DRAG_SETTLE_MS = 350;

/** Whether C1 may be live in this render. */
export function liveMapAvailable() {
  return !STATIC && !state.ui.preview;
}

let view = null;       // { host, L, map, tiles, basemap, overlay, opts, fitKey, lastDrag, failed }
let queued = false;

/**
 * The live map's element, for C1 to mount. Same element every time.
 *
 * @param {object} opts  what mapSvg draws — plots, measure, basemap, layers,
 *                       dateKey, gps, onPlotTap — plus:
 * @param {string} opts.fitKey  the map fits itself to the plots whenever this
 *                              changes (the farm filter); otherwise it stays
 *                              where the farmer left it
 * @param {() => {top: number, bottom: number}} opts.insets  how much of the
 *                              map's top and bottom C1's floating controls
 *                              cover, measured after mount: the fit keeps the
 *                              farms out from under them, and the tiles'
 *                              credit sits above the bottom panel
 */
export function liveMap(opts) {
  view ??= create();
  view.opts = opts;
  // After the shell has mounted the element; one draw however many renders.
  if (!queued) {
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  }
  return view.host;
}

/** C1's own zoom and locate buttons drive the live map through these. */
export const liveMapControls = {
  zoomIn: () => view?.map?.zoomIn(),
  zoomOut: () => view?.map?.zoomOut(),
  /** Fly to the blue dot. False when there is no live map to move. */
  locate() {
    const { map, opts } = view ?? {};
    if (!map || !opts?.gps) return false;
    map.flyTo(toLatLng(gpsPoint(opts.plots, opts.gps)), Math.max(map.getZoom(), 18));
    return true;
  },
};

function create() {
  const v = { host: h('div.livemap'), lastDrag: -Infinity };
  import('../vendor/leaflet/leaflet.js')
    .then((L) => { v.L = L; })
    .catch((error) => { console.warn('[livemap] Leaflet did not load; drawing the picture instead', error); v.failed = true; })
    .finally(draw);
  return v;
}

function draw() {
  const { host, L, opts } = view;
  if (!host.isConnected || !opts) return;      // C1 is not on screen
  if (view.failed) {
    host.replaceChildren(mapSvg(opts));
    return;
  }
  if (!L) return;                              // draws again once it loads
  if (!host.clientWidth || !host.clientHeight) return;

  const insets = opts.insets?.() ?? { top: 0, bottom: 0 };
  host.style.setProperty('--livemap-bottom', `${insets.bottom}px`);

  if (!view.map) {
    view.map = L.map(host, {
      zoomControl: false,            // C1 has its own buttons
      minZoom: 11, maxZoom: 20,
      /* Whole zoom levels only. Between them every tile is scaled by a
         fraction, and the browser leaves hairline seams between neighbours
         across the whole map; a pinch settles on the nearest level instead. */
      zoomSnap: 1,
      attributionControl: true,
    });
    view.map.attributionControl.setPrefix(false);
    view.map.on('dragend', () => { view.lastDrag = performance.now(); });
    view.map.on('zoomend', paint);
  } else {
    // It may have been away (another screen) or resized (rotated, harness).
    view.map.invalidateSize({ pan: false });
  }

  if (view.basemap !== opts.basemap) {
    const source = TILE_SOURCES[opts.basemap] ?? TILE_SOURCES.satellite;
    view.tiles?.remove();
    view.tiles = L.tileLayer(source.url, {
      maxNativeZoom: source.maxNativeZoom, maxZoom: 20,
      attribution: source.attribution,
      // So the worker can store them as ordinary responses — see core/tiles.js.
      crossOrigin: 'anonymous',
      keepBuffer: 4,
    }).addTo(view.map);
    view.basemap = opts.basemap;
  }

  if (view.fitKey !== opts.fitKey) {
    const [x0, y0, x1, y1] = extentOf(opts.plots);
    view.map.fitBounds([toLatLng([x0, y0]), toLatLng([x1, y1])], {
      paddingTopLeft: [16, insets.top + 16],
      paddingBottomRight: [16, insets.bottom + 16],
      animate: view.fitKey !== undefined,      // the first fit is not a move
    });
    view.fitKey = opts.fitKey;
  }

  paint();
}

/* The plots, drawn for the current zoom and laid over the tiles. */
function paint() {
  const { L, map, opts } = view;
  if (!map || !opts || !view.host.isConnected) return;

  const gps = opts.gps ? gpsPoint(opts.plots, opts.gps) : null;
  // A margin round everything drawn, so a farm boundary — drawn outside its
  // plots — and the blue dot are inside the SVG rather than cut by its edge.
  const [x0, y0, x1, y1] = extentOf(opts.plots, gps, 0.35);
  const nw = toLatLng([x0, y0]);
  const se = toLatLng([x1, y1]);

  const zoom = map.getZoom();
  const unitsPerPx = (x1 - x0) / (map.project(se, zoom).x - map.project(nw, zoom).x);

  const svg = mapSvg({
    ...opts,
    onPlotTap: opts.onPlotTap && ((plot) => {
      if (performance.now() - view.lastDrag < DRAG_SETTLE_MS) return;
      opts.onPlotTap(plot);
    }),
    live: {
      extent: [x0, y0, x1 - x0, y1 - y0],
      labelScale: unitsPerPx * LABEL_PX,
      lineScale: unitsPerPx * LINE_PX,
      labels: unitsPerPx <= LABELS_FROM_UNITS_PER_PX,
      gps,
    },
  });

  view.overlay?.remove();
  view.overlay = L.svgOverlay(svg, [nw, se], { interactive: false }).addTo(map);
}

/** Farm space to Leaflet's [lat, lng]. */
function toLatLng(point) {
  const [lon, lat] = toLonLat(FARM_SPACE.unproject(point));
  return [lat, lon];
}

/** [minX, minY, maxX, maxY] of the plots (and a point), grown by `pad` of its size. */
function extentOf(plots, point = null, pad = 0) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const take = ([x, y]) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (const plot of plots) for (const ring of ringsOf(plot)) ring.forEach(take);
  if (point) take(point);
  if (x0 === Infinity) [x0, y0, x1, y1] = [0, 0, 1000, 1000];
  const grow = Math.max(x1 - x0, y1 - y0, 120) * pad;
  return [x0 - grow, y0 - grow, x1 + grow, y1 + grow];
}
