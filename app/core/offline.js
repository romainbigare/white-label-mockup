/* ---------------------------------------------------------------------------
   offline.js — the page's half of sw.js.

   Registers the worker that keeps the whole mockup on the device, and decides
   WHEN a newer build may replace the one on screen. That second half is the
   delicate one. The app keeps everything in memory, so a reload puts a demo
   back at its first screen: reloading the moment a deploy lands would do that
   to somebody halfway through showing the advice screens to a visitor.

   So a new build takes over at the first moment nobody is using the page:
     * at once, if nobody has touched the page since it loaded — which is the
       usual case, because the new build is found as the page opens;
     * otherwise the next time the page is hidden (the iPad locked, the tab
       or app switched), so it is fresh when it comes back.
   Until then the reviewer bar says a newer build is available, as it always
   has (freshness.js).

   A device left on a stand all day never navigates, so it would never look
   for a new worker on its own: the page asks every half hour, and whenever it
   comes back to the foreground.

   ?offline=reset removes the worker and everything it stored, for the day
   something goes wrong on the stand and nobody has a laptop.

   Local development (BUILD 'dev') never registers it, and removes one left
   behind by a deployed build, so a local edit is never hidden behind a cache.
   --------------------------------------------------------------------------- */

import { BUILD } from '../version.js';
import { SITE_ROOT } from './site.js';

const CHECK_EVERY_MS = 30 * 60 * 1000;

export async function keepOffline() {
  const sw = globalThis.navigator?.serviceWorker;
  if (!sw) return;

  if (BUILD === 'dev' || new URLSearchParams(location.search).get('offline') === 'reset') {
    await forget(sw);
    return;
  }

  // From the site root, so the exhibition page (expo/) registers the same
  // worker, for the same scope, as the main page — one cache for both.
  const reg = await sw.register(new URL('sw.js', SITE_ROOT), { scope: SITE_ROOT.pathname, updateViaCache: 'none' })
    .catch(() => null);
  if (!reg) return;

  const check = () => reg.update().catch(() => {});
  setInterval(check, CHECK_EVERY_MS);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });

  let touched = false;
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { touched = true; }, { capture: true, once: true });
  // The very first install takes control too; that is not a new build.
  let controlled = !!sw.controller;
  sw.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    if (!touched) { location.reload(); return; }
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') location.reload();
    });
  });
}

async function forget(sw) {
  const regs = await sw.getRegistrations().catch(() => []);
  await Promise.all(regs.map((r) => r.unregister()));
  const names = await globalThis.caches?.keys().catch(() => []) ?? [];
  await Promise.all(names.filter((n) => n.startsWith('wafra-')).map((n) => caches.delete(n)));
}
