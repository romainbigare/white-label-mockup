/* ---------------------------------------------------------------------------
   status.js — WF2.008 / WF2.009.

   "Health and status use this four-state scale everywhere, with the same icon,
   word and colour every time" and "status is never communicated by colour
   alone. Every colour-coded state also carries an icon and a text label."

   So there is exactly one definition of the scale in the codebase, and the
   renderer that draws it always draws icon + word + colour together. A screen
   physically cannot render a bare colour swatch.
   --------------------------------------------------------------------------- */

import { t } from './i18n.js';

export const SCALE = ['good', 'watch', 'action', 'urgent', 'nodata'];

/* THE WORDS, AND WHY THESE ONES.

   The scale is unchanged — four states, same ranks, same icons, same colours —
   but two of the names have gone. "Action needed" and "Watch" were the app's
   words for the middle two, and they read as a warning and a lesser warning:
   a farm showing two of one and three of the other reads as a farm in trouble,
   when what it is showing is a normal week. The review renamed them for what
   they actually mean to somebody planning his day.

     Urgent    take action today
     Planned   complete as regular activity          (was "Action needed")
     Monitor   watch for changes and reassess        (was "Watch")
     Good      no action required currently

   The KEYS did not change. `action` and `watch` are still the state names in
   the data and in every selector, because renaming a status key renames it in
   the fixtures, the filters, the CSS custom properties and the four translation
   catalogues at once — and none of that is what the review asked for. What the
   farmer reads is here; what the code matches on is underneath it. */
export const STATUS = {
  good:   { rank: 0, icon: 'circle-filled',  labelKey: 'status.good',   en: 'Good',    meaningKey: 'status.good.meaning',   meaningEn: 'No action required currently' },
  watch:  { rank: 1, icon: 'circle-half',    labelKey: 'status.watch',  en: 'Monitor', meaningKey: 'status.watch.meaning',  meaningEn: 'Watch for changes and reassess' },
  action: { rank: 2, icon: 'triangle',       labelKey: 'status.action', en: 'Planned', meaningKey: 'status.action.meaning', meaningEn: 'Complete as regular activity' },
  urgent: { rank: 3, icon: 'triangle-filled',labelKey: 'status.urgent', en: 'Urgent',  meaningKey: 'status.urgent.meaning', meaningEn: 'Take action today' },
  nodata: { rank: -1, icon: 'circle-dashed', labelKey: 'status.nodata', en: 'No data',       meaningKey: 'status.nodata.meaning', meaningEn: 'Cloud cover, no imagery, or outside subscription' },
  // The tree list keeps missing/dead as its own state — WF5.045 forbids folding
  // it into "urgent".
  missing:{ rank: -1, icon: 'cross',         labelKey: 'status.missing',en: 'Missing / dead',meaningKey: 'status.missing.meaning',meaningEn: 'No canopy detected' },
};

export function statusLabel(key) {
  const s = STATUS[key] ?? STATUS.nodata;
  return t(s.labelKey, s.en);
}

export function statusMeaning(key) {
  const s = STATUS[key] ?? STATUS.nodata;
  return t(s.meaningKey, s.meaningEn);
}

/** WF5.001 — a farm's status is its WORST plot, never an average. */
export function worstStatus(items, pick = (x) => x.status) {
  let worst = null;
  for (const item of items) {
    const key = pick(item);
    const s = STATUS[key];
    if (!s) continue;
    if (!worst || s.rank > STATUS[worst].rank) worst = key;
  }
  return worst ?? 'nodata';
}

/** Sort helper — severity first (WF5.007, WF5.076, WF5.108). */
export function bySeverity(a, b, pick = (x) => x.status) {
  return (STATUS[pick(b)]?.rank ?? -2) - (STATUS[pick(a)]?.rank ?? -2);
}

export function countByStatus(items, pick = (x) => x.status) {
  const out = { good: 0, watch: 0, action: 0, urgent: 0, nodata: 0, missing: 0 };
  for (const item of items) {
    const k = pick(item);
    if (k in out) out[k] += 1;
  }
  return out;
}
