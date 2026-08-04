/* ---------------------------------------------------------------------------
   i18n.js — chapter 10.

   WF-750: five languages at launch. WF-751: Arabic AND Pashto are right-to-left
   — treating only Arabic as RTL is a defect, so `dir` is derived from a set, not
   from `lang === 'ar'`.

   Every string in the app goes through t(). The English text passed as the
   second argument is the catalogue's English column: it is registered on first
   use, which is what makes `missingReport()` below possible. Translations are
   overlays keyed identically, and a missing key falls back to English and is
   logged rather than showing a raw key to a user (WF-763).

   In the shipped product the English column moves out of source into the same
   i18n platform as the other four (WF-758); the key contract does not change.
   --------------------------------------------------------------------------- */

import { state, commit } from './store.js';

export const LANGUAGES = [
  { code: 'en', native: 'English',  english: 'English', dir: 'ltr' },
  { code: 'ar', native: 'العربية',   english: 'Arabic',  dir: 'rtl' },
  { code: 'hi', native: 'हिन्दी',      english: 'Hindi',   dir: 'ltr' },
  { code: 'bn', native: 'বাংলা',      english: 'Bengali', dir: 'ltr' },
  { code: 'ps', native: 'پښتو',      english: 'Pashto',  dir: 'rtl' },
];

const RTL = new Set(['ar', 'ps']);

const catalogues = { en: {} };      // code → { key: string }
const englishSource = {};           // key → English, registered on first t() call
const missing = new Set();

export function registerCatalogue(code, table) {
  catalogues[code] = { ...(catalogues[code] || {}), ...table };
}

/**
 * t('b1.greeting', 'Good morning') — key first, English second.
 * Interpolation: t('x', 'Due in {n} days', { n: 3 }).
 */
export function t(key, en, vars) {
  if (en !== undefined && englishSource[key] === undefined) englishSource[key] = en;
  const lang = state.session.lang;
  let out = catalogues[lang]?.[key];
  if (out === undefined) {
    if (lang !== 'en') missing.add(`${lang}:${key}`);   // WF-763 — log, never show the key
    out = englishSource[key] ?? en ?? key;
  }
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
  }
  return out;
}

export function dir() {
  return RTL.has(state.session.lang) ? 'rtl' : 'ltr';
}

export function isRtl() {
  return RTL.has(state.session.lang);
}

export function langMeta(code = state.session.lang) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** WF-756 — switching takes effect immediately across the whole interface. */
export function setLanguage(code) {
  state.session.lang = code;
  commit('lang');
}

/** Coverage report for the release checklist item "zero missing keys". */
export function missingReport() {
  const total = Object.keys(englishSource).length;
  const byLang = {};
  for (const l of LANGUAGES) {
    if (l.code === 'en') continue;
    const have = Object.keys(catalogues[l.code] || {}).filter((k) => englishSource[k] !== undefined).length;
    byLang[l.code] = { have, total, pct: total ? Math.round((have / total) * 100) : 0 };
  }
  return { total, byLang, missing: [...missing] };
}

export function catalogueKeys() {
  return Object.entries(englishSource).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Content translation — WF-761.
 *
 * Recommendation text, alert bodies and report headings are generated on the
 * server in the product, but they come "from the same catalogue as the app,
 * keyed the same way". So fixture-authored content goes through the same t()
 * with a `c.` key namespace, which means it appears in the coverage report and
 * falls back to English identically (WF-763).
 *
 *   tc(`adv.${a.id}.action`, a.action)
 */
export function tc(path, english) {
  if (english == null || english === '') return english;
  return t(`c.${path}`, english);
}

/** The same, for an array of strings. */
export function tcList(path, list) {
  return (list ?? []).map((value, i) => tc(`${path}.${i}`, value));
}
