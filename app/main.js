/* ---------------------------------------------------------------------------
   main.js — composes the app shell and drives every re-render.

   A screen module returns a plain description:
       { top, body, dock, fab, tabs, barLight }
   and this file assembles it with the banners, tab bar and overlay layer. That
   keeps two global rules in ONE place instead of sixty:
     * WF-165 — the demo banner is on every screen and is not dismissible.
     * WF-791 — the connectivity indicator is on every screen.
   A screen physically cannot forget them.
   --------------------------------------------------------------------------- */

import { h, mount, when } from './core/dom.js';
import { state, subscribe, commit } from './core/store.js';
import { current, nav, initHashListener, enterOnboarding, closeOverlay, back } from './core/router.js';
import { dir } from './core/i18n.js';
import { SCREENS, resolveDefaultRoutes } from './screens/index.js';
import { renderOverlay } from './screens/overlays.js';
import { tabBar } from './ui/components.js';
import { badges } from './screens/badges.js';
import { banners } from './screens/banners.js';
import { applyDevice, renderControls, renderCaption } from './harness.js';
import { installCatalogues } from './i18n/index.js';
import { icon } from './ui/icons.js';

const appEl = document.getElementById('app');

function renderApp() {
  const { view, param } = current();
  const screen = SCREENS[view];

  appEl.dir = dir();                                   // WF-751 / WF-752
  appEl.classList.toggle('show-reqs', state.ui.showReqIds);

  if (!screen) {
    mount(appEl, h('div.page', h('p', `No screen registered for "${view}".`)));
    return;
  }

  let out;
  try {
    out = screen.render(param) ?? {};
  } catch (error) {
    console.error(`[${view}]`, error);
    out = { body: h('div.page', h('pre', { style: { fontSize: '12px', whiteSpace: 'pre-wrap' } }, String(error?.stack ?? error))) };
  }

  appEl.dataset.barLight = String(!!out.barLight);
  appEl.style.setProperty('--chrome-bg', out.chromeBg ?? 'var(--paper)');
  const showTabs = out.tabs !== false && nav.mode === 'app';

  mount(appEl,
    banners(),
    out.top ?? null,
    h(`div.app__scroll${out.scrollClass ? `.${out.scrollClass}` : ''}`, { id: 'scroll' }, out.body ?? null),
    out.dock ?? null,
    when(showTabs, () => tabBar({ activeTab: nav.tab, badges: badges() })),
    out.fab ?? null,
    when(state.ui.overlay, () => renderOverlay(state.ui.overlay)),
    when(state.ui.toast, () => h(`div.toast${state.ui.toast.tone === 'warn' ? '.toast--warn' : ''}`,
      icon(state.ui.toast.tone === 'warn' ? 'warning' : 'check', 18),
      h('span', state.ui.toast.text))));

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
  renderControls();
  renderCaption();
}

installCatalogues();
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
