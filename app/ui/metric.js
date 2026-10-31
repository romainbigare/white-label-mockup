/* ---------------------------------------------------------------------------
   metric.js — the metric picker and the legend, the same on every map.

   REVIEW v1.7.2: "users report it's not clear that we can change the
   visualisation on the map and select the metric we want", and the legend
   was a thin rainbow between the words "low" and "high". Both were drawn five
   different ways on five maps — a native select on B1 and B5, a dark caption
   on B2, a bordered row on C1, a bare ramp on C4 — so each was improved alone
   and none of them was obvious. They are drawn here, once:

     metricChips()   every metric as a chip, the painted one filled (v1.8);
                     a locked one carries a lock and opens the upgrade sheet.
     metricLegend()  one slim gradient through the metric's five colours, its
                     ends and middle named (all five in the accessible name).
                     Red is bad and green is good; on soil moisture and water
                     stress the far end is blue, for too much water.
     metricLine()    the small legend over the foot of a map in a page (B2,
                     B5): the metric's name, then a short bar of its five
                     colours between the words for its two ends.
                     C1 lays the picker and legend out in its own panel.

   What a reading MEANS — its band, its colour, its tone — is core/health.js.
   This file only draws it and names it.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { state } from '../core/store.js';
import { t, tc } from '../core/i18n.js';
import { openSheet, openModal } from '../core/router.js';
import { has } from '../core/entitlements.js';
import { icon } from './icons.js';
import { deckMark } from './components.js';
import { METRIC_ORDER, RAMPS, BAND_WORDS, rampKind, bandOf } from '../core/health.js';

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

/* ONE VOCABULARY FOR EVERY METRIC (Nov 2026): best, good, monitor, deficient,
   urgent — and on the two water metrics, where both ends of the range are
   bad, urgent, monitor, best, monitor, urgent (BAND_WORDS in core/health.js).
   A word has one key, so a translator is asked for it once. */
const WORD_LABEL = {
  best: () => t('band.best', 'Best'),
  good: () => t('band.good', 'Good'),
  monitor: () => t('band.monitor', 'Monitor'),
  deficient: () => t('band.deficient', 'Deficient'),
  urgent: () => t('band.urgent', 'Urgent'),
};

export function bandLabel(key, index) {
  return WORD_LABEL[BAND_WORDS[rampKind(key)][index]]();
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
  h('div.mlegend__bar', { style: { background: `linear-gradient(90deg, ${colours.join(', ')})` } }),
  h('div.mlegend__words', colours.map((_, i) => h('span', bandLabel(key, i)))));
}

/* -- the picker ------------------------------------------------------------ */

/**
 * THE METRICS AS A ROW OF CHIPS (v1.8), every one of them on show: a farmer
 * sees at a glance that the map can show other things, which a single button
 * naming one of them never said. The one painted is filled green; a metric
 * the plan does not include carries a lock and opens the upgrade sheet.
 * `onPick` runs after the app-wide metric has changed — every map follows
 * `state.ui.measure`, so a choice made on one map holds on the next.
 */
export function metricChips(key, { plot = null, farm = null, onPick } = {}) {
  return h('div.chips', { role: 'radiogroup', 'aria-label': t('mpick.title', 'Pick a metric') },
    metrics().map((m) => {
      const locked = !has(m.featureKey, farm ?? plot?.farmId);
      const on = !locked && m.key === key;
      return h('button.chip', {
        type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-pressed': String(on),
        onclick: () => {
          if (locked) { openModal('UPGRADE', { featureKey: m.featureKey }); return; }
          state.ui.measure = m.key;
          onPick?.(m.key);
        },
        ...deckMark({ deckNote: locked ? 'Locked: opens the plan that includes it' : 'Paints the map with this metric' }),
      }, icon(locked ? 'lock' : (m.icon ?? 'leaf'), 16), h('span', metricName(m.key, plot)));
    }));
}

/** The "what does this mean" button beside a picker. */
export function metricInfo(key) {
  return h('button.iconbtn.iconbtn--bare', {
    type: 'button',
    onclick: () => openSheet('MEASURE_INFO', { key }),
    'aria-label': t('c1.whatis', 'What does this mean?'),
    title: t('c1.whatis', 'What does this mean?'),
  }, icon('info', 20));
}

/**
 * WHAT A MAP IN A PAGE IS PAINTED WITH, on the map itself (B2, B5): a small
 * legend laid over the bottom of the picture — the metric's name in one tiny
 * line, and under it a short bar of its five colours between the words for
 * its two ends. It was a big block under the map until Nov 2026 ("it hits you
 * in the face"); it is a footnote to the picture again. The five words are in
 * the accessible name; the full legend is on C1.
 */
export function metricLine(key, { plot = null } = {}) {
  const colours = RAMPS[rampKind(key)];
  const words = colours.map((_, i) => bandLabel(key, i));
  return h('div.mline', {
    role: 'img',
    'aria-label': `${metricName(key, plot)}: ${words.join(', ')}`,
  },
  h('span.mline__name', metricName(key, plot)),
  h('span.mline__scale',
    h('span', words[0]),
    h('span.mline__bar', colours.map((c) => h('i', { style: { background: c } }))),
    h('span', words[words.length - 1])));
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
