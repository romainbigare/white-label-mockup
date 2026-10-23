/* ---------------------------------------------------------------------------
   plotparts.js — the blocks a plot screen is built from, for B2 and B5 alike.

   v1.7.2 MADE THE TWO SCREENS ONE SCREEN, and v1.7.3 — the October review —
   set its order, one long page, top to bottom:

     map  ·  crop box (B2 only)  ·  scorecard  ·  agronomic trend  ·
     irrigation trend  ·  growth stage (B2) or fruit development (B5)  ·
     irrigation  ·  fertilisation  ·  disease & pest

   THE THREE BOXES AT THE END REPLACED THE ADVICE BOX AND THE DOCK. There was
   one "Advice" card and two buttons under the page, "See advice" and
   "Irrigation schedule"; the review split the advice by what the farmer does
   about it — water, feed, protect — and put each in the box for that job, so
   the buttons had nothing left to open. An urgent advice is in its box, at
   the top of it. A box with nothing to do says "No action": an empty box is
   good news, and it is what calms a farmer down.

   NUMBERS ARE SHOWN HERE, AND ONLY HERE. The scorecard is the one place in
   the app that prints a metric as a percentage; every other screen prints the
   band's word in its colour. The farm's own three measures on B1 are the one
   exception, and they are averages, not a plot's reading.

   So each block is built here, once, and each screen lists them. A block that
   has nothing to say still draws, with a line saying so, so the two screens
   keep the same shape and a farmer learns one page, not two.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openModal } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  req, chips, helpButton, deckMark, titledCard, lockedRow, openMapChip, kv,
} from '../ui/components.js';
import { num, date, area, monthName, NOW } from '../core/format.js';
import { farmById, measureByKey, adviceForPlot, severityToStatus } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { plotRasterSvg } from '../ui/map.js';
import { liveMap, liveMapAvailable } from '../ui/livemap.js';
import { pairedBars, seasonChart } from '../ui/charts.js';
import { metrics, metricName, metricValue, metricLine, reading } from '../ui/metric.js';
import { RAMPS, rampKind, measureScore, shownScore, isSigned } from '../core/health.js';

/* -- the map ---------------------------------------------------------------

   THE MAP OWNS ITS IMAGE CONTROLS, and not its metric. The date is a button
   on the image, and the way to the full map is the expand button in its
   corner — "Pick a metric" lives on the map screen (C1) and only there.

   The plot is still painted with the metric the scorecard below has pressed —
   a field as a coloured area, a tree group as its dots inside an outline in
   that colour — so its legend stays under the picture, naming what is shown,
   without a picker. */

/* THE LATEST IMAGE, AND NO DATE TOOL (v1.7.4). The map used to carry a
   "Which date?" button opening a list of image dates and the way to compare
   two; the plot page does not need it — comparing dates is the map's job
   (C4), one tap away through the expand button. The date of the picture stays
   on the picture. */
function latestImage(plot) {
  const dates = farmById(plot.farmId).imageryDates;
  return dates[dates.length - 1] ?? null;
}

/** The image of the plot, the way to the full map, and the metric strip under it. */
export function plotMap(plot) {
  const farm = farmById(plot.farmId);
  const current = latestImage(plot);
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const locked = !has(measure.featureKey, farm);
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
    h('div.mapbox.plotmap', { style: { height: trees ? '230px' : '250px', borderRadius: 'var(--radius)' } },
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

      openMapChip(openFullMap)),

    /* WHAT THE MAP IS PAINTED WITH, in one quiet line under it: the
       metric, and its colours between their two end words (v1.7.4). */
    when(!locked, () => metricLine(measureKey, { plot })));
}

/** WF2.011 / WF5.019 — "no imagery for the selected date" is a designed state. */
function noImagery(farm) {
  return titledCard(t('b4.noimagery', 'No imagery yet'), { card: { accent: 'nodata' } },
    h('div', { style: { color: 'var(--ink-600)' } },
      farm.imageryBlockedReason ?? t('b4.noimagery.body', 'This farm was just added to our satellite watchlist. The first images usually arrive within 48 hours.')),
    req('WF2.011'));
}

/* Every block's title carries the glyph of what it is about, in the brand
   colour — water for irrigation, a shield for disease and pest — so a farmer
   scrolling the long page finds a block by its picture before its word. */
function titled(iconName, text) {
  return [h('span.cardhead__icon', icon(iconName, 19)), text];
}

/* -- the scorecard ---------------------------------------------------------

   THE FIVE METRICS, AS NUMBERS, AVERAGED OVER THE PLOT — and the only place
   in the app a metric is printed as a percentage (v1.7.3: "numbers only on
   the plot page"). "Scorecard" is one word since the October review.

   Each row says three things: the metric, where its reading sits on the
   legend (the same five colours as the map, with a mark at the reading), and
   the number with its band's word.

   Every row is a control: pressing one paints the map with it — a field's
   area, a tree group's outline. On a tree group the first metric is "Canopy
   health", not plant health. */
export function scoreCard(plot) {
  const showing = state.ui.measure;
  return titledCard(titled('grid', t('b13.scorecard', 'Scorecard')), {
    bleed: true,
    aside: h('span.cardhead__hint', t('scorecard.hint', 'Tap one to see it on the map')),
  },
  h('div.scorelist', metrics().map((m) => {
    const name = metricName(m.key, plot);
    if (!has(m.featureKey, plot.farmId)) return lockedRow(m.featureKey, name);
    const score = measureScore({ key: m.key, ...(plot.measures?.[m.key] ?? {}) });
    const on = m.key === showing;
    const content = [
      h('span.scorerow__mark', icon(m.icon ?? 'leaf', 18)),
      h('span.scorerow__main',
        h('span.scorerow__name', name, when(on, () => h('span.scorerow__onmap', icon('map', 12), t('scorecard.onmap', 'On the map')))),
        gauge(m.key, score)),
      metricValue(m.key, score),
    ];
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
    }, ...content);
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

/* -- the season, as an axis -------------------------------------------------

   THE X AXIS OF EVERY CHART ON THIS PAGE IS THE SEASON (v1.7.3): a field's
   crop cycle from planting to the harvest we expect, and a tree group's
   calendar year. A date is placed on it as a fraction, so a chart can draw
   the whole season and stop the plot's own line at today. */
const DAY = 86400000;

function seasonOf(plot) {
  if (plot.kind !== 'trees') {
    const cycle = plot.cropCycles?.find((c) => c.state === 'current');
    if (cycle?.startDate && cycle.expectedHarvest) {
      return { kind: 'cycle', start: new Date(`${cycle.startDate}T00:00:00Z`), end: new Date(`${cycle.expectedHarvest}T00:00:00Z`) };
    }
  }
  const y = NOW.getUTCFullYear();
  return { kind: 'year', start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
}

function fractionOf(season, when) {
  const at = typeof when === 'string' ? new Date(`${when.slice(0, 10)}T00:00:00Z`) : when;
  return (at - season.start) / (season.end - season.start);
}

/* Weeks of the cycle along a field's axis, months along a tree group's. */
function seasonLabels(season) {
  if (season.kind === 'year') {
    return [0, 3, 6, 9].map((m) => ({ x: m / 12, text: monthName(m) }))
      .concat([{ x: 1, text: monthName(11) }]);
  }
  const weeks = Math.max(2, Math.round((season.end - season.start) / (7 * DAY)));
  return [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    x: f, text: t('b4.trend.week', 'wk {n}', { n: num(Math.max(1, Math.round(f * weeks))) }),
  }));
}

function swatch(colour, label, dashed = false) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
    h('span', {
      style: dashed
        ? { width: '14px', height: 0, borderTop: `2px dashed ${colour}` }
        : { width: '11px', height: '11px', borderRadius: '3px', background: colour },
    }), label);
}

function chartKey(...items) {
  return h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, ...items);
}

/* -- the agronomic trend ----------------------------------------------------

   "AGRONOMIC TREND" since v1.7.3 — it covers the five metrics, and the
   irrigation trend is its own chart. The metric buttons stay a row that
   scrolls sideways: a drop-down was proposed and not taken.

   The line is the number the farmer is shown (shownScore), so on water
   stress and soil moisture it is how close to right the plot has been — the
   same number as the scorecard — and the target is where "good" starts: 80
   there, the start of the good band, 60, on the other three, and the zero
   line on water stress, which is signed. The target is flat, and it is drawn
   for the whole season. */
function trendTarget(key) {
  if (isSigned(key)) return 0;
  return rampKind(key) === 'rgb' ? 80 : 60;
}

function trendFigure(plot, key) {
  const series = plot.series?.[key] ?? [];
  if (series.length < 2) {
    return h('div.emptyline', icon('info', 18), h('span', t('b4.trend.none', 'Not enough images yet to draw a trend.')));
  }
  const season = seasonOf(plot);
  const last = series[series.length - 1].value;
  const actual = series
    .map((p) => ({ x: fractionOf(season, p.date), value: shownScore(key, p.value) }))
    .filter((p) => p.x >= 0 && p.x <= 1);
  const signed = isSigned(key);
  const colour = reading(key, last)?.ink ?? 'var(--brand-600)';
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    seasonChart({
      label: metricName(key, plot), actual, colour,
      expected: trendTarget(key),
      today: fractionOf(season, NOW),
      xLabels: seasonLabels(season),
      yMin: signed ? -100 : 0, yMax: 100, yTicks: signed ? [-100, 0, 100] : [0, 50, 100],
      yFormat: (v) => `${v > 0 && signed ? '+' : ''}${num(v)}%`,
    }),
    chartKey(
      swatch(colour, t('b4.trend.actual', 'This plot')),
      swatch('var(--st-monitor)', t('b4.trend.target', 'Target'), true)));
}

/** "A trend widget where we can select between the 5 metrics." */
export function trendBlock(plot) {
  const ui = local(`trend-${plot.id}`, { key: null });
  const key = ui.key ?? state.ui.measure;
  return titledCard(titled('trend', t('b4.trend.agro', 'Agronomic trend')), {
    aside: metricValue(key, measureScore({ key, ...(plot.measures?.[key] ?? {}) }), { size: 'sm' }),
  },
  chips(metrics().map((m) => ({ id: m.key, label: metricName(m.key, plot) })), key,
    (id) => { ui.key = id; commit('trend'); }),
  trendFigure(plot, key));
}

/* WF5.101 — advised against applied, week by week. Always drawn; a plot
   with no irrigation records says so. Kept for now, though "applied" can
   only come from the farmer's own records (see the open questions).

   It is the irrigation efficiency report drawn for one plot, so it carries
   that key: Premium on crops, Basic on trees (the plan sheet, Oct 2026). */
export function irrigationTrendBlock(plot) {
  if (!has('irrigation.efficiency', plot.farmId)) {
    return titledCard(titled('chart', t('b4.irrigationtrend', 'Irrigation trend')), { bleed: true },
      lockedRow('irrigation.efficiency', t('b4.advisedapplied.chart', 'Advised versus applied')));
  }
  const records = plot.irrigationRecord ?? [];
  const any = records.some((r) => r.appliedM3 > 0);
  return titledCard(titled('chart', t('b4.irrigationtrend', 'Irrigation trend')), {
    aside: helpButton(
      t('b4.advisedapplied.help', 'Grey is what we advised for that week; green is what was actually put on, from the irrigation records entered on this plot. A run of green under grey is a plot being under-watered against its own advice.'),
      { title: t('b4.irrigationtrend', 'Irrigation trend') },
    ),
  },
  any
    ? [pairedBars(records.map((r) => ({ label: t('b4.week.short', 'W{n}', { n: r.week }), a: r.advisedM3, b: r.appliedM3 })), { label: t('b4.advisedapplied.chart', 'Advised versus applied') }),
      chartKey(
        swatch('var(--ink-300)', t('b4.advised', 'Advised')),
        swatch('var(--brand-600)', t('b4.applied', 'Applied')))]
    : h('div.emptyline', icon('droplet', 18), h('span', t('b4.irrigationtrend.none', 'No irrigation recorded on this plot yet.'))),
  req('WF5.131'));
}

/* -- growth stage, as a line ------------------------------------------------

   A LINE CHART SINCE v1.7.3, in place of the row of green and grey steps:
   two lines, what was expected and where the plot is today, so the farmer
   sees at a glance whether he is above or below plan. It is read off biomass,
   as a share of what the crop is expected to carry at harvest.

   The expected curve is the usual S of a growing crop over its cycle; the
   plot's own line is the same curve moved by how far ahead or behind the
   heat it has had puts it (growth.aheadDays), and it stops at today. (Whether
   MMC can send the expected curve per crop is an open question.) */
function sCurve(x) {
  const k = 9;
  const f = (v) => 1 / (1 + Math.exp(-k * (v - 0.48)));
  return ((f(x) - f(0)) / (f(1) - f(0))) * 100;
}

function curvePoints(from, to, fn, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = from + ((to - from) * i) / steps;
    return { x, value: fn(x) };
  });
}

export function growthBlock(plot) {
  const growth = plot.growth;
  if (!growth) return null;
  const season = seasonOf(plot);
  const today = Math.max(0, Math.min(1, fractionOf(season, NOW)));
  const span = (season.end - season.start) / DAY;
  const shift = (growth.aheadDays ?? 0) / Math.max(1, span);
  const off = growth.aheadDays;
  const verdict = Math.abs(off) <= 2
    ? t('b4.growth.ontrack', 'On track for this crop and this season.')
    : off > 0
      ? t('b4.growth.ahead', '{n} days ahead of the expected pace.', { n: num(off) })
      : t('b4.growth.behind', '{n} days behind the expected pace.', { n: num(Math.abs(off)) });

  return titledCard(titled('leaf', t('b4.growth', 'Growth stage')), {
    aside: helpButton(
      t('b4.growth.help2', 'The dashed line is how much a healthy crop of this kind, planted on this date, is expected to have grown by each week, up to harvest. The solid line is your plot, up to today. Above the dashed line is ahead of plan; below it is behind.'),
      { title: t('b4.growth', 'Growth stage') },
    ),
  },
  h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' } },
    h('strong', { style: { fontSize: 'var(--t-lead)' } }, stageName(growth, growth.stageId, growth.stageName)),
    h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
      t('b4.growth.of', 'stage {n} of {total}', { n: num(growth.stageIndex + 1), total: num(growth.stageCount) }))),
  seasonChart({
    label: t('b4.growth.chart', 'Expected growth and growth so far'),
    expected: curvePoints(0, 1, sCurve),
    actual: curvePoints(0, today, (x) => sCurve(Math.max(0, Math.min(1, x + shift))), 16),
    today, xLabels: seasonLabels(season),
    yTicks: [0, 50, 100], yFormat: (v) => `${num(v)}%`,
    colour: off < -2 ? 'var(--st-monitor)' : 'var(--brand-600)', expectedColour: 'var(--ink-400)',
  }),
  chartKey(
    swatch(off < -2 ? 'var(--st-monitor)' : 'var(--brand-600)', t('b4.growth.today', 'Your plot, to today')),
    swatch('var(--ink-400)', t('b4.growth.expected', 'Expected'), true)),
  h('div', { style: { color: 'var(--ink-700)' } }, verdict),
  when(growth.nextStageName, () => h('div', { style: { color: 'var(--ink-600)' } },
    t('b4.growth.next', 'Next: {stage}, about {n} days away.', {
      stage: stageName(growth, growth.nextStageId, growth.nextStageName), n: num(growth.daysToNext),
    }))));
}

/* -- fruit development, on a tree group -------------------------------------

   THE TREE GROUP'S THIRD TREND (v1.7.3): after the agronomic trend and the
   irrigation trend, fruit development — in the place a field has its growth
   stage. The same two lines over the year: how far the fruit is expected to
   have come by each month, from setting to harvest, and how far this group's
   fruit has come, up to today. */
const FRUIT_SEASON = { 'date-palm': [2, 9], olive: [4, 10], mango: [2, 7] };

export function fruitBlock(plot) {
  const season = seasonOf(plot);
  const [fromMonth, toMonth] = FRUIT_SEASON[plot.cropId] ?? [3, 10];
  const from = fromMonth / 12;
  const to = (toMonth + 1) / 12;
  const within = (x) => (x <= from ? 0 : x >= to ? 100 : sCurve((x - from) / (to - from)));
  const today = Math.max(0, Math.min(1, fractionOf(season, NOW)));
  const shift = ((plot.growth?.aheadDays ?? 0) / 365);
  const behind = shift < -0.004;
  return titledCard(titled('tree', t('b13.fruit', 'Fruit development trend')), {
    aside: helpButton(
      t('b13.fruit.help', 'The dashed line is how far the fruit on a healthy group of these trees is expected to have developed by each month, from fruit set to harvest. The solid line is this group, up to today.'),
      { title: t('b13.fruit', 'Fruit development trend') },
    ),
  },
  seasonChart({
    label: t('b13.fruit', 'Fruit development trend'),
    expected: curvePoints(0, 1, within, 36),
    actual: curvePoints(0, today, (x) => within(Math.max(0, x + shift)), 24),
    today, xLabels: seasonLabels(season),
    yTicks: [0, 50, 100], yFormat: (v) => `${num(v)}%`,
    colour: behind ? 'var(--st-monitor)' : 'var(--brand-600)', expectedColour: 'var(--ink-400)',
  }),
  chartKey(
    swatch(behind ? 'var(--st-monitor)' : 'var(--brand-600)', t('b13.fruit.today', 'This group, to today')),
    swatch('var(--ink-400)', t('b4.growth.expected', 'Expected'), true)));
}

/* A stage's name is content — the growthStages list in content.json — keyed
   by the crop family as well as the stage, because "fill" is grain fill on
   wheat and fruit fill on a tomato. */
export function stageName(growth, id, english) {
  return tc(`stage.${growth.family}.${id}`, english);
}

/* -- the three boxes --------------------------------------------------------

   IRRIGATION, FERTILISATION, DISEASE & PEST — the advice, by what the farmer
   does about it (v1.7.3). An advice on this plot is in the box for its kind,
   urgent first, and opens its own screen. A box with nothing to do says "No
   action". */

/** One advice, as a line in its box: the warning and the word when it is urgent. */
function adviceLine(a) {
  const urgent = severityToStatus(a.severity) === 'urgent';
  return h('button.row.boxline', {
    // Inside the irrigation box, which opens the week when it is pressed: the
    // advice is the nearer target, so the press stops here.
    type: 'button', onclick: (e) => { e.stopPropagation(); go(`${detailRouteFor(a)}:${a.id}`); },
    ...deckMark({ deckTo: detailRouteFor(a) }),
  },
  h('div.row__main',
    when(urgent, () => h('span.urgentflag.urgentflag--inline', icon('warning', 14), h('span', t('b2.urgent', 'Urgent')))),
    h('div.row__title', a.action),
    when(a.amount, () => h('div.row__sub', a.amount))),
  h('span.row__chev', icon('forward', 18, 'flip')));
}

function adviceOf(plot, type) {
  return adviceForPlot(plot.id).filter((a) => a.type === type);
}

function noAction() {
  return h('div.noaction', icon('check', 18), h('span', t('box.noaction', 'No action')));
}

/* IRRIGATION: today and tomorrow, in so much water per hectare — the summary
   the review asked for — and the week under it. Pressing the box opens the
   week (B12), which is where the dock's old "Irrigation schedule" button
   went. A tree group is watered per AREA, never per tree: the hectares the
   group covers. Never in minutes: the system and its flow rate are not asked
   for in this version. */
export function irrigationBox(plot) {
  const plan = plot.irrigationSchedule;
  const alerts = adviceOf(plot, 'irrigation');
  const today = NOW.toISOString().slice(0, 10);
  const tomorrow = new Date(NOW.getTime() + DAY).toISOString().slice(0, 10);
  const on = (day) => plan?.events.find((e) => e.date === day);
  const dayLine = (label, event) => [label, event
    ? t('irr.rate', '{n} m³/ha', { n: num(event.volumeM3Ha) })
    : t('box.irr.none', 'No watering')];
  return titledCard(titled('droplet', t('box.irrigation', 'Irrigation')), {
    card: { onclick: () => go(`B12:${plot.id}`) },
    aside: h('span.cardhead__hint.cardhead__hint--go', t('box.irr.week', 'The week'), icon('forward', 14, 'flip')),
  },
  alerts.map(adviceLine),
  plan
    ? [kv([
      dayLine(t('box.irr.today', 'Today'), on(today)),
      dayLine(t('box.irr.tomorrow', 'Tomorrow'), on(tomorrow)),
    ]),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
      plot.kind === 'trees'
        ? t('box.irr.trees', 'Per hectare of the {area} this group covers.', { area: area(plot.areaHa ?? 0) })
        : t('box.irr.fields', 'Per hectare of this plot, {area}.', { area: area(plot.areaHa ?? 0) }))]
    : (alerts.length ? null : noAction()),
  req('WF5.111'));
}

/* FERTILISATION: when, and with what, per hectare — "Fertilisers needed",
   the same words as the irrigation schedule (B12) and the fertilisation
   advice (D3), because it is the same content in both places.

   The advice is in every plan; "Fertilisers needed" is the fertilisation
   schedule, Premium on crops (`fertigation`, the plan sheet, Oct 2026). */
export function fertilisationBox(plot) {
  const alerts = adviceOf(plot, 'nutrition');
  const f = plot.fertigation;
  const needed = f && !f.targets.includes('maintenance');
  if (needed && !has('fertigation', plot.farmId)) {
    return titledCard(titled('sprout', t('box.fertilisation', 'Fertilisation')), {},
      alerts.map(adviceLine),
      lockedRow('fertigation', t('d2.fertneeded', 'Fertilisers needed')));
  }
  return titledCard(titled('sprout', t('box.fertilisation', 'Fertilisation')), {},
    alerts.map(adviceLine),
    when(needed, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      h('div', { style: { fontWeight: 650 } }, t('d2.fertneeded', 'Fertilisers needed')),
      kv([
        [t('d2.fert.product', 'Product'), f.product],
        [t('d2.fert.rate', 'Rate'), t('d2.fert.ratevalue', '{n} kg per hectare, per irrigation', { n: num(f.kgPerEventPerHa) })],
        [t('box.fert.when', 'When'), t('d2.fert.eventsvalue', '{n} of this week’s irrigations', { n: num(f.events) })],
      ]))),
    when(!alerts.length && !needed, noAction));
}

/* DISEASE & PEST: last on the page, and never a percentage — not a
   probability, not a Harvey ball, and not called "risk". An action word, in
   the words the advice uses: Action required, Inspect and report back,
   Monitor — or No action. Each row opens the directory entry, which says how
   to check for it and what to do. */
const PEST_ACTION = {
  action: { label: () => t('pest.action', 'Action required'), tone: 'urgent' },
  inspect: { label: () => t('pest.inspect', 'Inspect and report back'), tone: 'monitor' },
  monitor: { label: () => t('pest.monitor', 'Monitor'), tone: 'quiet' },
};

export function pestAction(risk) {
  if (risk.band === 'urgent' || risk.risk >= 60) return 'action';
  if (risk.rising || risk.risk >= 40) return 'inspect';
  return 'monitor';
}

export function pestBox(plot) {
  const alerts = adviceOf(plot, 'protection');
  const risks = (plot.diseaseRisk ?? []).slice(0, 3);
  return titledCard(titled('shield', t('box.pest', 'Disease & pest')), {
    bleed: true,
    aside: helpButton(
      t('box.pest.help', 'What to do about the pests and diseases this crop is prone to, from what the satellite sees on the plot and the weather this week. Open one to read how to check for it and how to treat it.'),
      { title: t('box.pest', 'Disease & pest') },
    ),
  },
  alerts.map(adviceLine),
  risks.map((risk) => {
    const a = PEST_ACTION[pestAction(risk)];
    return h('button.row.boxline', { type: 'button', onclick: () => go(`F16:${risk.diseaseId}`) },
      h('div.row__main', h('div.row__title', tc(`disease.${risk.diseaseId}.name`, risk.name))),
      h(`span.pestword.pestword--${a.tone}`, a.label()),
      h('span.row__chev', icon('forward', 18, 'flip')));
  }),
  when(!alerts.length && !risks.length, () => h('div', { style: { padding: '12px 16px 14px' } }, noAction())));
}

/* -- where the advice for a plot opens ------------------------------------ */

export function detailRouteFor(advice) {
  return ({ irrigation: 'D2', nutrition: 'D3', protection: 'D4' })[advice.type] ?? 'D2';
}
