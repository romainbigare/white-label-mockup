/* ---------------------------------------------------------------------------
   home.js — B1 Home, B2 Farm detail, B3 Fields and plots, B11 Farm settings,
   B12 Add farm.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, switchTab, enterOnboarding } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { logo, BRAND } from '../ui/brand.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, emptyState, errorState, loadingState, kv, statGrid, lockedRow, req,
  field, input, select, disclaimer, skeletonList, divider,
} from '../ui/components.js';
import { area, num, ago, date, tempC, speed, dateTime } from '../core/format.js';
import { countByStatus, worstStatus, statusLabel, bySeverity } from '../core/status.js';
import { visibleFarms, farmById, rawFarm, plotsOf, farmStatus, adviceFor, tasksFor, allVisiblePlots, measureByKey } from '../data/selectors.js';
import { can } from '../core/capabilities.js';
import { has, farmIsPending, planLabel } from '../core/entitlements.js';
import { mapSvg, statusColour } from '../ui/map.js';
import { surveyTotals } from '../data/survey.js';
import { markSurveyReady, requestSurvey } from '../data/actions.js';
import { connChip } from './banners.js';

/* -- B1 · Home / My farms ------------------------------------------------- */

export function B1() {
  const ui = local('b1', { refreshing: false });
  const farms = visibleFarms();
  const plots = allVisiblePlots();
  const counts = countByStatus(farms.map((f) => ({ status: farmStatus(f) })));
  const needing = counts.action + counts.urgent;

  if (ui.refreshing) {
    return {
      top: homeBar(ui),
      body: h('div.page', skeletonList(3)),          // WF2.012 — explicit loading state
    };
  }

  // WF5.009 — empty state with a button that resolves it.
  if (!farms.length) {
    return {
      top: homeBar(ui),
      body: emptyState({
        iconName: 'leaf',
        title: t('b1.empty.title', 'You have no farms yet'),
        body: t('b1.empty.body', 'Add your land and we will start watching it from space.'),
        action: can('farm.create') ? { label: t('b1.empty.cta', 'Add your first farm'), onclick: () => enterOnboarding('A7') } : null,
      }),
    };
  }

  return {
    top: homeBar(ui),
    body: page(
      h('h1', { style: { fontSize: 'var(--t-head)', margin: '0' } },
        t('b1.greeting', 'Good morning, {name}', { name: (state.db.team.find((m) => m.isYou)?.name ?? '').split(' ')[0] })),

      // WF5.001 — counted by worst plot, not by average.
      card({ accent: needing ? 'urgent' : 'good' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650 } },
          statusIcon(needing ? 'urgent' : 'good', 20),
          h('span', needing
            ? t('b1.needing', '{n} farms need attention', { n: num(needing) })
            : t('b1.allgood', 'All farms are healthy')),
          req('WF5.001')),
        statGrid([
          { status: 'good', label: statusLabel('good'), count: counts.good },
          { status: 'watch', label: statusLabel('watch'), count: counts.watch },
          { status: 'action', label: statusLabel('action'), count: counts.action },
          { status: 'urgent', label: statusLabel('urgent'), count: counts.urgent },
        ]),
        // WF5.002 — goes to D1 pre-filtered to Action needed and Urgent.
        btn(t('b1.seewhat', 'See what to do'), {
          variant: 'primary', size: 'sm',
          onclick: () => { state.ui.adviceTab = 'needs'; switchTab('advice'); },
        }))),

      section(t('b1.myfarms', 'My farms'), can('farm.create') ? {
        action: { label: `+ ${t('action.add', 'Add')}`, onclick: () => go('B12') },
      } : {},
        farms.map(farmCard))),
  };
}

function homeBar(ui) {
  return h('div.app__top', h('div.appbar',
    // The mark alone: the wordmark would eat the bar, and the title says it.
    logo('mark', 26),
    h('div.appbar__title', BRAND.name),
    connChip(),                                        // WF11.012
    // WF5.008 — a visible refresh button as the non-gesture equivalent.
    barAction('refresh', t('action.refresh', 'Refresh'), () => {
      ui.refreshing = true; commit('b1');
      setTimeout(() => { ui.refreshing = false; commit('b1'); }, 700);
    }),
    barAction('bell', t('nav.alerts', 'Alerts'), () => openSheet('NOTIFICATIONS'))));
}

function farmCard(farm) {
  // WF5.005 / WF5.006 — a farm can be on Home before it has a single plot,
  // because a survey
  // takes hours and the farmer was told to go back to work. Both waiting states
  // say what is happening and what happens next, and neither pretends to be a
  // farm with nothing wrong with it.
  if (farm.survey?.state === 'surveying') return surveyingCard(farm);
  if (farm.survey?.state === 'ready') return surveyReadyCard(farm);

  const status = farmStatus(farm);
  const pending = farmIsPending(farm);            // WF9.006
  const plots = plotsOf(farm.id);
  return card({ accent: status, onclick: () => go(`B2:${farm.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon(status, 20),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, farm.name),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),
    // WF5.003 — type icon, area, plot or tree count.
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      icon(farm.type === 'crops' ? 'sprout' : 'tree', 16),
      h('span', [
        farm.type === 'crops' ? t('farm.crops', 'Crops') : farm.type === 'trees' ? t('farm.trees', 'Trees') : t('farm.mixed', 'Crops and trees'),
        area(farm.areaHa, { bare: true }),
        farm.treeCount ? t('farm.treecount', '{n} trees', { n: num(farm.treeCount) }) : t('farm.plotcount', '{n} plots', { n: num(plots.length) }),
      ].join(' · '))),
    pending
      ? h('div.locked', { style: { alignSelf: 'flex-start' } }, icon('lock', 15),
          t('b1.pending', 'Analytics locked — upgrade to a Complete plan'))
      : h('div', farm.headline),
    // WF5.004 — the age of the IMAGERY, and the reason when it is stale.
    h('div', { style: { fontSize: 'var(--t-meta)', color: farm.imageryBlockedReason ? 'var(--st-watch)' : 'var(--ink-500)' } },
      farm.imageryBlockedReason
        ? farm.imageryBlockedReason
        : t('b1.updated', 'Updated {when}', { when: agoFromHours(farm.imageryAgeHours) }))));
}

function surveyingCard(farm) {
  return card({ accent: 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon('scan', 20)),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, farm.name)),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      `${area(farm.areaHa, { bare: true })} · ${t('b1.surveying.sub', 'whole-farm survey')}`),
    h('div', t('b1.surveying', 'We are working out what is on this land. It usually takes a few hours, and we will tell you when it is done.')),
    // Nothing to wait for in a mockup, so there is a way past it.
    btn(t('b1.surveying.skip', 'See the result now'), {
      variant: 'secondary', size: 'sm',
      onclick: () => { markSurveyReady(farm.id); toast(t('b1.survey.arrived', 'Your farm survey is ready')); },
    })));
}

function surveyReadyCard(farm) {
  const totals = surveyTotals(farm);
  return card({ accent: 'action', onclick: () => go(`A10:${farm.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon('action', 20),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, farm.name),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      `${area(farm.areaHa, { bare: true })} · ${t('b1.ready.sub', '{n} areas found', { n: num(totals.areas.length) })}`),
    h('div', t('b1.ready', 'Your survey is ready. Tell us which areas we should watch.'))));
}

function agoFromHours(hours) {
  if (hours < 36) return t('ago.past', '{x} ago', { x: t('ago.hour', '{n} hours', { n: num(hours) }) });
  return t('ago.past', '{x} ago', { x: t('ago.day', '{n} days', { n: num(Math.round(hours / 24)) }) });
}

/* -- B2 · Farm detail ----------------------------------------------------- */

const HEALTH_ROWS = [
  { key: 'overall', measure: 'ndvi', label: 'Overall health', feature: 'measure.ndvi' },
  { key: 'water', measure: 'ndwi', label: 'Water stress', feature: 'measure.ndwi' },
  { key: 'nutrition', measure: 'ndre', label: 'Nutrition status', feature: 'measure.ndre' },
  { key: 'growth', measure: 'evi', label: 'Growth and vigour', feature: 'measure.evi' },
];

export function B2(farmId) {
  const farm = farmById(farmId);
  const plots = plotsOf(farm.id);
  const status = farmStatus(farm);
  const counts = countByStatus(plots);
  const needing = counts.action + counts.urgent;
  const advice = adviceFor({ farmId: farm.id });
  const tasks = tasksFor({ farmId: farm.id }).filter((task) => ['open', 'in_progress'].includes(task.state));
  const pending = farmIsPending(farm);

  return {
    top: appBar({
      title: farm.name,
      actions: [
        // WF5.014 — farm settings is Owner and Supervisor only.
        can('farm.edit', farm) ? barAction('settings', t('b11.title', 'Settings'), () => go(`B11:${farm.id}`)) : null,
      ].filter(Boolean),
    }),
    body: page(
      h('div.mapbox', { style: { height: '180px', borderRadius: 'var(--radius)' } },
        mapSvg({ plots, measure: 'ndvi', layers: { labels: plots.length <= 8 } }),
        h('button.mapchip', {
          style: { position: 'absolute', insetInlineEnd: '10px', bottom: '10px' },
          onclick: () => { state.ui.farmFilter = farm.id; switchTab('map'); },
        }, t('b2.openmap', 'Open map'), icon('forward', 17, 'flip'))),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650 } },
          statusIcon(status, 20),
          h('span', needing
            ? t('b2.needing', '{n} plots need attention', { n: num(needing) })
            : t('b2.allgood', 'All plots are healthy'))),
        h('div', { style: { color: 'var(--ink-600)' } },
          [area(farm.areaHa, { bare: true }),
           t('farm.plotcount', '{n} plots', { n: num(plots.length) }),
           farm.treeCount ? t('farm.treecount', '{n} trees', { n: num(farm.treeCount) }) : null,
          ].filter(Boolean).join(' · ')),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('b2.imagery', 'Imagery from {date} ({age})', { date: date(farm.imageryDate), age: agoFromHours(farm.imageryAgeHours) }),
          req('WF5.004'))),

      when(pending, () => h('div', { onclick: () => openModal('UPGRADE', { featureKey: 'yield.estimate' }) },
        disclaimer(t('b2.pending', 'This farm is outside your current plan. Its boundary is kept and nothing you have paid for is affected — upgrade to a Complete plan to see its analytics.'), true))),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        miniTile('advice', t('nav.advice', 'Advice'), t('b2.new', '{n} new', { n: num(advice.length) }), () => { state.ui.farmFilter = farm.id; switchTab('advice'); }),
        miniTile('tasks', t('nav.tasks', 'Tasks'), t('b2.open', '{n} open', { n: num(tasks.length) }), () => { state.ui.farmFilter = farm.id; switchTab('tasks'); })),

      // WF5.010 — measures outside the plan are greyed with a lock, never hidden.
      section(t('b2.health', 'Health today'), {},
        card({}, HEALTH_ROWS.map((r) => {
          if (pending || !has(r.feature)) return lockedRow(r.feature, t(`measure.${r.measure}`, r.label));
          const worst = worstStatus(plots, (p) => p.healthRows?.[r.key] ?? 'nodata');
          return row({
            title: t(`measure.${r.measure}`, r.label),
            value: statusChip(worst),
            chevron: true,
            // WF5.011 — opens the measure viewer for that measure across the farm.
            onclick: () => go(`B7:${plots[0]?.id ?? ''}|${r.measure}`),
          });
        }))),

      section(t('b2.weather', 'Weather'), {}, weatherCard(farm)),

      section(t('b2.explore', 'Explore'), {},
        card({},
          row({ title: t('b3.title', 'Fields and plots'), value: num(plots.length), iconName: 'grid', onclick: () => go(`B3:${farm.id}`) }),
          // WF5.012 — the Trees row exists only for tree and mixed farms.
          when(farm.type !== 'crops', () => row({
            title: t('b9.title', 'Trees'), value: num(farm.treeCount), iconName: 'tree',
            onclick: () => go(`B9:${farm.id}`),
          })),
          when(farm.type !== 'crops', () => (has('harvest.planning')
            ? row({ title: t('b13.title', 'Harvest planning and yield'), iconName: 'basket', onclick: () => go(`B13:${farm.id}`) })
            : lockedRow('harvest.planning', t('b13.title', 'Harvest planning and yield')))),   // WF5.052
          when(can('report.view', farm), () => row({ title: t('f1.title', 'Reports'), iconName: 'document', onclick: () => go(`F1:${farm.id}`) })),
          row({ title: t('b2.diary', 'Farm diary'), iconName: 'book', onclick: () => go(`F11:${farm.id}`) }),
          when(can('farm.edit', farm), () => row({ title: t('b11.title', 'Farm settings'), iconName: 'settings', onclick: () => go(`B11:${farm.id}`) }))))),
  };
}

function miniTile(iconName, title, value, onclick) {
  return h('button.card.card--tap', { onclick },
    h('div.card__pad', { style: { gap: '2px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon(iconName, 22)),
      h('span', { style: { fontWeight: 650 } }, title),
      h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, value)));
}

function weatherCard(farm) {
  const w = farm.weather;
  // WF5.013 — 7 or 14 days according to plan.
  const days = has('weather.forecast.14') ? 14 : 7;
  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
      h('span', { style: { color: 'var(--st-action)', display: 'flex' } }, icon(w.condition === 'Clear' ? 'sun' : 'cloud', 30)),
      h('span.num', tempC(w.tempC)),
      h('span', { style: { color: 'var(--ink-600)' } }, w.condition),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${t('weather.wind', 'Wind')} ${speed(w.windKph)}`)),
    h('div', { style: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '2px' } },
      w.forecast.slice(0, days).map((f) => h('div', {
        style: { flex: '0 0 auto', textAlign: 'center', minWidth: '46px' },
      },
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, f.day),
      h('div', { style: { color: 'var(--ink-500)', display: 'flex', justifyContent: 'center' } },
        icon(f.rainMm > 0 ? 'rain' : f.condition === 'Clear' ? 'sun' : 'cloud', 18)),
      h('div', { style: { fontWeight: 650 } }, `${num(f.hiC)}°`)))),
    when(days === 7, () => h('button.locked', {
      onclick: () => openModal('UPGRADE', { featureKey: 'weather.forecast.14' }),
      style: { alignSelf: 'flex-start' },
    }, icon('lock', 15), t('b2.forecast14', '14-day forecast'))),
    // WF5.013 — an active alert is surfaced inline.
    when(w.alert, () => h('button.row', {
      onclick: () => go(`D6:${farm.id}`),
      style: { padding: '10px 0', borderBottom: 0 },
    },
    statusIcon(w.alert.severity, 18),
    h('div.row__main', h('div.row__title', w.alert.title), h('div.row__sub', w.alert.detail)),
    h('span.row__chev', icon('forward', 18, 'flip'))))));
}

/* -- B3 · Fields and plots ------------------------------------------------ */

const SORTS = [
  { id: 'attention', label: 'Needs attention first' },
  { id: 'name', label: 'Name' },
  { id: 'area', label: 'Area' },
  { id: 'changed', label: 'Most recently changed' },
];

export function B3(farmId) {
  const farm = farmById(farmId);
  const ui = local(`b3-${farm.id}`, { collapsed: {} });
  const sort = state.ui.plotSort;
  const plots = sortPlots(plotsOf(farm.id), sort);
  const blocks = farm.blocks ?? [];

  const listFor = (items) => items.map((plot) => plotRow(plot));

  return {
    top: appBar({ title: t('b3.title', 'Fields and plots'), subtitle: farm.name }),
    body: page(
      // WF5.016 — sort options, "Needs attention first" the default.
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, t('b3.sort', 'Sort')),
        select(SORTS.map((s) => ({ value: s.id, label: t(`b3.sort.${s.id}`, s.label) })), sort,
          (v) => { state.ui.plotSort = v; commit('sort'); })),

      plots.length === 0
        ? emptyState({
            iconName: 'grid', title: t('b3.empty.title', 'No plots in this farm yet'),
            body: t('b3.empty.body', 'Draw a boundary and we will start measuring it.'),
            action: can('plot.create', farm) ? { label: t('b3.empty.cta', 'Add a plot'), onclick: () => go('A8D') } : null,
          })
        // WF5.015 — grouping is hidden entirely when a farm has no blocks.
        : blocks.length
          ? blocks.map((block) => {
              const items = plots.filter((p) => p.blockId === block.id);
              const open = !ui.collapsed[block.id];
              return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
                h('button.row', {
                  onclick: () => { ui.collapsed[block.id] = open; commit('b3'); },
                  style: { background: 'transparent', borderBottom: 0, padding: '4px 0' },
                },
                icon(open ? 'chevronDown' : 'forward', 20, open ? '' : 'flip'),
                h('div.row__main', h('div.row__title', block.name)),
                h('span.row__value', num(items.length))),
                when(open, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, listFor(items))));
            })
          : listFor(plots)),
  };
}

function sortPlots(plots, sort) {
  const copy = [...plots];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'area') return copy.sort((a, b) => b.areaHa - a.areaHa);
  if (sort === 'changed') return copy.sort((a, b) => Math.abs(b.measures.ndvi?.delta ?? 0) - Math.abs(a.measures.ndvi?.delta ?? 0));
  return copy.sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name));
}

export function plotRow(plot) {
  // A plot drawn today, or found by a survey this morning, has no reading yet.
  // That is a state to say out loud, not a zero to print.
  const m = plot.measures.ndvi;
  const measure = measureByKey('ndvi');
  return card({ accent: plot.status, onclick: () => go(`B4:${plot.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon(plot.status, 18),
      h('span', { style: { fontWeight: 650 } }, plot.name),
      h('span', { style: { color: 'var(--ink-600)' } }, `${plot.cropName}${plot.variety ? ` — ${plot.variety}` : ''}`),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      [area(plot.areaHa, { bare: true }), plot.treeCount ? t('farm.treecount', '{n} trees', { n: num(plot.treeCount) }) : null]
        .filter(Boolean).join(' · ')),
    h('div', plot.statusLine),
    // WF5.017 — value and its 7-day change, with a direction arrow.
    m
      ? h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', display: 'flex', gap: '8px', alignItems: 'center' } },
          h('span', `${measure.technical} ${num(m.value, 2)}`),
          h('span', {
            style: { color: m.delta > 0 ? 'var(--st-good)' : m.delta < 0 ? 'var(--st-urgent)' : 'var(--ink-500)', fontWeight: 650 },
          }, m.delta === 0 ? t('delta.nochange', 'no change') : `${m.delta > 0 ? '↑' : '↓'} ${num(Math.abs(m.delta), 2)}`),
          h('span', t('b3.vs7', 'vs 7 days ago')))
      : h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('b3.noreading', 'No reading yet'))));
}

/* -- B11 · Farm settings, WF5.039 / WF5.040 -------------------------------- */

export function B11(farmId) {
  const farm = farmById(farmId);
  const d = local(`b11-${farm.id}`, {
    name: farm.name, type: farm.type, region: farm.region,
    irrigation: farm.irrigation, soil: farm.soil, reportLang: 'English', contact: 'Khaled Al-Amri',
  });

  return {
    top: appBar({ title: t('b11.title', 'Farm settings'), subtitle: farm.name }),
    body: page(
      field(t('a11.name', 'Farm name'), input({ value: d.name, oninput: (e) => { d.name = e.target.value; } }), { required: true }),
      field(t('a11.what', 'What is on this land?'),
        select([
          { value: 'crops', label: t('a7.crops', 'Field crops') },
          { value: 'trees', label: t('a7.trees', 'Trees and orchards') },
          { value: 'mixed', label: t('a7.both', 'Both') },
        ], d.type, (v) => { d.type = v; commit('b11'); })),
      field(t('b11.region', 'Address or region'), input({ value: d.region, oninput: (e) => { d.region = e.target.value; } })),

      // WF4.035 — neither route is spent. A farmer who drew his plots can still ask
      // for the whole place to be read, and one who surveyed can still draw.
      section(t('b11.land', 'Land'), {}, card({},
        when(!farm.survey, () => row({
          iconName: 'scan',
          title: t('b11.survey', 'Survey the whole farm'),
          sub: t('b11.survey.sub', 'We read everything inside your boundary and tell you what is there'),
          onclick: () => openModal('CONFIRM', {
            title: t('b11.survey.q', 'Survey this farm?'),
            body: t('b11.survey.body', 'It takes a few hours and costs nothing. Your plots stay exactly as they are.'),
            confirmLabel: t('a9.start', 'Start the survey'),
            onConfirm: () => { requestSurvey(farm.id); toast(t('a9.started2', 'Survey started. We will tell you when it is ready.')); },
          }),
        })),
        when(farm.survey?.state === 'confirmed', () => row({
          iconName: 'grid',
          title: t('b11.reopen', 'Change what we watch'),
          sub: t('b11.reopen.sub', 'Go back to the survey and include or leave out an area'),
          onclick: () => go(`A10:${farm.id}`),
        })),
        row({
          iconName: 'edit',
          title: t('b11.draw', 'Draw a plot by hand'),
          sub: t('b11.draw.sub', 'For land we missed, or an outline we read wrongly'),
          onclick: () => go(`C5:${plotsOf(farm.id)[0]?.id ?? 'plot-04'}`),
        }))),
      field(t('a11.irrigation', 'Irrigation system'),
        select(['Drip', 'Centre pivot', 'Sprinkler', 'Bubbler', 'Flood/furrow', 'Other', 'Not sure'].map((v) => ({ value: v, label: v })),
          d.irrigation, (v) => { d.irrigation = v; commit('b11'); })),
      field(t('a11.soil', 'Soil type'),
        select(['Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay', 'Silt loam'].map((v) => ({ value: v, label: v })),
          d.soil, (v) => { d.soil = v; commit('b11'); }),
        { hint: t('b11.soil.hint', 'Estimated from the soil layer. Change it if you know better.') }),
      field(t('b11.reportlang', 'Default language for reports'),
        select(['English', 'العربية', 'हिन्दी', 'বাংলা', 'پښتو'].map((v) => ({ value: v, label: v })),
          d.reportLang, (v) => { d.reportLang = v; commit('b11'); })),
      field(t('b11.contact', 'Primary contact'),
        select(state.db.team.map((m) => ({ value: m.name, label: `${m.name} · ${m.role}` })), d.contact,
          (v) => { d.contact = v; commit('b11'); })),

      // WF2.005 — destructive and rarely-used actions go to the top… but they are
      // also the last thing in the reading order here, deliberately guarded.
      section(t('b11.danger', 'Ownership and deletion'), {},
        card({},
          when(can('farm.transfer', farm), () => row({
            title: t('b11.transfer', 'Transfer ownership'),
            sub: t('b11.transfer.sub', 'Confirmed by SMS. You keep your access until the new owner accepts.'),
            iconName: 'users',
            onclick: () => openModal('CONFIRM', {
              title: t('b11.transfer', 'Transfer ownership'),
              body: t('b11.transfer.body', 'We will send a confirmation code to your mobile number before anything changes.'),
              confirmLabel: t('action.send', 'Send code'),
              onConfirm: () => toast(t('b11.transfer.sent', 'Confirmation code sent')),
            }),
          })),
          when(can('farm.delete', farm), () => row({
            title: t('b11.delete', 'Delete farm'),
            sub: t('b11.delete.sub', 'All history is lost. You must type the farm name to confirm.'),
            iconName: 'trash',
            onclick: () => openModal('DELETE_FARM', { farmId: farm.id }),
          })))),
      when(!can('farm.delete', farm), () => h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b11.owneronly', 'Only a farm owner can transfer or delete a farm.'), req('WF5.040')))),
    dock: actionDock(btn(t('action.save', 'Save changes'), {
      variant: 'primary',
      onclick: () => {
        // The screen holds a localised view; the edit belongs on the record.
        Object.assign(rawFarm(farm.id), { name: d.name, type: d.type, region: d.region, irrigation: d.irrigation, soil: d.soil });
        toast(t('b11.saved', 'Farm settings saved'));
        commit('b11');
      },
    })),
  };
}

/* -- B12 · Add farm ------------------------------------------------------- */

export function B12() {
  return {
    top: appBar({ title: t('b12.title', 'Add a farm') }),
    body: page(
      when(state.session.demo, () => disclaimer(t('demo.addfarm', 'Adding a real farm needs an account. Everything else in the demo works.'))),
      card({ onclick: () => (state.session.demo ? openModal('DEMO_CONVERT') : go('A8D')) }, cardPad(
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('edit', 26)),
        h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, t('a8.draw', 'Draw it on the map')),
        h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, t('a8.draw.sub', 'Trace the boundary on satellite imagery')))),
      // WF4.072 — adding a farm of the other type offers an upgrade, not a second sub.
      disclaimer(t('b12.combined', 'If you add a farm of a type your plan does not cover, we will offer you the matching Complete plan rather than a second subscription.'))),
  };
}
