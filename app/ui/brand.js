/* ---------------------------------------------------------------------------
   brand.js — the one place the label lives.

   The app is the WAFRA FARM APP — Wafra owns it and Wafra's name is on it. It
   was drawn as a white label one, and the code still is: the brand is
   configuration, not decoration scattered through sixty screens, so re-labelling
   means replacing the artwork and the two names below and nothing else. No
   screen knows what the mark looks like; it asks for a lockup or a mark and
   gets whatever the supplied asset can give.

   The artwork is a horizontal lockup — the mark, a gap, then the wordmark — so
   the compact form is a CROP of the same file rather than a second file to keep
   in step. Both variants are one background image sized by its height;
   `--logo-h` then drives the width through the aspect ratios in components.css.

   REVIEW 06/09 TOOK THE ARABIC OUT: "Logo should be English only to accommodate
   new international focus". The supplied file carried the name twice — وفرة
   جرينتك over WafraGreentech — and an app sold from Georgia to Bengal is not
   served by one of its ten languages being singled out in the mark.

   AND THE WORDMARK IS STACKED. The reviewer's own pasted artwork sets Wafra
   over Greentech rather than running them together, and he is right about it
   twice over: WafraGreentech read as one invented word, and a lockup two lines
   deep is nearly square, which is what a screen with a logo in the middle of it
   wants. The mark stands about one and a half times the height of the two
   lines, which is his proportion, and the two lines are centred against it.

   All of it is cut from the file that was supplied — same letters, same mark,
   rearranged — so nothing has been redrawn. The reviewer's own designer is
   drawing the real replacement; when it lands it is a file swap and these three
   numbers.

   One thing the crop is load-bearing for: the wordmark is set in black. It
   reads on paper and on the brand green; it does not read on the dark harness
   chrome. That is the second reason the top bars take the mark alone.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';

export const BRAND = {
  /* Short form — app bars, where the mark sits beside it. */
  name: 'Wafra',
  /* Long form — the harness caption and the browser title. */
  product: 'Wafra Farm App',
  /* Review 01/09 — the address, printed on A1 so the first screen of the first
     run says where to read about us. It lives here rather than in a screen for
     the same reason the names do: re-labelling this app is replacing the
     artwork and the strings in this object, and nothing else. */
  site: 'www.wafragreen.com',
  /* Geometry of app/imgs/logo.avif, in its own pixels. Mirrored in the two
     aspect ratios in components.css; if the artwork is replaced, both move. */
  art: { width: 288, height: 100, markWidth: 101 },
};

/**
 * @param {'lockup'|'mark'} variant  the full artwork, or just the mark
 * @param {number} height            rendered height in CSS pixels
 */
export function logo(variant = 'lockup', height = 40) {
  return h(`span.logo.logo--${variant}`, {
    role: 'img',
    'aria-label': BRAND.name,
    style: { '--logo-h': `${height}px` },
  });
}
