/* ---------------------------------------------------------------------------
   plot.js — B4 Plot detail, B5/B6 Crop cycles.

   B4 IS DELIBERATELY SHORT NOW. The review's complaint about this screen was
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
import { B13 } from './trees.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock,
  statusIcon, kv, disclaimer, req, field, input, chips, divider, helpButton,
} from '../ui/components.js';
import { area, num, date, NOW } from '../core/format.js';
import { plotById, rawPlot, farmById, measureByKey, measures, adviceForPlot, severityToStatus } from '../data/selectors.js';
import { declareCrop } from '../data/actions.js';
import { has, lock } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { plotRasterSvg, legend } from '../ui/map.js';
import { trendChart, axisLabels, pairedBars } from '../ui/charts.js';

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

/* -- B4 · Plot detail ------------------------------------------------------
   OPEN FIELD ONLY. A tree group goes to B13 instead: it has no crop, no cycle
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

export function B4(plotId) {
  const plot = plotById(plotId);
  // A tree group has no crop and no cycle; B13 is its screen.
  if (plot.kind === 'trees') return B13(plot.id);

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
      actions: [overflowAction(() => openSheet('PLOT_MENU', { plotId: plot.id }))],
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
          : plotRasterSvg(plot, measureKey, { dateKey: current.date }),

        // THE THREE BUTTONS. Top right, stacked, each 44 dp, each naming what it
        // does — WF2.014 keeps the label on the accessible name rather than
        // under the glyph, because there is no room on a photograph for three
        // captions and the panel each one opens says its own name at the top.
        h('div.plotmap__tools',
          mapTool('layers', t('b4.measure', 'Which reading?'), panel.open === PANELS.measure,
            () => { panel.open = panel.open === PANELS.measure ? null : PANELS.measure; commit('b4'); }),
          mapTool('compare', t('b4.dates', 'Which date?'), panel.open === PANELS.date,
            () => { panel.open = panel.open === PANELS.date ? null : PANELS.date; commit('b4'); }),
          mapTool('scan', t('b4.openmap', 'Open in the map'), false,
            () => { state.ui.farmFilter = farm.id; state.ui.mapPlot = plot.id; switchTab('map'); })),

        // What is being looked at, always visible, because a control that opens
        // a panel has to say what it is currently set to.
        h('div.plotmap__caption',
          h('span', t(`measure.${measure.key}`, measure.plain)),
          h('span', { style: { opacity: .7 } }, '·'),
          h('span', current ? date(current.date) : '')),

        legendStrip(measureKey),

        when(panel.open === PANELS.measure, () => mapPanel(
          t('b4.measure', 'Which reading?'),
          () => { panel.open = null; commit('b4'); },
          measures().map((m) => panelRow(m.key === measureKey, t(`measure.${m.key}`, m.plain), m.technical,
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

      // WF5.020 — the interpretation names WHERE and HOW LONG.
      when(current, () => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
        statusIcon(plot.status, 22),
        h('div',
          h('div', { style: { fontWeight: 650 } }, plot.statusLine),
          h('div', { style: { color: 'var(--ink-600)' } }, plot.interpretation),
          req('WF5.024')))),

      when((plot.series[measureKey] ?? []).length > 1, () => section(t('b4.trend', 'Trend'), {},
        card({}, cardPad(
          trendChart(plot.series[measureKey] ?? [], { label: measure.plain }),
          axisLabels(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']))))),

      // WF5.101 — once actions have been recorded, show advised vs applied.
      when(plot.irrigationRecord.some((r) => r.appliedM3 > 0), () =>
        section(t('b4.advisedapplied', 'Water advised and applied'), {},
          card({}, cardPad(
            pairedBars(plot.irrigationRecord.map((r) => ({ label: r.week, a: r.advisedM3, b: r.appliedM3 })), { label: 'Advised versus applied' }),
            h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
              swatch('var(--ink-300)', t('b4.advised', 'Advised')),
              swatch('var(--brand-600)', t('b4.applied', 'Applied'))),
            req('WF5.131'))))),

      // RECENT SUGGESTIONS, not recent activity. A log of what was done is a
      // record; what the farmer opens a plot to see is what the model thinks
      // about it, and where nothing is outstanding the ones already dealt with
      // still say what kind of farm this has been lately.
      section(t('b4.suggestions', 'Recent suggestions'), {},
        card({}, (() => {
          const recent = adviceForPlot(plot.id, { includeDone: true }).slice(0, 4);
          return recent.length
            ? recent.map((a) => row({
              iconName: ADVICE_ICON[a.type] ?? 'advice',
              title: a.action,
              sub: [a.amount, a.status === 'done' ? t('advice.recorded.done', 'Recorded') : null].filter(Boolean).join(' · '),
              statusKey: a.status === 'done' ? 'good' : severityToStatus(a.severity),
              value: date(a.issuedAt, { noYear: true, short: true }),
              onclick: () => go(`${detailRouteFor(a)}:${a.id}`),
            }))
            : h('div', { style: { padding: '18px', textAlign: 'center', color: 'var(--ink-500)' } },
              t('b4.suggestions.empty', 'Nothing suggested for this plot yet.'));
        })())),
    ),
    // WF5.025 — one primary action, and it goes where the work is. It used to
    // read "Nothing to do here today" and be disabled on a quiet plot, which is
    // a dead control taking the most valuable space on the screen.
    dock: actionDock(btn(t('b4.seeai', 'See AI suggestions'), {
      variant: 'primary', icon: 'advice',
      onclick: () => {
        state.ui.farmFilter = farm.id;
        state.ui.adviceTab = advice.length ? 'needs' : 'all';
        switchTab('advice');
      },
    })),
  };
}

/* A tool on the image. Small, square, and legible over a satellite photograph,
   which is why it carries its own scrim rather than trusting the picture. */
function mapTool(iconName, label, active, onclick) {
  return h(`button.maptool${active ? '.maptool--on' : ''}`, {
    onclick, 'aria-label': label, title: label, type: 'button',
    'aria-pressed': String(!!active),
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

function legendStrip(measureKey) {
  return h('div.plotmap__legend', legend(measureKey, null));
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

  /* COMPACT. This was four stacked paragraphs and a button — a heading, the
     harvest sentence, an explanation of satellite phenology, and the control —
     which is a quarter of a phone screen spent on one question. It is a line
     and a button now, in the same shape as the growing state beside it, and the
     "why" is behind the info button where a farmer who wants it can find it and
     the fifteen who do not are not made to read it. */
  const head = awaiting
    ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      // The question on its own line so it does not wrap to three, then the
      // fact and the control on the next. Two lines against the five this used
      // to take.
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('urgent', 22),
        h('span', { style: { fontWeight: 700, fontSize: 'var(--t-lead)', flex: 1, minWidth: 0 } },
          t('b4.whatnow', 'What is growing here now?')),
        helpButton(t('b3.harvested.why', 'We can’t read a new crop from space until it has about three weeks of leaf, so we have to ask you.'),
          { title: t('b4.whatnow', 'What is growing here now?') })),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { color: 'var(--ink-600)', flex: 1, minWidth: 0 } },
          t('b4.harvested.short', '{crop} came off on {d}', {
            crop: plot.cropName, d: date(plot.harvestDetectedOn, { noYear: true, short: true }),
          })),
        when(canEdit, () => btn(t('b4.setcrop.short', 'Set crop'), {
          variant: 'emphasis', size: 'sm', block: false, icon: 'sprout',
          onclick: () => openSheet('CROP_PICKER', { onPick: (crop) => declareCrop(plot.id, crop) }),
        }))))
    : h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
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
        variant: 'secondary', size: 'sm', block: false,
        onclick: () => go(`B5:${plot.id}`),
      })));

  return card({}, cardPad(
    head,
    when(cycle?.detectedCropName && cycle.detectedCropName !== cycle.cropName, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--st-watch)', fontWeight: 600 },
    }, statusIcon('watch', 16), t('b4.mismatch.short', 'The satellite reads something else here'))),
    divider(),
    // WF6.020 — the values the watering calculation consumes, and WF5.115's
    // prompt where one of them is missing.
    kv([
      [t('b4.area', 'Area'), area(plot.areaHa)],
      plot.variety ? [t('b4.variety', 'Variety'), plot.variety] : null,
      plot.secondaryCropName ? [t('b4.secondary', 'Also growing'), plot.secondaryCropName] : null,
      cycle?.targetYield ? [t('b5.target', 'Target yield'), cycle.targetYield] : null,
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

function swatch(colour, label) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
    h('span', { style: { width: '11px', height: '11px', borderRadius: '3px', background: colour } }), label);
}

export function detailRouteFor(advice) {
  return ({ irrigation: 'D2', nutrition: 'D3', protection: 'D4', weather: 'D6' })[advice.type] ?? 'D2';
}

/* -- B5 · Crop cycles ----------------------------------------------------- */

export function B5(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const current = plot.cropCycles.find((c) => c.state === 'current');
  const previous = plot.cropCycles.filter((c) => c.state === 'closed');
  const canManage = can('cropcycle.manage', farm);

  return {
    top: appBar({
      title: t('b5.title', 'Crop cycles'), subtitle: plot.shortName,
      actions: [canManage ? barAction('plus', t('action.new', 'New'), () => go(`B6:${plot.id}`)) : null].filter(Boolean),
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

        // The two numbers a season is judged on, side by side, only where the
        // fixture has them — a target with no yield beside it is an ambition.
        when(current.yieldSoFar || current.targetYield, () => h('div', { style: { display: 'flex', gap: '10px' } },
          when(current.yieldSoFar, () => figure(t('b5.yieldsofar', 'Yield so far'), current.yieldSoFar)),
          when(current.targetYield, () => figure(t('b5.target', 'Target yield'), current.targetYield)))),

        // A cut crop is a season inside a season; alfalfa is cut eight times.
        when(current.cutsPlanned, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b5.cutvalue', '{a} of {b}, next around {d}', {
              a: current.cutsDone, b: current.cutsPlanned, d: date(current.nextCut, { noYear: true }),
            })),
          h('div.cuts', Array.from({ length: current.cutsPlanned }, (_, i) => h(
            `span.cuts__mark${i < current.cutsDone ? '.cuts__mark--done' : ''}`,
          ))))),

        when(canManage, () => btn(t('b5.manage', 'Edit this cycle'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => go(`B6:${plot.id}|${current.id}`),
        }))))),

      when(!current, () => card({ accent: 'nodata' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon('nodata', 20),
          h('span', { style: { fontWeight: 650 } }, t('b5.none', 'Nothing planted here at the moment'))),
        when(canManage, () => btn(t('b5.start', 'Record a planting'), {
          variant: 'primary', size: 'sm', block: false, icon: 'plus',
          onclick: () => go(`B6:${plot.id}`),
        }))))),

      // WF5.029 — closing never deletes; the full history stays visible. It is
      // a TIMELINE rather than a stack of cards: what the history is for is
      // comparing one year with the last, and cards of equal weight down a
      // screen hide the sequence that is the whole point of keeping them.
      section(t('b5.previous', 'Previous seasons'), {},
        previous.length
          ? card({}, previous.map((cycle) => h('button.season', {
            onclick: () => go(`B6:${plot.id}|${cycle.id}`), type: 'button',
          },
          h('span.season__year', String(new Date(cycle.startDate).getUTCFullYear())),
          h('span.season__body',
            h('span.season__crop', `${cycle.cropName}${cycle.variety ? ` — ${cycle.variety}` : ''}`),
            h('span.season__dates',
              `${date(cycle.startDate, { noYear: true })} – ${date(cycle.actualHarvest, { noYear: true })}`)),
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
function seasonBar(cycle) {
  const start = new Date(cycle.startDate).getTime();
  const end = new Date(cycle.expectedHarvest ?? cycle.startDate).getTime();
  const now = NOW.getTime();
  const span = Math.max(1, end - start);
  const pctThrough = Math.max(0, Math.min(100, ((now - start) / span) * 100));
  const daysLeft = Math.round((end - now) / 86400000);

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    h('div.season__bar',
      h('span.season__fill', { style: { width: `${pctThrough}%` } }),
      h('span.season__now', { style: { insetInlineStart: `${pctThrough}%` } })),
    h('div.season__ends',
      h('span',
        h('b', date(cycle.startDate, { noYear: true })),
        h('small', t('b5.sownlabel', 'planted'))),
      h('span', { style: { textAlign: 'center' } },
        h('b', daysLeft > 0
          ? t('b5.daysleft', '{n} days to go', { n: num(daysLeft) })
          : t('b5.overdue', 'past our estimate'))),
      h('span', { style: { textAlign: 'end' } },
        h('b', cycle.expectedHarvest ? date(cycle.expectedHarvest, { noYear: true }) : '—'),
        h('small', t('b5.expected.ours', 'our estimate')))));
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
  return card({ accent: 'watch' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon('watch', 18),
      h('span', { style: { fontWeight: 700 } }, t('b5.mismatch', 'This may not be the right crop'))),
    h('div', { style: { color: 'var(--ink-700)' } },
      t('b5.mismatch.body', 'The satellite is seeing something different. It reads {detected}, and you entered {entered}.',
        { detected, entered: cycle.cropName })),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      btn(t('b5.mismatch.take', 'Update with satellite data'), {
        variant: 'emphasis', size: 'sm', block: false,
        onclick: () => {
          const raw = rawPlot(plot.id).cropCycles.find((c) => c.id === cycle.id);
          if (raw) { raw.cropName = cycle.detectedCropName; raw.variety = ''; raw.detectedCropName = null; }
          toast(t('b5.mismatch.taken', 'Updated to {crop}', { crop: detected }));
          commit('cycle');
        },
      }),
      btn(t('b5.mismatch.keep', 'Keep as is'), {
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

/* -- B6 · Add / edit crop cycle, WF5.028 / WF5.030 / WF5.031 ---------------- */

export function B6(param) {
  const [plotId, cycleId] = String(param).split('|');
  const plot = plotById(plotId);
  const existing = cycleId ? plot.cropCycles.find((c) => c.id === cycleId) : null;
  const openCycle = plot.cropCycles.find((c) => c.state === 'current');
  const blocked = !existing && openCycle;                       // WF5.028

  const d = local(`b6-${plotId}-${cycleId ?? 'new'}`, {
    cropId: existing?.cropId ?? '', cropName: existing?.cropName ?? '', variety: existing?.variety ?? '',
    startDate: existing?.startDate ?? '2026-08-03',
    actualHarvest: existing?.actualHarvest ?? '', targetYield: existing?.targetYield ?? '',
    actualYield: existing?.actualYield ?? '',
    notes: existing?.notes ?? '',
  });

  return {
    top: appBar({ title: existing ? t('b6.edit', 'Edit crop cycle') : t('b6.new', 'New crop cycle'), subtitle: plot.shortName }),
    body: page(
      when(blocked, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        disclaimer(t('b6.blocked', 'This plot already has an open cycle: {crop}, started {date}. Close it first by recording a harvest date and, optionally, a yield.', {
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
      field(t('b6.variety', 'Variety'), input({ value: d.variety, oninput: (e) => { d.variety = e.target.value; } })),
      // "Planting date", not "sowing or planting date". Review C288/C289: the
      // two words describe the same moment for a farmer, and offering both
      // raised a distinction that then had to be explained.
      //
      // The EXPECTED HARVEST field has gone with them (C287). It was a guess
      // typed in February about a date in November, it was never revisited, and
      // the app models it from the crop, the planting date and the season —
      // which is the number B5 shows, marked as ours.
      field(t('b6.start', 'Planting date'), input({ type: 'date', value: d.startDate, onchange: (e) => { d.startDate = e.target.value; commit('b6'); } }), { required: true }),
      when(existing?.state === 'closed', () => field(t('b6.actual', 'Actual harvest date'),
        input({ type: 'date', value: d.actualHarvest, onchange: (e) => { d.actualHarvest = e.target.value; } }))),
      field(t('b6.targetyield', 'Target yield'), input({ value: d.targetYield, placeholder: '18 t/ha', oninput: (e) => { d.targetYield = e.target.value; } })),
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
        if (existing) { Object.assign(existing, d); toast(t('cycle.saved', 'Crop cycle saved')); commit('b6'); }
        else {
          plot.cropCycles.unshift({ id: `local-${Date.now()}`, plotId, state: 'current', ...d, cutsDone: null, cutsPlanned: null, yieldSoFar: null });
          toast(t('cycle.saved', 'Crop cycle saved')); commit('b6');
        }
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
   is one of four things on the tab bar. So the "open in the map" button on B4
   hands the plot to C1 and the two screens have gone with their duplication.
   C1/C4 carry WF5.029…WF5.033 now. */
