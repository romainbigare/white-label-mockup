/* ---------------------------------------------------------------------------
   store.js — the single mutable place in the app.

   Separation of concerns:
     * `session`  — who is looking, in what language, on what plan, online or not.
                    In the real product all of this is server-resolved (WF-676,
                    WF-715); here it is a harness control.
     * `db`       — a working copy of the fixtures. Screens mutate this so that
                    "I did it", "Mark as done", "Add observation" etc. behave
                    like the real thing for the length of a session (WF-016).
     * `nav`      — the navigation model, owned by router.js. Stored here so a
                    single subscribe() drives every re-render.
     * `device`   — harness-only: which phone body is being emulated.

   Nothing else holds state. Screens are pure functions of (state, params).
   --------------------------------------------------------------------------- */

import { loadFixtures } from '../data/fixtures.js';

const listeners = new Set();

export const state = {
  session: {
    userId: 'user-1',
    role: 'owner',            // owner | supervisor | worker
    lang: 'en',
    // WF-704 — the family is derived from the account's farms, and this account
    // holds both crop and tree farms, so it is a Complete plan.
    plan: 'complete_pro',
    connectivity: 'online',   // online | offline | syncing  (WF-791)
    pendingSync: 0,
    demo: false,              // WF-126..WF-170
    trialDaysLeft: 12,
    areaUnit: 'dunum',        // WF-765 — dunum default across the region
    waterUnit: 'm3',          // WF-333
    numerals: 'western',      // WF-753
    calendar: 'gregorian',    // gregorian | hijri | both  (WF-766)
    sharedDevice: false,      // WF-161
    biometric: true,
    firstRunDone: false,
    quietHours: { on: true, from: '21:00', to: '05:00' }, // WF-655
    notifications: null,      // filled by settings screen on first open
    wifiOnlyImagery: true,
    cacheCapMb: 500,          // WF-781
    layers: null,             // WF-257 — layer selection persists
    // WF-259 / WF-812 — the operator's own position, and whether they granted
    // it. Held on the session so the map, the tree card and "show me where" all
    // agree about where the person is standing.
    gps: [420, 620],
    gpsGranted: true,
  },

  nav: null,   // set by router.init()

  ui: {
    overlay: null,        // { kind: 'sheet' | 'modal', view, params }
    toast: null,
    farmFilter: 'all',
    adviceTab: 'needs',
    adviceTypeFilter: 'all',
    taskTab: 'today',
    plotSort: 'attention',
    treeFilter: 'attention',
    measure: 'ndwi',
    dateIndex: 0,
    showReqIds: false,
    // Set while a screen is drawn somewhere other than the device — the harness
    // grid. Render-time side effects check it and stand down.
    preview: false,
    lastError: null,
    loading: null,        // screen id currently faking a load (WF-012)
  },

  device: {
    presetId: 'iphone-14',
    zoom: 'fit',
    fontScale: 1,
  },

  db: loadFixtures(),
};

/** Subscribe to every state change. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notify subscribers. Call after any mutation.
 *
 * A render replaces the DOM wholesale, and tearing a focused field out of the
 * document fires `blur` — and therefore `change` — on the way. Those handlers
 * commit too, so a commit can arrive while one is already running. Re-entering
 * the render there would try to remove nodes that the outer render has already
 * removed, and the browser throws. So an inner commit is not dropped: it is
 * folded into one more pass once the current one has finished, which is also
 * what makes a value normalised on blur actually appear.
 */
let rendering = false;
let pending = false;

export function commit(reason = '') {
  if (rendering) { pending = true; return; }
  rendering = true;
  try {
    do {
      pending = false;
      for (const fn of [...listeners]) fn(state, reason);
    } while (pending);
  } finally {
    rendering = false;
  }
}

/** Shallow-merge into a top-level slice, then commit. */
export function update(slice, patch, reason = slice) {
  Object.assign(state[slice], patch);
  commit(reason);
}

/** Reset the working data back to the fixtures (harness "Reset data"). */
export function resetData() {
  state.db = loadFixtures();
  commit('reset');
}

/** Transient confirmation line — the visible local confirmation of WF-016. */
export function toast(text, tone = 'ok') {
  state.ui.toast = { text, tone, at: Date.now() };
  commit('toast');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    state.ui.toast = null;
    commit('toast');
  }, 2600);
}
