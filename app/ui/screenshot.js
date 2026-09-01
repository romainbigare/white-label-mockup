/* ---------------------------------------------------------------------------
   screenshot.js — a real screen, drawn small.

   The reviewer contact sheet draws every screen in the app at once, live, into
   its own tile; tools/tourshots.mjs photographs six of them for the guided
   tour. Both want the same two guarantees, and this is where they are made:

     * render-time side effects stand down (`state.ui.preview`), because drawing
       the advice inbox as a thumbnail must not mark every advice read;
     * the session is handed back exactly as it was found, language included.

   The guided tour used to mount live screens through here as well. It shows
   generated pictures now — see tourArt() in screens/onboarding.js — which is
   why there is no longer a framed-thumbnail helper in this file.
   --------------------------------------------------------------------------- */

import { state } from '../core/store.js';
import { parseRoute, tabForView } from '../core/router.js';
import { SCREENS } from '../screens/index.js';
import { composeApp } from '../shell.js';

/* The phone the tiles are drawn on. Fixed, and deliberately not taken from the
   device dropdown: a contact sheet whose tiles changed shape as you scrolled
   would be comparing screens against different rulers. Matches the iPhone 16
   preset in harness.js. */
export const SHOT = { w: 393, h: 852, safeTop: 50, safeBottom: 26 };

/**
 * Draw a screen into a host element, at rest.
 *
 * @param {Element} host  the `.app` element to render into
 * @param {string}  id    a screen id from the registry
 * @param {object}  opts
 * @param {boolean} opts.english  force English — the contact sheet wants it,
 *                                because a reviewer is scanning for the titles
 *                                he knows the screens by.
 */
export function renderShot(host, id, { english = false } = {}) {
  const meta = SCREENS[id];
  if (!meta) return;
  const { view, param } = parseRoute(meta.route ?? id);
  // Onboarding owns the whole screen; a tab bar under it would be a lie.
  const onboarding = view.startsWith('A') || view === 'FORGOT';
  const lang = state.session.lang;
  if (english) state.session.lang = 'en';
  state.ui.preview = true;
  try {
    composeApp(host, view, param, {
      inApp: !onboarding, tab: tabForView(view), overlays: false,
    });
  } finally {
    state.session.lang = lang;
    state.ui.preview = false;
  }
}
