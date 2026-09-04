/* ---------------------------------------------------------------------------
   shell.js — what wraps every screen.

   A screen module returns a plain description:
       { top, body, dock, fab, tabs, barLight, chromeBg, scrollClass }
   and this file assembles it with the banners, the tab bar and the overlay
   layer. Keeping that in ONE place is what makes WF11.012 hold by construction
   rather than sixty times over: the connectivity indicator is on every screen,
   and a screen physically cannot forget it.

   The route arrives as an argument rather than being read off the router,
   because there are two callers with different ideas of "current": main.js
   composes the live route into the device, and the harness screen grid composes
   every route at once, each into its own tile.
   --------------------------------------------------------------------------- */

import { h, mount, when } from './core/dom.js';
import { state } from './core/store.js';
import { nav, parseRoute, tabForView } from './core/router.js';
import { dir } from './core/i18n.js';
import { SCREENS } from './screens/index.js';
import { renderOverlay } from './screens/overlays.js';
import { tabBar, resetFieldKeys } from './ui/components.js';
import { badges } from './screens/badges.js';
import { banners } from './screens/banners.js';
import { icon } from './ui/icons.js';

/* WHAT A PHONE IS, when a screen is drawn as a PICTURE rather than run.

   The contact sheet and the guided tour's snapshots both need a screen at a
   known size to scale down, and a tile whose shape moved between the two would
   be comparing screens against different rulers. iPhone 16, matching the preset
   in harness.js. It is a presentation size and not an acceptance one — WF2.002's
   360 × 640 is still checked on every screen by tools/smoke.mjs. */
export const TILE = { w: 393, h: 852, safeTop: 50, safeBottom: 26 };

/**
 * @param {Element} host        the `.app` element to render into
 * @param {string}  view        screen id, e.g. 'B4'
 * @param {?string} param       the route parameter, e.g. 'plot-04'
 * @param {object}  opts
 * @param {boolean} opts.inApp    false suppresses the tab bar (onboarding)
 * @param {string}  opts.tab      which tab reads as active
 * @param {boolean} opts.overlays false leaves out the sheet/toast layer, which
 *                                belongs to the live app and not to a thumbnail
 * @param {boolean} opts.topBar   false leaves out the app bar and the banners,
 *                                for a picture of a screen that is meant to
 *                                show what the screen DOES — see screenSnapshot
 */
export function composeApp(host, view, param, opts = {}) {
  const { inApp = nav.mode === 'app', tab = nav.tab, overlays = true, topBar = true } = opts;
  const screen = SCREENS[view];
  const focus = captureFocus(host);
  resetFieldKeys();

  host.dir = dir();                                    // WF10.002 / WF10.003
  host.classList.toggle('show-reqs', state.ui.showReqIds);

  if (!screen) {
    // Marked, not just worded: a bare paragraph here reads as a successful
    // render to anything counting characters, which is how routes to deleted
    // screens survived a green test run.
    mount(host, h('div.page', { 'data-missing-screen': view },
      h('p', `No screen registered for "${view}".`)));
    return;
  }

  let out;
  try {
    out = screen.render(param) ?? {};
  } catch (error) {
    console.error(`[${view}]`, error);
    out = { body: h('div.page', h('pre', { style: { fontSize: '12px', whiteSpace: 'pre-wrap' } }, String(error?.stack ?? error))) };
  }

  host.dataset.barLight = String(!!out.barLight);
  host.style.setProperty('--chrome-bg', out.chromeBg ?? 'var(--paper)');

  mount(host,
    // The banners belong to the session — a connectivity warning inside a
    // picture of a screen is a fact about the reviewer's wifi, not about the
    // app — so they come off with the bar they sit above.
    when(topBar, () => banners()),
    topBar ? out.top ?? null : null,
    h(`div.app__scroll${out.scrollClass ? `.${out.scrollClass}` : ''}`, { id: opts.scrollId ?? null }, out.body ?? null),
    out.dock ?? null,
    when(out.tabs !== false && inApp, () => tabBar({ activeTab: tab, badges: badges() })),
    out.fab ?? null,
    when(overlays && state.ui.overlay, () => renderOverlay(state.ui.overlay)),
    when(overlays && state.ui.toast, () => h(`div.toast${state.ui.toast.tone === 'warn' ? '.toast--warn' : ''}`,
      icon(state.ui.toast.tone === 'warn' ? 'warning' : 'check', 18),
      h('span', state.ui.toast.text))));

  restoreFocus(host, focus);
}

/* -- a screen, drawn small, as a picture -----------------------------------

   The guided tour's last three cards show what the app DOES by showing the
   screen that does it, rather than by drawing an icon of it. They are live
   renders at TILE size scaled down, not saved images: a screenshot pasted into
   a tour goes stale the first time the screen it photographs is redrawn, and
   nothing in the build would notice.

   TWO THINGS ARE DELIBERATELY LEFT OUT. The app bar, because the reviewer asked
   for it — a snapshot is there to show the screen's substance and the bar is
   the same strip of chrome on all of them. And the overlays, because a sheet or
   a toast belongs to the live app rather than to a picture of it.

   The picture keeps the WHOLE screen. It is narrow rather than cropped, which
   is the other half of what the review asked: a card 200 px tall showing the
   middle third of a phone tells you less than the same 200 px showing all of
   it. The caller gives the height and the width follows from the phone.

   `state.ui.preview` is raised for the render, so a screen with a side effect —
   marking its advice read, say — stands down while it is being photographed.
   Note that composeApp() resets the field-key counter, so a snapshot may not be
   drawn inside a screen that has text fields of its own; the tour has none. */
export function screenSnapshot(id, { height, label } = {}) {
  const screen = SCREENS[id];
  const { view, param } = parseRoute(screen?.route ?? id);
  const scale = height / TILE.h;

  const host = h('div.app', {
    // No notch to duck under: the bar that reserved that space is not drawn.
    style: { '--safe-top': '0px', '--safe-bottom': `${TILE.safeBottom}px`, '--fs': '1' },
  });
  const wasPreview = state.ui.preview;
  state.ui.preview = true;
  try {
    composeApp(host, view, param, {
      inApp: true, tab: tabForView(view), overlays: false, topBar: false,
    });
  } finally {
    state.ui.preview = wasPreview;
  }

  return h('div.snapshot', {
    // One picture to a screen reader, not sixty focusable controls.
    role: 'img', 'aria-label': label ?? screen?.title ?? id,
    style: { width: `${Math.round(TILE.w * scale)}px`, height: `${Math.round(height)}px` },
  }, h('div.snapshot__scale', {
    // INERT, and not merely un-clickable. The picture is full of real buttons
    // and real inputs; without this they take keyboard focus, answer a tap and
    // appear to anything walking the DOM as controls on the screen that is
    // showing them. tools/smoke.mjs and tools/screendeck.mjs skip `.snapshot`
    // for the same reason.
    inert: true,
    style: { width: `${TILE.w}px`, height: `${TILE.h}px`, transform: `scale(${scale})` },
  }, host));
}

/* -- typing across a re-render --------------------------------------------

   Every keystroke re-renders, because that is the only way a Continue button
   enables on the right character rather than on blur. But a re-render replaces
   the DOM wholesale, and the browser's idea of "the field you are typing in"
   goes with the node. So the shell takes a note of it first and puts it back
   after: which field, and where the caret and selection were inside it.

   Fields identify themselves with data-field — see textField() in
   components.js. Nothing else is restored, because nothing else is the user's
   place in the screen. */

function captureFocus(host) {
  const el = document.activeElement;
  if (!el || !host.contains(el) || !el.dataset?.field) return null;
  const saved = { key: el.dataset.field, scroll: el.scrollTop };
  // selectionStart throws on the input types that have no text selection
  // (number, email, date). Those still get their focus back, just not a caret.
  try {
    saved.start = el.selectionStart;
    saved.end = el.selectionEnd;
    saved.direction = el.selectionDirection;
  } catch { /* no selection on this input type */ }
  return saved;
}

function restoreFocus(host, saved) {
  if (!saved) return;
  const el = host.querySelector(`[data-field="${CSS.escape(saved.key)}"]`);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollTop = saved.scroll;
  if (saved.start == null) return;
  try { el.setSelectionRange(saved.start, saved.end, saved.direction ?? 'none'); } catch { /* as above */ }
}
