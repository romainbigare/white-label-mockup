/* ---------------------------------------------------------------------------
   router.js — mobile navigation semantics on a static page.

   The app is not a set of URLs, it is a set of *stacks*. Owner/Supervisor get
   five tabs (WF3.001), Worker three (WF3.002); each tab keeps its own back stack,
   the way a native app does. Onboarding is a separate linear stack that owns
   the screen entirely (no tab bar).

   Overlays (bottom sheets, modal upgrade sheets) are a third layer so that
   opening one never disturbs the stack underneath — WF5.061 requires the plot
   sheet to be draggable to full height "without leaving the map".

   The URL hash mirrors the top of the current stack so a reviewer can link to a
   screen; it is a mirror, not the source of truth.
   --------------------------------------------------------------------------- */

import { state, commit } from './store.js';
import { tabsFor } from './capabilities.js';

export const nav = {
  mode: 'onboarding',       // 'onboarding' | 'app'
  onboarding: ['A1'],
  tab: 'home',
  stacks: { home: ['B1'], map: ['C1'], advice: ['D1'], tasks: ['E1'], more: ['F0'] },
};

state.nav = nav;

/* -- route strings ------------------------------------------------------- */
/* 'B4:plot-04' → { view: 'B4', param: 'plot-04' }                           */

export function parseRoute(route) {
  const i = route.indexOf(':');
  if (i === -1) return { view: route, param: null };
  return { view: route.slice(0, i), param: route.slice(i + 1) };
}

export function currentStack() {
  return nav.mode === 'onboarding' ? nav.onboarding : nav.stacks[nav.tab];
}

export function current() {
  const stack = currentStack();
  return parseRoute(stack[stack.length - 1]);
}

export function canGoBack() {
  return currentStack().length > 1;
}

/* -- navigation ---------------------------------------------------------- */

export function go(route, opts = {}) {
  const stack = currentStack();
  if (opts.replace) stack[stack.length - 1] = route;
  else if (stack[stack.length - 1] !== route) stack.push(route);
  state.ui.overlay = null;
  syncHash();
  commit('nav');
}

export function back() {
  const stack = currentStack();
  if (state.ui.overlay) { state.ui.overlay = null; commit('nav'); return; }
  if (stack.length > 1) stack.pop();
  syncHash();
  commit('nav');
}

/** Drop the stack back to its root — used after a flow completes. */
export function resetStack(tab, route) {
  nav.stacks[tab] = [route];
}

export function switchTab(tab) {
  if (nav.tab === tab) {
    // Tapping the active tab returns to its root, as native apps do.
    nav.stacks[tab] = [nav.stacks[tab][0]];
  }
  nav.tab = tab;
  state.ui.overlay = null;
  syncHash();
  commit('nav');
}

/** Leave onboarding and enter the tabbed app in the role the flow produced. */
export function enterApp(role) {
  if (role) state.session.role = role;
  const tabs = tabsFor(state.session.role);
  nav.mode = 'app';
  nav.tab = tabs[0].id;                       // WF3.002 — Worker lands on My Work
  nav.stacks = { home: ['B1'], map: ['C1'], advice: ['D1'], tasks: ['E1'], more: ['F0'] };
  state.session.firstRunDone = true;
  state.ui.overlay = null;
  syncHash();
  commit('nav');
}

/** Return to the first-run flow — logging out lands on A3, the front door.
    Review 22/08 deleted A2; A1 and the tour are first-run only, so somebody who
    logs out is somebody the app has already met and the login screen is where
    he belongs. */
export function enterOnboarding(route = 'A3') {
  nav.mode = 'onboarding';
  nav.onboarding = [route];
  state.ui.overlay = null;
  syncHash();
  commit('nav');
}

/* -- overlays ------------------------------------------------------------ */

export function openSheet(view, params = null) {
  state.ui.overlay = { kind: 'sheet', view, params };
  commit('overlay');
}

export function openModal(view, params = null) {
  state.ui.overlay = { kind: 'modal', view, params };
  commit('overlay');
}

export function closeOverlay() {
  state.ui.overlay = null;
  commit('overlay');
}

/* -- hash mirroring ------------------------------------------------------ */

let ignoreHash = false;

function syncHash() {
  const stack = currentStack();
  const top = stack[stack.length - 1];
  const prefix = nav.mode === 'onboarding' ? '' : `${nav.tab}/`;
  ignoreHash = true;
  location.hash = `#/${prefix}${top}`;
  setTimeout(() => { ignoreHash = false; }, 0);
}

/** Jump straight to any screen — the harness screen index uses this. */
export function jump(route, tab) {
  const { view } = parseRoute(route);
  if (view.startsWith('A') || view === 'FORGOT') {
    nav.mode = 'onboarding';
    nav.onboarding = [route];
  } else {
    nav.mode = 'app';
    nav.tab = tab || tabForView(view);
    nav.stacks[nav.tab] = [route];
  }
  state.ui.overlay = null;
  syncHash();
  commit('nav');
}

export function tabForView(view) {
  const letter = view[0];
  if (letter === 'C') return 'map';
  if (letter === 'D') return 'advice';
  if (letter === 'E') return 'tasks';
  if (letter === 'F') return 'more';
  return 'home';
}

/**
 * @param {(raw: string) => boolean} [claimed] — a hash another part of the app
 *   owns, such as the harness contact sheet. The router does not need to know
 *   what those are, only that it must keep its hands off them.
 */
export function initHashListener(claimed = () => false) {
  addEventListener('hashchange', () => {
    if (ignoreHash) return;
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw || claimed(raw)) return;
    const parts = raw.split('/');
    if (parts.length === 2) jump(parts[1], parts[0]);
    else jump(parts[0]);
  });
}
