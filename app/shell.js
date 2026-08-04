/* ---------------------------------------------------------------------------
   shell.js — what wraps every screen.

   A screen module returns a plain description:
       { top, body, dock, fab, tabs, barLight, chromeBg, scrollClass }
   and this file assembles it with the banners, the tab bar and the overlay
   layer. Keeping that in ONE place is what makes two global rules hold by
   construction rather than sixty times over:
     * WF-165 — the demo banner is on every screen and is not dismissible.
     * WF-791 — the connectivity indicator is on every screen.
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
import { tabBar } from './ui/components.js';
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

  host.dir = dir();                                    // WF-751 / WF-752
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
}
