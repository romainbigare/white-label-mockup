/* ---------------------------------------------------------------------------
   plotparts.js — the blocks a plot screen is built from, for B2 and B5 alike.

   v1.7.2 MADE THE TWO SCREENS ONE SCREEN. A crop plot (B2) and a tree group
   (B5) had grown apart: the score card was on the trees and not on the crops,
   the trend and the risk strip were on the crops and not on the trees, and the
   tree group was "very empty". The review asked for the same widgets on both,
   in one order, with the crop cycle the only difference:

     map  ·  crop cycle (B2 only)  ·  score card  ·  advice  ·  trend  ·
     irrigation trend  ·  pest and disease risk  ·  growth stage

   (A separate plant health trend went in the second pass: the trend block
   already draws it, and opens on the metric the map is showing.)

   So each block is built here, once, and each screen lists them. A block that
   has nothing to say still draws, with a line saying so — "advice for this
   plot, show even when no advice" — so the two screens keep the same shape and
   a farmer learns one page, not two.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openModal, switchTab } from '../core/router.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  btn, actionDock, row, statusIcon, disclaimer, req, chips, helpButton, deckMark,
  titledCard, lockedRow,
} from '../ui/components.js';
import { num, date } from '../core/format.js';
import { farmById, measureByKey, adviceForPlot, severityToStatus } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { plotRasterSvg } from '../ui/map.js';
import { liveMap, liveMapAvailable } from '../ui/livemap.js';
import { trendChart, axisLabels, pairedBars } from '../ui/charts.js';
import { metrics, metricName, metricValue, mapMetricBar, reading } from '../ui/metric.js';
import { RAMPS, rampKind, measureScore, shownScore, isSigned } from '../core/health.js';

/* -- where the advice for a plot opens ------------------------------------ */

export function detailRouteFor(advice) {
  return ({ irrigation: 'D2', nutrition: 'D3', protection: 'D4' })[advice.type] ?? 'D2';
}

/* A stage's name is content — the growthStages list in content.json — keyed
   by the crop family as well as the stage, because "fill" is grain fill on
   wheat and fruit fill on a tomato. */
export function stageName(growth, id, english) {
  return tc(`stage.${growth.family}.${id}`, english);
}

/* -- the map ---------------------------------------------------------------

   THE MAP OWNS ITS IMAGE CONTROLS, and since v1.7.2 not its metric. The date
   and the way to the full map are buttons on the image; the metric is the
   titled picker under it, with the legend, because "users report it's not
   clear that we can change the visualisation on the map". */

const DATE_PANEL = 'date';

function dateState(plot) {
  const farm = farmById(plot.farmId);
  const dates = farm.imageryDates;
  const ui = local(`dates-${plot.id}`, { index: Math.max(0, dates.length - 1), notice: null });
  ui.index = Math.max(0, Math.min(dates.length - 1, ui.index));
  return { dates, ui, current: dates[ui.index] ?? null };
}

/** The image of the plot, its two tools, and the metric strip under it. */
export function plotMap(plot) {
  const farm = farmById(plot.farmId);
  const { dates, ui, current } = dateState(plot);
  const panel = local(`b4-${plot.id}`, { open: null });
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const locked = !has(measure.featureKey);
  const trees = plot.kind === 'trees';

  // WF2.011 — a plot on a farm not yet on the watchlist has nothing to draw,
  // so it gets a designed empty state rather than a blank frame.
  if (!current) return noImagery(farm);

  /* THE EXPAND BUTTON OPENS THE MAP ON THIS STACK, with a way back — v1.7.2.
     It used to switch to the Map tab and raise this plot's sheet there, which
     left the farmer on another tab with no back button and a sheet he had not
     asked for. */
  const openFullMap = () => { state.ui.farmFilter = farm.id; go(`C1:${plot.id}`); };

  return h('div', { class: 'plotmapwrap' },
    h('div.mapbox.plotmap.mapbox--withbar', { style: { height: trees ? '230px' : '250px', borderRadius: 'var(--radius)' } },
      locked
        ? h('div', { style: { display: 'grid', placeItems: 'center', height: '100%', background: 'var(--ink-100)' } },
          h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: measure.featureKey }) },
            icon('lock', 16), t('locked.measure', '{name} is not in your plan', { name: metricName(measure.key, plot) })))
        /* Live: the plot with ground round it, on the farm's own map, to drag
           and pinch out of (ui/livemap.js). The picture is for previews. */
        : liveMapAvailable()
          ? liveMap(trees ? 'B5' : 'B2', {
            plots: [plot], measure: measureKey, dateKey: current.date,
            layers: { labels: false, trees }, selectedId: plot.id,
            fitKey: plot.id, fitTo: 'plot', inPage: true,
          })
          : plotRasterSvg(plot, measureKey, { dateKey: current.date, zoomOut: true }),

      // The image's date, on the image: it is a property of the picture.
      h('span.plotmap__date', icon('calendar', 13), date(current.date, { short: true })),

      h('div.plotmap__tools',
        mapTool('compare', t('b4.dates', 'Which date?'), panel.open === DATE_PANEL,
          () => { panel.open = panel.open === DATE_PANEL ? null : DATE_PANEL; commit('b4'); },
          { deckNote: 'Picks the imagery date, and compares two' }),
        mapTool('scan', t('b4.openmap', 'Open in the map'), false, openFullMap, { deckTo: 'C1' })),

      when(panel.open === DATE_PANEL, () => mapPanel(
        t('b4.dates', 'Which date?'),
        () => { panel.open = null; commit('b4'); },
        // WF5.019 — the stepper moves between AVAILABLE IMAGERY DATES, so the
        // panel lists them rather than offering a calendar that would be
        // mostly empty. Newest first, which is where the farmer starts.
        [...dates].reverse().slice(0, 12).map((d, i) => panelRow(
          d.date === current?.date,
          date(d.date),
          i === 0 ? `${d.source} · ${t('b4.latest', 'latest')}` : d.source,
          () => { ui.index = dates.indexOf(d); panel.open = null; commit('b4'); })),
        // WF5.032 — comparing two dates is a map job, done over the whole farm.
        has('maps.compare')
          ? btn(t('b4.compare', 'Compare two dates'), {
            variant: 'secondary', size: 'sm', icon: 'compare',
            onclick: () => { panel.open = null; state.ui.farmFilter = farm.id; go('C4'); },
          })
          : h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: 'maps.compare' }) },
            icon('lock', 15), t('b4.compare', 'Compare two dates'))))),

    mapMetricBar(measureKey, { plot }),
    when(ui.notice, () => disclaimer(ui.notice)));
}

/* A tool on the image. Small, square, and legible over a satellite photograph,
   which is why it carries its own scrim rather than trusting the picture. */
function mapTool(iconName, label, active, onclick, deck = {}) {
  return h(`button.maptool${active ? '.maptool--on' : ''}`, {
    onclick, 'aria-label': label, title: label, type: 'button',
    'aria-pressed': String(!!active),
    ...deckMark(deck),
  }, icon(iconName, 20));
}

/* A panel over the map rather than a sheet over the app: the farmer is choosing
   what he is looking AT, so the thing he is looking at should stay on screen. */
function mapPanel(title, onClose, ...children) {
  return h('div.mappanel',
    h('div.mappanel__head',
      h('span', title),
      h('button.iconbtn.iconbtn--bare', { onclick: onClose, 'aria-label': t('action.close', 'Close') }, icon('close', 20))),
    h('div.mappanel__body', ...children));
}

function panelRow(selected, title, sub, onclick) {
  return h(`button.mappanel__row${selected ? '.mappanel__row--on' : ''}`, { onclick, type: 'button' },
    h('span', { style: { flex: 1, minWidth: 0 } },
      h('span', { style: { fontWeight: 600, display: 'block' } }, title),
      sub ? h('small', { style: { color: 'var(--ink-500)' } }, sub) : null),
    selected ? icon('check', 18) : null);
}

/** WF2.011 / WF5.019 — "no imagery for the selected date" is a designed state. */
function noImagery(farm) {
  return titledCard(t('b4.noimagery', 'No imagery yet'), { card: { accent: 'nodata' } },
    h('div', { style: { color: 'var(--ink-600)' } },
      farm.imageryBlockedReason ?? t('b4.noimagery.body', 'This farm was just added to our satellite watchlist. The first images usually arrive within 48 hours.')),
    req('WF2.011'));
}

/* -- the score card --------------------------------------------------------

   THE FIVE METRICS, AS NUMBERS, AVERAGED OVER THE PLOT — v1.7.2. "This widget
   is shown in the trees plots but not in crops. And it's not thorough or nice
   looking (remove color blind symbol)." It was three of the five, on the tree
   group only, each with a status triangle beside it.

   Each row now says three things: the metric, where its reading sits on the
   legend (the same five colours as the map, with a mark at the reading), and
   the number with its band's word. The triangles went: the colour is no longer
   carrying the meaning alone, because the word beside every number says it.

   AND EVERY ROW IS A CONTROL. "When clicking on a metric, it changes it on the
   map." The row the map is painted with is the one marked, and pressing
   another repaints the map and brings it into view. */
export function scoreCard(plot) {
  const showing = state.ui.measure;
  return titledCard(t('b13.scorecard', 'Score card'), {
    bleed: true,
    aside: h('span.cardhead__hint', t('scorecard.hint', 'Tap one to see it on the map')),
  },
  h('div.scorelist', metrics().map((m) => {
    const name = metricName(m.key, plot);
    if (!has(m.featureKey)) return lockedRow(m.featureKey, name);
    const score = measureScore({ key: m.key, ...(plot.measures?.[m.key] ?? {}) });
    const r = reading(m.key, score);
    const on = m.key === showing;
    return h(`button.scorerow${on ? '.scorerow--on' : ''}`, {
      type: 'button',
      'aria-pressed': String(on),
      onclick: () => {
        state.ui.measure = m.key;
        commit('measure');
        // After the render: the map is rebuilt with the new metric, and the
        // farmer pressed a row below it to see exactly that.
        setTimeout(() => document.querySelector('.plotmapwrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      },
      ...deckMark({ deckNote: 'Shows this metric on the map' }),
    },
    h('span.scorerow__mark', icon(m.icon ?? 'leaf', 18)),
    h('span.scorerow__main',
      h('span.scorerow__name', name, when(on, () => h('span.scorerow__onmap', icon('map', 12), t('scorecard.onmap', 'On the map')))),
      gauge(m.key, score)),
    metricValue(m.key, score));
  })),
  req('WF5.041'));
}

/* Where a reading sits on its legend: the five colours, small, and a mark at
   the score. It is what makes a 64 on plant health and a 64 on water stress
   readable as different things without a paragraph. */
function gauge(key, score) {
  const colours = RAMPS[rampKind(key)];
  return h('span.gauge',
    colours.map((c) => h('i', { style: { background: c } })),
    when(score != null, () => h('b.gauge__mark', { style: { insetInlineStart: `${Math.max(0, Math.min(100, score))}%` } })));
}

/* -- advice ----------------------------------------------------------------

   SHOWN EVEN WHEN THERE IS NONE — v1.7.2. A block that disappears on a quiet
   plot makes the next plot's screen a different shape, and "nothing for this
   plot" is an answer the farmer opened the screen to get. */
export function adviceBlock(plot) {
  const trees = plot.kind === 'trees';
  const recent = adviceForPlot(plot.id, { includeDone: true }).slice(0, 4);
  return titledCard(trees ? t('b13.advice', 'Advice for this tree group') : t('b4.suggestions', 'Advice for this plot'), { bleed: true },
    recent.length
      ? recent.map((a) => row({
        iconName: ADVICE_ICON[a.type] ?? 'advice',
        title: a.action,
        sub: [a.amount, a.status === 'completed' ? t('advice.recorded.done', 'Recorded') : null].filter(Boolean).join(' · '),
        statusKey: a.status === 'completed' ? 'good' : severityToStatus(a.severity),
        value: date(a.issuedAt, { noYear: true, short: true }),
        onclick: () => go(`${detailRouteFor(a)}:${a.id}`),
      }))
      : h('div.emptyline', icon('check', 18),
        h('span', trees
          ? t('b13.advice.empty', 'No advice for this tree group')
          : t('b4.suggestions.none', 'No advice for this plot right now. We will put it here when there is.'))));
}

/* -- trends ----------------------------------------------------------------

   THE AXIS IS THE CROP CYCLE, IN WEEKS (review 21/09), and the target is on
   it. The line is the number the farmer is shown (metricScore), so on water
   stress and soil moisture it is how close to right the plot has been — the
   same number as the score card — and the target is where "good" starts:
   80 there, and the start of the good band, 60, on the other three. */

function trendTarget(key) {
  // Water stress is signed, so right is the zero line.
  if (isSigned(key)) return 0;
  return rampKind(key) === 'rgb' ? 80 : 60;
}

function cycleWeeks(series) {
  const n = Math.max(series.length, 2);
  const step = (n - 1) / 4;
  return Array.from({ length: 5 }, (_, i) =>
    t('b4.trend.week', 'wk {n}', { n: num(Math.round(i * step) + 1) }));
}

function swatch(colour, label) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
    h('span', { style: { width: '11px', height: '11px', borderRadius: '3px', background: colour } }), label);
}

function trendFigure(plot, key) {
  const series = plot.series?.[key] ?? [];
  if (series.length < 2) {
    return h('div.emptyline', icon('info', 18), h('span', t('b4.trend.none', 'Not enough images yet to draw a trend.')));
  }
  const last = series[series.length - 1].value;
  const shown = series.map((p) => ({ ...p, value: shownScore(key, p.value) }));
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    trendChart(shown, { label: metricName(key, plot), target: trendTarget(key), colour: reading(key, last)?.ink }),
    axisLabels(cycleWeeks(series)),
    h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
      swatch(reading(key, last)?.ink ?? 'var(--brand-600)', t('b4.trend.actual', 'This plot')),
      swatch('var(--st-monitor)', t('b4.trend.target', 'Target'))));
}

/** "A trend widget where we can select between the 5 metrics." */
export function trendBlock(plot) {
  const ui = local(`trend-${plot.id}`, { key: null });
  const key = ui.key ?? state.ui.measure;
  return titledCard(t('b4.trend', 'Trend'), {
    aside: metricValue(key, measureScore({ key, ...(plot.measures?.[key] ?? {}) }), { size: 'sm' }),
  },
  chips(metrics().map((m) => ({ id: m.key, label: metricName(m.key, plot) })), key,
    (id) => { ui.key = id; commit('trend'); }),
  trendFigure(plot, key));
}

/* WF5.101 — advised against applied, week by week. Always drawn now; a plot
   with no irrigation records says so. */
export function irrigationTrendBlock(plot) {
  const records = plot.irrigationRecord ?? [];
  const any = records.some((r) => r.appliedM3 > 0);
  return titledCard(t('b4.irrigationtrend', 'Irrigation trend'), {
    aside: helpButton(
      t('b4.advisedapplied.help', 'Grey is what we advised for that week; green is what was actually put on, from the irrigation records entered on this plot. A run of green under grey is a plot being under-watered against its own advice.'),
      { title: t('b4.irrigationtrend', 'Irrigation trend') },
    ),
  },
  any
    ? [pairedBars(records.map((r) => ({ label: t('b4.week.short', 'W{n}', { n: r.week }), a: r.advisedM3, b: r.appliedM3 })), { label: t('b4.advisedapplied.chart', 'Advised versus applied') }),
      h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        swatch('var(--ink-300)', t('b4.advised', 'Advised')),
        swatch('var(--brand-600)', t('b4.applied', 'Applied')))]
    : h('div.emptyline', icon('droplet', 18), h('span', t('b4.irrigationtrend.none', 'No irrigation recorded on this plot yet.'))),
  req('WF5.131'));
}

/* -- disease and pest risk -------------------------------------------------

   A FORECAST, SO IT IS BOUNDED. Every row names the thing, how likely it is,
   and when it peaks. Rows are drawn only from directory entries that name this
   crop, so a wheat plot is never told to watch for red palm weevil. And every
   row is a door into the directory. */
export function riskBlock(plot) {
  const risks = (plot.diseaseRisk ?? []).slice(0, 3);
  return titledCard(t('b4.risk', 'Disease and pest risk'), {
    bleed: !!risks.length,
    aside: helpButton(
      t('b4.risk.help', 'Risk is worked out from the weather ahead and what this crop is prone to. It is a forecast, not a finding — nothing has been seen on your plot yet. Open a row to read how to confirm it and what to do about it.'),
      { title: t('b4.risk', 'Disease and pest risk') },
    ),
  },
  risks.length
    ? risks.map((risk, i) => h('button.row', {
      onclick: () => go(`F16:${risk.diseaseId}`),
      style: i ? { borderTop: '1px solid var(--ink-200)' } : {},
    },
    statusIcon(risk.band, 20),
    h('div.row__main',
      h('div.row__title', tc(`disease.${risk.diseaseId}.name`, risk.name)),
      h('div.row__sub',
        [risk.rising ? t('b4.risk.rising', 'rising') : null,
          t('b4.risk.peaks', 'peaks in {from}–{to} days', { from: num(risk.window[0]), to: num(risk.window[1]) })].filter(Boolean).join(' · '))),
    h('span', { style: { fontWeight: 650, color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' } }, `${num(risk.risk)}%`),
    h('span.row__chev', icon('forward', 18, 'flip'))))
    : h('div', { style: { color: 'var(--ink-600)' } },
      t('b4.risk.none', 'Nothing this crop is prone to is forecast for the next two weeks.')));
}

/* -- growth stage ----------------------------------------------------------

   WHAT MAKES IT MORE THAN A LABEL is the verdict: whether the plant reached
   its stage early or late for the heat it has had. Growing degree days are
   printed small, under the track, because they are the working rather than
   the answer. */
export function growthBlock(plot) {
  const growth = plot.growth;
  if (!growth) return null;
  const off = growth.aheadDays;
  const verdict = Math.abs(off) <= 2
    ? t('b4.growth.ontrack', 'On track for this crop and this season.')
    : off > 0
      ? t('b4.growth.ahead', '{n} days ahead of the expected pace.', { n: num(off) })
      : t('b4.growth.behind', '{n} days behind the expected pace.', { n: num(Math.abs(off)) });

  return titledCard(t('b4.growth', 'Growth stage'), {
    aside: helpButton(
      t('b4.growth.help', 'We add up the heat your crop has actually had — growing degree days — and compare it with the heat this crop normally needs to reach each stage. That is why a stage can arrive sooner in a hot week than the calendar suggests.'),
      { title: t('b4.growth', 'Growth stage') },
    ),
  },
  h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' } },
    h('strong', { style: { fontSize: 'var(--t-lead)' } }, stageName(growth, growth.stageId, growth.stageName)),
    h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
      t('b4.growth.of', 'stage {n} of {total}', { n: num(growth.stageIndex + 1), total: num(growth.stageCount) }))),
  h('div', { style: { display: 'flex', gap: '4px' } },
    growth.curve.map((stage, i) => h('span', {
      style: {
        flex: 1, height: '8px', borderRadius: '999px',
        background: i === growth.stageIndex ? 'var(--brand-600)'
          : stage.reached ? 'var(--brand-300)' : 'var(--ink-200)',
      },
    }))),
  h('div', { style: { color: 'var(--ink-700)' } }, verdict),
  when(growth.nextStageName, () => h('div', { style: { color: 'var(--ink-600)' } },
    t('b4.growth.next', 'Next: {stage}, about {n} days away.', {
      stage: stageName(growth, growth.nextStageId, growth.nextStageName), n: num(growth.daysToNext),
    }))),
  h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
    t('b4.growth.gdd', '{acc} of {target} growing degree days, base {base} °C', {
      acc: num(growth.accumulated), target: num(growth.target), base: num(growth.base),
    })));
}

/* -- the dock ----------------------------------------------------------------

   TWO BUTTONS SINCE v1.7.2: the advice, as before, and the plot's irrigation
   schedule beside it — "in addition to the 'See advice' button we have another
   secondary button next to it for irrigation schedule".

   "See advice" opens the inbox NARROWED TO THIS PLOT. It used to narrow to the
   farm, so a farmer who pressed it on his wheat was shown the farm's citrus
   advice under it and took it for his wheat's. */
export function plotDock(plot) {
  return actionDock(h('div.actiondock__pair',
    btn(t('b4.seeadvice', 'See advice'), {
      variant: 'primary', icon: 'advice',
      deckTo: 'D1', deckNote: 'Opens the advice for this plot only',
      onclick: () => {
        state.ui.farmFilter = plot.farmId;
        state.ui.plotFilter = plot.id;
        switchTab('advice');
      },
    }),
    btn(t('irr.button', 'Irrigation schedule'), {
      variant: 'secondary', icon: 'droplet', deckTo: 'B12',
      onclick: () => go(`B12:${plot.id}`),
    })));
}

