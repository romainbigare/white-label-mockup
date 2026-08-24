/* ---------------------------------------------------------------------------
   home.js — B2 My farm, B11 Farm settings.

   ONE HOME SCREEN. B3 went at the v1.5.4 review, which merged the farm and its
   plot list; B1 went at the round after it, which pointed out that a list of
   farms is a picker and a picker belongs in the app bar. So B2 is the whole of
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
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, switchTab } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock,
  statusIcon, emptyState, req, field, input, select, disclaimer, deckMark, openMapChip,
} from '../ui/components.js';
import { area, num, date, NOW } from '../core/format.js';
import { bySeverity } from '../core/status.js';
import { visibleFarms, farmById, rawFarm, plotsOf } from '../data/selectors.js';
import { can } from '../core/capabilities.js';
import { farmIsPending } from '../core/entitlements.js';
import { mapSvg } from '../ui/map.js';
import { surveyTotals } from '../data/survey.js';
import { markSurveyReady, declareCrop } from '../data/actions.js';
import { startDrawPlot } from './onboarding.js';

/* URGENT IS THE ONLY THING WORTH SAYING, AND ONLY WHEN IT IS TRUE.

   The attention line used to count everything that was not Good, which on a
   farm of any size says something needs attention every day. Then it counted
   only the urgent — and still printed "Nothing urgent on this farm" on the
   mornings when there was nothing, which is a line of type spent telling the
   farmer that nothing has happened. Now it appears when something is wrong and
   is absent otherwise. */
const urgentCount = (plots) => plots.filter((p) => p.status === 'urgent').length;

/* -- B2 · My farm, WF5.012 … WF5.021 -------------------------------------- */

export function B2(farmId) {
  const farms = visibleFarms();
  const farm = farmById(farmId);
  const plots = sortPlots(plotsOf(farm.id));
  const crops = plots.filter((p) => p.kind !== 'trees');
  const groups = plots.filter((p) => p.kind === 'trees');
  const urgent = urgentCount(plots);
  const pending = farmIsPending(farm);

  // A farm mid-survey has no plots to list and a farm whose survey has come
  // back has a decision waiting; both own the screen until they are resolved.
  if (farm.survey?.state === 'surveying' || farm.survey?.state === 'ready') {
    return { top: farmBar(farm, farms), body: page(surveyState(farm)) };
  }

  return {
    top: farmBar(farm, farms),
    body: page(
      h('div.mapbox', { style: { height: '180px', borderRadius: 'var(--radius)' } },
        mapSvg({ plots, measure: 'ndvi', layers: { labels: plots.length <= 10 } }),
        openMapChip(() => { state.ui.farmFilter = farm.id; switchTab('map'); })),

      h('div', { style: { color: 'var(--ink-600)' } }, plotMetaLine(farm, plots)),

      // The one line that is allowed to raise its voice, and only when it has
      // something to raise it about.
      when(urgent, () => h('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650, color: 'var(--st-urgent)' },
      }, statusIcon('urgent', 20),
         h('span', t('b2.needing', '{n} plots need urgent attention', { n: num(urgent) })))),

      when(pending, () => h('div', { onclick: () => openModal('UPGRADE', { featureKey: 'tree.list' }) },
        disclaimer(t('b2.pending', 'This farm isn’t covered by your current plan. Its boundary is saved and your existing service isn’t affected — upgrade to the combined plan to see its analytics.'), true))),

      // Two blocks, because open field and trees are not the same thing and are
      // not read the same way. Crops first: they change, and the groups do not.
      // A LIST, NOT A CARD. The rows were inside a bordered, rounded, shadowed
      // box — which is a card containing eight rows that each already read as a
      // row, and the box added nothing but an edge. Hairlines between them are
      // the whole of the separation a list of plots needs.
      when(crops.length, () => section(t('b2.cropplots', 'Crops'), {},
        h('div.plotlist', crops.map((p) => plotLine(p))))),
      when(groups.length, () => section(t('b2.treegroups', 'Trees'), {},
        h('div.plotlist', groups.map((p) => plotLine(p))))),

      when(!plots.length, () => emptyState({
        iconName: 'grid',
        title: t('b3.empty.title', 'No plots in this farm yet'),
        body: t('b3.empty.body', 'Draw a boundary and we will start measuring it.'),
        action: can('plot.create', farm)
          ? { label: t('b3.empty.cta', 'Add a plot'), onclick: () => startDrawPlot(farm.name) }
          : null,
      })),

      section(t('b2.explore', 'Explore'), {},
        card({},
          when(can('report.view', farm), () => row({ title: t('f1.title', 'Reports'), iconName: 'document', onclick: () => go(`F1:${farm.id}`) })),
          when(can('farm.edit', farm), () => row({ title: t('b11.title', 'Farm settings'), iconName: 'settings', onclick: () => go(`B11:${farm.id}`) })))),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        req('WF5.012', 'WF5.018', 'WF5.019'))),
  };
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
    onTitleTap: () => openSheet('FARM_SWITCH', { current: farm.id }),
    titleHint: t('b2.switchfarm', 'Switch farm'),
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
   NOT A CARD, and that is the whole of the change. A plot used to be a boxed
   card with an accent stripe, a status icon, a status sentence, a reading and
   sometimes a button — eight of them down a screen, each shouting. It is a row
   now, and it says the four things the review asked for:

     the name · what is growing (a control) · the size · a way in

   The crop is a button rather than a label because correcting the crop is the
   job this screen exists for. It opens the cycle manager for an open field, and
   on a plot the satellite has watched being cleared it says so, in red, and
   offers the picker directly — there is no cycle to manage until the farmer
   says what is in the ground. */
function plotLine(plot) {
  const trees = plot.kind === 'trees';
  const awaiting = !!plot.harvestDetectedOn;

  return h('div.plotline',
    h('div.plotline__main',
      // The name and the size on ONE line. The size is a property of the plot
      // rather than a fact about it — it does not change and nobody scans for
      // it — so it belongs beside the name in a lighter weight, not on a line
      // of its own underneath.
      // A TREE GROUP IS COUNTED, NOT MEASURED. Its hectares are the ground its
      // parcels happen to cover, which is not what it is priced on, not what
      // the advice is calculated per, and not a number anybody quotes about an
      // orchard. An open field is the opposite: area is the whole of its size.
      h('div.plotline__head',
        h('span.plotline__name', plot.shortName),
        h('span.plotline__area', trees
          ? t('farm.treecount', '{n} trees', { n: num(plot.treeCount) })
          : area(plot.areaHa)),
        when(trees && (plot.parcels ?? 1) > 1, () => h('span.plotline__area',
          `· ${t('b3.places', 'in {n} places', { n: num(plot.parcels) })}`))),

      // The crop, as a control. A tree group's species does not change, so it
      // is a statement; an open field's does, so it is a button.
      trees
        ? h('div.plotline__crop.plotline__crop--fixed', icon('tree', 16), h('span', treeGroupLabel(plot)))
        : h('button.plotline__crop', {
          class: awaiting ? 'plotline__crop--empty' : '',
          type: 'button',
          onclick: () => (awaiting
            ? openSheet('CROP_PICKER', { onPick: (crop) => declareCrop(plot.id, crop) })
            : go(`B5:${plot.id}`)),
          ...deckMark(awaiting
            ? { deckNote: 'Names the crop that has just gone in' }
            : { deckTo: 'B5' }),
        },
        icon('sprout', 16),
        // ONE LINE. "Harvested — tell us what you planted" wrapped to two on a
        // 360 dp phone and made the tallest row on the screen the emptiest one.
        h('span', awaiting ? t('b2.tellus', 'Set the new crop') : plot.cropName),
        icon('chevronDown', 15))),

    h('button.plotline__go', {
      type: 'button',
      onclick: () => go(`${plot.kind === 'trees' ? 'B13' : 'B4'}:${plot.id}`),
      'aria-label': t('b2.openplot', 'Open {name}', { name: plot.shortName }),
      title: t('b2.openplot', 'Open {name}', { name: plot.shortName }),
      ...deckMark({ deckTo: trees ? 'B13' : 'B4' }),
    }, icon('forward', 22, 'flip')));
}

/* WHAT A TREE GROUP IS CALLED IN A LIST.

   Every row used to read "Date palm", because that is the crop record behind
   it — which on a farm of date palms is the same word eight times and tells the
   farmer nothing about which group he is looking at. The review asked for the
   labels to vary, and the honest variation is the CATEGORY the group belongs
   to: date palms are their own thing here commercially and agronomically, and
   everything else is a fruit tree.

   The group's own name — Olives, Citrus, Mangoes — is on the line above, so
   this is the second line's job: what KIND of planting it is. */
export function treeGroupLabel(plot) {
  return plot.species === 'date-palm'
    ? t('landuse.datepalms', 'Date palms')
    : t('landuse.fruittrees', 'Fruit trees');
}

/* Worst first, then by name, and no sort picker: four orderings for a list of
   eight rows was a control nobody used. */
function sortPlots(plots) {
  return [...plots].sort((a, b) => bySeverity(a, b) || a.name.localeCompare(b.name));
}

/* -- the two states a farm can be in before it has plots ------------------- */

function surveyState(farm) {
  if (farm.survey.state === 'ready') {
    const totals = surveyTotals(farm);
    return card({ accent: 'action', onclick: () => go(`A11:${farm.id}`) }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('action', 20),
        h('span', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, t('b1.ready.head', 'Your survey is ready')),
        h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${area(farm.areaHa)} · ${t('b1.ready.sub', '{n} areas found', { n: num(totals.areas.length) })}`),
      h('div', t('b1.ready', 'Your survey is ready. Confirm what we found.'))));
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

      /* THE "LAND" SECTION IS GONE, and one row of it survives as the thing it
         was hiding. It offered three doors — survey the whole farm, change what
         we watch, draw a plot by hand — under a heading that told the farmer
         nothing about which of them he wanted, and the review called it what it
         was: confusing. What a farmer opens Farm settings to do about his land
         is add a plot he has just cleared, so that is the row. Re-surveying is
         a support conversation, not a button on a settings page. */
      section(t('b11.plots', 'Plots'), {},
        card({},
          when(can('plot.create', farm), () => row({
            iconName: 'plus',
            title: t('b11.addplot', 'Add a plot'),
            sub: t('b11.addplot.sub', 'Draw its boundary on the satellite image and name it'),
            onclick: () => startDrawPlot(farm.name),
          })),
          row({
            iconName: 'grid',
            title: t('b11.seeplots', 'All plots on this farm'),
            value: num(plotsOf(farm.id).length),
            onclick: () => go(`B2:${farm.id}`),
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

