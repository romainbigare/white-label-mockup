/* ---------------------------------------------------------------------------
   home.js — B1 My farms, B2 Farm home, B11 Farm settings, B12 Add farm.

   B3 HAS GONE, AND THAT IS THE POINT OF THIS FILE NOW. There used to be a farm
   screen and, one tap further in, a list of its plots; the review merged them,
   because a farmer opening his farm came to see his plots and was handed a
   summary of them instead. So B2 is the farm AND the plot list: a map, one line
   saying whether anything is urgent, the advice count, and then every plot —
   the crops first, the tree groups after.

   Three things came off that screen in the same round and are worth naming,
   because each was a whole block:

     * "Health today" — plant health, water stress and nutrition read at FARM
       level. Every crop has its own profile, so a farm-level reading is an
       average of things that cannot be averaged, and "plant health: urgent"
       told the farmer nothing about which of his four crops was in trouble.
       The measures are untouched on the plot and on the map, where they mean
       something.
     * Weather — moved to More. It is a thing to look up, not a thing to be
       shown every time the app opens.
     * Workforce and Farm diary — deleted with task management.

   B1 survives as an extra layer for the account that has more than one farm.
   About 95% have one, and they never see it: router.homeRoute() sends them
   straight here.
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
import { visibleFarms, farmById, rawFarm, plotsOf, farmStatus, adviceFor, adviceForPlot, allVisiblePlots } from '../data/selectors.js';
import { detailRouteFor } from './plot.js';
import { can } from '../core/capabilities.js';
import { has, farmIsPending } from '../core/entitlements.js';
import { mapSvg, farmGlyph } from '../ui/map.js';
import { surveyTotals } from '../data/survey.js';
import { markSurveyReady, requestSurvey, declareCrop } from '../data/actions.js';
import { farmRouteCards, startAddFarm, farmNameField, farmTypeField, farmIsNamed } from './onboarding.js';

/* URGENT IS THE ONLY THING WORTH CALLING OUT.

   The attention lines used to count everything that was not Good, which on a
   farm of any size means every line on every screen says something needs
   attention every day — planned work and things to keep an eye on are always
   there. So the count is Urgent alone, and the word is in the sentence: two
   farms need URGENT attention, or nothing does. */
const urgentCount = (items, pick = (x) => x.status) =>
  items.filter((x) => pick(x) === 'urgent').length;

/* -- B1 · Home / My farms -------------------------------------------------
   Only an account holding more than one farm ever arrives here; see
   router.homeRoute(). It is a chooser, not a dashboard — everything it leads to
   is on B2, and it exists so that a farmer with four holdings can tell at a
   glance which of them he has to deal with this morning. */

export function B1() {
  const farms = visibleFarms();
  const view = state.ui.homeView;
  // WF5.006 — a farm still being surveyed carries no health status and is not
  // counted here, so the summary describes only the farms it can describe.
  const judged = farms.filter((f) => !f.survey || f.survey.state === 'confirmed');
  const counts = countByStatus(judged.map((f) => ({ status: farmStatus(f) })));
  const needing = counts.urgent;

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
            ? t('b1.needing', '{n} farms need urgent attention', { n: num(needing) })
            : t('b1.allgood', 'Nothing urgent on any farm')),
          req('WF5.001')),
        proportionBar([
          { status: 'urgent', label: statusLabel('urgent'), count: counts.urgent },
          { status: 'action', label: statusLabel('action'), count: counts.action },
          { status: 'watch', label: statusLabel('watch'), count: counts.watch },
          { status: 'good', label: statusLabel('good'), count: counts.good },
          { status: 'nodata', label: statusLabel('nodata'), count: counts.nodata },
        ]),
        // WF5.002 — goes to D1 pre-filtered to Action needed and Urgent. The
        // review asked that the button say where it lands, since a printed deck
        // cannot be tapped; the sub-line under it is that answer.
        btn(t('b1.seewhat', 'See what to do'), {
          variant: 'primary', size: 'sm',
          onclick: () => { state.ui.adviceTab = 'needs'; state.ui.farmFilter = 'all'; switchTab('advice'); },
        }),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('b1.seewhat.dest', 'Opens your advice list (D1)'))))),

      // WF5.007 — All farms is a first-class view, not a filter buried in a
      // picker. The farmer sees every plot across every holding in one list and
      // on one map, or one farm at a time, and switching between the two is one
      // tap on the screen they are already on.
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
  const plots = sortPlots(allVisiblePlots());
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
  // because a survey takes hours and the farmer was told to go back to work.
  // Both waiting states say what is happening and what happens next, and
  // neither pretends to be a farm with nothing wrong with it.
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
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div.farmcard__name', h('span', { style: { minWidth: 0 } }, farm.name), typeIcons(farm)),
        h('div.farmcard__meta', plotMetaLine(farm, plots))),
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

/* Plots and tree groups counted separately, because they are not the same kind
   of thing and a single "8 plots" hid four of each behind one word. */
function plotMetaLine(farm, plots) {
  const crops = plots.filter((p) => p.kind !== 'trees').length;
  const groups = plots.filter((p) => p.kind === 'trees').length;
  return [
    area(farm.areaHa),
    crops ? t('farm.plotcount', '{n} plots', { n: num(crops) }) : null,
    groups ? t('farm.groupcount', '{n} tree groups', { n: num(groups) }) : null,
  ].filter(Boolean).join(' · ');
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

/* -- B2 · Farm home, WF5.012 … WF5.021 ------------------------------------
   The farm and its plots on one screen. This is where a single-farm account
   lands and it is the screen the whole app is read from. */

/* The five options the review asked for, in the app's own four-state words:
   everything, or one state at a time. */
const PLOT_FILTERS = ['all', 'urgent', 'action', 'watch', 'good'];

export function B2(farmId) {
  const farm = farmById(farmId);
  const plots = plotsOf(farm.id);
  const status = farmStatus(farm);
  const filter = state.ui.plotFilter;
  const shown = sortPlots(filter === 'all' ? plots : plots.filter((p) => p.status === filter));
  const crops = shown.filter((p) => p.kind !== 'trees');
  const groups = shown.filter((p) => p.kind === 'trees');
  const needing = urgentCount(plots);
  const advice = adviceFor({ farmId: farm.id });
  const pending = farmIsPending(farm);
  const multi = visibleFarms().length > 1;

  return {
    top: appBar({
      title: farm.name,
      // The farm picker in the bar is what B1 used to be for a farmer who is
      // already inside one farm: he can move to another without going back out
      // to a list. It is only there when there is more than one to move to.
      subtitle: multi ? t('b2.switch', 'Tap to switch farm') : farm.region,
      onTitleTap: multi
        ? () => openSheet('FARM_PICKER', { onPick: (id) => go(`B2:${id}`, { replace: true }) })
        : null,
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
          // farmStatus() is already the worst plot, so it is 'urgent' exactly
          // when the sentence beside it says something is.
          statusIcon(status, 20),
          h('span', needing
            ? t('b2.needing', '{n} plots need urgent attention', { n: num(needing) })
            : t('b2.allgood', 'Nothing urgent on this farm'))),
        h('div', { style: { color: 'var(--ink-600)' } }, plotMetaLine(farm, plots))),

      when(pending, () => h('div', { onclick: () => openModal('UPGRADE', { featureKey: 'tree.list' }) },
        disclaimer(t('b2.pending', 'This farm isn’t covered by your current plan. Its boundary is saved and your existing service isn’t affected — upgrade to the combined plan to see its analytics.'), true))),

      // ONE tile, not two. The pair used to be Advice and Tasks; tasks have
      // gone, and a lone half-width box beside an empty half is worse than a
      // row. It says where it goes, for the reviewer holding a printout.
      card({ class: 'card--tap', onclick: () => { state.ui.farmFilter = farm.id; state.ui.adviceTab = 'all'; switchTab('advice'); } },
        row({
          iconName: 'advice',
          title: t('nav.advice', 'Advice'),
          sub: t('b2.advice.dest', 'Everything we think this farm needs (D1)'),
          value: t('b2.new', '{n} new', { n: num(advice.length) }),
        })),

      // The plot list, on the farm screen, which is the merge. WF2.008 — the
      // colours down it mean something, and the key says what.
      section(t('b2.plots', 'Plots'), {}, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          select(PLOT_FILTERS.map((id) => ({
            value: id,
            label: id === 'all' ? t('b3.filter.all', 'All plots') : statusLabel(id),
          })), filter, (v) => { state.ui.plotFilter = v; commit('plots'); }, { style: { flex: '1 1 160px' } }),
          h('span', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)', whiteSpace: 'nowrap' } },
            t('b3.showing', '{n} of {m}', { n: num(shown.length), m: num(plots.length) }))),
        when(shown.length, () => statusKey()),

        // Two blocks, because open field and trees are not the same thing and
        // are not read the same way. Crops first: they change, and the tree
        // groups do not.
        when(crops.length, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          blockHeading('sprout', t('b2.cropplots', 'Crops')),
          crops.map((p) => plotRow(p)))),
        when(groups.length, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          blockHeading('tree', t('b2.treegroups', 'Trees')),
          groups.map((p) => plotRow(p)))),

        when(!shown.length, () => emptyState({
          iconName: 'grid',
          title: plots.length
            ? t('b3.nofilter.title', 'Nothing at that level')
            : t('b3.empty.title', 'No plots in this farm yet'),
          body: plots.length
            ? t('b3.nofilter.body', 'Try another state, or show all plots.')
            : t('b3.empty.body', 'Draw a boundary and we will start measuring it.'),
          action: plots.length
            ? { label: t('b3.showallplots', 'Show all plots'), onclick: () => { state.ui.plotFilter = 'all'; commit('plots'); } }
            : (can('plot.create', farm) ? { label: t('b3.empty.cta', 'Add a plot'), onclick: () => startAddFarm('plots', farm?.name ?? '') } : null),
        })),
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF5.018', 'WF5.019', 'WF5.020')))),

      section(t('b2.explore', 'Explore'), {},
        card({},
          // WF5.014 — the Trees row exists only for a farm that holds any.
          when(farm.treeCount > 0, () => row({
            title: t('b9.everytree', 'Every tree'), value: num(farm.treeCount), iconName: 'tree',
            sub: t('b2.trees.sub', 'The count behind the tree groups, tree by tree'),
            onclick: () => go(`B9:${farm.id}`),
          })),
          when(can('report.view', farm), () => row({ title: t('f1.title', 'Reports'), iconName: 'document', onclick: () => go(`F1:${farm.id}`) })),
          when(can('farm.edit', farm), () => row({ title: t('b11.title', 'Farm settings'), iconName: 'settings', onclick: () => go(`B11:${farm.id}`) })))),
    ),
  };
}

function blockHeading(iconName, label) {
  return h('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--ink-600)',
      fontSize: 'var(--t-meta)', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
    },
  }, icon(iconName, 16), label);
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

/* Worst first, then by name. The sort PICKER has gone with B3: four orderings
   for a list of six rows was a control nobody used, and severity-first is the
   only one the review ever asked for. */
function sortPlots(plots) {
  return [...plots].sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name));
}

/* -- the plot row ---------------------------------------------------------
   WHAT A ROW SAYS NOW, AND WHAT IT STOPPED SAYING.

   It says what the plot is called, how big it is, what is growing on it, and
   whether anything urgent is waiting. That is the record of the plot, which is
   what the farmer opened the list to read.

   The NDVI value and its seven-day delta have gone. A column of "NDVI 0.42 ↓
   0.03 vs 7 days ago" down a list of eight is an agronomist's readout on a
   screen read by the person who owns the field; the number is still on the plot
   itself and on the map, where there is a picture beside it to mean something.

   And a plot the satellite has seen harvested says so, in red, with the one
   control that fixes it — because the app cannot name a new crop for about
   three weeks after it goes in, and until the farmer says, every recommendation
   about that field is a guess. */

export function plotRow(plot, { showFarm = false } = {}) {
  const trees = plot.kind === 'trees';
  const cycle = plot.cropCycles.find((c) => c.state === 'current');
  const awaiting = !!plot.harvestDetectedOn;
  // WF5.024 / review C342 — a red row states a problem, and the farmer's next
  // question is "what problem". The advice that raised it is one tap away
  // rather than two screens away, and only where there IS one.
  const alert = plot.status === 'urgent' ? adviceForPlot(plot.id)[0] : null;

  return card({ accent: plot.status, class: 'plotcard' },
    h('button.plotcard__open', { onclick: () => go(`B4:${plot.id}`), type: 'button' }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon(plot.status, 18),
        h('span', { style: { fontWeight: 650 } }, showFarm ? plot.name : plot.shortName),
        h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),

      // What is on it. A tree group is NAMED after its species, so repeating
      // the species under the name gave "Grapes / Grape · 648 trees"; what a
      // group has to say here is how many trees and how spread out they are.
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-700)' } },
        icon(trees ? 'tree' : 'sprout', 16),
        trees
          ? h('span', { style: { fontWeight: 550 } }, t('farm.treecount', '{n} trees', { n: num(plot.treeCount) }))
          : h('span', { style: { fontWeight: 550 } },
              awaiting ? t('b3.nocrop', 'Nothing growing') : plot.cropName),
        when(trees && (plot.parcels ?? 1) > 1, () => h('span', { style: { color: 'var(--ink-600)' } },
          `· ${t('b3.parcels', 'in {n} places on the farm', { n: num(plot.parcels) })}`)),
        when(!trees && cycle && !awaiting, () => h('span', { style: { color: 'var(--ink-600)' } },
          `· ${t('b3.since', 'since {d}', { d: date(cycle.startDate, { noYear: true, short: true }) })}`))),

      // Size, which is the one thing about a plot that does not change.
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, area(plot.areaHa)),

      // WF5.021 — the one thing worth calling out on a row, and only when true.
      when(plot.status === 'urgent', () => h('div', {
        style: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--st-urgent)', fontWeight: 650 },
      }, statusIcon('urgent', 16), t('b3.urgenthere', 'Needs urgent attention'))))),

    // THE REMINDER. Its own block, under the row rather than inside it, because
    // it carries a control and a card that is one big button cannot hold one.
    when(awaiting, () => h('div', { style: { padding: '0 var(--sp-4) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: '8px' } },
      h('div', { style: { color: 'var(--st-urgent)', fontWeight: 650 } },
        t('b3.harvested', 'Your {crop} crop came off on {d}. What is on this field now?', {
          crop: plot.cropName, d: date(plot.harvestDetectedOn, { noYear: true, short: true }),
        })),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('b3.harvested.why', 'We can’t read a new crop from space until it has about three weeks of leaf.')),
      btn(t('b3.setcrop', 'Tell us what you planted'), {
        variant: 'emphasis', size: 'sm', block: false, icon: 'sprout',
        onclick: () => openSheet('CROP_PICKER', { onPick: (crop) => declareCrop(plot.id, crop) }),
      }))),

    // A second control on a card that is itself one big target means a button
    // inside a button, which the DOM will not stand — so the card body is one
    // button and this sits outside its flow.
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
  const d = local('addfarm', { farmName: '', farmType: null });
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
