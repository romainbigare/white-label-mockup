/* ---------------------------------------------------------------------------
   sw.js — the whole mockup, kept on the device, so a demo runs without wifi.

   On the first visit this worker downloads every file the app uses — both
   editions' pages, every module, stylesheet and picture — into one cache named
   after the build. After that the app is served from that cache and never waits
   on the network, which is what a stand with bad exhibition wifi needs.

   WHY IT CANNOT SHOW AN OLD BUILD FOR LONG. The two lines below are rewritten
   at deploy time by tools/stamp.mjs, so every deploy changes this file's bytes,
   and a changed worker is how a browser learns there is a new build (the page
   registers it with updateViaCache: 'none', so the check never hits the HTTP
   cache). The new worker then:

     1. downloads the new build into a NEW cache, bypassing the HTTP cache, while
        the old build keeps serving the page — a half-downloaded build is never
        shown;
     2. checks that what it downloaded really is that build (app/version.js
        names it). GitHub's CDN can serve the previous deploy for a few minutes
        after a push; if it does, the install fails and is simply tried again at
        the next check, instead of caching a mixture;
     3. takes over, deletes every older cache, and tells the page, which reloads
        at a moment that does not interrupt a demo (app/core/offline.js).

   version.json is never cached: app/core/freshness.js fetches it to ask the
   server which build is live, and a cached answer would always agree.

   MAP TILES ARE KEPT APART, in a cache that outlives builds. The live maps
   streams Esri tiles (app/core/tiles.js); TILES, also stamped at deploy, is
   the ground over the farms at every useful zoom, about 12 MB. They are fetched
   once per device, after the build itself and never instead of it: a tile
   that fails is skipped and tried again at the next install, and the ones
   already kept are not fetched again, so a new build costs no tiles. Any other
   tile the map shows while online is kept too, so ground somebody has looked
   at is there offline. Tiles do not change between builds; that is why they
   are not in the build's cache, which every deploy throws away.

   Locally BUILD is 'dev' and the page does not register this worker at all.
   --------------------------------------------------------------------------- */

const BUILD = 'dev';
const FILES = [];
const TILES = [];
const TILE_ORIGIN = '';

const PREFIX = 'wafra-';
const CACHE = `${PREFIX}${BUILD}`;
const TILE_CACHE = `${PREFIX}tiles-1`;
const SCOPE = self.registration.scope;              // the site root, ending in '/'
const at = (path) => new URL(path, SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(keepTiles).then(() => self.skipWaiting()));
});

async function precache() {
  const cache = await caches.open(CACHE);
  const queue = [...FILES];
  // A few at a time: ninety requests at once is slower on a phone, not faster.
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const res = await fetch(new Request(at(path), { cache: 'reload' }));
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      await cache.put(at(path), res);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  const stamp = await (await cache.match(at('app/version.js')))?.text();
  if (!stamp?.includes(`'${BUILD}'`)) {
    await caches.delete(CACHE);
    throw new Error(`the server is still serving an older build than ${BUILD}`);
  }
}

/* Best effort, and in install rather than activate: while a worker is
   activating, the pages it controls wait for every request, and nobody should
   wait for ground they may never look at. */
async function keepTiles() {
  try {
    const cache = await caches.open(TILE_CACHE);
    const kept = new Set((await cache.keys()).map((r) => r.url));
    const queue = TILES.filter((url) => !kept.has(url));
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        } catch { /* next install */ }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  } catch { /* storage refused: the map streams instead */ }
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE && name !== TILE_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (TILE_ORIGIN && request.url.startsWith(TILE_ORIGIN)) {
    event.respondWith(tile(request));
    return;
  }
  if (!request.url.startsWith(SCOPE)) return;
  const path = new URL(request.url).pathname;
  if (path.endsWith('/version.json')) return;        // always the network's answer
  event.respondWith(fromCache(request));
});

async function tile(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request.url, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  // Only a CORS response: an opaque one would cost megabytes of quota each.
  if (res.ok && res.type === 'cors') cache.put(request.url, res.clone()).catch(() => {});
  return res;
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  // A page is asked for as a folder ("/expo/") and with review flags
  // ("?view=device"); both are the same cached file.
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (request.mode === 'navigate' && url.pathname.endsWith('/')) url.pathname += 'index.html';
  const hit = await cache.match(url.href);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    // Something the list missed: keep it for next time, in this build's cache.
    if (res.ok && res.type === 'basic') await cache.put(url.href, res.clone());
    return res;
  } catch (error) {
    // Offline, and not cached: a page falls back to the app's front door.
    if (request.mode === 'navigate') {
      const page = await cache.match(at('index.html'));
      if (page) return page;
    }
    throw error;
  }
}
