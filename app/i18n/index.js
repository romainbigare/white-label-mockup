/* ---------------------------------------------------------------------------
   i18n/index.js — registers the translation overlays.

   English is the source column, declared inline at each t() call site. The
   nine other languages are overlays keyed identically; anything a catalogue
   does not carry falls back to English and is recorded (WF10.014), which is
   what the coverage bars on F8 read from.

   FIVE OF THE NINE ARE A CORE RATHER THAN A CATALOGUE. Arabic, Bengali, Hindi
   and Pashto are broadly complete. Azerbaijani, French, Georgian, Turkish and
   Armenian carry the first run and the shell — the language sheet, the tour,
   the sign-up walk, the tab bar and the words on the buttons — which is what a
   reviewer switching language is looking at. The rest of each falls back to
   English in the open, and F8's coverage bar says by how much. A mockup that
   pretended otherwise would be inventing a translation memory it does not have.

   Armenian arrived with review 06/09, which supplied the language list.
   --------------------------------------------------------------------------- */

import { registerCatalogue } from '../core/i18n.js';
import ar from './ar.js';
import az from './az.js';
import bn from './bn.js';
import fr from './fr.js';
import hi from './hi.js';
import hy from './hy.js';
import ka from './ka.js';
import ps from './ps.js';
import tr from './tr.js';

export function installCatalogues() {
  registerCatalogue('ar', ar);
  registerCatalogue('az', az);
  registerCatalogue('bn', bn);
  registerCatalogue('fr', fr);
  registerCatalogue('hi', hi);
  registerCatalogue('hy', hy);
  registerCatalogue('ka', ka);
  registerCatalogue('ps', ps);
  registerCatalogue('tr', tr);
}
