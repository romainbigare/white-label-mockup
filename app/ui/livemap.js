/* ---------------------------------------------------------------------------
   livemap.js — the live maps: real tiles that pan, pinch and stream.

   Three kinds of screen carry one: C1 (the Map tab, the whole screen), B1 (the
   card at the top of My Farm) and B2 and B5 (the card at the top of a crop
   plot and of a tree group). Every other map in the app is a picture
   (map.js): the vendored photograph with the plots drawn on it, fitted once —
   right for a thumbnail, a sheet or a slide. These are where a tablet demo
   wants what a farmer's phone would do — drag the ground, pinch out to see the
   neighbours, pinch into one palm — so this module puts the SAME drawing on a
   Leaflet map over Esri tiles (core/tiles.js).
   The plots, rasters, outlines and labels are still mapSvg's; only the ground
   and the frame are Leaflet's. A photograph also runs out: it is a fixed patch
   of ground, and a wide landscape card showed its edges.

   FOUR THINGS MAKE IT WORK, and each is a place to look when it does not:

   1. ONE MAP PER SCREEN, FOR THE LIFE OF THE PAGE. The shell rebuilds a
      screen's DOM on every commit, and a Leaflet map rebuilt every commit
      would forget where it was looking and fetch its tiles again. So each
      screen's map and its element live here under a key ('C1', 'B1', 'B2',
      'B5'), and liveMap() hands the same element back to every render of that
      screen, which mounts it again; the view survives. A render only updates what to
      draw. Leaving a screen detaches its element; coming back re-measures it.

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

   4. IT ONLY MOVES ITSELF WHEN WHAT IT SHOWS CHANGES. Each map fits to its
      subject — the farms with their boundaries, or one plot with ground round
      it — when `fitKey` changes (another farm, another plot), and otherwise
      stays where the farmer left it. A change made on the screen glides there;
      arriving from elsewhere does not, because a map sliding across the desert
      from the last plot to this one is not news.

   WHEN IT IS NOT USED, the screens draw the picture as before:
     * in a preview — the screen grid and every screenshot tool render screens
       into their own hosts, and each live map can only be in one place;
     * with ?map=static in the address — for the tools that photograph the
       app and want the same picture every time, not whatever tiles loaded.
   And if Leaflet itself cannot load, the picture is drawn into the map's place.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { toLonLat } from '../core/geo.js';
import { TILE_SOURCES } from '../core/tiles.js';
import { FARM_SPACE } from '../data/fixtures.js';
import { mapSvg, ringsOf, gpsPoint, farmBoundary } from './map.js';

const STATIC = new URLSearchParams(globalThis.location?.search ?? '').get('map') === 'static';

/* Screen pixels per farm-space unit of a label, and of a line. mapSvg sizes
   both in farm units (a label's text is 19 of them, a farm outline's casing 8);
   these make that 14 px text and a 7 px casing at every zoom. */
const LABEL_PX = 0.75;
const LINE_PX = 0.9;
/* A tap that lands this soon after a drag is the end of the drag, which a
   mouse turns into a click on whatever plot it was released over. */
const DRAG_SETTLE_MS = 350;
/* Room round a fitted subject, in pixels, on top of the screen's own insets:
   a farm boundary on the very edge of a card reads as cropped, which is what
   the photograph-sized cards were criticised for. And a fit never comes closer
   than zoom 18, so a small plot opens with the fields round it rather than
   filling the card with its own blurred pixels. (Not a share of the subject's
   size: zoom moves in whole steps, so any proportional margin is as likely to
   cost a whole step as to add a few metres.) */
const FIT_PAD_PX = 24;
const FIT_MAX_ZOOM = 18;
/* A trackpad pinch arrives as a burst of ctrl+wheel events; one step per this. */
const WHEEL_STEP_MS = 220;

/** Whether a screen may be live in this render. */
export function liveMapAvailable() {
  return !STATIC && !state.ui.preview;
}

// Imported on first use: the screens without a live map never pay for it.
let leaflet = null;
const loadLeaflet = () => (leaflet ??= import('../vendor/leaflet/leaflet.js'));
const views = new Map();   // key → { host, map, tiles, basemap, overlay, opts, fitKey, arrived, lastDrag, queued, failed }

/**
 * A screen's live map element, to mount. The same element every render.
 *
 * @param {string} key  one per screen: its view is remembered under it
 * @param {object} opts what mapSvg draws — plots, measure, basemap, layers,
 *                      dateKey, gps, onPlotTap, selectedId — plus:
 * @param {string} opts.fitKey  fit to the subject whenever this changes
 * @param {'farms'|'plot'} [opts.fitTo]  the subject: the plots' farms, each
 *                      whole with its boundary (default), or the plots alone
 * @param {object} [opts.focus]  one plot among those drawn to fit instead —
 *                      C1 opened from a plot screen
 * @param {() => {top?: number, bottom?: number}} [opts.insets]  how much of the
 *                      map's top and bottom the screen's floating controls
 *                      cover, measured after mount: the fit keeps the subject
 *                      out from under them, and the tiles' credit sits above
 *                      whatever covers the bottom. Not for a control in a
 *                      corner: it spends a band the width of the map to clear
 *                      something a centred subject is rarely under
 * @param {boolean} [opts.inPage]  a card in a scrolling page rather than a
 *                      whole screen: the mouse wheel scrolls the page, and a
 *                      trackpad pinch (ctrl+wheel) zooms the map
 */
export function liveMap(key, opts) {
  let view = views.get(key);
  if (!view) {
    view = { key, host: h('div.livemap'), lastDrag: -Infinity, arrived: true };
    views.set(key, view);
  }
  // Rendered while not on screen: this render is an arrival, not a change.
  if (!view.host.isConnected) view.arrived = true;
  view.opts = opts;
  // After the shell has mounted the element; one draw however many renders.
  if (!view.queued) {
    view.queued = true;
    requestAnimationFrame(() => { view.queued = false; draw(view); });
  }
  return view.host;
}

/** A screen's own map buttons drive its live map through these. */
export function liveMapControls(key) {
  const view = views.get(key);
  return {
    /** Fly to the blue dot. False when there is no live map to move. */
    locate() {
      const { map, opts } = view ?? {};
      if (!map || !opts?.gps) return false;
      map.flyTo(toLatLng(gpsPoint(opts.plots, opts.gps)), Math.max(map.getZoom(), 18));
      return true;
    },
  };
}

async function draw(view) {
  const { host, opts } = view;
  if (!host.isConnected || !opts) return;      // the screen has gone
  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    if (!view.failed) console.warn('[livemap] Leaflet did not load; drawing the picture instead', error);
    view.failed = true;
  }
  if (view.failed) {
    host.replaceChildren(mapSvg(opts));
    return;
  }
  if (!host.isConnected || !host.clientWidth || !host.clientHeight) return;

  const insets = { top: 0, bottom: 0, ...opts.insets?.() };
  host.style.setProperty('--livemap-bottom', `${insets.bottom}px`);

  if (!view.map) {
    view.map = L.map(host, {
      zoomControl: false,            // the screens have their own buttons, or pinch
      minZoom: 11, maxZoom: 20,
      /* Whole zoom levels only. Between them every tile is scaled by a
         fraction, and the browser leaves hairline seams between neighbours
         across the whole map; a pinch settles on the nearest level instead. */
      zoomSnap: 1,
      scrollWheelZoom: !opts.inPage,
      attributionControl: true,
    });
    view.map.attributionControl.setPrefix(false);
    view.map.on('dragend', () => { view.lastDrag = performance.now(); });
    view.map.on('zoomend', () => paint(view));
    if (opts.inPage) pinchWheel(view);
  } else {
    // It may have been away (another screen) or resized (rotated, harness).
    view.map.invalidateSize({ pan: false });
  }

  /* The credit goes in the bottom corner on the reading side, which is the
     side the cards leave free (their own buttons sit at the end) — and it
     follows the language when that flips the page. */
  const corner = getComputedStyle(host).direction === 'rtl' ? 'bottomright' : 'bottomleft';
  if (view.map.attributionControl.getPosition() !== corner) view.map.attributionControl.setPosition(corner);

  // Only C1 offers a choice (C2); every card is satellite.
  const basemap = opts.basemap ?? 'satellite';
  if (view.basemap !== basemap) {
    const source = TILE_SOURCES[basemap] ?? TILE_SOURCES.satellite;
    view.tiles?.remove();
    view.tiles = L.tileLayer(source.url, {
      maxNativeZoom: source.maxNativeZoom, maxZoom: 20,
      attribution: source.attribution,
      // So the worker can store them as ordinary responses — see core/tiles.js.
      crossOrigin: 'anonymous',
      keepBuffer: 4,
    }).addTo(view.map);
    view.basemap = basemap;
  }

  if (view.fitKey !== opts.fitKey) {
    const subject = opts.focus ? ringsOf(opts.focus)
      : opts.fitTo === 'plot' ? opts.plots.flatMap(ringsOf) : drawnRings(opts);
    const [x0, y0, x1, y1] = extentOf(subject);
    view.map.fitBounds([toLatLng([x0, y0]), toLatLng([x1, y1])], {
      paddingTopLeft: [FIT_PAD_PX, insets.top + FIT_PAD_PX],
      paddingBottomRight: [FIT_PAD_PX, insets.bottom + FIT_PAD_PX],
      maxZoom: FIT_MAX_ZOOM,
      animate: !view.arrived,
    });
    view.fitKey = opts.fitKey;
  }
  view.arrived = false;

  paint(view);
}

/* The plots, drawn for the current zoom and laid over the tiles. */
async function paint(view) {
  const { map, opts } = view;
  if (!map || !opts || !view.host.isConnected) return;
  const L = await loadLeaflet();

  const gps = opts.gps ? gpsPoint(opts.plots, opts.gps) : null;
  // Round everything drawn — the farm boundaries stand outside their plots —
  // with a margin, so nothing is cut by the edge of the SVG.
  const [x0, y0, x1, y1] = extentOf([...drawnRings(opts), ...(gps ? [[gps]] : [])], 0.2);
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
      gps,
    },
  });

  view.overlay?.remove();
  view.overlay = L.svgOverlay(svg, [nw, se], { interactive: false }).addTo(map);
}

/* A card in a page: the wheel is the page's, so the map zooms only on a
   trackpad pinch, which browsers deliver as a wheel event with ctrlKey set
   (and so does ctrl + a mouse wheel). Without this, scrolling My Farm with
   the pointer over its map zoomed the map instead of moving the page. */
function pinchWheel(view) {
  let last = 0;
  view.host.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const now = performance.now();
    if (now - last < WHEEL_STEP_MS) return;
    last = now;
    const { map } = view;
    map.setZoomAround(map.mouseEventToContainerPoint(event), map.getZoom() + (event.deltaY < 0 ? 1 : -1));
  }, { passive: false });
}

/** Farm space to Leaflet's [lat, lng]. */
function toLatLng(point) {
  const [lon, lat] = toLonLat(FARM_SPACE.unproject(point));
  return [lat, lon];
}

/** Every ring mapSvg draws: the plots, and the boundary of each of their farms. */
function drawnRings(opts) {
  const farms = [...new Set(opts.plots.map((p) => p.farmId))];
  return [...opts.plots.flatMap(ringsOf), ...farms.map(farmBoundary).filter(Boolean)];
}

/** [minX, minY, maxX, maxY] of some rings, grown by `pad` of their size. */
function extentOf(rings, pad = 0) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x0 === Infinity) [x0, y0, x1, y1] = [0, 0, 1000, 1000];
  const grow = Math.max(x1 - x0, y1 - y0, 120) * pad;
  return [x0 - grow, y0 - grow, x1 + grow, y1 + grow];
}
