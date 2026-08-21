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
  statusIcon, emptyState, proportionBar, lockedRow, req, pillTabs,
  field, input, select, disclaimer,
} from '../ui/components.js';
import { area, num, ago, date, tempC, speed, NOW } from '../core/format.js';
import { countByStatus, worstStatus, statusLabel, statusMeaning, bySeverity, STATUS } from '../core/status.js';
import { visibleFarms, farmById, rawFarm, plotsOf, farmStatus, adviceFor, adviceForPlot, tasksFor, allVisiblePlots, measureByKey, workersOf } from '../data/selectors.js';
import { detailRouteFor } from './plot.js';
import { can } from '../core/capabilities.js';
import { has, farmIsPending } from '../core/entitlements.js';
import { mapSvg, farmGlyph } from '../ui/map.js';
import { surveyTotals } from '../data/survey.js';
import { markSurveyReady, requestSurvey } from '../data/actions.js';
import { farmRouteCards, startAddFarm, farmNameField, farmIsNamed } from './onboarding.js';

/* -- B1 · Home / My farms ------------------------------------------------- */

export function B1() {
  const farms = visibleFarms();
  const view = state.ui.homeView;
  // WF5.006 — a farm still being surveyed carries no health status and is not
  // counted here, so the summary describes only the farms it can describe.
  const judged = farms.filter((f) => !f.survey || f.survey.state === 'confirmed');
  const counts = countByStatus(judged.map((f) => ({ status: farmStatus(f) })));
  const needing = counts.action + counts.urgent;

  // WF5.011 — empty state with a button that resolves it.
  if (!farms.length) {
    return {
      top: homeBar(),
      body: emptyState({
        iconName: 'leaf',
        title: t('b1.empty.title', 'You have no farms yet'),
        body: t('b1.empty.body', 'Add your land and we will start watching it from space.'),
        action: can('farm.create') ? { label: t('b1.empty.cta', 'Add your first farm'), onclick: () => enterOnboarding('A9') } : null,
      }),
    };
  }

  return {
    top: homeBar(),
    body: page(
      h('div.b1__greet',
        h('h1', { style: { fontSize: 'var(--t-head)', margin: 0 } },
          t('b1.greeting', 'Good morning, {name}', { name: (state.db.team.find((m) => m.isYou)?.name ?? '').split(' ')[0] })),
        h('div.b1__date', date(NOW, { weekday: true, noYear: true, allowHijri: false }))),

      // WF5.001 — counted by worst plot, not by average. A bar rather than a
      // grid of four numbers: three of the four are usually zero, and "0 Urgent"
      // takes as much room as the number the farmer came to read.
      when(judged.length, () => card({ class: 'hero' }, cardPad(
        h('div.hero__head',
          statusIcon(needing ? 'urgent' : 'good', 20),
          h('span', needing
            ? t('b1.needing', '{n} farms need attention', { n: num(needing) })
            : t('b1.allgood', 'All farms are healthy')),
          req('WF5.001')),
        proportionBar([
          { status: 'urgent', label: statusLabel('urgent'), count: counts.urgent },
          { status: 'action', label: statusLabel('action'), count: counts.action },
          { status: 'watch', label: statusLabel('watch'), count: counts.watch },
          { status: 'good', label: statusLabel('good'), count: counts.good },
          { status: 'nodata', label: statusLabel('nodata'), count: counts.nodata },
        ]),
        // WF5.002 — goes to D1 pre-filtered to Action needed and Urgent.
        btn(t('b1.seewhat', 'See what to do'), {
          variant: 'primary', size: 'sm',
          onclick: () => { state.ui.adviceTab = 'needs'; switchTab('advice'); },
        })))),

      // WF5.007 — All farms is a first-class view, not a filter buried in a
      // picker. The farmer sees every plot across every holding in one list and
      // on one map, or one farm at a time, and switching between the two is one
      // tap on the screen they are already on.
      // The left tab is called All plots because that is what it lists. It read
      // "All farms" against "By farm", which is one word apart and describes
      // the same nouns — the farmer could not tell from the labels that one of
      // them was a list of plots.
      pillTabs([
        { id: 'all', label: t('b1.allplots', 'All plots') },
        { id: 'byfarm', label: t('b1.byfarm', 'By farm') },
      ], view, (id) => { state.ui.homeView = id; commit('b1'); }),

      view === 'all' ? allFarmsView(farms) : byFarmView(farms)),
  };
}

/* WF5.007 / WF5.008 — the combined view: one row for the holding as a whole,
   carrying the totals and the map toggle that opens every farm's plots at once,
   then every plot across every farm in one list, worst first. */
function allFarmsView(farms) {
  const plots = sortPlots(allVisiblePlots(), 'attention');
  const trees = farms.reduce((n, f) => n + (f.treeCount ?? 0), 0);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    card({},
      h('div.farmcard__id',
        h('span.farmcard__glyph', plots.length
          ? farmGlyph(plots)
          : h('span', { style: { display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-400)' } }, icon('grid', 22))),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div.farmcard__name', h('span', { style: { minWidth: 0 } }, t('b1.allfarms', 'All farms'))),
          h('div.farmcard__meta', [
            t('b1.farmcount', '{n} farms', { n: num(farms.length) }),
            area(farms.reduce((n, f) => n + (f.areaHa ?? 0), 0)),
            trees ? t('farm.treecount', '{n} trees', { n: num(trees) }) : t('farm.plotcount', '{n} plots', { n: num(plots.length) }),
          ].join(' · '))),
        mapToggle('all', t('b1.mapall', 'See every farm on the map')))),

    plots.length
      ? plots.map((p) => plotRow(p, { showFarm: true }))
      : emptyState({
        iconName: 'grid',
        title: t('b1.noplots', 'No plots yet'),
        body: t('b1.noplots.body', 'Draw a boundary or send a farm for survey, and its plots appear here.'),
      }),
    h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF5.007', 'WF5.008')));
}

function byFarmView(farms) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    sortedForHome(farms).map(farmCard),
    h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF5.003', 'WF5.009')));
}

/* WF5.008 — the same control beside a farm and beside All farms, so "show me
   this on the map" is one gesture wherever the eye happens to be. It sets the
   map's own farm filter rather than passing a route parameter: C1 is a tab with
   its own stack, and a filter is what it already understands. */
function mapToggle(farmFilter, label, cls = '') {
  return h(`button.iconbtn${cls ? `.${cls}` : ''}`, {
    'aria-label': label, title: label,
    onclick: (e) => {
      e.stopPropagation();
      state.ui.farmFilter = farmFilter;
      switchTab('map');
    },
  }, icon('map', 21));
}

/* WF5.009 — severity first. The second key is "most recently viewed", which
   nothing in a mockup can honestly report, so the fixture order stands in for
   it: Array.prototype.sort is stable, so equal severities keep it. */
function sortedForHome(farms) {
  return [...farms].sort((a, b) => rankForHome(b) - rankForHome(a));
}

/* A survey result waiting to be confirmed outranks everything — it is the only
   card on the screen the farmer can finish in a minute — and a farm still being
   surveyed sinks below the farms that have data. */
function rankForHome(farm) {
  if (farm.survey?.state === 'ready') return 9;
  if (farm.survey?.state === 'surveying') return -9;
  return STATUS[farmStatus(farm)]?.rank ?? -1;
}

function homeBar() {
  return h('div.app__top', h('div.appbar',
    // The mark alone: the wordmark would eat the bar, and the title says it.
    logo('mark', 26),
    h('div.appbar__title', BRAND.name)));
}

/* WF5.003's farm type, as the icon it asks for. Mixed is two icons rather than
   a third glyph nobody would recognise. */
function typeIcons(farm) {
  const names = farm.type === 'crops' ? ['sprout'] : farm.type === 'trees' ? ['tree'] : ['sprout', 'tree'];
  return h('span', {
    style: { display: 'inline-flex', gap: '2px', flex: '0 0 auto', color: 'var(--ink-500)' },
    title: farm.type === 'crops' ? t('farm.crops', 'Crops') : farm.type === 'trees' ? t('farm.trees', 'Trees') : t('farm.mixed', 'Crops and trees'),
  }, names.map((n) => icon(n, 17)));
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
  // A button inside a button is not a thing the DOM will let stand, and WF5.008
  // puts a second control on a card that is itself one big target. So the card
  // is a plain box, the whole of its content is one button, and the map toggle
  // is lifted out of that button's flow and pinned to the corner.
  return card({ accent: status, class: 'farmcard' },
    h('button.farmcard__open', { onclick: () => go(`B2:${farm.id}`), type: 'button' },
    // Block one: which farm this is.
    h('div.farmcard__id',
      h('span.farmcard__glyph', plots.length
        ? farmGlyph(plots)
        : h('span', { style: { display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-400)' } },
            icon(farm.type === 'crops' ? 'sprout' : 'tree', 22))),
      // WF5.003 — type icon, area, plot or tree count. The icon rides with the
      // NAME rather than the figures: the word "Trees" says nothing the icon
      // does not, and taking it out of the second line is what lets the area and
      // the count share one line at 360 dp instead of wrapping under a glyph.
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div.farmcard__name', h('span', { style: { minWidth: 0 } }, farm.name), typeIcons(farm)),
        h('div.farmcard__meta', [
          area(farm.areaHa),
          farm.treeCount ? t('farm.treecount', '{n} trees', { n: num(farm.treeCount) }) : t('farm.plotcount', '{n} plots', { n: num(plots.length) }),
        ].join(' · '))),
      h('span', { style: { color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),

    // Block two: how it is doing. WF5.003's one-line summary, and WF5.004's
    // imagery age underneath it — indented to the summary's text, so the two
    // read as one statement rather than two unrelated lines.
    h('div.farmcard__state',
      pending
        ? h('div.locked', { style: { alignSelf: 'flex-start' } }, icon('lock', 15),
            t('b1.pending', 'Analytics locked — upgrade to a Complete plan'))
        : h('div.farmcard__line', statusIcon(status, 17), h('span', farm.headline)),
      h(`div.farmcard__age${farm.imageryBlockedReason ? '.farmcard__age--warn' : ''}`,
        farm.imageryBlockedReason
          ? farm.imageryBlockedReason
          : t('b1.updated', 'Updated {when}', { when: agoFromHours(farm.imageryAgeHours) }))),
    ),
    mapToggle(farm.id, t('b1.mapfarm', 'See {name} on the map', { name: farm.name }), 'farmcard__map'));
}

function surveyingCard(farm) {
  return card({ accent: 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon('scan', 20)),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, farm.name)),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      `${area(farm.areaHa)} · ${t('b1.surveying.sub', 'whole-farm survey')}`),
    h('div', t('b1.surveying', 'We’re working out what’s on this land. It usually takes a few hours — we’ll let you know when it’s ready.')),
    // Nothing to wait for in a mockup, so there is a way past it.
    btn(t('b1.surveying.skip', 'See the result now'), {
      variant: 'secondary', size: 'sm',
      onclick: () => { markSurveyReady(farm.id); toast(t('b1.survey.arrived', 'Your farm survey is ready')); },
    })));
}

function surveyReadyCard(farm) {
  const totals = surveyTotals(farm);
  return card({ accent: 'action', onclick: () => go(`A11:${farm.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon('action', 20),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, farm.name),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      `${area(farm.areaHa)} · ${t('b1.ready.sub', '{n} areas found', { n: num(totals.areas.length) })}`),
    h('div', t('b1.ready', 'Your survey is ready. Confirm what we found.'))));
}

function agoFromHours(hours) {
  if (hours < 36) return t('ago.past', '{x} ago', { x: t('ago.hour', '{n} hours', { n: num(hours) }) });
  return t('ago.past', '{x} ago', { x: t('ago.day', '{n} days', { n: num(Math.round(hours / 24)) }) });
}

/* -- B2 · Farm detail ----------------------------------------------------- */

/* THREE metrics, in this order, and the order is the argument.
   Plant health first because it is the composite everything else qualifies.
   Water stress second because in this region it is the one that kills a crop
   inside a week. Nutrition status third because it is a matter of weeks.

   Growth and vigour was a fourth row and has gone: it is an aspect of plant
   health rather than a thing beside it, and a dashboard with four rows where
   two of them move together teaches the farmer to read neither. The measure
   itself is untouched — EVI is still on the plot page and still on the map,
   where somebody looking at one field can use it. This is the farm-level
   summary, and a summary that lists everything is not one. */
const HEALTH_ROWS = [
  { key: 'overall', measure: 'ndvi', label: 'Plant health', feature: 'measure.ndvi' },
  { key: 'water', measure: 'ndwi', label: 'Water stress', feature: 'measure.ndwi' },
  { key: 'nutrition', measure: 'ndre', label: 'Nutrition status', feature: 'measure.ndre' },
];

export function B2(farmId) {
  const farm = farmById(farmId);
  const ui = local(`b2-${farmId}`, { weatherOpen: false });
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
        h('button.mapchip.mapchip--quiet', {
          style: { position: 'absolute', insetInlineEnd: '6px', bottom: '2px' },
          onclick: () => { state.ui.farmFilter = farm.id; switchTab('map'); },
        }, t('b2.openmap', 'Open map'), icon('forward', 13, 'flip'))),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650 } },
          statusIcon(status, 20),
          h('span', needing
            ? t('b2.needing', '{n} plots need attention', { n: num(needing) })
            : t('b2.allgood', 'All plots are healthy'))),
        // The imagery DATE has gone from this line. WF5.004's promise — that the
        // farmer always knows how old the picture is — is kept on the farm card
        // (B1) and on the plot's own date stepper, where it sits beside the
        // image it describes. Here it was a second date on a screen that opens
        // with a map, and "imagery from 2 August" answers a question nobody
        // standing on this screen is asking.
        h('div', { style: { color: 'var(--ink-600)' } },
          [area(farm.areaHa),
           t('farm.plotcount', '{n} plots', { n: num(plots.length) }),
           farm.treeCount ? t('farm.treecount', '{n} trees', { n: num(farm.treeCount) }) : null,
          ].filter(Boolean).join(' · '))),

      when(pending, () => h('div', { onclick: () => openModal('UPGRADE', { featureKey: 'tree.list' }) },
        disclaimer(t('b2.pending', 'This farm isn’t covered by your current plan. Its boundary is saved and your existing service isn’t affected — upgrade to the combined plan to see its analytics.'), true))),

      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        miniTile('advice', t('nav.advice', 'Advice'), t('b2.new', '{n} new', { n: num(advice.length) }), () => { state.ui.farmFilter = farm.id; switchTab('advice'); }),
        miniTile('tasks', t('nav.tasks', 'Tasks'), t('b2.open', '{n} open', { n: num(tasks.length) }), () => { state.ui.farmFilter = farm.id; switchTab('tasks'); })),

      // WF5.010 — measures outside the plan are greyed with a lock, never hidden.
      section(t('b2.health', 'Health today'), {},
        card({}, HEALTH_ROWS.map((r) => {
          if (pending || !has(r.feature)) return lockedRow(r.feature, t(`measure.${r.measure}`, r.label));
          const worst = worstStatus(plots, (p) => p.healthRows?.[r.key] ?? 'nodata');
          // "Plant health" above all: it is a composite of several readings
          // and the one a farmer is least likely to interpret correctly on
          // sight. The info button is on the row, beside the name, rather than
          // hidden a screen deeper — the moment the question occurs is the
          // moment the word is read.
          return h('div.row', { style: { gap: '6px' } },
            h('div.row__main', { style: { display: 'flex', alignItems: 'center', gap: '2px', minWidth: 0 } },
              h('button', {
                // NOT nowrap. "Nutrition status" beside an "Action needed" chip
                // is wider than 360 dp allows, and a nowrap title in a shrunk
                // flex child does not overflow — it is clipped, which turned the
                // row into "Nutrition statu" with no ellipsis to say so.
                style: {
                  textAlign: 'start', background: 'none', border: 0, padding: 0,
                  cursor: 'pointer', font: 'inherit', color: 'inherit',
                  fontWeight: 550,
                },
                // WF5.013 — opens the measure viewer for that measure across the farm.
                onclick: () => go(`B7:${plots[0]?.id ?? ''}|${r.measure}`),
              }, t(`measure.${r.measure}`, r.label)),
              h('button.iconbtn.iconbtn--bare', {
                style: { minWidth: '34px' },
                onclick: () => openSheet('MEASURE_INFO', { key: r.measure }),
                'aria-label': t('c1.whatis', 'What does this mean?'),
                title: t('c1.whatis', 'What does this mean?'),
              }, icon('info', 18))),
            statusChip(worst),
            h('span.row__chev', icon('forward', 20, 'flip')));
        }))),

      section(t('b2.weather', 'Weather'), {}, weatherCard(farm, ui)),

      section(t('b2.explore', 'Explore'), {},
        card({},
          row({ title: t('b3.title', 'Plots'), value: num(plots.length), iconName: 'grid', onclick: () => go(`B3:${farm.id}`) }),
          // WF5.014 — the Trees row exists only for tree and mixed farms.
          when(farm.type !== 'crops', () => row({
            title: t('b9.title', 'Trees'), value: num(farm.treeCount), iconName: 'tree',
            onclick: () => go(`B9:${farm.id}`),
          })),
          // WF5.017 — Workforce lives HERE, beside Plots and Trees, with a
          // headcount. Not in Settings, not in the More tab: the people are
          // part of the holding, not a preference.
          when(can('worker.manage', farm), () => row({
            title: t('g1.title', 'Workforce'), value: num(workersOf(farm.id).length), iconName: 'users',
            onclick: () => go(`G1:${farm.id}`),
          })),
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

function weatherCard(farm, ui) {
  const w = farm.weather;
  // WF5.015 — the forecast length is per plan, and the two services do not
  // count it the same way: §9.3 gives crops 14 days at both levels, §9.4 gives
  // trees 7 at Basic and 15 at Pro. So the feature key depends on the farm.
  const key = farm.type === 'trees' ? 'weather.forecast.15' : 'weather.forecast.14';
  const days = has(key) ? (key === 'weather.forecast.15' ? 15 : 14) : 7;
  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
      h('span', { style: { color: 'var(--st-action)', display: 'flex' } }, icon(w.condition === 'Clear' ? 'sun' : 'cloud', 30)),
      h('span.num', tempC(w.tempC)),
      h('span', { style: { color: 'var(--ink-600)' } }, w.condition),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${t('weather.wind', 'Wind')} ${speed(w.windKph)}`)),
    // Headlines on the surface, detail behind a control. The full strip is
    // fourteen columns of numbers nobody reads standing in a doorway; the next
    // three days answer "do I spray this morning", and the rest is a tap away.
    // This screen was called dense, and that is the standard it now holds to.
    h('div', { style: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '2px' } },
      w.forecast.slice(0, ui.weatherOpen ? days : 3).map((f) => h('div', {
        style: { flex: '0 0 auto', textAlign: 'center', minWidth: '46px' },
      },
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, f.day),
      h('div', { style: { color: 'var(--ink-500)', display: 'flex', justifyContent: 'center' } },
        icon(f.rainMm > 0 ? 'rain' : f.condition === 'Clear' ? 'sun' : 'cloud', 18)),
      h('div', { style: { fontWeight: 650 } }, `${num(f.hiC)}°`))),
      when(!ui.weatherOpen && days > 3, () => h('button.textlink', {
        style: { fontSize: 'var(--t-meta)', alignSelf: 'center', whiteSpace: 'nowrap' },
        onclick: () => { ui.weatherOpen = true; commit('b2'); },
      }, t('b2.moredays', '+{n} days', { n: num(days - 3) })))),
    when(days === 7, () => h('button.locked', {
      onclick: () => openModal('UPGRADE', { featureKey: key }),
      style: { alignSelf: 'flex-start' },
    }, icon('lock', 15), t(`b2.forecast${key === 'weather.forecast.15' ? '15' : '14'}`,
      key === 'weather.forecast.15' ? '15-day forecast' : '14-day forecast'))),
    // WF5.015 — an active alert is surfaced inline.
    when(w.alert, () => h('button.row', {
      onclick: () => go(`D6:${farm.id}`),
      style: { padding: '10px 0', borderBottom: 0 },
    },
    statusIcon(w.alert.severity, 18),
    h('div.row__main', h('div.row__title', w.alert.title), h('div.row__sub', w.alert.detail)),
    h('span.row__chev', icon('forward', 18, 'flip'))))));
}

/* -- B3 · Plots, WF5.018 … WF5.021 ---------------------------------------
   Flat, because the hierarchy is: farm → boundary → plot → tree. Blocks and
   fields are not a layer the schema has, so the grouping this screen used to
   draw has gone with them — not hidden behind a condition, because there is no
   longer anything to group by. The requirement that said so has since been
   withdrawn as redundant; the shape it described is the shape of the data.

   WF5.019 makes "All farms" a real option here rather than a mode the user has
   to leave the screen to reach: someone with four farms and one bad plot wants
   to see the bad plot, not to remember which farm it was on. */

const SORTS = [
  { id: 'attention', label: 'Needs attention first' },
  { id: 'name', label: 'Name' },
  { id: 'area', label: 'Area' },
  { id: 'changed', label: 'Most recently changed' },
];

export function B3(farmId) {
  const farms = visibleFarms();
  const all = farmId === 'all';
  const farm = all ? null : farmById(farmId);
  const sort = state.ui.plotSort;
  const plots = sortPlots(all ? allVisiblePlots() : plotsOf(farm.id), sort);

  return {
    top: appBar({ title: t('b3.title', 'Plots'), subtitle: all ? t('b3.allfarms', 'All farms') : farm.name }),
    body: page(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        // WF5.019 — the farm selector, with All farms as one of its options.
        select([{ value: 'all', label: t('b3.allfarms', 'All farms') },
          ...farms.map((f) => ({ value: f.id, label: f.name }))],
        all ? 'all' : farm.id, (v) => go(`B3:${v}`, { replace: true }), { style: { flex: '1 1 140px' } }),
        // WF5.020 — sort options, "Needs attention first" the default.
        select(SORTS.map((x) => ({ value: x.id, label: t(`b3.sort.${x.id}`, x.label) })), sort,
          (v) => { state.ui.plotSort = v; commit('sort'); }, { style: { flex: '1 1 140px' } })),

      // WF2.008 — the colours down this list mean something, and this says what.
      // A farmer opening the plot list for the first time sees a column of red
      // and amber hairlines with no key anywhere on the screen.
      when(plots.length, () => statusKey()),

      plots.length === 0
        ? emptyState({
          iconName: 'grid',
          title: t('b3.empty.title', all ? 'No plots yet' : 'No plots in this farm yet'),
          body: t('b3.empty.body', 'Draw a boundary and we will start measuring it.'),
          action: can('plot.create', farm) ? { label: t('b3.empty.cta', 'Add a plot'), onclick: () => startAddFarm('plots', farm?.name ?? '') } : null,
        })
        : plots.map((p) => plotRow(p, { showFarm: all })),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF5.018'))),
  };
}

/**
 * The four-state scale, spelled out, at the top of the list it governs.
 *
 * It is built from STATUS rather than written out, so it cannot disagree with
 * the hairlines underneath it — and it prints the MEANING beside the word,
 * because "Urgent" and "Watch" are only useful once somebody has been told that
 * one means today and the other means keep looking.
 */
function statusKey() {
  return h('div', {
    style: {
      display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
      padding: '2px 2px 4px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)',
    },
  }, ['urgent', 'action', 'watch', 'good'].map((key) => h('span', {
    style: { display: 'inline-flex', alignItems: 'center', gap: '5px' },
  }, statusIcon(key, 15), h('b', { style: { fontWeight: 650 } }, statusLabel(key)),
     h('span', statusMeaning(key).toLowerCase()))));
}

function sortPlots(plots, sort) {
  const copy = [...plots];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'area') return copy.sort((a, b) => b.areaHa - a.areaHa);
  if (sort === 'changed') return copy.sort((a, b) => Math.abs(b.measures.ndvi?.delta ?? 0) - Math.abs(a.measures.ndvi?.delta ?? 0));
  return copy.sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name));
}

export function plotRow(plot, { showFarm = false } = {}) {
  // A plot drawn today, or found by a survey this morning, has no reading yet.
  // That is a state to say out loud, not a zero to print.
  const m = plot.measures.ndvi;
  const measure = measureByKey('ndvi');
  // WF5.024 / review C342 — a red row states a problem, and the farmer's next
  // question is "what problem". The advice that raised it is one tap away
  // rather than two screens away, and only where there IS one.
  const alert = ['urgent', 'action'].includes(plot.status) ? adviceForPlot(plot.id)[0] : null;
  return card({ accent: plot.status, class: 'plotcard' },
    h('button.plotcard__open', { onclick: () => go(`B4:${plot.id}`), type: 'button' }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon(plot.status, 18),
        // Farm-qualified in a list that spans farms, bare inside one farm.
        h('span', { style: { fontWeight: 650 } }, showFarm ? plot.name : plot.shortName),
        // The crop, not the cultivar. "Date palm — Sukkari" against "Date palm —
        // Khalas" down a list of twelve plots is a column of noise: the variety
        // changes nothing about what the row is telling you, and it is on the
        // plot's own screen for anyone who wants it.
        h('span', { style: { color: 'var(--ink-600)' } }, plot.cropName),
        h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        [area(plot.areaHa),
          plot.treeCount ? t('farm.treecount', '{n} trees', { n: num(plot.treeCount) }) : null]
          .filter(Boolean).join(' · ')),
      h('div', plot.statusLine),
      // WF5.021 — value and its 7-day change, with a direction arrow.
      m
        ? h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', display: 'flex', gap: '8px', alignItems: 'center' } },
            h('span', `${measure.technical} ${num(m.value, 2)}`),
            h('span', {
              style: { color: m.delta > 0 ? 'var(--st-good)' : m.delta < 0 ? 'var(--st-urgent)' : 'var(--ink-500)', fontWeight: 650 },
            }, m.delta === 0 ? t('delta.nochange', 'no change') : `${m.delta > 0 ? '↑' : '↓'} ${num(Math.abs(m.delta), 2)}`),
            h('span', t('b3.vs7', 'vs 7 days ago')))
        : h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('b3.noreading', 'No reading yet')))),

    // A second control on a card that is itself one big target means a button
    // inside a button, which the DOM will not stand — so the card body is one
    // button and this sits outside its flow, exactly as the map toggle does on
    // a farm card.
    when(alert, () => h('div', { style: { padding: '0 var(--sp-4) var(--sp-3)' } },
      btn(t('b3.seealert', 'See what to do'), {
        variant: 'emphasis', size: 'sm', block: false, icon: 'advice',
        onclick: () => go(`${detailRouteFor(alert)}:${alert.id}`),
      }))));
}

/* -- B11 · Farm settings, WF5.039 / WF5.040 -------------------------------- */

export function B11(farmId) {
  const farm = farmById(farmId);
  const d = local(`b11-${farm.id}`, {
    name: farm.name, type: farm.type, region: farm.region,
    reportLang: 'English', contact: 'Khaled Al-Amri',
  });

  return {
    top: appBar({ title: t('b11.title', 'Farm settings'), subtitle: farm.name }),
    body: page(
      field(t('a12.name', 'Farm name'), input({ value: d.name, oninput: (e) => { d.name = e.target.value; } }), { required: true }),
      field(t('a12.what', 'What is on this land?'),
        select([
          { value: 'crops', label: t('farmtype.crops', 'Field crops') },
          { value: 'trees', label: t('farmtype.trees', 'Date palms and fruit trees') },
          { value: 'mixed', label: t('farmtype.mixed', 'Both') },
        ], d.type, (v) => { d.type = v; commit('b11'); })),
      field(t('b11.region', 'Address or region'), input({ value: d.region, oninput: (e) => { d.region = e.target.value; } })),

      // WF5.047 — neither route is spent. A farmer who drew his plots can still ask
      // for the whole place to be read, and one who surveyed can still draw.
      section(t('b11.land', 'Land'), {}, card({},
        when(!farm.survey, () => row({
          iconName: 'scan',
          title: t('b11.survey', 'Survey the whole farm'),
          sub: t('b11.survey.sub', 'We read everything inside your boundary and tell you what is there'),
          onclick: () => openModal('CONFIRM', {
            title: t('b11.survey.q', 'Survey this farm?'),
            body: t('b11.survey.body', 'It takes a few hours and costs nothing. Your plots stay exactly as they are.'),
            confirmLabel: t('a10.send', 'Send for survey'),
            onConfirm: () => { requestSurvey(farm.id); toast(t('a10.started2', 'Survey started. We will tell you when it is ready.')); },
          }),
        })),
        when(farm.survey?.state === 'confirmed', () => row({
          iconName: 'grid',
          title: t('b11.reopen', 'Change what we watch'),
          sub: t('b11.reopen.sub', 'Go back to the survey and include or leave out an area'),
          onclick: () => go(`A11:${farm.id}`),
        })),
        row({
          iconName: 'edit',
          title: t('b11.draw', 'Draw a plot by hand'),
          sub: t('b11.draw.sub', 'For land we missed, or an outline we read wrongly'),
          onclick: () => go(`C5:${plotsOf(farm.id)[0]?.id ?? 'plot-04'}`),
        }))),
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
        t('b11.owneronly', 'Only a farm owner can transfer or delete a farm.'), req('WF5.048')))),
    dock: actionDock(btn(t('action.save', 'Save changes'), {
      variant: 'primary',
      onclick: () => {
        // The screen holds a localised view; the edit belongs on the record.
        Object.assign(rawFarm(farm.id), { name: d.name, type: d.type, region: d.region, soil: d.soil });
        toast(t('b11.saved', 'Farm settings saved'));
        commit('b11');
      },
    })),
  };
}

/* -- B12 · Add farm, WF5.049 … WF5.052 ------------------------------------
   The same fork as the first farm, because there is no reason for the second
   one to work differently. WF5.049 adds one rule: a farm holding trees never
   bypasses the survey, since the tree count is what the price is calculated
   from and nobody can be asked to count eight thousand palms by hand. */

export function B12() {
  const farms = visibleFarms();
  // Review 21/08 — the same change as A9, because this is the same choice.
  // Adding a second farm is where the name matters most: an account with one
  // farm can get away with calling it nothing in particular, and an account
  // with four cannot. The draft is B12's own — startAddFarm() clears the
  // signup draft on its way out, so the name is handed to it rather than
  // written into the thing it is about to empty.
  const d = local('addfarm', { farmName: '' });
  // WF5.051 — the hard limit. WF5.050's warning threshold used to sit at five,
  // which meant a farmer with six farms was told twice that he was near a limit
  // he was nowhere near: once at five, and again when he actually reached ten.
  // Both now speak at ten, so the warning is about the limit rather than about
  // a number that no longer means anything.
  const atCap = farms.length >= 10;
  const nearCap = farms.length >= 9;
  return {
    top: appBar({ title: t('b12.title', 'Add a farm') }),
    body: page(
      when(atCap, () => h('div',
        disclaimer(t('b12.cap', 'You’ve reached the 10-farm limit on this account. If you need more, get in touch and we’ll find an arrangement that works.'), true),
        h('div', { style: { height: '10px' } }),
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', onclick: () => openModal('CONTACT') }))),
      // The fork is A9's, drawn by A9's own component. It used to be a second
      // copy of the two cards written out here, which is how the two screens
      // came to describe the same two routes in different words.
      when(!atCap, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        farmNameField(d, 'addfarm'),
        ...farmRouteCards({ fresh: true, enabled: farmIsNamed(d), farmName: d.farmName }),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('b12.treenote', 'A farm with trees always goes through a survey — the tree count is what sets the price.'),
          req('WF5.049')))),

      // Both notices sit together, under the choice they qualify. Neither is a
      // warning about the fork itself — one is about buying at five farms
      // (WF5.050) and the other about buying a type you do not yet hold
      // (WF4.109) — so putting one above the cards gave it a weight it has not
      // earned and pushed the actual choice down the screen.
      when(!atCap, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        when(nearCap, () => disclaimer(
          t('b12.enterprise', 'You’re close to the 10-farm limit. If you’ll need more, there’s a better plan at this scale — talk to an advisor.'))),
        disclaimer(t('b12.combined', 'If you add a different type of farm, we’ll offer you the combined plan instead of a second subscription.'))))),
  };
}
