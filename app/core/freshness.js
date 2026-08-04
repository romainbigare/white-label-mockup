/* ---------------------------------------------------------------------------
   freshness.js — "am I looking at the build I just pushed?"

   GitHub Pages serves every file with `cache-control: max-age=600`, and an ES
   module is cached against its URL with no version in it. So a reviewer who
   visited ten minutes ago gets a mixture: some modules fresh, some a deploy
   behind. Nothing errors — the app just quietly renders the previous version of
   itself, which is indistinguishable from a deploy that did not happen.

   This is the only thing on the page that knows the difference. version.json is
   fetched with no-store so it is always the server's truth; app/version.js came
   through the cache with everything else. Disagreement means stale code.

   It stays silent when opened from file://, when offline, and in local
   development, where both sides read "dev".
   --------------------------------------------------------------------------- */

import { BUILD } from '../version.js';

export async function checkFreshness(onStale) {
  if (BUILD === 'dev' || location.protocol === 'file:') return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const live = await res.json();
    if (live.build && live.build !== BUILD) onStale({ running: BUILD, available: live.build });
  } catch {
    /* Offline, or the file is not there. Neither is worth a warning. */
  }
}
