/* ---------------------------------------------------------------------------
   icons.js — one 24×24 grid, one stroke weight, one place to draw a glyph.

   THE GEOMETRY IS NOT HERE ANY MORE. The mockup used to carry ~90 hand-written
   path strings, and the v1.5.4 review said what everybody could see: they
   looked hand-drawn, because they were. They come out of Lucide now — a real,
   maintained, ISC-licensed icon set — vendored into icons.data.js by
   tools/build-icons.mjs rather than fetched from a CDN, because this file is
   opened from file:// by reviewers and photographed by two headless browsers,
   and none of those should depend on a network round trip to have icons.

   What stayed here is what a mockup should own: the size, the stroke weight,
   how a filled status glyph differs from a stroked one, and WF2.014.

   WF2.014: an icon never travels alone in this app — every call site pairs it
   with a text label. The `icon()` helper therefore always renders
   aria-hidden="true" and leaves the accessible name to the label beside it.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import GLYPHS from './icons.data.js';

/* WF2.008's scale is the one set where the shape carries meaning, so the two
   filled states are drawn from the same outline as their stroked twin rather
   than from a second glyph that might not match it. `circle-dashed` is Lucide's
   own dashed circle and needs no help. */
const FILLED = new Set(['circle-filled', 'triangle-filled']);

export function icon(name, size = 20, extraClass = '') {
  const inner = GLYPHS[name];
  const attrs = {
    viewBox: '0 0 24 24', width: size, height: size,
    'aria-hidden': 'true', focusable: 'false',
    class: `ico ${extraClass}`.trim(),
  };
  if (!inner) return h('svg', attrs);
  return h('svg', {
    ...attrs,
    // A filled state reads as solid at 15 px, which is the size the four-state
    // scale is drawn at down a list; a stroked one at that size reads as a ring.
    fill: FILLED.has(name) ? 'currentColor' : 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    html: inner,
  });
}

/* One icon map, not two. There used to be a TASK_ICON beside this with nine
   entries — irrigation, fertiliser, spraying, planting, pruning, harvest,
   inspection, maintenance, other — for a kind of record the app no longer has.
   WF5.105's icons, filtering and reporting all hang off the advice type now. */
export const ADVICE_ICON = {
  irrigation: 'droplet', nutrition: 'sprout', protection: 'shield',
  weather: 'cloud', harvest: 'basket',
};
