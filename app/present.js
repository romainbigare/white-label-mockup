/* ---------------------------------------------------------------------------
   present.js — slideshow mode. Reviewer tooling, not the product.

   A fixed walk through the screens a client demo is built on, one at a time,
   on one phone, with nothing around it but a back arrow and a next arrow. The
   reviewer bar goes away for the length of it, so what is on the wall is the
   app and the two arrows that move it on.

   The screen still works while presenting — buttons, filters, sheets, typing —
   so a presenter can show what it does. What it cannot do is take the device
   to another screen: the router is locked (lockScreen in core/router.js), so
   a presenter who taps a card must not find themselves three screens off the
   walk with no arrow that brings them back.

   The device the reviewer had chosen is put back on exit. Presenting is a mode
   you leave, not a setting you change.
   --------------------------------------------------------------------------- */

import { h, mount } from './core/dom.js';
import { state, commit } from './core/store.js';
import { jump, lockScreen } from './core/router.js';
import { SCREENS } from './screens/index.js';
import { closeScreenGrid } from './screengrid.js';

export const SLIDES = ['C1', 'B5', 'B7', 'D1', 'D2', 'D3', 'D4'];
const PRESET = 'iphone-16-pro';

let index = -1;            // -1: not presenting
let saved = null;          // the device settings to put back on exit

const host = () => document.getElementById('present');

export function presenting() {
  return index >= 0;
}

export function startPresentation() {
  if (presenting()) return;
  closeScreenGrid({ keepHash: true });
  saved = { ...state.device };
  // The class goes on before the commit, so the stage the "fit" zoom measures
  // is already the full window with the bar gone.
  document.body.classList.add('presenting');
  lockScreen(true);
  addEventListener('keydown', onKey, true);
  Object.assign(state.device, { presetId: PRESET, orientation: 'portrait', zoom: 'fit' });
  show(0);
}

export function stopPresentation() {
  if (!presenting()) return;
  index = -1;
  document.body.classList.remove('presenting');
  lockScreen(false);
  removeEventListener('keydown', onKey, true);
  host().replaceChildren();
  Object.assign(state.device, saved);
  saved = null;
  commit('device');
}

function show(i) {
  index = Math.max(0, Math.min(SLIDES.length - 1, i));
  const id = SLIDES[index];
  // jump() commits, which re-renders the device at the preset set above.
  jump(SCREENS[id]?.route ?? id);
  renderChrome();
}

/* Arrow keys move, Escape leaves. Captured on the window, so the harness's own
   Escape handlers never see a key meant for the slideshow. */
function onKey(e) {
  const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (step) show(index + step);
  else if (e.key === 'Escape') stopPresentation();
  else return;
  e.preventDefault();
  e.stopPropagation();
}

/* Pinned with left and right rather than inline-start and end: the arrows are
   the presenter's, and they do not mirror when the app is in Arabic. */
function renderChrome() {
  const first = index === 0;
  const last = index === SLIDES.length - 1;
  mount(host(),
    arrow('present__arrow--prev', 'Previous screen', 'M15 5l-7 7 7 7', first, () => show(index - 1)),
    arrow('present__arrow--next', 'Next screen', 'M9 5l7 7-7 7', last, () => show(index + 1)),
    h('div.present__bar',
      h('span.present__count', `${index + 1} / ${SLIDES.length}`),
      h('button.present__exit', { onclick: stopPresentation, title: 'Leave the slideshow (Esc)' }, 'Exit')));
}

function arrow(cls, label, d, disabled, onclick) {
  return h(`button.present__arrow.${cls}`, { onclick, disabled, 'aria-label': label, title: label },
    h('svg', { viewBox: '0 0 24 24', width: 28, height: 28, fill: 'none', 'aria-hidden': 'true' },
      h('path', { d, stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })));
}
