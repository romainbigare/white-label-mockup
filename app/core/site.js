/* ---------------------------------------------------------------------------
   site.js — where the site's files are, whichever page is showing them.

   Two pages load this app: index.html at the site root, and the exhibition
   edition's expo/index.html one folder down (core/edition.js). A path the app
   builds at run time — a satellite photograph, version.json, the offline
   worker — resolves against the PAGE, so "app/data/…" from expo/ would ask for
   expo/app/data/… and get a 404.

   The fix is to resolve against the code instead: this module always sits at
   app/core/, so two folders up from it is the root, on either page. (A <base>
   tag on the exhibition page would have been shorter, and would have broken the
   map: Safari resolves an SVG's url(#clip) against <base>, and the map draws
   every plot through one.)
   --------------------------------------------------------------------------- */

export const SITE_ROOT = new URL('../../', import.meta.url);

/** A path from the site root — 'app/imgs/logo.avif' — as a URL that works from any page. */
export function asset(path) {
  return new URL(path, SITE_ROOT).href;
}
