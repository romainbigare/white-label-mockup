/* ---------------------------------------------------------------------------
   i18n/index.js — registers the translation overlays.

   English is the source column, declared inline at each t() call site. The
   nine other languages are overlays keyed identically; anything a catalogue
   does not carry falls back to English and is recorded (WF10.014), which is
   what the coverage bars on F8 read from.

   ALL TEN LANGUAGES ARE MEANT TO BE COMPLETE FOR v1.8.0: English, Arabic,
   Azerbaijani, Bengali, French, Hindi, Armenian, Georgian, Pashto and Turkish.
   The translations are still being added. Until a language has every key, the
   missing ones fall back to English in the open, and F8's coverage bar says
   how many.

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
