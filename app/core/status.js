/* ---------------------------------------------------------------------------
   status.js — WF-008 / WF-009.

   "Health and status use this four-state scale everywhere, with the same icon,
   word and colour every time" and "status is never communicated by colour
   alone. Every colour-coded state also carries an icon and a text label."

   So there is exactly one definition of the scale in the codebase, and the
   renderer that draws it always draws icon + word + colour together. A screen
   physically cannot render a bare colour swatch.
   --------------------------------------------------------------------------- */

import { t } from './i18n.js';

export const SCALE = ['good', 'watch', 'action', 'urgent', 'nodata'];

export const STATUS = {
  good:   { rank: 0, icon: 'circle-filled',  labelKey: 'status.good',   en: 'Good',          meaningKey: 'status.good.meaning',   meaningEn: 'No action needed' },
  watch:  { rank: 1, icon: 'circle-half',    labelKey: 'status.watch',  en: 'Watch',         meaningKey: 'status.watch.meaning',  meaningEn: 'Monitor, no action yet' },
  action: { rank: 2, icon: 'triangle',       labelKey: 'status.action', en: 'Action needed', meaningKey: 'status.action.meaning', meaningEn: 'Act within days' },
  urgent: { rank: 3, icon: 'triangle-filled',labelKey: 'status.urgent', en: 'Urgent',        meaningKey: 'status.urgent.meaning', meaningEn: 'Act today' },
  nodata: { rank: -1, icon: 'circle-dashed', labelKey: 'status.nodata', en: 'No data',       meaningKey: 'status.nodata.meaning', meaningEn: 'Cloud cover, no imagery, or outside subscription' },
  // The tree list keeps missing/dead as its own state — WF-243 forbids folding
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

/** WF-200 — a farm's status is its WORST plot, never an average. */
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

/** Sort helper — severity first (WF-204, WF-267, WF-299). */
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
