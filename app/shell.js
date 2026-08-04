/* ---------------------------------------------------------------------------
   shell.js — what wraps every screen.

   A screen module returns a plain description:
       { top, body, dock, fab, tabs, barLight, chromeBg, scrollClass }
   and this file assembles it with the banners, the tab bar and the overlay
   layer. Keeping that in ONE place is what makes two global rules hold by
   construction rather than sixty times over:
     * WF4.087 — the demo banner is on every screen and is not dismissible.
     * WF11.012 — the connectivity indicator is on every screen.
   A screen physically cannot forget them.

   The route arrives as an argument rather than being read off the router,
   because there are two callers with different ideas of "current": main.js
   composes the live route into the device, and the harness screen grid composes
   every route at once, each into its own tile.
   --------------------------------------------------------------------------- */

import { h, mount, when } from './core/dom.js';
import { state } from './core/store.js';
import { nav } from './core/router.js';
import { dir } from './core/i18n.js';
import { SCREENS } from './screens/index.js';
import { renderOverlay } from './screens/overlays.js';
import { tabBar, resetFieldKeys } from './ui/components.js';
import { badges } from './screens/badges.js';
import { banners } from './screens/banners.js';
import { icon } from './ui/icons.js';

/**
 * @param {Element} host        the `.app` element to render into
 * @param {string}  view        screen id, e.g. 'B4'
 * @param {?string} param       the route parameter, e.g. 'plot-04'
 * @param {object}  opts
 * @param {boolean} opts.inApp    false suppresses the tab bar (onboarding)
 * @param {string}  opts.tab      which tab reads as active
 * @param {boolean} opts.overlays false leaves out the sheet/toast layer, which
 *                                belongs to the live app and not to a thumbnail
 */
export function composeApp(host, view, param, opts = {}) {
  const { inApp = nav.mode === 'app', tab = nav.tab, overlays = true } = opts;
  const screen = SCREENS[view];
  const focus = captureFocus(host);
  resetFieldKeys();

  host.dir = dir();                                    // WF10.002 / WF10.003
  host.classList.toggle('show-reqs', state.ui.showReqIds);

  if (!screen) {
    mount(host, h('div.page', h('p', `No screen registered for "${view}".`)));
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
    banners(),
    out.top ?? null,
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
