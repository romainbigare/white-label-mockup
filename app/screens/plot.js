/* ---------------------------------------------------------------------------
   plot.js — B2 Plot detail, B3/B4 Crop cycles.

   B2 IS DELIBERATELY SHORT NOW. The review's complaint about this screen was
   not that anything on it was wrong; it was that the crop — the one thing the
   farmer both knows and has to tell us — was buried under a satellite image, a
   date stepper, a table of eight properties and a trend chart, and was then
   two more taps down. So the crop comes FIRST, above the imagery, and it is
   either "you are growing tomatoes" or "tell us what you planted". Everything
   else keeps its order below it.

   A TREE GROUP HAS NO CROP CYCLE. Citrus is citrus; there is nothing to sow and
   nothing to rotate to. What a tree group has instead is a count, the parcels it
   stands on, and the way through to the trees themselves.

   Two things here are easy to get wrong and are therefore centralised:
     * WF5.019 — the date stepper moves between AVAILABLE IMAGERY DATES, not
       calendar days. `stepDate()` walks the farm's imagery list, and when the
       user reaches the end it says why.
     * WF5.036 — on an intercropped plot the readings are per crop, with a
       "Whole plot" option; and WF5.038 says that when separation cannot be
       computed the whole-plot reading is shown MARKED, never passed off as one
       crop's. `cropSelector()` owns both.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, switchTab, back } from '../core/router.js';
import { B5 } from './trees.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock,
  statusIcon, healthScore, kv, disclaimer, req, field, input, chips, divider, helpButton, deckMark,
  titledCard,
} from '../ui/components.js';
import { area, num, date, NOW } from '../core/format.js';
import { plotById, rawPlot, farmById, measureByKey, measures, adviceForPlot, severityToStatus } from '../data/selectors.js';
import { startCycle } from '../data/actions.js';

import { has, lock } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { plotRasterSvg, rampCss } from '../ui/map.js';
import { trendChart, axisLabels, pairedBars } from '../ui/charts.js';

/* -- the growth stage, and the curve behind it ----------------------------

   NEW AT THE 13/09 CATALOGUE REVIEW, which found this one missing and already
   being sold: the plan comparison table promised growth-stage modelling and
   no screen delivered it.

   WHAT MAKES IT MORE THAN A LABEL. "Flowering" on its own is a word the farmer
   can see out of the window. What he cannot see is whether the plant reached
   flowering EARLY or LATE for the heat it has had, and that is the whole value
   of modelling it: growing degree days accumulate whether or not anyone is
   watching, so a crop can be four days behind its own curve in a cool week and
   a fortnight ahead after a hot one. The verdict line is therefore the point of
   this block, and the stage track is the context that makes the verdict
   readable.

   WHY GDD IS PRINTED AT ALL. It is the unit the model actually runs on, and a
   farmer who is told he is behind is owed the number that says so — the same
   argument that puts the quantities above the price on A17 rather than handing
   down a figure. It is set small, under the track, because it is the working
   rather than the answer.

   ACCUMULATION, NOT A CALENDAR. The season bar on B3 counts days; this counts
   heat. Where the two disagree — a crop that is two-thirds through its days and
   half through its heat — the disagreement is the useful part, which is why
   both stayed rather than one replacing the other. */

function stageTrack(growth) {
  return h('div', { style: { display: 'flex', gap: '4px' } },
    growth.curve.map((stage, i) => h('span', {
      style: {
        flex: 1, height: '8px', borderRadius: '999px',
        // The stage the crop is IN is brand; the ones behind it are the quiet
        // filled state; the ones ahead are empty. Three states, one row.
        background: i === growth.stageIndex ? 'var(--brand-600)'
          : stage.reached ? 'var(--brand-300)' : 'var(--ink-200)',
      },
    })));
}

/* `bare: true` is B2 since review 21/09: titledCard() supplies the card, so
   this must not draw a second one inside it. */
function growthBlock(growth, { bare = false } = {}) {
  // Ahead or behind, in the farmer's terms. Inside two days either way the
  // honest answer is "on track" — a model that reports one day of difference
  // as news is a model nobody believes the third time.
  const off = growth.aheadDays;
  const verdict = Math.abs(off) <= 2
    ? t('b4.growth.ontrack', 'On track for this crop and this season.')
    : off > 0
      ? t('b4.growth.ahead', '{n} days ahead of the expected pace.', { n: num(off) })
      : t('b4.growth.behind', '{n} days behind the expected pace.', { n: num(Math.abs(off)) });

  const inner = (...kids) => (bare ? h('div', {}, ...kids) : card({}, cardPad(...kids)));
  return inner(
    h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' } },
      h('strong', { style: { fontSize: 'var(--t-lead)' } }, growth.stageName),
      h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
        t('b4.growth.of', 'stage {n} of {total}', { n: num(growth.stageIndex + 1), total: num(growth.stageCount) }))),
    stageTrack(growth),
    h('div', { style: { color: 'var(--ink-700)' } }, verdict),
    when(growth.nextStageName, () => h('div', { style: { color: 'var(--ink-600)' } },
      t('b4.growth.next', 'Next: {stage}, about {n} days away.', {
        stage: growth.nextStageName, n: num(growth.daysToNext),
      }))),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      t('b4.growth.gdd', '{acc} of {target} growing degree days, base {base} °C', {
        acc: num(growth.accumulated), target: num(growth.target), base: num(growth.base),
      })));
}

/* -- the fortnight of disease risk ----------------------------------------

   ALSO NEW AT THE 13/09 REVIEW, and the pair to the directory it links into.
   The app already carried crop-protection ADVICE — a product, a rate, a
   pre-harvest interval — which arrives once the decision is made. What it had
   no way of saying was that the decision is coming: that mildew risk is
   climbing into the weekend and the window to act is now.

   IT IS A FORECAST, SO IT IS BOUNDED. Every row names the thing, how likely it
   is, and when it peaks; a risk with no date on it is a worry rather than a
   warning. Rows are drawn only from directory entries that name this crop, so
   a wheat plot is never told to watch for red palm weevil — which is the
   failure a single farm-wide risk score cannot avoid.

   AND EVERY ROW IS A DOOR. Tapping one opens that entry in the directory:
   symptoms to confirm it by, the conditions that bring it on, what to do, and
   the interval before harvest. A warning the farmer cannot follow up is a
   warning he learns to swipe past. */
function riskBlock(risks, { bare = false } = {}) {
  const top = risks.slice(0, 3);
  const inner = (...kids) => (bare
    // Negative inline margins pull the rows out to the card's own edges, which
    // is where a row belongs: cardPad() is for prose, not for tappable rows.
    ? h('div', { style: { marginInline: 'calc(var(--sp-4) * -1)', marginBottom: 'calc(var(--sp-4) * -1)', marginTop: '6px' } }, ...kids)
    : card({}, ...kids));
  return inner(top.map((risk, i) => h('button.row', {
    onclick: () => go(`F16:${risk.diseaseId}`),
    style: i ? { borderTop: '1px solid var(--ink-200)' } : {},
  },
  statusIcon(risk.band, 20),
  h('div.row__main',
    h('div.row__title', risk.name),
    h('div.row__sub',
      [risk.rising ? t('b4.risk.rising', 'rising') : null,
        t('b4.risk.window', 'peaks in {window}', { window: risk.window })].filter(Boolean).join(' · '))),
  h('span', { style: { fontWeight: 650, color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' } },
    `${num(risk.risk)}%`),
  h('span.row__chev', icon('forward', 18, 'flip')))));
}

/* -- shared: imagery date stepping, WF5.019 ------------------------------- */

function dateState(plot) {
  const farm = farmById(plot.farmId);
  const dates = farm.imageryDates;
  const ui = local(`dates-${plot.id}`, { index: Math.max(0, dates.length - 1), notice: null });
  ui.index = Math.max(0, Math.min(dates.length - 1, ui.index));
  return { dates, ui, current: dates[ui.index] ?? null };
}

function stepDate(plot, direction) {
  const { dates, ui } = dateState(plot);
  const next = ui.index + direction;
  if (next < 0) {
    // WF5.019 — say why, rather than dead-ending silently.
    ui.notice = t('b4.nodates.old', 'This is the oldest image we have for this plot. Earlier imagery isn’t included in your plan.');
  } else if (next > dates.length - 1) {
    ui.notice = t('b4.nodates.new', 'This is the most recent image. The next pass is expected in 2–3 days.');
  } else {
    ui.index = next;
    ui.notice = null;
  }
  commit('dates');
}

/* -- shared: per-crop attribution on intercropped plots, WF5.036 / WF5.038 -- */

function cropSelector(plot) {
  if (!plot.secondaryCropId) return null;
  const ui = local(`crop-${plot.id}`, { crop: 'primary' });
  const options = [
    { id: 'primary', label: plot.cropName },
    { id: 'secondary', label: plot.secondaryCropName },
    { id: 'whole', label: t('b4.wholeplot', 'Whole plot') },
  ];
  // WF5.038 — separation is unavailable on some dates; the reading is then shown
  // as Combined canopy and per-crop recommendations are suppressed for that date.
  const { current } = dateState(plot);
  const separated = !current || !current.date.endsWith('4');
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    chips(options, separated ? ui.crop : 'whole', (id) => {
      if (!separated) return;
      ui.crop = id; commit('crop');
    }),
    when(!separated, () => disclaimer(
      t('b4.combined', 'Combined canopy — we couldn’t separate the date palm from the alfalfa on this date, so this shows the whole-plot reading. Per-crop advice is paused for this date only.'))));
}

/* -- B2 · Plot detail ------------------------------------------------------
   OPEN FIELD ONLY. A tree group goes to B5 instead: it has no crop, no cycle
   and no season, and a screen built round "what is growing here" was answering
   a question citrus does not raise.

   THE MAP OWNS ITS OWN CONTROLS. The measure picker, the date stepper and the
   compare control used to be three full-width rows stacked under the image,
   which is most of a phone screen spent on chrome for a picture 190 px tall.
   They are three buttons on the image now, each opening a panel over it. The
   third one is new and does what the review asked for: it hands the plot to the
   Map tab, which is where a full-screen reading belongs and is why B7 and B8 no
   longer exist as screens of their own.

   THE CROP CYCLE IS A BOX UNDER THE MAP, not a section three scrolls down. It
   is the thing the farmer knows and we do not, so it sits directly under the
   picture with everything else about the plot inside it and one Edit button. */

const PANELS = { measure: 'measure', date: 'date' };

export function B2(plotId) {
  const plot = plotById(plotId);
  // A tree group has no crop and no cycle; B5 is its screen.
  if (plot.kind === 'trees') return B5(plot.id);

  const farm = farmById(plot.farmId);
  const { dates, ui, current } = dateState(plot);
  const panel = local(`b4-${plot.id}`, { open: null });
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const advice = adviceForPlot(plot.id);
  const cycle = plot.cropCycles.find((c) => c.state === 'current');
  const measureLocked = !has(measure.featureKey);

  return {
    top: appBar({
      title: plot.shortName,
      // WF5.018 — there is no block between the plot and the farm any more.
      subtitle: farm.name,
      actions: [overflowAction(() => openSheet('PLOT_MENU', { plotId: plot.id }), undefined,
        { deckNote: 'Rename, edit the boundary, remove the plot' })],
    }),
    body: page(
      // WF2.011 — a plot on a farm not yet on the watchlist has nothing to draw,
      // so it gets a designed empty state rather than a blank frame.
      when(!current, () => noImagery(farm)),

      when(current, () => h('div.mapbox.plotmap', { style: { height: '260px', borderRadius: 'var(--radius)' } },
        measureLocked
          ? h('div', { style: { display: 'grid', placeItems: 'center', height: '100%', background: 'var(--ink-100)' } },
              h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: measure.featureKey }) },
                icon('lock', 16), t('locked.measure', '{name} is not in your plan', { name: measure.plain })))
          : plotRasterSvg(plot, measureKey, { dateKey: current.date, zoomOut: true }),

        // THE THREE BUTTONS. Top right, stacked, each 44 dp, each naming what it
        // does — WF2.014 keeps the label on the accessible name rather than
        // under the glyph, because there is no room on a photograph for three
        // captions and the panel each one opens says its own name at the top.
        h('div.plotmap__tools',
          mapTool('compare', t('b4.dates', 'Which date?'), panel.open === PANELS.date,
            () => { panel.open = panel.open === PANELS.date ? null : PANELS.date; commit('b4'); },
            { deckNote: 'Picks the imagery date, and compares two' }),
          mapTool('scan', t('b4.openmap', 'Open in the map'), false,
            () => { state.ui.farmFilter = farm.id; state.ui.mapPlot = plot.id; switchTab('map'); },
            { deckTo: 'C1' })),

        h('button.plotmap__metric', {
          type: 'button',
          onclick: () => { panel.open = panel.open === PANELS.measure ? null : PANELS.measure; commit('b4'); },
          'aria-expanded': panel.open === PANELS.measure,
          'aria-label': t('b4.measure', 'Choose map metric'),
          ...deckMark({ deckNote: 'Changes the map metric from the compact legend control' }),
        },
        h('span.plotmap__metric-title', t(`measure.${measure.key}`, measure.plain), icon('chevronDown', 14)),
        h('span.plotmap__metric-legend',
          h('span', 'Low'), h('i', { style: { background: rampCss(measureKey) } }), h('span', 'High')),
        h('span.plotmap__metric-date', current ? date(current.date) : '')),

        when(panel.open === PANELS.measure, () => mapPanel(
          t('b4.measure', 'Which reading?'),
          () => { panel.open = null; commit('b4'); },
          measures().map((m) => panelRow(m.key === measureKey, t(`measure.${m.key}`, m.plain), m.unitNote,
            has(m.featureKey)
              ? () => { state.ui.measure = m.key; panel.open = null; commit('b4'); }
              : () => { panel.open = null; openModal('UPGRADE', { featureKey: m.featureKey }); },
            !has(m.featureKey))))),

        when(panel.open === PANELS.date, () => mapPanel(
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
          // WF5.032 — comparing two dates is a map job, and the map tab does it
          // over the whole farm. This is the way there.
          has('maps.compare')
            ? btn(t('b4.compare', 'Compare two dates'), {
              variant: 'secondary', size: 'sm', icon: 'compare',
              onclick: () => { panel.open = null; state.ui.farmFilter = farm.id; state.ui.mapCompare = true; switchTab('map'); },
            })
            : h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: 'maps.compare' }) },
              icon('lock', 15), t('b4.compare', 'Compare two dates')))))),

      when(ui.notice, () => disclaimer(ui.notice)),

      // WHAT IS GROWING HERE, directly under the picture, with everything else
      // about the plot inside the same box and one way to change it.
      cropBox(plot, cycle, farm),

      /* WF5.020 — the interpretation names WHERE and HOW LONG.

         IT USED TO FLOAT. Review 22/09: "there's also random piece of
         information outside of card container, which is very confusing. Why
         crop growth stage is outside a container?" — and the thing he was
         pointing at is this block, whose first line on a wheat plot reads
         "Grain filling stage". Unboxed, with a status disc beside it, it read
         as a stray caption belonging to whatever was above or below it; and
         because it names a stage, it read as the Growth stage card's title
         having escaped. It is the satellite's own summary of the picture over
         it, so it says so and it sits in a card like everything else. */
      when(current, () => titledCard(
        t('b4.reading', 'What the satellite sees'), {},
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
          statusIcon(plot.status, 22),
          h('div',
            h('div', { style: { fontWeight: 650 } }, plot.statusLine),
            h('div', { style: { color: 'var(--ink-600)' } }, plot.interpretation),
            req('WF5.024'))))),

      /* THE SCORE AND THE TREND ARE ONE BOX SINCE REVIEW 21/09.

         "That box should probably be merged with the 'health score' label
         rather than sitting in its own separate category — visually they read
         as unrelated right now." They were two cards with a section rule
         between them: a number, then a heading called "Trend", then a chart of
         that same number over time. One measure, drawn as two subjects.

         THE AXIS IS THE CROP CYCLE, IN WEEKS. It was six fixed month names,
         Mar to Aug, which is a calendar and not a season — and the same six
         whatever was planted or when. "Is the time axis in weeks, since we're
         tracking a crop cycle?… it should run from planting date to harvest,
         building up week over week." So the labels are weeks counted from the
         planting date on the cycle, and where there is no cycle they fall back
         to the length of the series itself.

         AND THE TARGET IS ON IT. "Could we also add a reference line showing
         the target?" A trend says which way the crop is going; it takes a
         second line to say whether that is good enough. */
      when(current, () => titledCard(
        t(`measure.${measure.key}`, measure.plain),
        { aside: healthScore(plot.measures?.[measureKey]?.score) },
        h('div', { style: { color: 'var(--ink-600)' } }, t('b4.trend.score', 'Health score and trend use a 0–100 scale.')),
        when((plot.series[measureKey] ?? []).length > 1, () => h('div', { style: { marginTop: '10px' } },
          trendChart(plot.series[measureKey] ?? [], { label: measure.plain, target: TREND_TARGET }),
          axisLabels(cycleWeeks(plot.series[measureKey] ?? [])),
          h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)', marginTop: '6px' } },
            swatch('var(--brand-600)', t('b4.trend.actual', 'This plot')),
            swatch('var(--st-monitor)', t('b4.trend.target', 'Target'))))))),

      /* GROWTH STAGE AND DISEASE RISK, IN THAT ORDER, UNDER THE TREND.
         Both are readings about the crop rather than about the ground, so they
         sit after the measure they are built from and before the advice they
         will turn into. Stage first: it is true every day of the season, where
         a risk is only sometimes worth reading. A tree group gets the stage too
         — a palm has a fruiting cycle even though it has no crop cycle to sow —
         which is why this is keyed off `plot.growth` rather than off the
         cycle. */
      /* Review 21/09, the same note again: "On 'stem extension' and growth
         stage — it's not clear the two are linked; make it one combined box."
         Stem extension is the stage the crop is AT; the heading said "Growth
         stage" a rule above it. Two words for one fact, drawn as two things. */
      when(plot.growth, () => titledCard(t('b4.growth', 'Growth stage'), {
        // The ⓘ carries the mechanism, which is the one question this block
        // raises and the one it must not spend a line on: why a stage can move
        // faster than the calendar.
        aside: helpButton(
          t('b4.growth.help', 'We add up the heat your crop has actually had — growing degree days — and compare it with the heat this crop normally needs to reach each stage. That is why a stage can arrive sooner in a hot week than the calendar suggests.'),
          { title: t('b4.growth', 'Growth stage') },
        ),
      }, growthBlock(plot.growth, { bare: true }))),

      // "Same note for 'disease and pest risk'."
      when(plot.diseaseRisk?.length, () => titledCard(t('b4.risk', 'Disease and pest risk'), {
        aside: helpButton(
          t('b4.risk.help', 'Risk is worked out from the weather ahead and what this crop is prone to. It is a forecast, not a finding — nothing has been seen on your plot yet. Open a row to read how to confirm it and what to do about it.'),
          { title: t('b4.risk', 'Disease and pest risk') },
        ),
      }, riskBlock(plot.diseaseRisk, { bare: true }))),

      // WF5.101 — once actions have been recorded, show advised vs applied.
      when(plot.irrigationRecord.some((r) => r.appliedM3 > 0), () =>
        titledCard(t('b4.advisedapplied', 'Water advised and applied'), {
          aside: helpButton(
            t('b4.advisedapplied.help', 'Grey is what we advised for that week; green is what was actually put on, from the irrigation records entered on this plot. A run of green under grey is a plot being under-watered against its own advice.'),
            { title: t('b4.advisedapplied', 'Water advised and applied') },
          ),
        },
        pairedBars(plot.irrigationRecord.map((r) => ({ label: r.week, a: r.advisedM3, b: r.appliedM3 })), { label: 'Advised versus applied' }),
        h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          swatch('var(--ink-300)', t('b4.advised', 'Advised')),
          swatch('var(--brand-600)', t('b4.applied', 'Applied'))),
        req('WF5.131'))),

      // RECENT SUGGESTIONS, not recent activity. A log of what was done is a
      // record; what the farmer opens a plot to see is what the model thinks
      // about it, and where nothing is outstanding the ones already dealt with
      // still say what kind of farm this has been lately.
      /* Review 21/09 — "rename 'recent suggestions' to 'advice for this plot'
         — it's not a suggestion, it's advice, and that's the language we've
         been using elsewhere." Which is right twice over: the word is advice
         everywhere else in the app, including B5's identical block, and what
         this list links to IS the advice inbox filtered to this plot. */
      titledCard(t('b4.suggestions', 'Advice for this plot'), { bleed: true }, (() => {
        const recent = adviceForPlot(plot.id, { includeDone: true }).slice(0, 4);
        return recent.length
          ? recent.map((a) => row({
            iconName: ADVICE_ICON[a.type] ?? 'advice',
            title: a.action,
            sub: [a.amount, a.status === 'completed' ? t('advice.recorded.done', 'Recorded') : null].filter(Boolean).join(' · '),
            statusKey: a.status === 'completed' ? 'good' : severityToStatus(a.severity),
            value: date(a.issuedAt, { noYear: true, short: true }),
            onclick: () => go(`${detailRouteFor(a)}:${a.id}`),
          }))
          : h('div', { style: { padding: '18px', textAlign: 'center', color: 'var(--ink-500)' } },
            t('b4.suggestions.empty', 'Nothing suggested for this plot yet.'));
      })()),
    ),
    // WF5.025 — one primary action, and it goes where the work is. It used to
    // read "Nothing to do here today" and be disabled on a quiet plot, which is
    // a dead control taking the most valuable space on the screen.
    // "'Advices' should be singular — 'Advice' — and probably lowercase."
    dock: actionDock(btn(t('b4.seeadvice', 'See advice'), {
      variant: 'primary', icon: 'advice',
      onclick: () => {
        state.ui.farmFilter = farm.id;
        // The screener is the farmer's own setting and is remembered between
        // sessions, so arriving from a plot narrows the FARM and leaves his
        // three menus exactly as he left them. It used to force the tab to
        // "needs action", which quietly undid a choice he had made on purpose.
        switchTab('advice');
      },
    })),
  };
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

function panelRow(selected, title, sub, onclick, locked = false) {
  return h(`button.mappanel__row${selected ? '.mappanel__row--on' : ''}`, { onclick, type: 'button' },
    h('span', { style: { flex: 1, minWidth: 0 } },
      h('span', { style: { fontWeight: 600, display: 'block' } }, title),
      sub ? h('small', { style: { color: 'var(--ink-500)' } }, sub) : null),
    locked ? icon('lock', 16) : (selected ? icon('check', 18) : null));
}

/* WHAT IS GROWING HERE, AND EVERYTHING ELSE ABOUT THE PLOT.

   One box under the map, in three states:

     waiting  the satellite watched the field being cleared and cannot name what
              replaced it for about three weeks, so the app asks. This is the
              reminder the review asked for by name.
     growing  the crop, when it went in, and when we expect it off.
     bare     a plot with no cycle recorded at all.

   Underneath, in the same box, the properties that used to be a separate "This
   plot" section — because they are the record of the plot and this is the box
   that holds it. */
function cropBox(plot, cycle, farm) {
  const awaiting = !!plot.harvestDetectedOn;
  const canEdit = can('cropcycle.manage', farm);

  /* NO CROP SET IS ONE BUTTON AND NOTHING ELSE, SINCE REVIEW 21/09 (SECOND
     PASS).

     "If a crop is not set, let's just add a button to set it, and open the
     screen to add a new cycle. If there's no crop, basically remove the 'we
     don't know what's growing there', the different metrics such as area,
     variety, planted, etc."

     Which is a stronger version of what the call already decided — "this should
     really just be a concise box: 'we don't know what's growing here — set the
     crop'" — and it is right to go further. Every line the box carried was an
     answer to a question the farmer has not been asked yet. The heading told
     him something he can see; the harvest date told him about the crop that has
     GONE; and the properties underneath — variety, planted, expected yield —
     belong to a cycle that does not exist. Printing "Variety: San Marzano"
     under "we don't know what is growing here" is the screen contradicting
     itself in two lines.

     So the whole box collapses to the one control. And it opens B4 rather than
     the crop picker sheet: a crop on its own is not a cycle, and the farmer who
     is answering this question has a planting date in his head too.

     The mismatch warning and the properties below all hang off the same
     `awaiting` flag now, which is why they are inside this branch rather than
     appended after it. */
  if (awaiting) {
    return card({}, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon('sprout', 24)),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
            t('b4.nocrop', 'No crop set')),
          h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t('b4.harvested.short', '{crop} came off on {d}', {
              crop: plot.cropName, d: date(plot.harvestDetectedOn, { noYear: true, short: true }),
            })))),
      when(canEdit, () => btn(t('b4.setcrop', 'Set the crop for this plot'), {
        variant: 'emphasis', icon: 'sprout', deckTo: 'B4',
        deckNote: 'Opens the new crop cycle screen',
        onclick: () => go(`B4:${plot.id}`),
      }))));
  }

  const head = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
    h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('sprout', 24)),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
        t('b4.growing', 'Growing {crop}', { crop: plot.cropName })),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        cycle
          ? [t('b5.sown', 'Started {date}', { date: date(cycle.startDate, { noYear: true }) }),
            cycle.expectedHarvest ? t('b4.expected', 'harvest around {d}', { d: date(cycle.expectedHarvest, { noYear: true }) }) : null,
          ].filter(Boolean).join(' · ')
          : t('b4.nocycleyet', 'No planting date recorded'))),
    when(canEdit, () => btn(t('action.edit', 'Edit'), {
      variant: 'secondary', size: 'sm', block: false, deckTo: 'B3',
      onclick: () => go(`B3:${plot.id}`),
    })));

  return card({}, cardPad(
    head,
    when(cycle?.detectedCropName && cycle.detectedCropName !== cycle.cropName, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--st-monitor)', fontWeight: 600 },
    }, statusIcon('monitor', 16), t('b4.mismatch.short', 'The satellite reads something else here'))),
    divider(),
    // WF6.020 — the values the watering calculation consumes, and WF5.115's
    // prompt where one of them is missing.
    /* THE ORDER IS THE REVIEWER'S, AND SO IS THE ROW THAT WAS MISSING.

       Review 21/09: "reorder the plot summary fields as area, variety, planting
       date, then expected yield — and add planting date, which I'd already
       entered but wasn't shown." He is right that it was absent: he typed a
       planting date into B4 and then could not find it anywhere on the plot.

       And "expected yield", not "target yield". The number is ours — the model
       works it out and the farmer cannot change it (see B4) — so calling it a
       target invited him to treat it as a thing he sets. */
    kv([
      [t('b4.area', 'Area'), area(plot.areaHa)],
      plot.variety ? [t('b4.variety', 'Variety'), plot.variety] : null,
      cycle?.startDate ? [t('b5.sownlabel', 'Planted'), date(cycle.startDate)] : null,
      cycle?.targetYield ? [t('b4.expectedyield', 'Expected yield'), cycle.targetYield] : null,
      plot.secondaryCropName ? [t('b4.secondary', 'Also growing'), plot.secondaryCropName] : null,
      [t('b4.soil', 'Soil'), plot.soil],
      [t('b4.efficiency', 'Irrigation efficiency'), `${num(plot.irrigationEfficiencyPct ?? 85)}%`],
      [t('b4.flow', 'System flow rate'), plot.flowRateM3h
        ? `${num(plot.flowRateM3h)} m³/h`
        : h('button.textlink', {
          onclick: () => toast(t('b4.addflow.done', 'We will ask for this when you next log irrigation')),
        }, t('b4.addflow', 'Add a flow rate'))],
    ].filter(Boolean)),
    when(can('plot.create', farm), () => btn(t('b4.editplot', 'Edit these details'), {
      variant: 'ghost', size: 'sm', block: false,
      onclick: () => openSheet('ASSUMPTIONS', { plotId: plot.id }),
    }))));
}

/** WF2.011 / WF5.019 — "no imagery for the selected date" is a designed state. */
function noImagery(farm) {
  return card({ accent: 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
      statusIcon('nodata', 22),
      h('div',
        h('div', { style: { fontWeight: 650 } }, t('b4.noimagery', 'No imagery yet')),
        h('div', { style: { color: 'var(--ink-600)' } },
          farm.imageryBlockedReason ?? t('b4.noimagery.body', 'This farm was just added to our satellite watchlist. The first images usually arrive within 48 hours.')))),
    req('WF2.011')));
}

/* THE TARGET LINE'S VALUE. The health score is a 0–100 scale and 70 is the
   line between "monitor" and "good" on it, so the target the chart draws is the
   score a plot has to hold to stop being a plot anybody watches. It is a
   constant here because the mockup has no per-crop target to read; the built
   app takes it from the crop, which is the one thing to change when it does. */
const TREND_TARGET = 70;

/* THE AXIS, IN WEEKS OF THE CROP CYCLE RATHER THAN MONTHS OF THE YEAR.

   It was six fixed month names — Mar to Aug — printed under every chart on
   every plot whatever was growing and whenever it went in. Review 21/09: "Is
   the time axis in weeks, since we're tracking a crop cycle?… it should run
   from planting date to harvest, building up week over week."

   Five labels across whatever span the series covers, one week apart per
   reading, which is what the series is. A typical cycle is about three months,
   so five labels lands roughly a fortnight apart and the row stays readable at
   phone width. */
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

export function detailRouteFor(advice) {
  return ({ irrigation: 'D2', nutrition: 'D3', protection: 'D4' })[advice.type] ?? 'D2';
}

/* -- B3 · Crop cycles ----------------------------------------------------- */

export function B3(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const current = plot.cropCycles.find((c) => c.state === 'current');
  const previous = plot.cropCycles.filter((c) => c.state === 'closed');
  const canManage = can('cropcycle.manage', farm);

  return {
    top: appBar({
      title: t('b5.title', 'Crop cycles'), subtitle: plot.shortName,
      actions: [canManage ? barAction('plus', t('action.new', 'New'), () => go(`B4:${plot.id}`), { deckTo: 'B4' }) : null].filter(Boolean),
    }),
    body: page(
      when(current, () => cropMismatch(plot, current)),

      // THE SEASON AS A BAR, not as a table of dates. What a farmer wants off
      // this screen is where he is in the season and how long is left, and a
      // list reading "Planting date 12 Feb / Harvest expected 4 Nov" makes him
      // do that arithmetic himself. The bar does it: sown at one end, harvest
      // at the other, today marked.
      when(current, () => card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('sprout', 22)),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, current.cropName),
            when(current.variety, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, current.variety))),
          h('span.status.status--good', icon('check', 15), t('b5.current', 'Current'))),

        seasonBar(current),

        /* THE HEAT BESIDE THE DAYS, at the 13/09 review. The bar above counts
           calendar days to the harvest estimate; this line says how much of
           the crop's own heat requirement has actually accumulated, which is
           what decides whether that estimate holds. A season two-thirds
           through its days and half through its heat is a harvest that will
           be late, and the farmer can see that here before the estimate
           moves under him. */
        when(current.growth, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b5.gdd', '{stage} · {acc} of {target} growing degree days', {
              stage: current.growth.stageName,
              acc: num(current.growth.accumulated),
              target: num(current.growth.target),
            })),
          h('div.season__bar', { style: { height: '6px' } },
            h('span.season__fill', {
              style: { width: `${Math.min(100, Math.round((current.growth.accumulated / current.growth.target) * 100))}%` },
            })))),

        // The two numbers a season is judged on, side by side, only where the
        // fixture has them — a target with no yield beside it is an ambition.
        when(current.yieldSoFar || current.targetYield, () => h('div', { style: { display: 'flex', gap: '10px' } },
          when(current.yieldSoFar, () => figure(t('b5.yieldsofar', 'Yield so far'), current.yieldSoFar)),
          // "Expected", not "target", everywhere the number is shown — it is
          // our estimate and not the farmer's goal. See the note on B4.
          when(current.targetYield, () => figure(t('b4.expectedyield', 'Expected yield'), current.targetYield)))),

        /* THE FORECAST, AND IT IS A RANGE.

           The app has always carried a TARGET yield, which is the farmer's own
           ambition typed into a field, and a yield SO FAR, which is what has
           been weighed. Neither is a prediction, and the tour has been
           promising one for months.

           A single number would be the wrong shape for it twice over: MMC
           quotes about 90% accuracy on annual crops, and the 13/09 call was
           explicit that date palms need another season's work before their
           figure can be trusted. So the band is the feature — wide early,
           narrowing as the crop fills — and where it is a tree the screen says
           in as many words that the model is still being refined, rather than
           printing a confident number nobody should act on. */
        when(current.yieldForecast, () => yieldForecastBlock(current.yieldForecast)),

        // A cut crop is a season inside a season; alfalfa is cut eight times.
        when(current.cutsMonitor, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b5.cutvalue', '{a} of {b}, next around {d}', {
              a: current.cutsDone, b: current.cutsMonitor, d: date(current.nextCut, { noYear: true }),
            })),
          h('div.cuts', Array.from({ length: current.cutsMonitor }, (_, i) => h(
            `span.cuts__mark${i < current.cutsDone ? '.cuts__mark--done' : ''}`,
          ))))),

        when(canManage, () => btn(t('b5.manage', 'Edit this cycle'), {
          variant: 'secondary', size: 'sm', block: false, deckTo: 'B4',
          onclick: () => go(`B4:${plot.id}|${current.id}`),
        }))))),

      when(!current, () => card({ accent: 'nodata' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon('nodata', 20),
          h('span', { style: { fontWeight: 650 } }, t('b5.none', 'Nothing planted here at the moment'))),
        when(canManage, () => btn(t('b5.start', 'Record a planting'), {
          variant: 'primary', size: 'sm', block: false, icon: 'plus',
          onclick: () => go(`B4:${plot.id}`),
        }))))),

      // WF5.029 — closing never deletes; the full history stays visible. It is
      // a TIMELINE rather than a stack of cards: what the history is for is
      // comparing one year with the last, and cards of equal weight down a
      // screen hide the sequence that is the whole point of keeping them.
      section(t('b5.previous', 'Previous seasons'), {},
        previous.length
          ? card({}, previous.map((cycle) => h('button.season', {
            onclick: () => go(`B4:${plot.id}|${cycle.id}`), type: 'button',
          },
          h('span.season__year', String(new Date(cycle.startDate).getUTCFullYear())),
          h('span.season__body',
            h('span.season__crop', `${cycle.cropName}${cycle.variety ? ` — ${cycle.variety}` : ''}`),
            // A range in a list row is the one place the second calendar is
            // dropped: two full dates either side of a dash is a paragraph
            // where the column wants a stamp, and the year beside it is what
            // the reader is scanning down anyway.
            h('span.season__dates',
              `${date(cycle.startDate, { short: true, noYear: true })} – ${date(cycle.actualHarvest, { short: true })}`)),
          h('span.season__yield', cycle.actualYield ?? '—'),
          h('span.row__chev', icon('forward', 18, 'flip')))))
          : h('p', { style: { color: 'var(--ink-500)', margin: 0 } }, t('b5.noprev', 'No earlier cycles recorded on this plot.'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b5.retained', 'Crop history is kept for good. Rotating a field never erases past cycles.'), req('WF5.029'))),
  };
}

/* WHERE THE SEASON IS, drawn rather than tabulated.

   Sowing at one end, the harvest we expect at the other, and today's position
   between them. The harvest date is OUR estimate and says so — review C287 took
   it off the farmer, and a date he did not type and cannot edit has to declare
   where it came from. */
/** The predicted harvest, as a band with its own confidence stated. Drawn as
    prose with one big figure rather than as a third `figure()` beside the
    target and the yield so far: those two are facts, this is a model's
    opinion, and setting all three in the same tiles would make it look like
    the same kind of thing. */
function yieldForecastBlock(forecast) {
  const confidence = {
    low: t('b5.forecast.low', 'Early in the season, so the range is wide.'),
    fair: t('b5.forecast.fair', 'Narrowing as the crop fills.'),
    good: t('b5.forecast.good', 'The crop is far enough along for this to be firm.'),
  }[forecast.confidence] ?? '';
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column', gap: '2px',
      borderTop: '1px solid var(--ink-200)', paddingTop: '10px',
    },
  },
  h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
    t('b5.forecast', 'Harvest forecast')),
  h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)', fontVariantNumeric: 'tabular-nums' } },
    `${num(forecast.low, forecast.unit === 'kg/tree' ? 0 : 1)}–${num(forecast.high, forecast.unit === 'kg/tree' ? 0 : 1)} ${forecast.unit}`),
  h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, confidence),
  // The one caveat the call asked to be carried rather than buried.
  when(forecast.refining, () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
    t('b5.forecast.refining', 'Tree yields are still being tuned for this region — treat the range as indicative.'))));
}

function seasonBar(cycle) {
  const start = new Date(cycle.startDate).getTime();
  const end = new Date(cycle.expectedHarvest ?? cycle.startDate).getTime();
  const now = NOW.getTime();
  const span = Math.max(1, end - start);
  const pctThrough = Math.max(0, Math.min(100, ((now - start) / span) * 100));
  const daysLeft = Math.round((end - now) / 86400000);

  /* THE ENDS ARE ROWS, NOT COLUMNS. They were three columns under the bar, and
     a date is two calendars wide now — "12 February 2026 - 24 Sha'ban 1447"
     does not fit a third of a phone, so all three columns wrapped into each
     other. The countdown moved above the bar, where it is the headline it
     always was, and the two dates get a full line each. */
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
    h('div', { style: { fontWeight: 650 } },
      daysLeft > 0
        ? t('b5.daysleft', '{n} days to go', { n: num(daysLeft) })
        : t('b5.overdue', 'past our estimate')),
    h('div.season__bar',
      h('span.season__fill', { style: { width: `${pctThrough}%` } }),
      h('span.season__now', { style: { insetInlineStart: `${pctThrough}%` } })),
    h('div.season__end',
      h('small', t('b5.sownlabel', 'Planted')),
      h('b', date(cycle.startDate))),
    h('div.season__end',
      h('small', t('b5.harvestlabel', 'Harvest, our estimate')),
      h('b', cycle.expectedHarvest ? date(cycle.expectedHarvest) : '—')));
}

function figure(label, value) {
  return h('div.figure',
    h('span.figure__label', label),
    h('span.figure__value', value));
}

/* Review C291 … C297 — the farmer typed tomato and the satellite reads onion.
   That is not an error state and it is not the app being right: the imagery is
   a canopy signature and the farmer was standing in the field. So both answers
   are shown, in the farmer's words, with the two dispositions that actually
   exist — take ours, or keep yours.

   It sits ABOVE the cycle card rather than inside it, because until it is
   resolved the card underneath may be describing the wrong crop, and the
   warning has to be read first. */
function cropMismatch(plot, cycle) {
  if (!cycle.detectedCropName || cycle.detectedCropName === cycle.cropName) return null;
  const detected = t(`crop.${cycle.detectedCropName.toLowerCase().replace(/\s/g, '')}`, cycle.detectedCropName);
  return card({ accent: 'monitor' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon('monitor', 18),
      h('span', { style: { fontWeight: 700 } }, t('b5.mismatch', 'This may not be the right crop'))),
    h('div', { style: { color: 'var(--ink-700)' } },
      t('b5.mismatch.body', 'The satellite is seeing something different. It reads {detected}, and you entered {entered}.',
        { detected, entered: cycle.cropName })),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      // Review 21/09 asked for these two by name — "two buttons, 'ignore' or
      // 'update', when the satellite's read doesn't match what the farmer
      // entered" — and they were already here under longer labels. Shortened to
      // his words: a two-word button is read, a five-word one is parsed.
      btn(t('b5.mismatch.take', 'Update'), {
        variant: 'emphasis', size: 'sm', block: false,
        onclick: () => {
          const raw = rawPlot(plot.id).cropCycles.find((c) => c.id === cycle.id);
          if (raw) { raw.cropName = cycle.detectedCropName; raw.variety = ''; raw.detectedCropName = null; }
          toast(t('b5.mismatch.taken', 'Updated to {crop}', { crop: detected }));
          commit('cycle');
        },
      }),
      btn(t('b5.mismatch.keep', 'Ignore'), {
        variant: 'secondary', size: 'sm', block: false,
        onclick: () => {
          const raw = rawPlot(plot.id).cropCycles.find((c) => c.id === cycle.id);
          if (raw) raw.detectedCropName = null;
          toast(t('b5.mismatch.kept', 'Kept as {crop}', { crop: cycle.cropName }));
          commit('cycle');
        },
      })),
    req('WF5.030')));
}

/* -- B4 · Add / edit crop cycle, WF5.028 / WF5.030 / WF5.031 ---------------- */

export function B4(param) {
  const [plotId, cycleId] = String(param).split('|');
  const plot = plotById(plotId);
  const existing = cycleId ? plot.cropCycles.find((c) => c.id === cycleId) : null;
  const openCycle = plot.cropCycles.find((c) => c.state === 'current');
  const blocked = !existing && openCycle;                       // WF5.028

  const d = local(`b6-${plotId}-${cycleId ?? 'new'}`, {
    cropId: existing?.cropId ?? '', cropName: existing?.cropName ?? '', variety: existing?.variety ?? '',
    startDate: existing?.startDate ?? '2026-08-03',
    actualHarvest: existing?.actualHarvest ?? '',
    actualYield: existing?.actualYield ?? '',
    notes: existing?.notes ?? '',
  });

  return {
    top: appBar({ title: existing ? t('b6.edit', 'Edit crop cycle') : t('b6.new', 'New crop cycle'), subtitle: plot.shortName }),
    body: page(
      when(blocked, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        /* Review 21/09 shortened the instruction: "Close it out before
           entering a new crop for this plot." The old half of the sentence
           explained HOW to close it — a harvest date, optionally a yield —
           which is the next screen's job, and the button under this banner
           already opens it. */
        disclaimer(t('b6.blocked', 'This plot already has an open cycle: {crop}, started {date}. Close it out before entering a new crop for this plot.', {
          crop: openCycle.cropName, date: date(openCycle.startDate),
        }), true),
        )),

      field(t('b6.crop', 'Crop'),
        h('button.row', {
          onclick: () => openSheet('CROP_PICKER', { onPick: (crop) => { d.cropId = crop.id; d.cropName = crop.name; commit('b6'); } }),
          style: { border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)', background: 'var(--paper)' },
        }, h('div.row__main', h('div.row__title', d.cropName || t('b6.pickcrop', 'Choose a crop'))),
           h('span.row__chev', icon('search', 20))),
        { required: true }),
      /* VARIETY IS FREE TEXT AND OPTIONAL, which is what it already was and is
         now said out loud. Review 21/09: "Before I confirm a crop like alfalfa,
         where do I specify the variety?" — it was here all along, one field
         below the crop, and unmarked enough to miss. "I'll make variety a
         free-text field, greyed out as optional, rather than another
         picklist": a picklist of varieties is a list nobody can keep current
         across ten countries, and a farmer who knows his seed can type it. */
      field(t('b6.variety', 'Variety'), input({
        value: d.variety,
        placeholder: t('b6.variety.eg', 'Optional — e.g. Hayat'),
        oninput: (e) => { d.variety = e.target.value; },
      }), { hint: t('b6.variety.hint', 'Optional. Type it however you know it.') }),
      // "Planting date", not "sowing or planting date". Review C288/C289: the
      // two words describe the same moment for a farmer, and offering both
      // raised a distinction that then had to be explained.
      //
      // The EXPECTED HARVEST field has gone with them (C287). It was a guess
      // typed in February about a date in November, it was never revisited, and
      // the app models it from the crop, the planting date and the season —
      // which is the number B3 shows, marked as ours.
      field(t('b6.start', 'Planting date'), input({ type: 'date', value: d.startDate, onchange: (e) => { d.startDate = e.target.value; commit('b6'); } }), { required: true }),
      when(existing?.state === 'closed', () => field(t('b6.actual', 'Actual harvest date'),
        input({ type: 'date', value: d.actualHarvest, onchange: (e) => { d.actualHarvest = e.target.value; } }))),
      /* THE TARGET YIELD FIELD HAS GONE, AND THE NUMBER HAS NOT.

         Review 21/09: "It shouldn't be editable by the farmer — either he's
         using our system, in which case we determine the yield and tell him
         whether he's tracking to it, or he isn't. He shouldn't be able to
         override our number." Mark checked the distinction twice on the call,
         and it is the input being removed rather than the data: B2 still prints
         the figure, under "Expected yield" rather than "Target yield", because
         a target is a thing you set and this is a thing we work out.

         An editable field here was quietly the opposite of the feature. The
         on-track/off-track reading is only worth anything measured against OUR
         estimate; a farmer who types in his own optimistic number gets an app
         that agrees with him. */
      when(existing?.state === 'closed', () => field(t('b6.actualyield', 'Actual yield'),
        input({ value: d.actualYield, oninput: (e) => { d.actualYield = e.target.value; } }))),
      field(t('b6.notes', 'Notes'), h('textarea.textarea', { value: d.notes, oninput: (e) => { d.notes = e.target.value; } })),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b6.mandatory', 'Just the crop and planting date are needed. We’ll estimate the harvest window and let you know if it shifts.'),
        req('WF5.036'))),
    // WF2.010 — one primary action, and it is whichever action the screen is
    // actually for: closing the blocking cycle, or saving the new one.
    dock: actionDock(blocked
      ? btn(t('b6.close', 'Close the {crop} cycle', { crop: openCycle.cropName }), {
          variant: 'primary',
          onclick: () => openModal('CLOSE_CYCLE', { plotId, cycleId: openCycle.id }),
        })
      : btn(t('action.save', 'Save'), {
      variant: 'primary', disabled: !d.cropId || !d.startDate,
      onclick: () => {
        if (existing) { Object.assign(existing, d); commit('b6'); }
        // startCycle() rather than a push from here: a new cycle also settles
        // the plot's own crop and clears the "set new crop" prompt, and both of
        // those live on the raw record this screen only holds a copy of.
        else startCycle(plotId, { ...d });
        toast(t('cycle.saved', 'Crop cycle saved'));
        back();
      },
    })),
  };
}

/* B7 AND B8 ARE GONE, and this is where they were.

   B7 drew one plot full-screen with a value probe; B8 drew the same plot at two
   dates with a divider. Both were the MAP, rebuilt at plot scope and reachable
   from nowhere else — and the review's answer was the obvious one: if you want a
   reading full-screen you want the Map tab, which already draws every plot on
   the farm, already has the layer picker, already has the date comparison, and
   is one of four things on the tab bar. So the "open in the map" button on B2
   hands the plot to C1 and the two screens have gone with their duplication.
   C1/C4 carry WF5.029…WF5.033 now. */
