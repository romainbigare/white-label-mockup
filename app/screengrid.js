/* ---------------------------------------------------------------------------
   screengrid.js — every screen at once, as a contact sheet.

   Reviewer tooling, not the product. Each registered screen is rendered live
   into its own 360 × 640 tile — the WF-002 acceptance size, so the sheet shows
   the size the specification asks to be tested at — and the whole sheet scales
   with one CSS transform.

   Three things make it safe to draw sixty screens into a running app:

     * English is forced for the duration, and put back afterwards. A contact
       sheet is for finding a screen, and the identifiers and titles a reviewer
       is scanning for are English.
     * `state.ui.preview` is raised, so render-time side effects stand down.
       Drawing every advice card in the app must not mark them all as read.
     * Tiles render on demand as they scroll into view. Sixty synthesised
       satellite rasters at once is a visible stall on a laptop.

   Everything else the tiles show — role, plan, connection, demo mode — is the
   live session, deliberately. Switching to Worker and reopening the sheet is
   the fastest way to see what a worker cannot reach.
   --------------------------------------------------------------------------- */

import { h, mount } from './core/dom.js';
import { state } from './core/store.js';
import { jump, parseRoute, tabForView } from './core/router.js';
import { SCREENS, SCREEN_GROUPS } from './screens/index.js';
import { PLANS } from './core/entitlements.js';
import { composeApp } from './shell.js';

/* Fixed, not taken from the device presets: the sheet is an acceptance-size
   check as much as an index, and a sheet that changed shape with the device
   dropdown would be comparing screens against different rulers. */
const TILE = { w: 360, h: 640, safeTop: 26, safeBottom: 10 };
const ZOOM = { min: 0.2, max: 1, step: 0.05, initial: 0.45 };

let zoom = ZOOM.initial;
let observer = null;

const host = () => document.getElementById('screen-grid');

export function openScreenGrid() {
  const el = host();
  el.hidden = false;
  mount(el, panel());
  setZoom(zoom);
  observeTiles(el);
}

export function closeScreenGrid() {
  const el = host();
  if (el.hidden) return;
  observer?.disconnect();
  observer = null;
  el.hidden = true;
  el.replaceChildren();          // tiles are rebuilt on reopen, against fresh state
}

/* -- the sheet ------------------------------------------------------------ */

function panel() {
  const ids = SCREEN_GROUPS.flatMap((g) => g.ids).filter((id) => SCREENS[id]);
  return h('div.sgrid__panel',
    h('div.sgrid__bar',
      h('div.sgrid__heading',
        h('h2', 'All screens'),
        h('span', `${ids.length} screens · English · ${TILE.w} × ${TILE.h} · `
          + `${state.session.role} · ${PLANS[state.session.plan].label}`)),
      h('div.sgrid__zoom',
        h('button', { onclick: () => setZoom(zoom - ZOOM.step), 'aria-label': 'Zoom out', title: 'Zoom out' }, '−'),
        h('input.sgrid__range', {
          type: 'range', min: ZOOM.min, max: ZOOM.max, step: ZOOM.step, value: String(zoom),
          'aria-label': 'Zoom', oninput: (e) => setZoom(Number(e.target.value)),
        }),
        h('button', { onclick: () => setZoom(zoom + ZOOM.step), 'aria-label': 'Zoom in', title: 'Zoom in' }, '+'),
        h('span.sgrid__pct')),
      h('button.sgrid__close', { onclick: closeScreenGrid }, 'Close')),
    SCREEN_GROUPS.map((group) => h('section.sgrid__group',
      h('h3', group.name),
      h('div.sgrid__row', group.ids.filter((id) => SCREENS[id]).map(cell)))));
}

function cell(id) {
  const meta = SCREENS[id];
  const open = () => { closeScreenGrid(); jump(meta.route ?? id); };
  return h('div.sgrid__cell', { onclick: open, dataset: { screen: id } },
    // A picture of a screen, not a working one: pointer events are off in CSS,
    // so a tap anywhere on the tile means "take me there".
    h('div.sgrid__shot', { 'aria-hidden': 'true' },
      h('div.sgrid__scale', h('div.app', {
        style: { '--safe-top': `${TILE.safeTop}px`, '--safe-bottom': `${TILE.safeBottom}px`, '--fs': '1' },
      }))),
    // The accessible control, and the one that answers to a keyboard.
    h('button.sgrid__cap', { onclick: (e) => { e.stopPropagation(); open(); } },
      h('b', id), h('span', meta.title)));
}

/* -- zoom ----------------------------------------------------------------- */

function setZoom(next) {
  zoom = Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, next)) * 100) / 100;
  const el = host();
  el.style.setProperty('--z', String(zoom));
  const pct = el.querySelector('.sgrid__pct');
  if (pct) pct.textContent = `${Math.round(zoom * 100)}%`;
  const range = el.querySelector('.sgrid__range');
  if (range && Number(range.value) !== zoom) range.value = String(zoom);
}

/* -- lazy rendering -------------------------------------------------------- */

function observeTiles(el) {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      renderTile(entry.target);
    }
  }, { root: el, rootMargin: '500px 0px' });
  for (const tile of el.querySelectorAll('.sgrid__cell')) observer.observe(tile);
}

function renderTile(tile) {
  const id = tile.dataset.screen;
  const { view, param } = parseRoute(SCREENS[id].route ?? id);
  // Onboarding owns the whole screen; the tab bar would be a lie there.
  const onboarding = view.startsWith('A') || view === 'LOGIN' || view === 'FORGOT';
  preview(() => composeApp(tile.querySelector('.app'), view, param, {
    inApp: !onboarding, tab: tabForView(view), overlays: false,
  }));
}

/** English, no side effects, and the session put back exactly as it was found. */
function preview(render) {
  const lang = state.session.lang;
  state.session.lang = 'en';
  state.ui.preview = true;
  try { render(); } finally {
    state.session.lang = lang;
    state.ui.preview = false;
  }
}
