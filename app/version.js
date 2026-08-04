/* ---------------------------------------------------------------------------
   version.js — which build this code is.

   Overwritten at deploy time by .github/workflows/pages.yml, together with the
   version.json beside index.html. The two say the same thing by different
   routes, and that is the whole point: this module arrives through the browser
   cache with the rest of the code, and version.json is fetched with no-store.
   If they disagree, the code on screen is older than the code on the server.
   Locally both read "dev" and nothing is checked.
   --------------------------------------------------------------------------- */

export const BUILD = 'dev';
export const BUILT_AT = '';
