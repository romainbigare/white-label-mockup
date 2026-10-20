/* ---------------------------------------------------------------------------
   metric.js — the metric picker and the legend, the same on every map.

   REVIEW v1.7.2: "users report it's not clear that we can change the
   visualisation on the map and select the metric we want", and the legend
   was a thin rainbow between the words "low" and "high". Both were drawn five
   different ways on five maps — a native select on B1 and B5, a dark caption
   on B2, a bordered row on C1, a bare ramp on C4 — so each was improved alone
   and none of them was obvious. They are drawn here, once:

     metricPicker()  a titled control — "Pick a metric" over a bordered button
                     naming the metric, with a chevron — that opens the picker
                     sheet with every metric explained.
     metricLegend()  five coloured blocks, each named. Red is bad and green is
                     good; on soil moisture and water stress the far end is
                     blue, for too much water. The words follow the metric.
     mapMetricBar()  the two together, for the strip under a map in a page
                     (B1, B2, B5). C1 lays them out in its own floating panel.

   What a reading MEANS — its band, its colour, its tone — is core/health.js.
   This file only draws it and names it.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { t, tc } from '../core/i18n.js';
import { openSheet } from '../core/router.js';
import { icon } from './icons.js';
import { deckMark } from './components.js';
import { METRIC_ORDER, RAMPS, rampKind, bandOf, shownScore, isSigned } from '../core/health.js';

/** Every metric, in the order the farmer reads them. */
export function metrics() {
  const all = state.db.measures;
  return METRIC_ORDER.map((key) => all.find((m) => m.key === key)).filter(Boolean);
}

function metricRecord(key) {
  return state.db.measures.find((m) => m.key === key) ?? state.db.measures[0];
}

/* "Plant health" over a field and "Canopy health" over a tree group — the
   October review's word, in place of "Tree health" or "foliage": one measure
   with two honest names, and a key each, because a key that carries two
   English strings ships whichever rendered first. */
export function metricName(key, plot = null) {
  if (key === 'ndvi' && plot?.kind === 'trees') return t('b13.measure.canopy', 'Canopy health');
  return t(`measure.${key}`, metricRecord(key).plain);
}

export function metricAbout(key) {
  const m = metricRecord(key);
  return tc(`measure.${key}.about`, m.about);
}

export function bandLabel(key, index) {
  const m = metricRecord(key);
  return tc(`measure.${key}.band.${index}`, m.bands?.[index] ?? '');
}

/** The colour and the word for one score on one metric, or null. */
export function reading(key, score) {
  const band = bandOf(key, score);
  return band ? { ...band, label: bandLabel(key, band.index) } : null;
}

/* -- the legend ------------------------------------------------------------ */

/**
 * Five blocks and five words. `onDark` for a legend laid over a photograph
 * rather than on paper.
 */
export function metricLegend(key, { onDark = false } = {}) {
  const colours = RAMPS[rampKind(key)];
  return h(`div.mlegend${onDark ? '.mlegend--dark' : ''}`, {
    role: 'img',
    'aria-label': t('mlegend.a11y', 'Legend: {words}', {
      words: colours.map((_, i) => bandLabel(key, i)).join(', '),
    }),
  },
  h('div.mlegend__bar', colours.map((c) => h('i', { style: { background: c } }))),
  h('div.mlegend__words', colours.map((_, i) => h('span', bandLabel(key, i)))));
}

/* -- the picker ------------------------------------------------------------ */

/**
 * The titled control. `onPick` runs after the app-wide metric has changed —
 * every map follows `state.ui.measure`, so a choice made on one map holds on
 * the next.
 */
export function metricPicker(key, { plot = null, onPick, deckNote } = {}) {
  const m = metricRecord(key);
  return h('div.mpick',
    h('span.mpick__title', t('mpick.title', 'Pick a metric')),
    h('button.mpick__button', {
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-label': t('mpick.a11y', 'Pick a metric. Showing {name}', { name: metricName(key, plot) }),
      onclick: () => openSheet('MEASURE_PICKER', { plot: plot?.id, onPick }),
      ...deckMark({ deckNote: deckNote ?? 'Opens the list of metrics, each explained' }),
    },
    h('span.mpick__mark', icon(m.icon ?? 'leaf', 16)),
    h('span.mpick__name', metricName(key, plot)),
    icon('chevronDown', 18)));
}

/** The "what does this mean" button beside a picker. */
export function metricInfo(key) {
  return h('button.iconbtn.iconbtn--bare.mpick__info', {
    type: 'button',
    onclick: () => openSheet('MEASURE_INFO', { key }),
    'aria-label': t('c1.whatis', 'What does this mean?'),
    title: t('c1.whatis', 'What does this mean?'),
  }, icon('info', 20));
}

/**
 * The strip under a map in a page: picker, info, an optional note (the image
 * date on B2) and the legend.
 */
export function mapMetricBar(key, { plot = null, note = null, onPick } = {}) {
  return h('div.mapbar',
    h('div.mapbar__row',
      metricPicker(key, { plot, onPick: onPick ?? (() => commit('measure')) }),
      when(note, () => h('span.mapbar__note', note)),
      metricInfo(key)),
    metricLegend(key));
}

/**
 * A reading's number, in the colour of its band, with the band's word under
 * it — the
 * score card's cell, and anywhere else a single reading is printed.
 */
export function metricValue(key, score, { size = 'md' } = {}) {
  const r = reading(key, score);
  if (!r) return h('span.mvalue.mvalue--nodata', t('status.nodata', 'No data'));
  // The number is how good it is — or, on water stress, how far from right
  // and which way — and the word agrees with it.
  return h(`span.mvalue.mvalue--${size}`,
    h('b', { style: { color: r.ink } }, scoreText(key, score), h('small', '%')),
    h('span.mvalue__word', r.label));
}

/**
 * A reading as its band's WORD, in the band's colour, and no number — how a
 * metric is shown everywhere but the plot page's scorecard (v1.7.3: "words,
 * not numbers, outside the plot page"). Five bands, dark green good, red bad.
 */
export function metricWord(key, score) {
  const r = reading(key, score);
  if (!r) return h('span.mword.mword--nodata', t('status.nodata', 'No data'));
  return h('span.mword', { style: { color: r.ink } }, r.label);
}

/** The printed number, without the % sign: "+22" and "−45" on water stress. */
export function scoreText(key, score) {
  const n = shownScore(key, score);
  if (n == null) return '';
  return isSigned(key) && n !== 0 ? `${n > 0 ? '+' : '−'}${Math.abs(n)}` : String(n);
}
