/* ---------------------------------------------------------------------------
   illustrations.js — the two pictures the guided tour asks for that are not
   pictures of screens.

   The 01/09 review wanted a satellite on the panel that explains how the
   service works, and a multi-crop image on the one that closes it. This build
   has no photograph library and should not grow one: everything else in the app
   draws its own imagery, so these do too. The ground under the satellite is the
   same synthesised basemap the map screens use, and the crop strip is five real
   plots out of the fixtures painted with their own measures — which means both
   pictures change when the imagery does, and neither can go stale.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { mapSvg, plotRasterSvg } from './map.js';

/* Whatever the fixtures hold, in a stable order, with a shape to draw. A tour
   panel must never be empty because a plot was renamed. */
function drawablePlots(limit) {
  return (state.db?.plots ?? [])
    .filter((p) => (p.geometry?.length ?? 0) >= 3)
    .slice(0, limit);
}

/**
 * A satellite over farmland — the panel that says what we are looking with.
 *
 * The satellite is drawn rather than photographed: two panels, a body and a
 * dish, in the app's own greens against the basemap. It sits in the upper
 * third, so the fields it is watching are the larger half of the picture.
 */
export function satelliteOverFarmland() {
  const plots = drawablePlots(6);
  return h('div.tourart.tourart--bleed', { style: { position: 'relative' } },
    // The ground. Boundaries and labels off: this is a photograph of farmland,
    // not a working map, and a plot label on it invites a tap that does nothing.
    h('div', { style: { position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' } },
      mapSvg({ plots, measure: 'ndvi', basemap: 'satellite', layers: { boundaries: false, labels: false } })),
    h('svg', {
      viewBox: '0 0 200 120', preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': 'A satellite passing over farmland',
      style: { position: 'relative' },
    },
    // A thin haze at the top, so the satellite reads as being above the ground
    // rather than lying on it.
    h('defs', {},
      h('linearGradient', { id: 'sky-fade', x1: '0', y1: '0', x2: '0', y2: '1' },
        h('stop', { offset: '0', 'stop-color': '#0b1a15', 'stop-opacity': '.55' }),
        h('stop', { offset: '1', 'stop-color': '#0b1a15', 'stop-opacity': '0' }))),
    h('rect', { x: 0, y: 0, width: 200, height: 62, fill: 'url(#sky-fade)' }),
    h('g', { transform: 'translate(100 40) rotate(-14)' },
      // solar wings
      h('rect', { x: -46, y: -9, width: 30, height: 18, rx: 1.5, fill: '#2d6ea8', stroke: '#dfe9f2', 'stroke-width': 1 }),
      h('rect', { x: 16, y: -9, width: 30, height: 18, rx: 1.5, fill: '#2d6ea8', stroke: '#dfe9f2', 'stroke-width': 1 }),
      h('path', { d: 'M-46 -3 h30 M-46 3 h30 M16 -3 h30 M16 3 h30', stroke: '#dfe9f2', 'stroke-width': .7, opacity: .8 }),
      h('path', { d: 'M-16 0 h32', stroke: '#dfe9f2', 'stroke-width': 2 }),
      // body and dish
      h('rect', { x: -15, y: -11, width: 30, height: 22, rx: 3, fill: '#f2f5f3', stroke: '#0d1411', 'stroke-width': 1.2 }),
      h('rect', { x: -15, y: -11, width: 30, height: 7, rx: 3, fill: '#c9d6cf' }),
      h('ellipse', { cx: 0, cy: 15, rx: 9, ry: 5, fill: '#f2f5f3', stroke: '#0d1411', 'stroke-width': 1.2 }),
      h('path', { d: 'M0 11 v-4', stroke: '#0d1411', 'stroke-width': 1.2 })),
    // The beam, which is the whole point of the picture: this thing is looking
    // at that ground.
    h('path', {
      d: 'M96 58 L60 118 L146 118 L110 58 Z',
      fill: '#ffffff', opacity: .16,
    })));
}

/**
 * Five fields, five crops — the picture on the panel about results.
 *
 * Real plots, painted with the measure the app paints them with everywhere
 * else, so the strip is a row of this farm rather than a stock photograph of
 * somebody else's.
 */
export function cropStrip() {
  const plots = drawablePlots(5);
  if (!plots.length) return h('div.tourart');
  return h('div.tourart.tourart--bleed', { style: { gap: '4px', padding: 0 } },
    plots.map((p, i) => h('div', {
      style: {
        flex: '1 1 0', minWidth: 0, alignSelf: 'stretch', overflow: 'hidden',
        borderStartStartRadius: i === 0 ? 'var(--radius-lg)' : 0,
        borderEndStartRadius: i === 0 ? 'var(--radius-lg)' : 0,
        borderStartEndRadius: i === plots.length - 1 ? 'var(--radius-lg)' : 0,
        borderEndEndRadius: i === plots.length - 1 ? 'var(--radius-lg)' : 0,
      },
    }, plotRasterSvg(p, i % 2 ? 'ndwi' : 'ndvi'))));
}
