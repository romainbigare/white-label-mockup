/* ---------------------------------------------------------------------------
   screenshot.js — a real screen, drawn small.

   Two places in this build show a picture of a screen rather than the screen
   itself: the reviewer contact sheet (app/screengrid.js) and the guided tour,
   whose panels illustrate what the product does by showing the screens that do
   it. Both want the same three guarantees, and this is the one place they are
   made:

     * the picture is the LIVE screen, so it cannot drift from the app the way a
       pasted PNG does — which is the whole reason the tour stopped using icons;
     * render-time side effects stand down (`state.ui.preview`), because drawing
       the advice inbox as an illustration must not mark every advice read;
     * nothing inside answers a tap. A thumbnail is a picture; whatever wraps it
       decides what pressing it means.

   ON THE IMPORT CYCLE. screens/index.js → screens/onboarding.js → here →
   shell.js → screens/index.js. It is safe and deliberately so: neither end
   touches the other's bindings while the modules are evaluating — shell.js only
   reads SCREENS inside composeApp(), and this file only calls composeApp()
   inside a render. Keep it that way.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { parseRoute, tabForView } from '../core/router.js';
import { SCREENS } from '../screens/index.js';
import { composeApp } from '../shell.js';

/* The phone the pictures are taken on. Fixed, and the same for every caller:
   two thumbnails side by side have to be comparing screens against one ruler.
   Matches the iPhone 16 preset in harness.js. */
export const SHOT = { w: 393, h: 852, safeTop: 50, safeBottom: 26 };

/**
 * Draw a screen into a host element, at rest.
 *
 * @param {Element} host  the `.app` element to render into
 * @param {string}  id    a screen id from the registry
 * @param {object}  opts
 * @param {boolean} opts.english  force English — the contact sheet wants it
 *                                (a reviewer is scanning for titles), the tour
 *                                emphatically does not.
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

/**
 * A framed picture of a screen, rendered immediately.
 *
 * The frame carries the scaled size because a transform does not affect layout;
 * that pair is what lets a caller lay thumbnails out with ordinary flexbox.
 *
 * @param {string} id      a screen id from the registry
 * @param {object} opts
 * @param {number} opts.width   rendered width in CSS pixels
 * @param {number} opts.height  rendered height; the screen is CROPPED to it,
 *                              from the top, the way an app-store shot is
 */
export function screenShot(id, { width = 150, height = 320, english = false } = {}) {
  const scale = width / SHOT.w;
  const app = h('div.app', {
    style: {
      '--safe-top': `${SHOT.safeTop}px`, '--safe-bottom': `${SHOT.safeBottom}px`, '--fs': '1',
    },
  });
  /* A PICTURE, AND THE DOM HAS TO KNOW IT. Everything inside is a real screen,
     which means real buttons at a third of their size — invisible to a finger,
     meaningless to a screen reader, and a false positive for any audit counting
     touch targets or primary actions on the page. `inert` takes the subtree out
     of the tab order and out of the accessibility tree; the CSS takes it out of
     the way of the pointer. */
  const frame = h('div.shot', {
    'aria-hidden': 'true', inert: '',
    style: { width: `${width}px`, height: `${height}px` },
  },
    h('div.shot__scale', {
      style: { width: `${SHOT.w}px`, height: `${SHOT.h}px`, transform: `scale(${scale})` },
    }, app));
  renderShot(app, id, { english });
  return frame;
}
