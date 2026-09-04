/* ---------------------------------------------------------------------------
   screengrid.js — every screen at once, as a contact sheet.

   Reviewer tooling, not the product. Each registered screen is rendered live
   into its own iPhone 16 tile, 393 × 852, and the whole sheet scales with one
   CSS transform. That is a presentation size rather than an acceptance one:
   WF2.002's 360 × 640 is still checked, on every screen, by tools/smoke.mjs.

   The sheet has a URL — #/screens, with the zoom on the end — so "look at this"
   is a link rather than a set of instructions.

   Three things make it safe to draw sixty screens into a running app:

     * English is forced for the duration, and put back afterwards. A contact
       sheet is for finding a screen, and the identifiers and titles a reviewer
       is scanning for are English.
     * `state.ui.preview` is raised, so render-time side effects stand down.
       Drawing every advice card in the app must not mark them all as read.
     * Tiles render on demand as they scroll into view. Sixty synthesised
       satellite rasters at once is a visible stall on a laptop.

   Everything else the tiles show — role, plan, connection — is the
   live session, deliberately. Switching to Supervisor and reopening the sheet
   is the fastest way to see what a supervisor cannot reach.
   --------------------------------------------------------------------------- */

import { h, mount } from './core/dom.js';
import { state } from './core/store.js';
import { jump, parseRoute, tabForView } from './core/router.js';
import { SCREENS, SCREEN_GROUPS } from './screens/index.js';
import { PLANS } from './core/entitlements.js';
import { composeApp, TILE } from './shell.js';

/* TILE — the phone a composed picture of a screen is drawn on — lives in
   shell.js, because the guided tour's snapshots are drawn on the same one and
   two tiles of different shapes would compare screens against different
   rulers. */
const ZOOM = { min: 0.2, max: 1, step: 0.05, initial: 0.4 };
const ROUTE = 'screens';

let zoom = ZOOM.initial;
let observer = null;
let returnHash = '';

const host = () => document.getElementById('screen-grid');

export function screenGridOpen() {
  return !host().hidden;
}

export function openScreenGrid({ fromUrl = false } = {}) {
  const el = host();
  if (!el.hidden) return;
  // Where to put the reviewer back when they close it. A link straight to the
  // sheet has nothing behind it, so Close falls through to Home.
  returnHash = fromUrl ? '' : location.hash;
  el.hidden = false;
  el.style.setProperty('--tile-w', `${TILE.w}px`);
  el.style.setProperty('--tile-h', `${TILE.h}px`);
  mount(el, panel());
  setZoom(zoom, { silent: true });
  observeTiles(el);
  writeHash();
}

export function closeScreenGrid({ keepHash = false } = {}) {
  const el = host();
  if (el.hidden) return;
  observer?.disconnect();
  observer = null;
  el.hidden = true;
  el.replaceChildren();          // tiles are rebuilt on reopen, against fresh state
  if (!keepHash) location.hash = returnHash || '#/home/B2:farm-1';
}

/* -- the URL --------------------------------------------------------------
   #/screens, or #/screens/z60 to pin the zoom. It sits in the same hash the
   router mirrors screens into, so the two never fight: the router ignores a
   hash it does not recognise as a screen, and main.js hands this one here. */

export function screenGridRoute(raw) {
  const [head, tail] = String(raw).split('/');
  if (head !== ROUTE) return false;
  const z = /^z(\d{1,3})$/.exec(tail ?? '');
  if (z) zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, Number(z[1]) / 100));
  return true;
}

function writeHash() {
  const next = `#/${ROUTE}/z${Math.round(zoom * 100)}`;
  if (location.hash !== next) location.hash = next;
}

/* -- the sheet ------------------------------------------------------------ */

function panel() {
  const ids = SCREEN_GROUPS.flatMap((g) => g.ids).filter((id) => SCREENS[id]);
  return h('div.sgrid__panel',
    h('div.sgrid__bar',
      h('div.sgrid__heading',
        h('h2', 'All screens'),
        h('span', `${ids.length} screens · English · iPhone 16 · `
          + `${state.session.role} · ${PLANS[state.session.plan].label}`)),
      h('div.sgrid__zoom',
        h('button', { onclick: () => setZoom(zoom - ZOOM.step), 'aria-label': 'Zoom out', title: 'Zoom out' }, '−'),
        h('input.sgrid__range', {
          type: 'range', min: ZOOM.min, max: ZOOM.max, step: ZOOM.step, value: String(zoom),
          'aria-label': 'Zoom', oninput: (e) => setZoom(Number(e.target.value)),
        }),
        h('button', { onclick: () => setZoom(zoom + ZOOM.step), 'aria-label': 'Zoom in', title: 'Zoom in' }, '+'),
        h('span.sgrid__pct')),
      h('button.sgrid__close', { onclick: () => closeScreenGrid() }, 'Close')),
    SCREEN_GROUPS.map((group) => h('section.sgrid__group',
      h('h3', group.name),
      h('div.sgrid__row', group.ids.filter((id) => SCREENS[id]).map(cell)))));
}

function cell(id) {
  const meta = SCREENS[id];
  const open = () => { closeScreenGrid({ keepHash: true }); jump(meta.route ?? id); };
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

function setZoom(next, { silent = false } = {}) {
  zoom = Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, next)) * 100) / 100;
  if (!silent) writeHash();
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
  const onboarding = view.startsWith('A') || view === 'FORGOT';
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
