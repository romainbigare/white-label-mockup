/* ---------------------------------------------------------------------------
   store.js — the single mutable place in the app.

   Separation of concerns:
     * `session`  — who is looking, in what language, on what plan, online or not.
                    In the real product all of this is server-resolved (WF8.007,
                    WF9.016); here it is a harness control.
     * `db`       — a working copy of the fixtures. Screens mutate this so that
                    "I did it", "Mark as done", "Add observation" etc. behave
                    like the real thing for the length of a session (WF2.016).
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
    role: 'owner',            // owner | supervisor
    lang: 'en',            // replaced at boot by WF4.014's pre-selection
    langChosen: false,     // true once the user picks one on A1 or in Settings
    // WF4.106 — the service is derived from the account's farms, and this
    // account holds both crop and tree farms, so it is the combined service.
    plan: 'combined_pro',
    connectivity: 'online',   // online | offline | syncing  (WF11.012)
    pendingSync: 0,
    trialDaysLeft: 12,
    // §9.1.3 — which of the three routes paid for this. It decides what F5 may
    // offer (WF5.176 vs WF5.178); the app never derives entitlement from it.
    purchasePath: 'inapp',   // inapp | web | managed
    // WF10.019 — dunum or hectare; acres are not offered. Hectare is the
    // default because the default country is Saudi Arabia, which counts in
    // hectares, and because review 22/08 put hectare first on A9's chips: a
    // reviewer opening any screen cold should read the unit the farm's own
    // country uses, not the Levant's.
    areaUnit: 'hectare',
    waterUnit: 'm3',          // WF5.181
    numerals: 'western',      // WF10.004
    calendar: 'gregorian',    // gregorian | hijri | both  (WF10.017)
    timeFormat: '12h',        // 12h | 24h — every clock in the app reads this
    // What the account asked us to cover, chosen before the survey runs:
    // crops, trees or both. It filters the survey result and the plan pages.
    coverage: 'both',
    // Every new piece of advice goes straight to the supervisor without the
    // farmer approving it one card at a time. Off by default: an inbox that
    // empties itself is one nobody trusts until they have watched it work.
    autoSend: false,
    sharedDevice: false,      // WF5.147
    // WF4.024. `biometric` is the setting — F7 toggles it and A3 shows a Face ID
    // button while it is on. `biometricAsked` is whether the one-time offer has
    // been made, which happens once, after the code is verified on a brand new
    // account (review 22/08). It starts false so the demo flow shows the offer.
    biometric: true,
    biometricAsked: false,
    firstRunDone: false,
    quietHours: { on: true, from: '21:00', to: '05:00' }, // WF7.006
    notifications: null,      // filled by settings screen on first open
    wifiOnlyImagery: true,
    cacheCapMb: 500,          // WF11.002
    layers: null,             // WF5.063 — layer selection persists
    // WF5.077 — the operator's own position, and whether they granted
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
    homeView: 'byfarm',   // WF5.007 — 'all' | 'byfarm', and it persists
    adviceTab: 'needs',
    adviceTypeFilter: 'all',
    // The five options the review asked for on the plot list and the advice
    // list alike: everything, or one of the four states. It replaced a filter
    // on who the work was addressed to, which was an error in the mockup —
    // advice is not addressed to anybody until it is sent.
    adviceStateFilter: 'all',
    plotFilter: 'all',
    treeFilter: 'attention',
    measure: 'ndwi',
    dateIndex: 0,
    showReqIds: false,
    // Set while a screen is drawn somewhere other than the device — the harness
    // grid. Render-time side effects check it and stand down.
    preview: false,
    lastError: null,
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

/** Transient confirmation line — the visible local confirmation of WF2.016. */
export function toast(text, tone = 'ok') {
  state.ui.toast = { text, tone, at: Date.now() };
  commit('toast');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    state.ui.toast = null;
    commit('toast');
  }, 2600);
}
