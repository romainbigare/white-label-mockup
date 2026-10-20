/* ---------------------------------------------------------------------------
   home.js — B1 My farm, B11 Farm settings, B10 Manage workforce.

   ONE HOME SCREEN. B3 went at the v1.5.4 review, which merged the farm and its
   plot list; B1 went at the round after it, which pointed out that a list of
   farms is a picker and a picker belongs in the app bar. So B1 is the whole of
   Home: the farm, its map, and every plot on it, with the farm name at the top
   left opening the list of the others and the way to add one.

   What this screen deliberately does NOT do any more, all of it asked for and
   each of it a block that used to be here:

     * No health summary. Plant health at farm level averages crops that cannot
       be averaged.
     * No warning line and no colour key. This is the record of the holding, not
       the alarm — the alarms are in Advice, and a page that opens with a legend
       for four severities is a page telling the farmer to worry before it has
       told him what he has.
     * No advice card. The Advice tab is one tap away and always was.
     * No plot filter. Eight rows do not need a filter above them.
     * No card styling on a plot. A plot is a ROW: its name, what is growing on
       it, its size, and a chevron. The crop is its own control, because
       correcting the crop is the thing the farmer is here to do.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openSheet, openModal, reachable, switchTab } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock,
  statusIcon, emptyState, req, field, input, select, disclaimer, deckMark, openMapChip, titledCard,
} from '../ui/components.js';
import { area, num, date, NOW } from '../core/format.js';
import { visibleFarms, farmById, rawFarm, plotsOf, smallTreesOf, membersOf, me, farmMeasures, adviceForPlot, severityToStatus } from '../data/selectors.js';
import { can, ROLE_LABEL } from '../core/capabilities.js';
import { farmIsPending } from '../core/entitlements.js';
import { mapSvg } from '../ui/map.js';
import { metricName, reading } from '../ui/metric.js';
import { efficiencyBand } from '../core/health.js';
import { MIN_GROUP_TREES } from '../core/trees.js';
import { liveMap, liveMapAvailable } from '../ui/livemap.js';
import { surveyTotals } from '../data/survey.js';
import { markSurveyReady, createFarmInvitation, cancelFarmInvitation } from '../data/actions.js';
import { startDrawPlot, canDrawPlot } from './onboarding.js';
import { detailRouteFor } from './plotparts.js';

/* URGENT IS THE ONLY THING WORTH SAYING, AND ONLY WHEN IT IS TRUE.

   The attention line used to count everything that was not Good, which on a
   farm of any size says something needs attention every day. Since v1.7.3 it
   is not a line at all: a plot with urgent advice says so on its own row, with
   the word, and says nothing otherwise (see plotLine()). */
const urgentAdvice = (plot) => adviceForPlot(plot.id).filter((a) => severityToStatus(a.severity) === 'urgent');

/* -- B1 · My farm, WF5.012 … WF5.021 -------------------------------------- */

export function B1(farmId) {
  const farms = visibleFarms();
  const farm = farmById(farmId);
  const plots = plotsOf(farm.id);
  const crops = plots.filter((p) => p.kind !== 'trees');
  const groups = plots.filter((p) => p.kind === 'trees');
  const small = smallTreesOf(farm.id);
  const pending = farmIsPending(farm);

  // A farm mid-survey has no plots to list and a farm whose survey has come
  // back has a decision waiting; both own the screen until they are resolved.
  if (farm.survey?.state === 'surveying' || farm.survey?.state === 'ready') {
    return { top: farmBar(farm, farms), body: page(surveyState(farm)) };
  }

  /* A LIVE MAP, fitted to the whole farm with its boundary and ground all
     round, which the farmer can drag and pinch out of (ui/livemap.js).

     NO METRIC ON IT, since v1.7.3. "Pick a metric" stays on the map screen
     (C1) and nowhere else, so this card shows where the plots are, plainly,
     and its one button says where the metrics are: "View metrics" opens C1.
     With the picker gone the legend went too — a legend under a map painted
     with nothing would be a key to colours that are not there. */
  // No labels on this card: the plots are listed by name right under it, and
  // the full map (C1), one tap away, carries them.
  const farmMap = { plots, measure: null, layers: { labels: false } };

  return {
    top: farmBar(farm, farms),
    body: page(
      h('div.mapbox.farmmap', { style: { height: '220px', borderRadius: 'var(--radius)' } },
        liveMapAvailable()
          ? liveMap('B1', {
            ...farmMap,
            fitKey: farm.id, inPage: true,
          })
          : mapSvg(farmMap),
        // The full map, on this stack, with a way back to the farm.
        openMapChip(() => { state.ui.farmFilter = farm.id; go(`C1:${farm.id}`); })),

      // Where the metric picker was, and in its place: the farm's own measures.
      farmCard(farm),

      h('div', { style: { color: 'var(--ink-600)' } }, plotMetaLine(farm, plots)),

      when(pending, () => h('div', { onclick: () => openModal('UPGRADE', { featureKey: 'tree.list' }) },
        disclaimer(t('b2.pending', 'This farm isn’t covered by your current plan. Its boundary is saved and your existing service isn’t affected — upgrade to the combined plan to see its analytics.'), true))),

      // Two blocks, because open field and trees are not the same thing and are
      // not read the same way. Crops first: they change, and the groups do not.
      // A LIST, NOT A CARD. The rows were inside a bordered, rounded, shadowed
      // box — which is a card containing eight rows that each already read as a
      // row, and the box added nothing but an edge. Hairlines between them are
      // the whole of the separation a list of plots needs.
      /* NO HEALTH SCORE ON THE LIST, since v1.7.3 — the October review's
         last word on it, after keeping the score had been argued for. A
         percentage beside every row made the list a table of grades; the
         number lives on the plot's own scorecard, and the row says the one
         thing worth saying from here, when it is true: Urgent. */
      when(crops.length, () => section(t('b2.cropplots', 'Crops'), {},
        h('div.plotlist', crops.map((p) => plotLine(p))))),
      when(groups.length || small.length, () => section(t('b2.treegroups', 'Trees'), {},
        when(groups.length, () => h('div.plotlist', groups.map((p) => plotLine(p)))),
        when(small.length, () => smallTreesNote(small)))),

      when(!plots.length, () => emptyState({
        iconName: 'grid',
        title: t('b3.empty.title', 'No plots in this farm yet'),
        body: t('b3.empty.body', 'Draw a boundary and we will start measuring it.'),
        action: can('plot.create', farm) && canDrawPlot()
          ? { label: t('b3.empty.cta', 'Add a plot'), onclick: () => startDrawPlot(farm.name) }
          : null,
      })),

      /* "Explore" was a heading over two settings rows, which is a promise of
         somewhere to go and a delivery of somewhere to configure. It is what it
         is: the rest of this farm. */
      section(t('b2.more', 'More'), {},
        card({},
          /* THE TWO FARM-LEVEL VIEWS THE 13/09 REVIEW ADDED, above the
             administrative rows rather than among them. Planning next season
             and reading the year behind you are both farm WORK; reports,
             workforce and settings are the filing cabinet, and a farmer opens
             this block for one or the other. */
          row({
            title: t('b15.title', 'Crop planner'), iconName: 'calendar',
            sub: t('b15.sub', 'What is in the ground, and what follows it'),
            onclick: () => go(`B7:${farm.id}`), deckTo: 'B7',
          }),
          row({
            title: t('b16.title', 'Farm progress'), iconName: 'trend',
            sub: t('b16.sub', 'The last twelve months, farm-wide'),
            onclick: () => go(`B8:${farm.id}`), deckTo: 'B8',
          }),
          when(can('report.view', farm), () => row({ title: t('f1.title', 'Reports'), iconName: 'document', onclick: () => go(`F3:${farm.id}`), deckTo: 'F3' })),
          when(can('member.invite', farm), () => row({
            title: t('b14.title', 'Manage workforce'), iconName: 'users',
            sub: t('b14.sub', 'Who work on this farm, and how you reach them'),
            onclick: () => go(`B10:${farm.id}`), deckTo: 'B10',
          })),
          when(can('farm.edit', farm), () => row({ title: t('b11.title', 'Farm settings'), iconName: 'settings', onclick: () => go(`B11:${farm.id}`), deckTo: 'B11' })))),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        req('WF5.012', 'WF5.018', 'WF5.019'))),
  };
}

/* -- the farm's own card ---------------------------------------------------

   THREE MEASURES OF THE WHOLE FARM, in place of the metric picker that was
   under the map (v1.7.3): irrigation efficiency, plant health, and growth and
   vigour. Each is the average of every plot on the farm (farmMeasures() in
   selectors.js), and each says it three ways — the word for its band in the
   band's colour, a warning sign when it is not good, and the percentage. The
   farm is the one place outside a plot's scorecard where a number is shown
   beside the word; everywhere else the word stands alone.

   And the soil, which belongs to the farm now: one guess from the survey,
   which the farmer can confirm or change in Farm settings (B11). */
const EFFICIENCY_WORDS = ['Very poor', 'Poor', 'Fair', 'Good', 'Very good'];

function farmCard(farm) {
  const m = farmMeasures(farm.id);
  const eff = efficiencyBand(m.efficiency);
  const rows = [
    farmMeasure(t('farmm.efficiency', 'Irrigation efficiency'), 'droplet', m.efficiency, eff,
      eff && t(`farmm.eff.band.${eff.index}`, EFFICIENCY_WORDS[eff.index])),
    farmMeasure(metricName('ndvi'), 'leaf', m.ndvi, reading('ndvi', m.ndvi), reading('ndvi', m.ndvi)?.label),
    farmMeasure(metricName('evi'), 'trend', m.evi, reading('evi', m.evi), reading('evi', m.evi)?.label),
  ];
  return titledCard(t('farmm.title', 'This farm'), {
    bleed: true,
    aside: h('span.cardhead__hint', t('farmm.hint', 'Average of all plots')),
  },
  h('div.farmmeasures', rows),
  h('button.row', {
    type: 'button',
    onclick: can('farm.edit', farm) ? () => go(`B11:${farm.id}`) : undefined,
    ...deckMark({ deckTo: 'B11', deckNote: 'Confirm or change the soil in Farm settings' }),
  },
  icon('layers', 20),
  h('div.row__main',
    h('div.row__title', t('farmm.soil', 'Soil: {soil}', { soil: farm.soil || t('farmm.soil.unknown', 'not known yet') })),
    h('div.row__sub', farm.soilSource === 'farmer'
      ? t('farmm.soil.farmer', 'Set by you')
      : t('farmm.soil.survey', 'Our guess from the survey. You can change it.'))),
  when(can('farm.edit', farm), () => h('span.row__chev', icon('forward', 18, 'flip')))));
}

/** One farm measure: its name, then the word, the warning and the number. */
function farmMeasure(label, iconName, score, band, word) {
  return h('div.farmmeasure',
    h('span.farmmeasure__mark', icon(iconName, 18)),
    h('span.farmmeasure__name', label),
    band
      ? h('span.farmmeasure__value', { style: { color: band.ink } },
        when(band.tone !== 'good', () => icon('warning', 16)),
        h('b', word),
        h('span.farmmeasure__pct', `${num(score)}%`))
      : h('span.farmmeasure__value.farmmeasure__value--nodata', t('status.nodata', 'No data')));
}

/* FEWER THAN FORTY TREES OF ONE KIND ARE COUNTED, NOT GROUPED (v1.7.3, and
   core/trees.js). They are not hidden — the farmer knows they are there, and
   a list that silently dropped them would look like the survey missed them —
   but they are one quiet line, with no row, no advice and no schedule. */
function smallTreesNote(small) {
  return h('p.plotlist__note',
    t('b2.smalltrees', 'Also counted: {list}. Fewer than {min} trees of one kind do not make a tree group, so they get no advice or irrigation schedule.', {
      list: small.map((p) => t('b2.smalltrees.one', '{n} {species}', { n: num(p.treeCount), species: lowerSpecies(p.cropName) })).join(', '),
      min: num(MIN_GROUP_TREES),
    }));
}

function lowerSpecies(name) {
  return (name ?? '').toLocaleLowerCase();
}

/* THE FARM PICKER, WHICH IS WHAT B1 BECAME.

   A list of farms was a whole screen, and a screen a single-farm owner — 95% of
   them — had to get past every morning. It is a sheet now, opened from the farm
   name, and it carries the one other thing that used to be on B1: the way to
   add a farm. Somebody with one farm sees a title; somebody with four sees a
   title with a chevron. */
function farmBar(farm, farms) {
  return appBar({
    title: farm.name,
    subtitle: farm.region,
    back: false,
    onTitleTap: farms.length > 1 ? () => openSheet('FARM_SWITCH', { current: farm.id }) : null,
    titleHint: farms.length > 1 ? t('b2.switchfarm', 'Switch farm') : null,
    deckNote: 'Switches between farms, and adds a new one',
    actions: [
      can('farm.edit', farm) ? barAction('settings', t('b11.title', 'Settings'), () => go(`B11:${farm.id}`), { deckTo: 'B11' }) : null,
    ].filter(Boolean),
  });
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

/* -- the plot line --------------------------------------------------------
   NOT A CARD. A plot is a row: what it is called, what is growing on it, its
   size, its score and a way in.

   TWO LINES, TIGHT, SINCE v1.7.2 — "the space between the plot name and the
   crop name is too big". The name stands alone on the first line, and the
   crop and the size share the second: the crop is what the farmer scans the
   list for, the size is a property he does not, and the two sit together
   under the name they describe. The gap between the lines is the line height
   and nothing more.

   The crop is a button because correcting the crop is the job this screen
   exists for: it opens the cycle list. A field the satellite has watched being
   cleared asks for its crop instead — a small outlined button now, "Set new
   crop is too big of a button", the size of the text it replaces.

   A tree group is NAMED after its species since v1.7.3 — "Olive", "Date
   palm" — so its second line is its count, not its species again.

   NO SCORE, AND "URGENT" ONLY WHEN IT IS TRUE (v1.7.3). The score column
   went. In its place a plot with urgent advice carries the word Urgent with
   its warning sign — the word, not only the triangle — and pressing it opens
   that advice. A plot with nothing urgent carries nothing. */
function plotLine(plot) {
  const trees = plot.kind === 'trees';
  const awaiting = !!plot.harvestDetectedOn;
  const urgent = urgentAdvice(plot);

  return h('div.plotline',
    h('div.plotline__main',
      h('span.plotline__name', plot.shortName),
      h('div.plotline__sub',
        trees
          ? null
          : h('button.plotline__crop', {
            class: awaiting ? 'plotline__crop--empty' : '',
            type: 'button',
            // A crop opens its cycles (B3); a cleared field opens a new cycle
            // (B4), which is also what B2's own no-crop button does.
            onclick: () => go(`${awaiting ? 'B4' : 'B3'}:${plot.id}`),
            ...deckMark(awaiting
              ? { deckTo: 'B4', deckNote: 'Opens the new crop cycle for this plot' }
              : { deckTo: 'B3' }),
          }, awaiting ? [icon('plus', 14), h('span', t('b2.tellus2', 'Set new crop'))] : h('span', plot.cropName)),
        // A TREE GROUP IS COUNTED, NOT MEASURED: its hectares are the ground
        // its parcels happen to cover, which is not what anybody quotes about
        // an orchard. An open field is the opposite.
        h('span.plotline__area', trees
          ? t('farm.treecount', '{n} trees', { n: num(plot.treeCount) })
          : area(plot.areaHa)),
        when(trees && (plot.parcels ?? 1) > 1, () => h('span.plotline__area',
          t('b3.places', 'in {n} places', { n: num(plot.parcels) }))))),

    // An empty cell when nothing is urgent, so the chevron keeps its column.
    !urgent.length ? h('span') : h('button.urgentflag', {
      type: 'button',
      onclick: () => {
        if (urgent.length === 1) { go(`${detailRouteFor(urgent[0])}:${urgent[0].id}`); return; }
        state.ui.farmFilter = plot.farmId;
        state.ui.plotFilter = plot.id;
        switchTab('advice');
      },
      ...deckMark({ deckTo: urgent.length === 1 ? detailRouteFor(urgent[0]) : 'D1', deckNote: 'Opens the urgent advice for this plot' }),
    }, icon('warning', 16), h('span', t('b2.urgent', 'Urgent'))),
    h('button.plotline__go', {
      type: 'button',
      onclick: () => go(`${plot.kind === 'trees' ? 'B5' : 'B2'}:${plot.id}`),
      'aria-label': t('b2.openplot', 'Open {name}', { name: plot.shortName }),
      title: t('b2.openplot', 'Open {name}', { name: plot.shortName }),
      ...deckMark({ deckTo: trees ? 'B5' : 'B2' }),
    }, icon('forward', 22, 'flip')));
}

/* IN PLOT ORDER, AND NOTHING ELSE DECIDES IT — v1.7.2, and since v1.7.3 the
   order is the read layer's (plotsOf() in selectors.js): fields by number,
   then tree groups by species. The list used to put the worst first, which
   moved a plot up the screen the morning it went red; a farmer finds Plot 4
   where Plot 4 was yesterday now. */

/* -- the two states a farm can be in before it has plots ------------------- */

function surveyState(farm) {
  /* WHAT A READY SURVEY OPENS, AND WHY IT IS THE PLOT LIST AGAIN.
     The second pass of the 13/09 review pointed this card at A17 — "if
     analysis ready → show pricing screen" — because at that point the price
     was the one thing the farmer had not yet been shown. The third pass moved
     the plan and its payment in front of the survey, so he has seen it: he
     chose a plan, confirmed it, and only then was the satellite asked for
     anything. What is new when the answer comes back is the ANSWER — the
     plots that were found — so the card opens A16, which is the screen for
     exactly that, and A17 is one step beyond it with the price adjusted to
     what was really there. */
  if (farm.survey.state === 'ready') {
    const totals = surveyTotals(farm);
    // A16 is in the first-run series, which the exhibition edition does not
    // have: there the card says the survey is back and goes nowhere.
    const open = reachable(`A16:${farm.id}`);
    return card({ accent: 'monitor', onclick: open ? () => go(`A16:${farm.id}`) : undefined }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('monitor', 20),
        h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, t('b1.ready.head', 'Your survey is ready')),
        when(open, () => h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip')))),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${area(farm.areaHa)} · ${t('b1.ready.sub', '{n} areas found', { n: num(totals.areas.length) })}`),
      when(open, () => h('div', t('b1.ready3', 'See what we found on your land.')))));
  }
  return card({ accent: 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon('scan', 20)),
      h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, t('b1.surveying.head', 'Reading your land'))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      `${area(farm.areaHa)} · ${t('b1.surveying.sub', 'whole-farm survey')}`),
    h('div', t('b1.surveying', 'We’re working out what’s on this land. It usually takes a few hours — we’ll let you know when it’s ready.')),
    // Nothing to wait for in a mockup, so there is a way past it.
    btn(t('b1.surveying.skip', 'See the result now'), {
      variant: 'secondary', size: 'sm',
      onclick: () => { markSurveyReady(farm.id); toast(t('b1.survey.arrived', 'Your farm survey is ready')); },
    })));
}

/* -- B11 · Farm settings, WF5.039 / WF5.040 -------------------------------- */

export function B11(farmId) {
  const farm = farmById(farmId);
  const raw = rawFarm(farm.id);
  const d = local(`b11-${farm.id}`, {
    name: farm.name, region: farm.region, soil: raw.soil ?? '',
    reportLang: 'English', contact: 'Khaled Al-Amri',
  });

  return {
    top: appBar({ title: t('b11.title', 'Farm settings'), subtitle: farm.name }),
    body: page(
      field(t('a12.name', 'Farm name'), input({ value: d.name, oninput: (e) => { d.name = e.target.value; } }), { required: true }),
      /* "WHAT IS GROWING ON THIS FARM?" IS GONE — review 22/09. It was a
         three-way menu (field crops / trees / both) restating something the app
         already knows better than the farmer can tell it: the plots below carry
         their own crops and their own tree counts, and the survey wrote them.
         A settings field that can contradict the data under it is a field that
         will. */
      field(t('b11.region', 'Address or region'), input({ value: d.region, oninput: (e) => { d.region = e.target.value; } })),

      /* THE SOIL IS THE FARM'S, AND IT IS OUR GUESS UNTIL THE FARMER SAYS
         OTHERWISE (v1.7.3). MMC reads it off the survey; the farmer confirms or
         changes it here, by picking, never by typing — and B1 shows it. */
      field(t('plot.soil', 'Soil type'),
        select(state.db.soilTypes.map((v) => ({ value: v, label: tc(`soil.${v}`, v) })), d.soil,
          (v) => { d.soil = v; commit('b11'); }),
        { hint: raw.soilSource === 'farmer'
          ? t('b11.soil.farmer', 'You set this.')
          : t('b11.soil.survey', 'Our guess from the survey. Change it if you know better.') }),

      /* THE "LAND" SECTION IS GONE, and one row of it survives as the thing it
         was hiding. It offered three doors — survey the whole farm, change what
         we watch, draw a plot by hand — under a heading that told the farmer
         nothing about which of them he wanted, and the review called it what it
         was: confusing. What a farmer opens Farm settings to do about his land
         is add a plot he has just cleared, so that is the row. Re-surveying is
         a support conversation, not a button on a settings page. */
      /* "ALL PLOTS ON THIS FARM" IS THE PLOTS NOW, not a door to them. Review
         22/09: "reconnect the 'All plots on this farm' button to the actual
         plot editor page (right now it links to B1)."

         It pointed at B1 — the screen the farmer just came FROM. A row that
         walks him back to the farm he was already on, and nothing on the far
         side of it edits anything.

         THE PLOT EDITOR IN THIS APP IS C5, and C5 edits ONE plot: it takes a
         plot id, because a boundary is a shape and a shape belongs to a field.
         So a button could only ever have opened a picker, and a picker over a
         list this short is a sheet asking a question the page has room to
         answer. The plots are the list, one row each, and every row is the
         editor — which is one tap rather than two and needs no screen that did
         not already exist. */
      section(t('b11.plots', 'Plots'), { aside: h('span', { style: { color: 'var(--ink-500)', fontWeight: 700 } }, num(plotsOf(farm.id).length)) },
        card({},
          ...plotsOf(farm.id).map((p) => row({
            iconName: p.kind === 'trees' ? 'tree' : 'sprout',
            title: p.shortName,
            sub: [p.kind === 'trees' ? t('farm.treecount', '{n} trees', { n: num(p.treeCount) }) : p.cropName, area(p.areaHa)]
              .filter(Boolean).join(' · '),
            onclick: () => go(`C5:${p.id}`), deckTo: 'C5',
          })),
          when(can('plot.create', farm) && canDrawPlot(), () => row({
            iconName: 'plus',
            title: t('b11.addplot', 'Add a plot'),
            sub: t('b11.addplot.sub', 'Draw its boundary on the satellite image and name it'),
            onclick: () => startDrawPlot(farm.name),
          })),
          /* JOINING AND SPLITTING AFTER SIGN-UP — v1.7.3, and only "look
             into" so far. The satellite can count two or three plots where
             the farmer farms one, and until now the only place to join them
             was the survey result, once. This is the door: a request the
             Wafra team settles with him, because whether MMC can re-cut a
             plot after the survey is one of the questions for them. */
          when(can('plot.create', farm), () => row({
            iconName: 'split',
            title: t('b11.joinsplit', 'Join or split plots'),
            sub: t('b11.joinsplit.sub', 'If we counted two plots where you farm one, or one where you farm two'),
            onclick: () => toast(t('b11.joinsplit.sent', 'Request sent. The Wafra team will call you to join or split your plots.')),
          })))),

      field(t('b11.reportlang', 'Default language for reports'),
        select(['English', 'العربية', 'हिन्दी', 'বাংলা', 'پښتو'].map((v) => ({ value: v, label: v })),
          d.reportLang, (v) => { d.reportLang = v; commit('b11'); })),
      field(t('b11.contact', 'Primary contact'),
        select(state.db.team.map((m) => ({ value: m.name, label: `${m.name} · ${t(`role.${m.role}`, ROLE_LABEL[m.role] ?? m.role)}` })), d.contact,
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
        const soilChanged = d.soil !== raw.soil;
        Object.assign(raw, { name: d.name, region: d.region, soil: d.soil });
        if (soilChanged) raw.soilSource = 'farmer';
        toast(t('b11.saved', 'Farm settings saved'));
        commit('b11');
      },
    })),
  };
}

/* -- B10 · Manage workforce, WF8.003 / WF8.005 ----------------------------

   THE WORKFORCE CAME BACK, AND IT IS NOT WHAT WAS DELETED.

   §5.6 described worker RECORDS: accounts, roles, per-worker languages,
   invitations, a permission matrix, and a queue of jobs each man was answerable
   for. The v1.5.4 review deleted all of it on the grounds that a farm of five
   men will not run five logins, and nothing since has argued with that.

   What the Monday review asked for is a different object with the same name:
   "somewhere you get your library of team members." An advice is shared with
   somebody, and F9 routes each kind of advice to somebody, and neither can name
   a person the app has never been told about. So this is an address book — a
   name, a number and the app the man actually reads — and it is deliberately
   not an access-control screen:

     * NOBODY HERE HOLDS AN ACCOUNT. They receive a message with a link. The
       one exception is the supervisor, who may, and the row says so rather than
       offering a switch.
     * THERE ARE NO PERMISSIONS. There is nothing to permit: the app sends
       messages to these people and reads nothing back from them.
     * IT IS PER FARM, because that is the scope every other question on this
       tab is asked at, and a man who works two farms is on both lists.

   WF8.003's invitation survives as the row's own action for the supervisor
   alone; WF8.005's worker management is satisfied by the list rather than by
   the deleted screens. */

export function B10(farmId) {
  const farm = farmById(farmId);
  const people = membersOf(farm.id).filter((m) => !m.isYou);
  const owner = me();
  const access = (state.db.farmAccess ?? []).filter((a) => a.farmId === farm.id);
  const invites = (state.db.farmInvitations ?? []).filter((i) => i.farmId === farm.id && i.status === 'active');

  return {
    top: appBar({ title: t('b14.title', 'Manage workforce'), subtitle: farm.name }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('b14.intro', 'The people you send work to. They do not need the app — an advice reaches them as a message with a link.')),

      section(t('b14.access', 'People with app access'), {},
        card({}, access.map((a) => {
          const account = state.db.accounts?.find((x) => x.id === a.accountId);
          return row({ iconName: 'user', title: account?.name ?? account?.email ?? a.accountId,
            sub: a.role === 'primary-owner' ? t('b14.billing', 'Billing owner') : t(`role.${a.role}`, ROLE_LABEL[a.role] ?? a.role),
            chevron: false });
        })),
        when(invites.length, () => card({}, invites.map((invite) => row({
          iconName: 'qr', title: t('b14.pending', 'Pending invitation'),
          sub: t('b14.pending.sub', '{code} · expires {date}', { code: invite.code, date: date(invite.expiresAt) }),
          onclick: () => cancelFarmInvitation(invite.id), value: t('b14.cancel', 'Cancel'), chevron: false,
        })))),

        /* TWO WAYS TO SEND ONE INVITATION, AND THE OWNER PICKS BY WHERE THE
           OTHER PERSON IS STANDING.

           Review 21/09 settled the split that made A21 confusing: "If I'm
           sending an invite to someone remote, that's a six-digit code;
           face-to-face, sitting next to each other, that's a QR code." The two
           are not alternatives offered to the guest — they are answers to
           different situations, and the person who knows which situation it is
           is the one issuing the invitation, standing here.

           So the choice moved to this screen. A QR code is shown on this phone
           and read off it by the person beside you — "one phone shows, one
           phone scans", which is where review 06/09 put it and why the guest
           never has to find a scanner. An SMS carries the six digits to
           somebody who is not in the room, and A21 is where those digits are
           typed. The invitation itself is the same record either way. */
        when(can('member.invite', farm), () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          btn(t('b14.invite.qr', 'Invite in person'), {
            variant: 'secondary', icon: 'qr', align: 'start',
            sub: t('b14.invite.qr.sub', 'Show a QR code'),
            deckNote: 'Shows the code on this phone for the other person to scan',
            onclick: () => {
              const invite = createFarmInvitation(farm.id);
              if (invite) toast(t('b14.invite.qr.done', 'Show this screen to them: code {code}', { code: invite.code }));
            },
          }),
          btn(t('b14.invite.sms', 'Invite by SMS'), {
            variant: 'secondary', icon: 'phone', align: 'start',
            sub: t('b14.invite.sms.sub', 'Send a six-digit code'),
            deckNote: 'Sends the code to somebody who is not here',
            onclick: () => {
              const invite = createFarmInvitation(farm.id);
              if (invite) toast(t('b14.invite.sms.done', 'Code {code} sent by SMS', { code: invite.code }));
            },
          })))),

      section(t('b14.you', 'You'), {},
        card({}, row({
          iconName: 'user', chevron: false,
          // The session's role, not the record's: `me()` is an ACCOUNT now, and
          // an account holds no role — it holds access to farms (farmAccess).
          title: owner.name, sub: t(`role.${state.session.role}`, ROLE_LABEL[state.session.role]),
          value: h('span.chip__count', t('b14.owner', 'Owner')),
        }))),

      section(t('b14.people', 'On this farm'), {},
        people.length
          ? card({}, people.map((m) => row({
            iconName: 'user',
            title: m.name,
            sub: [m.phone, t(`channel.${m.channel ?? 'whatsapp'}`, CHANNEL_NAME[m.channel ?? 'whatsapp'])].filter(Boolean).join(' · '),
            onclick: can('member.invite', farm) ? () => openSheet('WORKER', { id: m.id, farmId: farm.id }) : null,
          })))
          : emptyState({
            iconName: 'users',
            title: t('b14.empty', 'Nobody on this farm yet'),
            body: t('b14.empty.body', 'Add the people you would ring about a job, and you can send them advice from the inbox.'),
          })),

      // WF8.003 — an invitation is one of the two things this screen does, and
      // it is the rarer one: most of these men will never open the app.
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('b14.note', 'One person may be invited to hold an account of their own, as your supervisor. Everyone else receives messages only.'),
        req('WF8.003', 'WF8.005'))),

    dock: can('member.invite', farm) ? actionDock(btn(t('b14.add', 'Add someone'), {
      variant: 'primary', icon: 'plus',
      onclick: () => openSheet('WORKER', { farmId: farm.id }),
    })) : null,
  };
}

export const CHANNEL_NAME = { whatsapp: 'WhatsApp', sms: 'SMS', telegram: 'Telegram' };
