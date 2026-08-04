/* ---------------------------------------------------------------------------
   i18n/index.js — registers the translation overlays.

   English is the source column, declared inline at each t() call site. The four
   other languages are overlays keyed identically; anything a catalogue does not
   carry falls back to English and is recorded (WF-763), which is what the
   coverage bars on F8 read from.
   --------------------------------------------------------------------------- */

import { registerCatalogue } from '../core/i18n.js';
import ar from './ar.js';
import hi from './hi.js';
import bn from './bn.js';
import ps from './ps.js';

export function installCatalogues() {
  registerCatalogue('ar', ar);
  registerCatalogue('hi', hi);
  registerCatalogue('bn', bn);
  registerCatalogue('ps', ps);
}
