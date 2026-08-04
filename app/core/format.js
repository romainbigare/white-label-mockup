/* ---------------------------------------------------------------------------
   format.js — §10.4 locale conventions, in one module.

   WF-013 — numbers ALWAYS carry their unit, rounded to actionable precision.
   Screens never build a unit string by hand; if they did, the dunum/hectare
   preference of WF-765 and the numeral preference of WF-753 would drift apart
   across sixty screens.
   --------------------------------------------------------------------------- */

import { state } from './store.js';
import { t } from './i18n.js';

/** The mockup's fixed "now" — the specification is dated 3 August 2026. */
export const NOW = new Date('2026-08-03T09:12:00Z');

const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Digits without grouping — years, IDs, row numbers. "2026", never "2,026". */
export function digits(value) {
  let s = String(value);
  if (state.session.numerals === 'eastern') s = s.replace(/\d/g, (d) => EASTERN[+d]);
  return s;
}

/** WF-753 — Western Arabic numerals in every language unless the user opts out. */
export function num(value, decimals = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  let s = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (state.session.numerals === 'eastern') s = s.replace(/\d/g, (d) => EASTERN[+d]);
  return s;
}

/* -- area, WF-765 -------------------------------------------------------- */
/* 1 dunum = 0.1 ha throughout — the metric dunum.                          */

const HA_TO = { dunum: 10, hectare: 1, acre: 2.47105 };
const AREA_UNIT_KEY = { dunum: 'unit.dunum', hectare: 'unit.ha', acre: 'unit.acre' };
const AREA_UNIT_EN = { dunum: 'dunum', hectare: 'ha', acre: 'ac' };

export function area(hectares, opts = {}) {
  const primary = opts.unit || state.session.areaUnit;
  const value = hectares * HA_TO[primary];
  const main = `${num(value, value < 10 ? 1 : value < 100 ? 1 : 0)} ${t(AREA_UNIT_KEY[primary], AREA_UNIT_EN[primary])}`;
  if (opts.bare) return main;
  // The secondary unit in brackets is always the other metric one.
  const secondaryUnit = primary === 'hectare' ? 'dunum' : 'hectare';
  const secValue = hectares * HA_TO[secondaryUnit];
  const sec = `${num(secValue, secValue < 100 ? 2 : 0)} ${t(AREA_UNIT_KEY[secondaryUnit], AREA_UNIT_EN[secondaryUnit])}`;
  return `${main} (${sec})`;
}

/* -- water, WF-764 / WF-333 ---------------------------------------------- */

export function volume(m3) {
  const unit = state.session.waterUnit;
  if (unit === 'litres') return `${num(m3 * 1000)} ${t('unit.litre', 'L')}`;
  return `${num(m3)} ${t('unit.m3', 'm³')}`;
}

export function depth(mm) {
  return `${num(mm, mm < 10 ? 1 : 0)} ${t('unit.mm', 'mm')}`;
}

export function litresPerTree(m3, trees) {
  if (!trees) return null;
  return `${num((m3 * 1000) / trees)} ${t('unit.litre', 'L')}/${t('unit.tree', 'tree')}`;
}

export function tempC(c) {
  return `${num(c)} ${t('unit.celsius', '°C')}`;   // WF-764 — always Celsius
}

export function speed(kph) {
  return `${num(kph)} ${t('unit.kph', 'km/h')}`;
}

export function pct(value, decimals = 0) {
  return `${num(value, decimals)}%`;
}

export function measureValue(v) {
  return num(v, 2);
}

export function delta(v, decimals = 2) {
  if (v === 0) return `→ ${t('delta.nochange', 'no change')}`;
  const arrow = v > 0 ? '↑' : '↓';
  return `${arrow} ${num(Math.abs(v), decimals)}`;
}

/* -- dates, WF-766 ------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDate(v) {
  return v instanceof Date ? v : new Date(v);
}

function gregorian(d, opts = {}) {
  const day = num(d.getUTCDate());
  const mon = t(`month.${MONTHS[d.getUTCMonth()].toLowerCase()}`, MONTHS[d.getUTCMonth()]);
  return opts.noYear ? `${day} ${mon}` : `${day} ${mon} ${digits(d.getUTCFullYear())}`;
}

function hijri(d) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return `${digits(Number(get('day')))} ${get('month')} ${digits(get('year').replace(/\D/g, ''))}`;
  } catch {
    return '';
  }
}

/**
 * WF-766 — both calendars when the app language is Arabic, Gregorian primary.
 * The user may reverse the order or show one only; Hijri is display-only.
 */
export function date(value, opts = {}) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  const g = gregorian(d, opts);
  const pref = state.session.calendar;
  const showHijri = pref === 'hijri' || pref === 'both' || (pref === 'gregorian' && state.session.lang === 'ar' && opts.allowHijri !== false);
  if (!showHijri || opts.short) return g;
  const hi = hijri(d);
  if (!hi) return g;
  return pref === 'hijri' ? `${hi} (${g})` : `${g} (${hi})`;
}

export function time(value) {
  const d = toDate(value);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${num(Number(hh))}`.padStart(2, '0') === hh ? `${hh}:${mm}` : `${hh}:${mm}`;
}

export function dateTime(value) {
  return `${date(value, { short: true })}, ${time(value)}`;
}

/** "6 hours ago" / "in 5 days" — always relative to the mockup's fixed NOW. */
export function ago(value, now = NOW) {
  const d = toDate(value);
  const mins = Math.round((now - d) / 60000);
  const future = mins < 0;
  const m = Math.abs(mins);
  let text;
  if (m < 2) text = t('ago.now', 'just now');
  else if (m < 60) text = t('ago.min', '{n} minutes', { n: num(m) });
  else if (m < 60 * 36) text = t('ago.hour', '{n} hours', { n: num(Math.round(m / 60)) });
  else if (m < 60 * 24 * 14) text = t('ago.day', '{n} days', { n: num(Math.round(m / 1440)) });
  else text = t('ago.week', '{n} weeks', { n: num(Math.round(m / 10080)) });
  if (m < 2) return text;
  return future ? t('ago.in', 'in {x}', { x: text }) : t('ago.past', '{x} ago', { x: text });
}

export function dayLabel(value, now = NOW) {
  const d = toDate(value);
  const days = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
  if (days === 0) return t('day.today', 'today');
  if (days === 1) return t('day.tomorrow', 'tomorrow');
  if (days === -1) return t('day.yesterday', 'yesterday');
  return date(d, { noYear: true, short: true });
}

/* -- money, WF-767 ------------------------------------------------------- */
/* Rates come from the server and are refreshed daily; the app never converts.  */

const CURRENCY = {
  SA: { code: 'SAR', perUsd: 3.75 }, AE: { code: 'AED', perUsd: 3.67 },
  JO: { code: 'JOD', perUsd: 0.709 }, KW: { code: 'KWD', perUsd: 0.307 },
  QA: { code: 'QAR', perUsd: 3.64 }, OM: { code: 'OMR', perUsd: 0.385 },
  BH: { code: 'BHD', perUsd: 0.376 },
};

export function price(usd, country = 'SA') {
  const c = CURRENCY[country] ?? CURRENCY.SA;
  const local = usd * c.perUsd;
  const decimals = local >= 100 ? 0 : 2;
  return `${c.code} ${num(local, decimals)} / ${t('unit.month', 'month')}`;
}

export function priceWithUsd(usd, country = 'SA') {
  return `${price(usd, country)} (${t('unit.usd', 'USD')} ${num(usd)})`;
}

/* -- misc ---------------------------------------------------------------- */

export function duration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (!h) return `${num(m)} ${t('unit.min', 'm')}`;
  return m ? `${num(h)} ${t('unit.hour', 'h')} ${num(m)} ${t('unit.min', 'm')}` : `${num(h)} ${t('unit.hour', 'h')}`;
}

export function bytes(mb) {
  return mb >= 1024 ? `${num(mb / 1024, 1)} GB` : `${num(mb)} MB`;
}
