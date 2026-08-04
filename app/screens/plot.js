/* ---------------------------------------------------------------------------
   plot.js — B4 Plot detail, B5/B6 Crop cycles, B7 Measure viewer, B8 Compare.

   Two things here are easy to get wrong and are therefore centralised:
     * WF-216 — the date stepper moves between AVAILABLE IMAGERY DATES, not
       calendar days. `stepDate()` walks the farm's imagery list, and when the
       user reaches the end it says why.
     * WF-233 — on an intercropped plot the readings are per crop, with a
       "Whole plot" option; and WF-235 says that when separation cannot be
       computed the whole-plot reading is shown MARKED, never passed off as one
       crop's. `cropSelector()` owns both.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, switchTab, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, field, input, select, chips,
  divider, meter,
} from '../ui/components.js';
import { area, num, date, dateTime, ago, volume, NOW } from '../core/format.js';
import { plotById, farmById, measureByKey, measures, adviceForPlot, plotActivity, observationsOf } from '../data/selectors.js';
import { has, lock } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { plotRasterSvg, legend, mapSvg, MEASURE_SCALE, rampCss, colourFor } from '../ui/map.js';
import { trendChart, axisLabels, multiLine, pairedBars } from '../ui/charts.js';

/* -- shared: imagery date stepping, WF-216 ------------------------------- */

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
    // WF-216 — say why, rather than dead-ending silently.
    ui.notice = t('b4.nodates.old', 'That is the oldest image we hold for this plot. Earlier imagery is outside your plan.');
  } else if (next > dates.length - 1) {
    ui.notice = t('b4.nodates.new', 'This is the most recent image. The next pass is expected in 2–3 days.');
  } else {
    ui.index = next;
    ui.notice = null;
  }
  commit('dates');
}

/* -- shared: measure selection, WF-215 ----------------------------------- */

function measureSelector(plot, onPick) {
  const current = measureByKey(state.ui.measure);
  return h('button.row', {
    onclick: () => openSheet('MEASURE_PICKER', { plotId: plot.id, onPick }),
    style: { background: 'var(--paper)', borderRadius: 'var(--radius)', border: '1px solid var(--ink-200)', borderBottom: '1px solid var(--ink-200)' },
  },
  h('div.row__main',
    // The plain-language name is what appears everywhere; the technical name is
    // secondary and only for the agronomists.
    h('div.row__title', t(`measure.${current.key}`, current.plain)),
    h('div.row__sub', current.technical)),
  h('span.row__chev', icon('chevronDown', 20)));
}

/* -- shared: per-crop attribution on intercropped plots, WF-233 / WF-235 -- */

function cropSelector(plot) {
  if (!plot.secondaryCropId) return null;
  const ui = local(`crop-${plot.id}`, { crop: 'primary' });
  const options = [
    { id: 'primary', label: plot.cropName },
    { id: 'secondary', label: plot.secondaryCropName },
    { id: 'whole', label: t('b4.wholeplot', 'Whole plot') },
  ];
  // WF-235 — separation is unavailable on some dates; the reading is then shown
  // as Combined canopy and per-crop recommendations are suppressed for that date.
  const { current } = dateState(plot);
  const separated = !current || !current.date.endsWith('4');
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
    chips(options, separated ? ui.crop : 'whole', (id) => {
      if (!separated) return;
      ui.crop = id; commit('crop');
    }),
    when(!separated, () => disclaimer(
      t('b4.combined', 'Combined canopy — we could not separate the date palm from the alfalfa on this date, so this is the whole-plot reading. Per-crop advice is paused for this date only.'))));
}

/* -- B4 · Plot detail ----------------------------------------------------- */

export function B4(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const { dates, ui, current } = dateState(plot);
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const advice = adviceForPlot(plot.id);
  const cycle = plot.cropCycles.find((c) => c.state === 'current');
  const activity = plotActivity(plot.id);
  const measureLocked = !has(measure.featureKey);

  return {
    top: appBar({
      title: plot.name,
      subtitle: [farm.blocks?.find((b) => b.id === plot.blockId)?.name, farm.name].filter(Boolean).join(' · '),
      actions: [overflowAction(() => openSheet('PLOT_MENU', { plotId: plot.id }))],
    }),
    body: page(
      // WF-011 — a plot on a farm not yet on the watchlist has nothing to draw,
      // so it gets a designed empty state rather than a blank frame.
      when(!current, () => noImagery(farm)),

      // Hero: the measure map for this plot.
      when(current, () => h('div.mapbox', { style: { height: '190px', borderRadius: 'var(--radius)' } },
        measureLocked
          ? h('div', { style: { display: 'grid', placeItems: 'center', height: '100%', background: 'var(--ink-100)' } },
              h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: measure.featureKey }) },
                icon('lock', 16), t('locked.measure', '{name} is not in your plan', { name: measure.plain })))
          : plotRasterSvg(plot, measureKey, { dateKey: current.date, onclick: () => go(`B7:${plot.id}|${measureKey}`) }),
        h('div', {
          style: {
            position: 'absolute', insetInline: '10px', bottom: '8px',
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,.92)', borderRadius: 'var(--radius-pill)', padding: '5px 10px',
          },
        }, legend(measureKey, null),
           h('button.mapchip.mapchip--square', {
             style: { marginInlineStart: 'auto', boxShadow: 'none', background: 'transparent' },
             onclick: () => go(`B7:${plot.id}|${measureKey}`),
             'aria-label': t('b4.fullscreen', 'Full screen'),
           }, icon('scan', 20))))),

      when(current, () => measureSelector(plot, (key) => { state.ui.measure = key; commit('measure'); })),
      cropSelector(plot),

      // WF-216 — the date stepper.
      when(current, () => h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('button.iconbtn', { onclick: () => stepDate(plot, -1), 'aria-label': t('b4.prevdate', 'Previous image') }, icon('back', 22, 'flip')),
        h('div', { style: { flex: 1, textAlign: 'center' } },
          h('div', { style: { fontWeight: 650 } }, date(current.date)),
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, current.source)),
        h('button.iconbtn', { onclick: () => stepDate(plot, 1), 'aria-label': t('b4.nextdate', 'Next image') }, icon('forward', 22, 'flip')),
        (has('maps.compare')
          ? h('button.chip', { onclick: () => go(`B8:${plot.id}`) }, icon('compare', 16), t('b4.compare', 'Compare'))
          : h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: 'maps.compare' }) }, icon('lock', 15), t('b4.compare', 'Compare'))))),
      when(ui.notice, () => disclaimer(ui.notice)),

      // WF-217 — the interpretation names WHERE and HOW LONG.
      when(current, () => h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
        statusIcon(plot.status, 22),
        h('div',
          h('div', { style: { fontWeight: 650 } }, plot.statusLine),
          h('div', { style: { color: 'var(--ink-600)' } }, plot.interpretation),
          req('WF-217')))),

      section(t('b4.thisplot', 'This plot'), {},
        card({}, cardPad(kv([
          [t('b4.crop', 'Crop'), `${plot.cropName}${plot.variety ? ` — ${plot.variety}` : ''}`],
          plot.secondaryCropName ? [t('b4.secondary', 'Also growing'), plot.secondaryCropName] : null,
          [t('b4.planted', 'Planted'), `${date(plot.plantedOn)} · ${t('b4.age', '{n} years', { n: num(2026 - new Date(plot.plantedOn).getFullYear()) })}`],
          plot.treeCount ? [t('b4.trees', 'Trees'), `${num(plot.treeCount)} · ${plot.treeSpacing ?? ''}`] : null,
          [t('b4.area', 'Area'), area(plot.areaHa)],
          [t('b4.irrigation', 'Irrigation'), plot.irrigation],
          // WF-275 — where there is no flow rate, prompt for one instead of hiding the row.
          [t('b4.flow', 'System flow rate'), plot.flowRateM3h
            ? `${num(plot.flowRateM3h)} m³/h`
            : h('button.textlink', {
                onclick: () => toast(t('b4.addflow.done', 'We will ask for this when you next log irrigation')),
              }, t('b4.addflow', 'Add a flow rate'))],
        ])))),

      // Crop cycles are a first-class record, so they get their own entry point.
      section(t('b5.title', 'Crop cycles'), { action: { label: t('action.seeall', 'See all'), onclick: () => go(`B5:${plot.id}`) } },
        card({ onclick: () => go(`B5:${plot.id}`) }, cardPad(
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            statusIcon('good', 16),
            h('span', { style: { fontWeight: 700, fontSize: 'var(--t-meta)', letterSpacing: '.05em' } }, t('b5.current', 'CURRENT'))),
          h('div', { style: { fontWeight: 650 } }, `${cycle.cropName}${cycle.variety ? ` — ${cycle.variety}` : ''}`),
          h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t('b5.sown', 'Started {date}', { date: date(cycle.startDate) })),
          when(cycle.cutsPlanned, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t('b5.cuts', 'Cut {a} of {b} · next cut around {date}', { a: cycle.cutsDone, b: cycle.cutsPlanned, date: date(cycle.nextCut, { noYear: true }) })))))),

      when((plot.series[measureKey] ?? []).length > 1, () => section(t('b4.trend', 'Trend'), {},
        card({}, cardPad(
          trendChart(plot.series[measureKey] ?? [], { label: measure.plain }),
          axisLabels(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']),
          has('compare.5y')
            ? btn(t('b4.compareyears', 'Compare with previous years'), { variant: 'ghost', size: 'sm', onclick: () => go(`B8:${plot.id}|years`) })
            : h('button.locked', { onclick: () => openModal('UPGRADE', { featureKey: 'compare.5y' }), style: { alignSelf: 'flex-start' } },
                icon('lock', 15), t('b4.compareyears', 'Compare with previous years')))))),

      // WF-292 — once actions have been recorded, show advised vs applied.
      when(plot.irrigationRecord.some((r) => r.appliedM3 > 0), () =>
        section(t('b4.advisedapplied', 'Water advised and applied'), {},
          card({}, cardPad(
            pairedBars(plot.irrigationRecord.map((r) => ({ label: r.week, a: r.advisedM3, b: r.appliedM3 })), { label: 'Advised versus applied' }),
            h('div', { style: { display: 'flex', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
              swatch('var(--ink-300)', t('b4.advised', 'Advised')),
              swatch('var(--brand-600)', t('b4.applied', 'Applied'))),
            req('WF-292'))))),

      section(t('b4.activity', 'Recent activity'), { action: { label: t('action.seeall', 'See all'), onclick: () => go(`F11:${farm.id}`) } },
        card({}, activity.length
          ? activity.slice(0, 4).map((entry) => row({
              iconName: entry.icon, title: entry.text, sub: entry.detail, value: date(entry.at, { noYear: true, short: true }), chevron: false,
            }))
          : h('div', { style: { padding: '18px', textAlign: 'center', color: 'var(--ink-500)' } },
              t('b4.activity.empty', 'Nothing recorded on this plot yet.')))),
    ),
    // WF-218 — "See what to do" is the primary action; when there is no
    // recommendation it becomes "Create a task", pre-filled with the plot.
    dock: actionDock(advice.length
      ? btn(t('b4.seewhat', 'See what to do'), {
          variant: 'primary', icon: 'advice',
          onclick: () => go(`${detailRouteFor(advice[0])}:${advice[0].id}`),
        })
      : btn(t('e3.title', 'Create a task'), {
          variant: 'primary', icon: 'plus',
          onclick: () => go(`E3:plot=${plot.id}`),
        })),
  };
}

/** WF-011 / WF-216 — "no imagery for the selected date" is a designed state. */
function noImagery(farm) {
  return card({ accent: 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
      statusIcon('nodata', 22),
      h('div',
        h('div', { style: { fontWeight: 650 } }, t('b4.noimagery', 'No imagery yet')),
        h('div', { style: { color: 'var(--ink-600)' } },
          farm.imageryBlockedReason ?? t('b4.noimagery.body', 'This farm has just been added to the satellite watchlist. The first pass usually arrives within 48 hours.')))),
    req('WF-011')));
}

function swatch(colour, label) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } },
    h('span', { style: { width: '11px', height: '11px', borderRadius: '3px', background: colour } }), label);
}

export function detailRouteFor(advice) {
  return ({ irrigation: 'D2', nutrition: 'D3', protection: 'D4', harvest: 'D5', weather: 'D6' })[advice.type] ?? 'D2';
}

/* -- B5 · Crop cycles ----------------------------------------------------- */

export function B5(plotId) {
  const plot = plotById(plotId);
  const current = plot.cropCycles.filter((c) => c.state === 'current');
  const previous = plot.cropCycles.filter((c) => c.state === 'closed');

  return {
    top: appBar({
      title: t('b5.title', 'Crop cycles'), subtitle: plot.name,
      actions: [can('cropcycle.manage', farmById(plot.farmId))
        ? barAction('plus', t('action.new', 'New'), () => go(`B6:${plot.id}`)) : null].filter(Boolean),
    }),
    body: page(
      current.map((cycle) => card({ accent: 'good' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon('good', 16),
          h('span', { style: { fontWeight: 700, fontSize: 'var(--t-meta)', letterSpacing: '.05em' } }, t('b5.current', 'CURRENT'))),
        h('div', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, `${cycle.cropName}${cycle.variety ? ` — ${cycle.variety}` : ''}`),
        kv([
          [t('b5.sowndate', 'Started'), date(cycle.startDate)],
          cycle.cutsPlanned ? [t('b5.cutlabel', 'Cuts'), t('b5.cutvalue', '{a} of {b}, next around {d}', { a: cycle.cutsDone, b: cycle.cutsPlanned, d: date(cycle.nextCut, { noYear: true }) })] : null,
          cycle.yieldSoFar ? [t('b5.yieldsofar', 'Yield so far'), cycle.yieldSoFar] : null,
          cycle.targetYield ? [t('b5.target', 'Target yield'), cycle.targetYield] : null,
          [t('b5.expected', 'Expected harvest'), date(cycle.expectedHarvest)],
        ]),
        when(can('cropcycle.manage', farmById(plot.farmId)), () => btn(t('b5.manage', 'Manage'), {
          variant: 'secondary', size: 'sm', onclick: () => go(`B6:${plot.id}|${cycle.id}`),
        }))))),

      // WF-226 — closing never deletes; the full history stays visible.
      section(t('b5.previous', 'Previous'), {},
        previous.length
          ? previous.map((cycle) => card({ onclick: () => go(`B6:${plot.id}|${cycle.id}`) }, cardPad(
              h('div', { style: { fontWeight: 650 } }, `${cycle.cropName} — ${cycle.variety}`),
              h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
                `${date(cycle.startDate, { noYear: true })} – ${date(cycle.actualHarvest)}`),
              h('div', t('b5.yield', 'Yield {v}', { v: cycle.actualYield })))))
          : h('p', { style: { color: 'var(--ink-500)', margin: 0 } }, t('b5.noprev', 'No earlier cycles recorded on this plot.'))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b5.retained', 'Crop history is kept indefinitely. Rotating a field never erases what came before.'), req('WF-226'))),
  };
}

/* -- B6 · Add / edit crop cycle, WF-225 / WF-227 / WF-228 ---------------- */

export function B6(param) {
  const [plotId, cycleId] = String(param).split('|');
  const plot = plotById(plotId);
  const existing = cycleId ? plot.cropCycles.find((c) => c.id === cycleId) : null;
  const openCycle = plot.cropCycles.find((c) => c.state === 'current');
  const blocked = !existing && openCycle;                       // WF-225

  const d = local(`b6-${plotId}-${cycleId ?? 'new'}`, {
    cropId: existing?.cropId ?? '', cropName: existing?.cropName ?? '', variety: existing?.variety ?? '',
    startDate: existing?.startDate ?? '2026-08-03', expectedHarvest: existing?.expectedHarvest ?? '',
    actualHarvest: existing?.actualHarvest ?? '', targetYield: existing?.targetYield ?? '',
    actualYield: existing?.actualYield ?? '', irrigation: existing?.irrigation ?? plot.irrigation,
    notes: existing?.notes ?? '',
  });

  return {
    top: appBar({ title: existing ? t('b6.edit', 'Edit crop cycle') : t('b6.new', 'New crop cycle'), subtitle: plot.name }),
    body: page(
      when(blocked, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        disclaimer(t('b6.blocked', 'There is already an open cycle on this plot: {crop}, started {date}. Close it first — record a harvest date and, if you have it, a yield.', {
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
      field(t('b6.start', 'Sowing or planting date'), input({ type: 'date', value: d.startDate, onchange: (e) => { d.startDate = e.target.value; commit('b6'); } }), { required: true }),
      field(t('b6.expected', 'Expected harvest date'), input({ type: 'date', value: d.expectedHarvest, onchange: (e) => { d.expectedHarvest = e.target.value; } })),
      when(existing?.state === 'closed', () => field(t('b6.actual', 'Actual harvest date'),
        input({ type: 'date', value: d.actualHarvest, onchange: (e) => { d.actualHarvest = e.target.value; } }))),
      field(t('b6.targetyield', 'Target yield'), input({ value: d.targetYield, placeholder: '18 t/ha', oninput: (e) => { d.targetYield = e.target.value; } })),
      when(existing?.state === 'closed', () => field(t('b6.actualyield', 'Actual yield'),
        input({ value: d.actualYield, oninput: (e) => { d.actualYield = e.target.value; } }))),
      field(t('b6.irrigation', 'Irrigation method'),
        select(['Drip', 'Centre pivot', 'Sprinkler', 'Bubbler', 'Flood/furrow', 'Other'].map((v) => ({ value: v, label: v })),
          d.irrigation, (v) => { d.irrigation = v; commit('b6'); })),
      field(t('b6.notes', 'Notes'), h('textarea.textarea', { value: d.notes, oninput: (e) => { d.notes = e.target.value; } })),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b6.mandatory', 'Only the crop and the start date are needed.'), req('WF-227'))),
    // WF-010 — one primary action, and it is whichever action the screen is
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

/* -- B7 · Measure viewer, full screen, WF-220 … WF-222 ------------------- */

export function B7(param) {
  const [plotId, measureKey = state.ui.measure] = String(param).split('|');
  const plot = plotById(plotId);
  const measure = measureByKey(measureKey);
  const { current } = dateState(plot);
  const ui = local(`b7-${plotId}`, { probe: null });
  const scale = MEASURE_SCALE[measureKey] ?? MEASURE_SCALE.ndvi;

  if (!current) {
    return {
      tabs: false,
      top: appBar({ title: t(`measure.${measure.key}`, measure.plain), subtitle: plot.name }),
      body: page(noImagery(farmById(plot.farmId))),
    };
  }

  return {
    tabs: false,
    barLight: true,
    chromeBg: 'var(--ink-900)',
    top: h('div.app__top', { style: { background: 'var(--ink-900)', color: '#fff' } },
      h('div.appbar',
        h('button.iconbtn', { onclick: back, 'aria-label': t('a11y.back', 'Back') }, icon('close', 24)),
        h('div.appbar__title', h('span', t(`measure.${measure.key}`, measure.plain)), h('small', `${plot.name} · ${date(current.date)}`)),
        barAction('share', t('action.share', 'Share'), () => toast(t('share.opened', 'Opening the share sheet…'))))),
    body: h('div', { style: { position: 'relative', height: '100%', background: 'var(--ink-900)' } },
      h('div.mapbox', {
        style: { position: 'absolute', inset: 0 },
        // WF-221 — tapping any point shows the value there, with coordinates.
        onclick: (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          ui.probe = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            value: (plot.measures[measureKey]?.value ?? 0.4) + (Math.random() - 0.5) * 0.09,
          };
          commit('probe');
        },
      }, plotRasterSvg(plot, measureKey, { dateKey: current.date })),
      when(ui.probe, () => h('div', {
        style: {
          position: 'absolute', left: `${ui.probe.x}%`, top: `${ui.probe.y}%`,
          transform: 'translate(-50%, -130%)', background: 'rgba(255,255,255,.96)',
          borderRadius: 'var(--radius-sm)', padding: '7px 10px', boxShadow: 'var(--shadow-2)',
          fontSize: 'var(--t-meta)', whiteSpace: 'nowrap', pointerEvents: 'none',
        },
      },
      h('div', { style: { fontWeight: 700 } }, `${measure.technical} ${num(ui.probe.value, 2)}`),
      h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-micro)' } },
        `${num(plot.lat + ui.probe.y / 4000, 4)}, ${num(plot.lon + ui.probe.x / 4000, 4)}`))),
      h('div', {
        style: {
          position: 'absolute', insetInline: '12px', bottom: '12px',
          background: 'rgba(255,255,255,.95)', borderRadius: 'var(--radius)', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '6px',
        },
      },
      // WF-222 — the scale is fixed per measure, printed with its units.
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--t-meta)', fontWeight: 650 } },
        h('span', t('b7.scale', 'Fixed scale')), h('span', { style: { color: 'var(--ink-500)', fontWeight: 500 } }, measure.unitNote), req('WF-222')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { fontSize: 'var(--t-micro)' } }, num(scale.min, 2)),
        h('span', { style: { flex: 1, height: '12px', borderRadius: '6px', background: rampCss(measureKey) } }),
        h('span', { style: { fontSize: 'var(--t-micro)' } }, num(scale.max, 2))),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
        measure.legend.map((l) => h('span', l))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, measure.help))),
  };
}

/* -- B8 · Compare, WF-223 / WF-224 --------------------------------------- */

export function B8(param) {
  const [plotId, mode = 'dates'] = String(param).split('|');
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  if (farm.imageryDates.length < 2) {
    return {
      top: appBar({ title: t('b8.title', 'Compare dates'), subtitle: plot.name }),
      body: page(noImagery(farm)),
    };
  }
  const ui = local(`b8-${plotId}`, { split: 50, leftIndex: Math.max(0, farm.imageryDates.length - 9), rightIndex: farm.imageryDates.length - 1 });
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const left = farm.imageryDates[ui.leftIndex];
  const right = farm.imageryDates[ui.rightIndex];
  const series = plot.series[measureKey] ?? [];
  const leftValue = series[ui.leftIndex]?.value ?? 0;
  const rightValue = series[ui.rightIndex]?.value ?? 0;

  if (mode === 'years') {
    // WF-224 — same calendar week across up to 5 previous years; Advanced only.
    if (!has('compare.5y')) {
      return {
        top: appBar({ title: t('b8.years', 'Compare with previous years') }),
        body: page(h('div', { style: { padding: '20px 0' } },
          emptyState({
            iconName: 'lock', title: lock('compare.5y').name,
            body: lock('compare.5y').benefit,
            action: { label: t('locked.cta', 'See {plan} plan', { plan: 'Advanced' }), onclick: () => openModal('UPGRADE', { featureKey: 'compare.5y' }) },
          }))),
      };
    }
    return {
      top: appBar({ title: t('b8.years', 'Compare with previous years'), subtitle: plot.name }),
      body: page(
        card({}, cardPad(
          multiLine(plot.yearComparison.map((y) => ({ label: String(y.year), points: y.points })), { label: 'Five years compared' }),
          axisLabels(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']),
          h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: 'var(--t-meta)' } },
            plot.yearComparison.map((y, i) => swatch(i === 0 ? 'var(--brand-700)' : 'var(--ink-300)', String(y.year)))))),
        card({}, cardPad(
          h('div', { style: { fontWeight: 650 } }, t('b8.thisweek', 'This calendar week, year by year')),
          plot.yearComparison.map((y) => meter(String(y.year), (y.points[30]?.value ?? 0) * 100, {
            text: num(y.points[30]?.value ?? 0, 2),
            colour: colourFor(measureKey, y.points[30]?.value ?? 0),
          }))))),
    };
  }

  return {
    top: appBar({ title: t('b8.title', 'Compare dates'), subtitle: plot.name }),
    body: page(
      h('div.mapbox', { style: { height: '260px', borderRadius: 'var(--radius)', position: 'relative' } },
        plotRasterSvg(plot, measureKey, { dateKey: right.date }),
        h('div', {
          style: {
            position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - ui.split}% 0 0)`,
          },
        }, plotRasterSvg(plot, measureKey, { dateKey: left.date })),
        h('div', {
          style: {
            position: 'absolute', top: 0, bottom: 0, left: `${ui.split}%`,
            width: '3px', background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,.5)',
          },
        }, h('span', {
          style: {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '38px', height: '38px', borderRadius: '50%', background: '#fff',
            display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-2)', color: 'var(--ink-700)',
          },
        }, icon('compare', 20))),
        h('input', {
          type: 'range', min: 0, max: 100, value: ui.split,
          oninput: (e) => { ui.split = Number(e.target.value); commit('b8'); },
          style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'ew-resize' },
          'aria-label': t('b8.slider', 'Move the divider'),
        }),
        h('span.mapchip', { style: { position: 'absolute', insetInlineStart: '10px', top: '10px' } }, date(left.date, { short: true })),
        h('span.mapchip', { style: { position: 'absolute', insetInlineEnd: '10px', top: '10px' } }, date(right.date, { short: true }))),

      // WF-223 — both dates labelled and the difference stated numerically.
      card({}, cardPad(
        h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px' } },
          h('div.metric', h('span.metric__label', date(left.date, { short: true })), h('span.num', num(leftValue, 2))),
          h('div.metric', { style: { textAlign: 'center' } },
            h('span.metric__label', t('b8.difference', 'Difference')),
            h('span.num', {
              style: { color: rightValue - leftValue >= 0 ? 'var(--st-good)' : 'var(--st-urgent)' },
            }, `${rightValue - leftValue >= 0 ? '+' : '−'}${num(Math.abs(rightValue - leftValue), 2)}`)),
          h('div.metric', { style: { textAlign: 'end' } }, h('span.metric__label', date(right.date, { short: true })), h('span.num', num(rightValue, 2)))),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, `${t(`measure.${measure.key}`, measure.plain)} · ${measure.technical}`))),

      field(t('b8.left', 'Left image'),
        select(farm.imageryDates.map((dt, i) => ({ value: String(i), label: date(dt.date, { short: true }) })),
          String(ui.leftIndex), (v) => { ui.leftIndex = Number(v); commit('b8'); })),
      field(t('b8.right', 'Right image'),
        select(farm.imageryDates.map((dt, i) => ({ value: String(i), label: date(dt.date, { short: true }) })),
          String(ui.rightIndex), (v) => { ui.rightIndex = Number(v); commit('b8'); })),

      btn(t('b8.years', 'Compare with previous years'), { variant: 'secondary', onclick: () => go(`B8:${plot.id}|years`) })),
  };
}
