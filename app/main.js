/* ---------------------------------------------------------------------------
   main.js — boots the mockup and drives every re-render.

   The composition itself lives in shell.js, because the harness screen grid
   needs to compose screens too. This file owns the running app: the live route,
   scroll memory, deep links, and the debug handle.
   --------------------------------------------------------------------------- */

import { state, subscribe, commit } from './core/store.js';
import { current, nav, initHashListener, enterOnboarding, closeOverlay, back } from './core/router.js';
import { SCREENS, resolveDefaultRoutes } from './screens/index.js';
import { composeApp } from './shell.js';
import { applyDevice, renderStatusBar, renderControls, renderCaption, initControls } from './harness.js';
import { installCatalogues } from './i18n/index.js';

const appEl = document.getElementById('app');

function renderApp() {
  const { view, param } = current();
  composeApp(appEl, view, param, { scrollId: 'scroll' });
  restoreScroll(view, param);
}

/* Scroll position is per route, the way a native stack behaves. */
const scrollMemory = new Map();
let lastKey = null;

function restoreScroll(view, param) {
  const key = `${nav.mode}:${nav.tab}:${view}:${param ?? ''}`;
  const el = document.getElementById('scroll');
  if (!el) return;
  if (key === lastKey) el.scrollTop = scrollMemory.get(key) ?? 0;
  else scrollMemory.set(key, 0);
  lastKey = key;
  el.addEventListener('scroll', () => scrollMemory.set(key, el.scrollTop), { passive: true });
}

/* -- boot ---------------------------------------------------------------- */

function render() {
  applyDevice();
  renderApp();
  renderStatusBar();          // after the app: it reads the screen's barLight
  renderControls();
  renderCaption();
}

installCatalogues();
initControls();
resolveDefaultRoutes(state.db);
initHashListener();
subscribe(render);

// Deep link support: #/home/B2:farm-1 opens straight into that screen.
const hash = location.hash.replace(/^#\/?/, '');
if (hash) {
  const parts = hash.split('/');
  const { jump } = await import('./core/router.js');
  if (parts.length === 2) jump(parts[1], parts[0]);
  else jump(parts[0]);
} else {
  enterOnboarding('A1');
}

render();

/* A deliberate handle on the running app. The harness uses it, tools/smoke.mjs
   drives every screen through it, and a reviewer can poke at state from the
   browser console — e.g. `wafra.setLanguage('ar')`. */
const router = await import('./core/router.js');
const i18n = await import('./core/i18n.js');
globalThis.wafra = {
  state, render, SCREENS,
  jump: router.jump, go: router.go, openSheet: router.openSheet, openModal: router.openModal,
  setLanguage: i18n.setLanguage, catalogue: i18n.catalogueKeys, coverage: i18n.missingReport,
  commit,
};

/* Browser back gesture maps to the app's back stack. */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.ui.overlay) { closeOverlay(); return; }
  if (e.key === 'Backspace' && e.target === document.body) { e.preventDefault(); back(); }
});
