/* ---------------------------------------------------------------------------
   format.js — §10.4 locale conventions, in one module.

   WF2.013 — numbers ALWAYS carry their unit, rounded to actionable precision.
   Screens never build a unit string by hand; if they did, the dunum/hectare
   preference of WF10.016 and the numeral preference of WF10.004 would drift apart
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

/** WF10.004 — Western Arabic numerals in every language unless the user opts out. */
export function num(value, decimals = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  let s = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (state.session.numerals === 'eastern') s = s.replace(/\d/g, (d) => EASTERN[+d]);
  return s;
}

/* -- area, WF10.016 -------------------------------------------------------- */
/* 1 dunum = 0.1 ha throughout — the metric dunum.
   Acres are gone: the launch region counts in dunum and hectares, and a third
   option on A7 was a question with a wrong answer in it. */

const HA_TO = { dunum: 10, hectare: 1 };
const AREA_UNIT_KEY = { dunum: 'unit.dunum', hectare: 'unit.ha' };
const AREA_UNIT_EN = { dunum: 'dunum', hectare: 'ha' };

export const AREA_UNITS = ['dunum', 'hectare'];

/**
 * A per-hectare rate restated per whatever unit the user actually reads areas
 * in. WF4.099 wants arithmetic the farmer can follow, and "124 dunum × a
 * per-hectare rate" is not a sum that multiplies out on the page.
 */
export function perAreaUnit(valuePerHa, unit = state.session.areaUnit) {
  return valuePerHa / HA_TO[unit];
}

/** The other direction: an area the farmer typed in his own unit, back to
    hectares — which is the unit every price and every survey total is kept
    in. */
export function toHectares(value, unit = state.session.areaUnit) {
  return value / HA_TO[unit];
}

/**
 * ONE unit, the one the farmer chose. The second figure in brackets was there
 * to help somebody who thinks in the other unit — but nobody thinks in two
 * units at once, and printing both doubled the length of every area on every
 * screen while raising the question of which one to act on.
 *
 * Hectares always carry one decimal. Two was false precision: a tenth of a
 * hectare is a thousand square metres, which is already finer than a boundary
 * traced with a fingertip.
 */
export function area(hectares, opts = {}) {
  const unit = opts.unit || state.session.areaUnit;
  const value = hectares * HA_TO[unit];
  const decimals = unit === 'hectare' ? 1 : value < 100 ? 1 : 0;
  return `${num(value, decimals)} ${t(AREA_UNIT_KEY[unit], AREA_UNIT_EN[unit])}`;
}

/* -- water, WF10.015 / WF5.144 ---------------------------------------------- */

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
  return `${num(c)} ${t('unit.celsius', '°C')}`;   // WF10.015 — always Celsius
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

/* -- dates, WF10.017 ------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDate(v) {
  return v instanceof Date ? v : new Date(v);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function gregorian(d, opts = {}) {
  const day = num(d.getUTCDate());
  const mon = t(`month.${MONTHS[d.getUTCMonth()].toLowerCase()}`, MONTHS[d.getUTCMonth()]);
  const body = opts.noYear ? `${day} ${mon}` : `${day} ${mon} ${digits(d.getUTCFullYear())}`;
  if (!opts.weekday) return body;
  const name = DAYS[d.getUTCDay()];
  return `${t(`weekday.${name.toLowerCase()}`, name)} · ${body}`;
}

/* THE HIJRI CALENDAR HAS GONE, AND WITH IT THE SETTING THAT CHOSE IT.

   Review 21/09: "Since we are now selling this across multiple jurisdictions,
   we can delete Hiji calendar from the app." Mark framed one date on B3 —
   "12 Feb 2026 - 24 Sha'ban 1447" — and the note applies everywhere the pair
   was printed, which was every date in the app outside a list column.

   It was put in for a good reason and the reason moved. WF10.017 asked for both
   calendars always, on the argument that in the Gulf the Hijri date is what a
   farmer's year is organised around; the app is being sold from Georgia to
   Bengal now, and in most of that a second calendar is a second thing to read
   past. It is not lost work — the requirement is on the record, the format is
   in the history, and a Gulf-only build is a `date()` away.

   F8's three-way calendar setting went with it: a choice between one option is
   not a choice. See more.js.

   `date()` is Gregorian, everywhere, and `short: true` still means the tighter
   form used in list columns. */

export function date(value, opts = {}) {

  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return gregorian(d, opts);
}

/**
 * WF10.017 / review C430 — 24-hour or a.m./p.m., the user's choice in F8.
 * Everything that prints a clock goes through here, so the setting reaches the
 * irrigation plan, the task due times and the activity log in one move.
 */
export function clock(hours, minutes = 0) {
  const h24 = ((Math.round(hours) % 24) + 24) % 24;
  if (state.session.timeFormat === '24h') {
    return `${String(h24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const suffix = h24 < 12 ? t('time.am', 'a.m.') : t('time.pm', 'p.m.');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return minutes ? `${num(h12)}:${String(minutes).padStart(2, '0')} ${suffix}` : `${num(h12)} ${suffix}`;
}

/**
 * A window rather than a moment. C427–C429: without a flow rate the app cannot
 * honestly say how long the pump runs, and "6 p.m. for about 2 h 6 m" invited
 * the farmer to act on a number nobody measured. A two-hour window is what the
 * advice actually supports.
 */
export function timeWindow(fromHour, toHour) {
  return t('time.between', 'between {a} and {b}', { a: clock(fromHour), b: clock(toHour) });
}

export function time(value) {
  const d = toDate(value);
  return clock(d.getUTCHours(), d.getUTCMinutes());
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

/* -- money, WF10.018 ------------------------------------------------------- */
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

/** The same figure with no period attached — for an annual total, or a table. */
export function priceBare(usd, country = 'SA') {
  const c = CURRENCY[country] ?? CURRENCY.SA;
  const local = usd * c.perUsd;
  return `${c.code} ${num(local, local >= 100 ? 0 : 2)}`;
}

export function priceWithUsd(usd, country = 'SA') {
  return `${price(usd, country)} (${t('unit.usd', 'USD')} ${num(usd)})`;
}

/**
 * A price BAND — "SAR 716 – 1,074" — for the estimate A11 quotes before
 * anything has been measured. The currency is named once: a range that repeats
 * it reads as two prices set beside each other rather than as the two ends of
 * one, and at estimate sizes it wrapped onto a second line.
 */
export function priceRange(lowUsd, highUsd, country = 'SA') {
  const c = CURRENCY[country] ?? CURRENCY.SA;
  const lo = lowUsd * c.perUsd;
  const hi = highUsd * c.perUsd;
  const decimals = hi >= 100 ? 0 : 2;
  return `${c.code} ${num(lo, decimals)} – ${num(hi, decimals)}`;
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
