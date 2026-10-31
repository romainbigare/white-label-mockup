/* ---------------------------------------------------------------------------
   home.js — B1 My farm, B11 Farm settings, B10 Manage workforce.

   ONE HOME SCREEN. B3 went at the v1.5.4 review, which merged the farm and its
   plot list; B1 went at the round after it, which pointed out that a list of
   farms is a picker and a picker belongs in the app bar. So B1 is the whole of
   Home: the farm, its map, and every plot on it, with the farm name at the top
   left opening the list of the others and the way to add one.

   What this screen deliberately does NOT do any more, all of it asked for and
   each of it a block that used to be here:

     * No health summary per crop. The farm's health is three words under
       the map (farmScores(), v1.8), averages of the whole farm; how each
       plot is doing is on its own card.
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
import { go, openSheet, openModal, reachable } from '../core/router.js';
import { icon } from '../ui/icons.js';
import { cropIcon } from '../ui/cropIcons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock,
  statusIcon, statusChip, emptyState, req, field, input, select, deckMark, openMapChip, upgradeSheet, lockCopy,
  tile, pill, avatar, actionCard, segmented,
} from '../ui/components.js';
import { has, farmReadOnly, READ_ONLY_KEPT_MONTHS } from '../core/entitlements.js';
import { STATUS, statusLabel } from '../core/status.js';
import { area, num, date, NOW } from '../core/format.js';
import { visibleFarms, farmById, rawFarm, plotsOf, smallTreesOf, membersOf, me, farmMeasures, farmTotals, plotHealth, isMeasured, surveyState } from '../data/selectors.js';
import { can, ROLE_LABEL } from '../core/capabilities.js';
import { mapSvg } from '../ui/map.js';
import { reading } from '../ui/metric.js';
import { efficiencyBand } from '../core/health.js';
import { MIN_GROUP_TREES } from '../core/trees.js';
import { liveMap, liveMapAvailable } from '../ui/livemap.js';
import { markSurveyDone, createFarmInvitation, cancelFarmInvitation } from '../data/actions.js';
import { startDrawPlot, startRedraw, canDrawPlot, countChangeLine } from './onboarding.js';

/* -- B1 · My farm, WF5.012 … WF5.021 -------------------------------------- */

export function B1(farmId) {
  const farms = visibleFarms();
  const farm = farmById(farmId);
  const plots = plotsOf(farm.id);
  const small = smallTreesOf(farm.id);

  /* A LIVE MAP, fitted to the whole farm with its boundary and ground all
     round, which the farmer can drag and pinch out of (ui/livemap.js).

     THE METRIC, BUT NOT THE PICKER, since v1.7.3. "Pick a metric" stays on
     the map screen (C1) and nowhere else, so this card has no picker and no
     legend: it is painted with the metric chosen there — fields as coloured
     areas, tree groups as coloured outlines — and its one button, "View
     metrics", opens C1, where the legend and the choice are. */
  // No labels on this card: the plots are cards right under it, and the full
  // map (C1), one tap away, carries them.
  const farmMap = { plots, measure: state.ui.measure, layers: { labels: false } };
  /* A FARM WITH NO MEASURED SIZE HAS NO MAP AND NO HEALTH (Oct 2026): until
     MMC has measured it, or when it could not, the page is the survey card
     and the fields as drawn. */
  const measured = isMeasured(farm);

  return {
    top: farmBar(farm, farms),
    // A dense page: the farm's widgets keep their tighter corners (v1.8).
    body: page({ class: 'page--dense' },
      when(measured, () => h('div.mapbox.farmmap',
        liveMapAvailable()
          ? liveMap('B1', {
            ...farmMap,
            fitKey: farm.id, inPage: true,
          })
          : mapSvg(farmMap),
        // The full map, on this stack, with a way back to the farm.
        openMapChip(() => { state.ui.farmFilter = farm.id; go(`C1:${farm.id}`); }))),

      // A read-only farm says so, and for how long it is kept.
      readOnlyCard(farm),

      // The survey while it runs or when it failed, and the tree count when
      // it is in.
      surveyCard(farm),

      // The farm's own health, under its own heading.
      when(measured, () => farmScores(farm)),

      /* The "not covered by your current plan" banner of WF4.109 stood here,
         opening the upgrade to Combined. It went in Oct 2026 (two plans,
         decided with Wafra): a farm is never of "the other
         type" now — whatever is on it, the plan covers it. */

      // Every field, crops and trees, as a card — see plotCard().
      when(plots.length || small.length, () => section(t('b1.fields', 'Your crops and trees'), { sub: plotMetaLine(farm, plots) },
        when(plots.length, () => h('div.pgrid', plots.map((p) => plotCard(p, measured)))),
        when(small.length, () => smallTreesNote(small)))),

      when(!plots.length, () => emptyState({
        iconName: 'grid',
        title: t('b3.empty.title', 'No fields in this farm yet'),
        body: t('b3.empty.body2', 'Draw your fields on the map and we will start measuring them.'),
        action: can('plot.create', farm) && canDrawPlot()
          ? { label: t('b11.addfields', 'Add fields'), onclick: () => startDrawPlot(farm.id) }
          : null,
      })),

      /* THE REST OF THIS FARM, as five round shortcuts in one card (v1.7.4):
         planning next season and reading the year behind come first, the
         filing cabinet — reports, workforce, settings — after. */
      section(t('b2.more', 'More'), {}, quickBar(farm)),

      h('p.finetext', req('WF5.012', 'WF5.018', 'WF5.019'))),
  };
}

/* -- the farm's health ------------------------------------------------------

   TWO MEASURES OF THE WHOLE FARM, under their own heading, "Your farm
   health" (v1.8): farm health and irrigation efficiency. The yield forecast
   was a third column until Nov 2026 and has come off. Each is an average over
   the farm's plots (farmMeasures() in selectors.js):

     Farm health            plant health with growth and vigour, read on the
                            plant health scale (core/health.js)
     Irrigation efficiency  its own five bands (efficiencyBand)

   ONE CARD OF TWO COLUMNS, the measure's name on top and its verdict under
   it as a tinted chip. The verdict is the app's state word in the state's
   colours — Good, Watch or Urgent, the same three words as the plot cards
   under it; the warning sign goes with the bad one only. No percentage, like
   everywhere outside the plot page. A measure outside the plan keeps its
   column, with a lock and the plan's name in place of the word (WF9.033), and
   opens the upgrade sheet. */
function farmScores(farm) {
  const m = farmMeasures(farm.id);
  const health = reading('ndvi', m.health);
  const eff = efficiencyBand(m.efficiency);
  const effLabel = t('farmm.efficiency', 'Irrigation efficiency');
  return section(t('b1.health', 'Your farm health'), {},
    h('div.farmscores',
      farmScore(t('farmm.health', 'Farm health'), health?.status, health && statusLabel(health.status)),
      // Premium (Oct 2026): the column stays, with the plan's name in place
      // of the word.
      has('irrigation.efficiency')
        ? farmScore(effLabel, eff?.status, eff && statusLabel(eff.status))
        : lockedScore('irrigation.efficiency', effLabel)));
}

/** One farm measure: its name, then its verdict as a chip in its state's tone. */
function farmScore(label, status, word) {
  return h('div.farmscores__cell',
    h('span.farmscores__label', label),
    status
      ? pill(word, { tone: status, size: 'lg', iconName: status === 'urgent' ? STATUS.urgent.icon : null })
      : pill(t('status.nodata', 'No data'), { tone: 'nodata', size: 'lg' }));
}

/** A farm measure outside the plan: a lock and the plan's name, in the quiet
    grey of a measure the farmer does not have, opening the upgrade sheet. */
function lockedScore(featureKey, label) {
  return h('button.farmscores__cell.farmscores__cell--locked', { type: 'button', onclick: () => upgradeSheet(featureKey) },
    h('span.farmscores__label', label),
    h('span.farmscores__lock', icon('lock', 15), h('b', lockCopy(featureKey).plan)));
}

/* A TREE FIELD WITH FEWER THAN FORTY TREES IS COUNTED, NOT WATCHED (v1.7.4,
   and core/trees.js). It is not hidden — the farmer drew it, and a list that
   silently dropped it would look like the app lost it — but it is one quiet
   line, with no row, no advice and no schedule. */
function smallTreesNote(small) {
  return h('p.pgrid__note',
    t('b2.smallfields', 'Also counted: {list}. A field with fewer than {min} trees gets no advice or irrigation schedule.', {
      list: small.map((p) => t('b2.smallfield.one', '{plot}, {n} {species} trees', {
        plot: p.shortName, n: num(p.treeCount), species: (p.cropName ?? '').toLocaleLowerCase(),
      })).join('; '),
      min: num(MIN_GROUP_TREES),
    }));
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

/* Crop fields and tree fields counted separately, because they are not the
   same kind of thing and a single "8 plots" hid four of each behind one word. */
function plotMetaLine(farm, plots) {
  const crops = plots.filter((p) => p.kind !== 'trees').length;
  const groups = plots.filter((p) => p.kind === 'trees').length;
  return [
    area(farm.areaHa),
    crops === 1 ? t('farm.plotcount.one', '1 field') : crops ? t('farm.plotcount', '{n} fields', { n: num(crops) }) : null,
    groups === 1 ? t('farm.treefields.one', '1 tree field') : groups ? t('farm.treefields', '{n} tree fields', { n: num(groups) }) : null,
  ].filter(Boolean).join(' · ');
}

/** B1's shortcuts: an icon in a circle over a short word, all in one row. A
    shortcut to a feature the plan does not give stays in the row with a small
    lock, and opens the upgrade sheet instead (WF9.033). */
function quickBar(farm) {
  const items = [
    { label: t('b15.title', 'Crop planner'), iconName: 'calendar', to: 'B7', feature: 'crop.planner' },
    { label: t('b1.more.progress', 'Progress'), iconName: 'trend', to: 'B8' },
    can('report.view', farm) && { label: t('f1.title', 'Reports'), iconName: 'document', to: 'F3' },
    can('member.invite', farm) && { label: t('b1.more.workforce', 'Workforce'), iconName: 'users', to: 'B10' },
    can('farm.edit', farm) && { label: t('b1.more.settings', 'Settings'), iconName: 'settings', to: 'B11' },
  ].filter(Boolean);
  return h('div.quickbar', items.map((it) => {
    const locked = it.feature && !has(it.feature);
    return h('button.quickbar__item', {
      type: 'button',
      onclick: () => (locked ? upgradeSheet(it.feature) : go(`${it.to}:${farm.id}`)),
      ...deckMark({ deckTo: locked ? null : it.to }),
    },
    h('span.quickbar__icon', icon(it.iconName, 20),
      when(locked, () => h('span.quickbar__lock', icon('lock', 12)))),
    h('span.quickbar__label', it.label));
  }));
}

/* -- the field cards -------------------------------------------------------

   A GRID OF CARDS, TWO COLUMNS, SINCE v1.7.4. With the scores and the
   legend gone from this screen, a list of two-line rows left it mostly empty;
   a card per field fills it with the same few facts, larger. Fields and tree
   fields share one grid, in field number order, because trees are grouped by
   the field the farmer drew and are numbered like any other.

   A PICTURE OF THE CROP, then its name. Each card opens on the crop's own
   icon in a soft tile (ui/cropIcons.js) — green for a field crop, bark brown
   for trees, the same icon for every field of the same crop — with the
   field's name across from it, then the crop or species as the headline and
   the size or tree count under it.

   EVERY FIELD SAYS HOW IT IS DOING, in the app's three words (v1.7.4, Mark
   and Hani's review): Good, Watch or Urgent, the worst of its five
   indicators (plotHealth() in selectors.js), as one small status chip at
   the foot of the card, under the size (v1.8, the calm card) — and nothing
   more: no indicator names and no coloured edge, because a card two columns
   wide has room for the verdict and not its reasons. Where the field falls
   short is its scorecard, one tap away. A cleared field ("No crop"), a tree
   field still being counted and every field of a farm not measured yet carry
   no verdict; their foot stays, empty, so every card in a row keeps the same
   rhythm.

   ONE CARD, ONE PLACE TO GO: THE FIELD. The whole card is a single button
   that opens the field (B2, or B5 for trees), wherever it is pressed. A tree
   field still being counted, or any field of a farm that has not been
   measured, opens nothing yet, and says so. */
function plotCard(plot, measured) {
  const trees = plot.kind === 'trees';
  const awaiting = !trees && !!plot.harvestDetectedOn;
  const waiting = plot.counting || !measured;
  const health = awaiting || waiting ? null : plotHealth(plot);
  const open = plot.counting
    ? () => toast(t('count.notyet', 'We are still counting the trees in {plot}', { plot: plot.shortName }))
    : !measured
      ? () => toast(t('survey.notyet', 'We have not measured {plot} yet', { plot: plot.shortName }))
      : () => go(`${trees ? 'B5' : 'B2'}:${plot.id}`);
  // The crop's tile: green for a crop, bark for trees, dashed for a cleared
  // field, pulsing while the trees are counted.
  const tile = awaiting ? '.pcard__tile--empty' : plot.counting ? '.tone-tree.pcard__tile--counting' : trees ? '.tone-tree' : '.tone-brand';

  return h(`button.pcard${waiting ? '.pcard--waiting' : ''}`, {
    'data-health': health ?? null,
    type: 'button', onclick: open,
    'aria-label': t('b2.openplot', 'Open {name}', { name: plot.shortName }),
    ...deckMark(waiting ? {} : { deckTo: trees ? 'B5' : 'B2' }),
  },
  h('span.pcard__top',
    h(`span.tile${tile}`, awaiting ? icon('plus', 20) : cropIcon(plot.cropId, { trees, size: 24 })),
    h('span.pcard__num', plot.shortName)),
  plot.counting
    ? h('span.pcard__big', h('span.skeleton', t('count.label', 'Counting trees…')))
    : awaiting
      ? h('span.pcard__big.pcard__big--none', t('b1.nocrop', 'No crop'))
      : h('span.pcard__big', plot.cropName),
  // A tree field is counted, not measured; an open field the opposite.
  h('span.pcard__meta', trees && !plot.counting
    ? t('farm.treecount', '{n} trees', { n: num(plot.treeCount) })
    : area(plot.areaHa)),
  // How the field is doing, at the foot, under the size.
  h('span.pcard__status', when(health, () => statusChip(health, { small: true }))));
}

/* IN FIELD ORDER, AND NOTHING ELSE DECIDES IT — v1.7.2, and since v1.7.3 the
   order is the read layer's (plotsOf() in selectors.js): fields by number,
   trees among them. The list used to put the worst first, which moved a field
   up the screen the morning it went red; a farmer finds Field 4 where Field 4
   was yesterday now. */

/* -- the survey and the tree count ----------------------------------------

   THE SURVEY IS MMC MEASURING THE FARM — its fields and the trees in them —
   after it is paid for (Oct 2026, Wafra's answer to MMC). It does not take
   the screen over: the farm's fields are drawn and listed from the moment it
   is made. This one card says where it has got to:

     running   "Measuring your farm", with the tree fields shimmering, on the
               map and in the list, while they are counted;
     slow      the same, more than three hours on: "This is taking longer
               than usual" (surveyState() in selectors.js);
     failed    "We could not measure this farm", and the two ways on: Contact
               Wafra, and Redraw the fields — the one thing a supervisor may
               do here too (can('farm.boundary.edit'));
     counted   the trees are counted: check them and confirm the plan (A16,
               then A17), with what the count did to the price. */
function surveyCard(farm) {
  const survey = surveyState(farm);
  if (survey === 'failed') {
    return card({ accent: 'urgent' }, cardPad(
      h('div.cardline',
        tile('warning', { tone: 'urgent' }),
        h('div.cardline__main', h('div.cardline__title', t('survey.failed.head', 'We could not measure this farm')))),
      h('div.cardline__sub', t('survey.failed.body', 'The satellite could not measure your fields. Check that they are drawn in the right place and draw them again, or contact Wafra.')),
      h('div.btnrow',
        btn(t('f13.title', 'Contact Wafra'), { variant: 'secondary', size: 'sm', block: false, onclick: () => openModal('CONTACT') }),
        when(can('farm.boundary.edit', farm) && canDrawPlot(), () => btn(t('survey.redraw', 'Redraw'), {
          variant: 'secondary', size: 'sm', block: false, icon: 'polygon', deckTo: 'B9',
          onclick: () => startRedraw(farm.id),
        })))));
  }
  if (survey === 'running' || survey === 'slow') {
    return card({}, cardPad(
      h('div.cardline',
        h('span.tile.tone-tree.pcard__tile--counting', icon('scan', 22)),
        h('div.cardline__main', h('div.cardline__title', t('survey.head', 'Measuring your farm')))),
      when(survey === 'slow', () => h('div.noteline.tone-monitor', icon('clock', 16), t('survey.slow', 'This is taking longer than usual.'))),
      h('div.cardline__sub', t('survey.body', 'We are measuring your fields and counting your trees. It usually takes a few hours — we will let you know when it is done.')),
      // Nothing to wait for in a mockup, so there is a way past it.
      btn(t('b1.surveying.skip', 'See the result now'), {
        variant: 'secondary', size: 'sm',
        onclick: () => { markSurveyDone(farm.id); toast(t('survey.arrived', 'Your farm is measured')); },
      })));
  }
  if (farm.count?.state === 'ready') {
    // A16 is in the first-run series, which the exhibition edition does not
    // have: there the card says the count is in and goes nowhere.
    const open = reachable(`A16:${farm.id}`);
    return card({ accent: 'monitor', onclick: open ? () => go(`A16:${farm.id}`) : undefined }, cardPad(
      h('div.cardline',
        tile('tree', { tone: 'monitor' }),
        h('div.cardline__main',
          h('div.cardline__title', t('count.ready.head', 'Your trees are counted')),
          h('div.cardline__sub', t('farm.treecount', '{n} trees', { n: num(farmTotals(farm.id).treeCount) }))),
        when(open, () => h('span.row__chev', icon('forward', 20, 'flip')))),
      when(open, () => h('div', t('count.ready.body', 'Check the numbers and confirm your plan.'))),
      when(farm.count.change && farm.count.change !== 'same', () => h('div.subtext', countChangeLine(farm.count, farm.country)))));
  }
  return null;
}

/* A READ-ONLY FARM SAYS SO, AND FOR HOW LONG IT IS KEPT (Oct 2026). Its old
   results stay open to look at — for the owner, and for the co-owners and
   supervisors it is shared with — and nothing new arrives. The way out is
   the owner's: a plan for an ended trial, the new price for a count. */
function readOnlyCard(farm) {
  if (!farmReadOnly(farm)) return null;
  const trialOver = !farm.count || state.session.plan === 'trial_expired';
  return card({ accent: 'urgent' }, cardPad(
    h('div.cardline',
      tile('lock', { tone: 'lock' }),
      h('div.cardline__main', h('div.cardline__title', t('readonly.head', 'This farm is read-only')))),
    h('div.cardline__sub', trialOver
      ? t('readonly.trial', 'Your free trial has ended. You can still see this farm’s past results, the guides and Contact Wafra, but nothing new arrives.')
      : t('readonly.count', 'The new price after your tree count was not confirmed. You can still see this farm’s past results, but nothing new arrives.')),
    h('div.cardline__sub', t('readonly.kept', 'We keep a read-only farm for {n} months, then remove it.', { n: num(READ_ONLY_KEPT_MONTHS) })),
    when(can('subscription.manage'), () => (trialOver
      ? btn(t('readonly.plans', 'See the plans'), { variant: 'secondary', size: 'sm', block: false, onclick: () => openSheet('PLAN_CHOOSER') })
      : when(reachable(`A16:${farm.id}`), () => btn(t('a16.confirmplan', 'Confirm my plan'), {
        variant: 'secondary', size: 'sm', block: false, onclick: () => go(`A16:${farm.id}`),
      }))))));
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
      section(`${t('b11.plots', 'Fields')} · ${num(plotsOf(farm.id).length)}`, {},
        card({},
          ...plotsOf(farm.id).map((p) => row({
            iconName: p.kind === 'trees' ? 'tree' : 'sprout', tone: p.kind === 'trees' ? 'tree' : 'brand',
            title: p.shortName,
            sub: [p.kind === 'trees' ? t('farm.treecount', '{n} trees', { n: num(p.treeCount) }) : p.cropName, area(p.areaHa)]
              .filter(Boolean).join(' · '),
            onclick: () => go(`C5:${p.id}`), deckTo: 'C5',
          })),
          when(can('plot.create', farm) && canDrawPlot(), () => row({
            iconName: 'plus',
            title: t('b11.addfields', 'Add fields'),
            sub: t('b11.addfields.sub', 'Draw them on the map, and say what grows in each'),
            onclick: () => startDrawPlot(farm.id), deckTo: 'B9',
          })),
          /* JOINING AND SPLITTING AFTER SIGN-UP — v1.7.3, and only "look
             into" so far. The satellite can count two or three plots where
             the farmer farms one, and until now the only place to join them
             was the survey result, once. This is the door: a request the
             Wafra team settles with him, because whether MMC can re-cut a
             plot after the survey is one of the questions for them. */
          when(can('plot.create', farm), () => row({
            iconName: 'split',
            title: t('b11.joinsplit', 'Join or split fields'),
            sub: t('b11.joinsplit.sub', 'If we counted two fields where you farm one, or one where you farm two'),
            onclick: () => toast(t('b11.joinsplit.sent', 'Request sent. The Wafra team will call you to join or split your fields.')),
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
            iconName: 'trash', tone: 'urgent',
            onclick: () => openModal('DELETE_FARM', { farmId: farm.id }),
          })))),
      when(!can('farm.delete', farm), () => h('p.finetext',
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
  const ui = local(`b10-${farm.id}`, { inviteRole: 'supervisor' });

  return {
    top: appBar({ title: t('b14.title', 'Manage workforce'), subtitle: farm.name }),
    body: page(
      h('p.lead',
        t('b14.intro', 'The people you send work to. They do not need the app — an advice reaches them as a message with a link.')),

      section(t('b14.access', 'People with app access'), {},
        card({}, access.map((a) => {
          const account = state.db.accounts?.find((x) => x.id === a.accountId);
          const name = account?.name ?? account?.email ?? a.accountId;
          return row({ lead: avatar(name), title: name,
            sub: a.role === 'primary-owner' ? t('b14.billing', 'Billing owner') : t(`role.${a.role}`, ROLE_LABEL[a.role] ?? a.role),
            chevron: false });
        }),
        // A pending invitation waits in the same card, in the monitor wash,
        // with the way to withdraw it at its end.
        invites.map((invite) => row({
          lead: tile('clock', { tone: 'monitor', round: true }), title: t('b14.pending', 'Pending invitation'),
          sub: t('b14.pending.sub', '{code} · expires {date}', { code: invite.code, date: date(invite.expiresAt) }),
          onclick: () => cancelFarmInvitation(invite.id), value: h('span.row__value--danger', t('b14.cancel', 'Cancel')), chevron: false,
        }))),

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
           typed. The invitation itself is the same record either way.

           AND AS WHAT (Oct 2026): a co-owner, who sees and changes the farm,
           invites and sends advice on but does not pay, or a supervisor, who
           sees everything and only redraws a field (core/capabilities.js). The
           line under the choice says which is which. */
        when(can('member.invite', farm), () => [
          field(t('b14.invite.as', 'Invite as'),
            segmented(['co-owner', 'supervisor'].map((id) => ({ id, label: t(`role.${id}`, ROLE_LABEL[id]) })),
              ui.inviteRole, (id) => { ui.inviteRole = id; commit('b10'); }),
            { hint: ui.inviteRole === 'co-owner'
              ? t('b14.invite.coowner', 'Sees and changes the farm, invites people and sends advice on. Does not pay.')
              : t('b14.invite.supervisor', 'Sees everything on the farm, and can only redraw a field.') }),
          h('div.choicegrid',
            actionCard('qr', 'brand', t('b14.invite.qr', 'Invite in person'), t('b14.invite.qr.sub', 'Show a QR code'), () => {
              const invite = createFarmInvitation(farm.id, ui.inviteRole);
              if (invite) toast(t('b14.invite.qr.done', 'Show this screen to them: code {code}', { code: invite.code }));
            }, 'Shows the code on this phone for the other person to scan'),
            actionCard('phone', 'info', t('b14.invite.sms', 'Invite by SMS'), t('b14.invite.sms.sub', 'Send a six-digit code'), () => {
              const invite = createFarmInvitation(farm.id, ui.inviteRole);
              if (invite) toast(t('b14.invite.sms.done', 'Code {code} sent by SMS', { code: invite.code }));
            }, 'Sends the code to somebody who is not here'))])),

      section(t('b14.you', 'You'), {},
        card({}, row({
          lead: avatar(owner.name), chevron: false,
          // The session's role, not the record's: `me()` is an ACCOUNT now, and
          // an account holds no role — it holds access to farms (farmAccess).
          title: owner.name, sub: t(`role.${state.session.role}`, ROLE_LABEL[state.session.role]),
          // The owner — the one who pays.
          value: when(can('subscription.view'), () => pill(t('b14.owner', 'Owner'))),
        }))),

      section(t('b14.people', 'On this farm'), {},
        people.length
          ? card({}, people.map((m) => row({
            lead: avatar(m.name),
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
      h('p.finetext',
        t('b14.note2', 'The people you invite hold an account of their own, as a co-owner or a supervisor. Everyone else receives messages only.'),
        req('WF8.003', 'WF8.005'))),

    dock: can('member.invite', farm) ? actionDock(btn(t('b14.add', 'Add someone'), {
      variant: 'primary', icon: 'plus',
      onclick: () => openSheet('WORKER', { farmId: farm.id }),
    })) : null,
  };
}

export const CHANNEL_NAME = { whatsapp: 'WhatsApp', sms: 'SMS', telegram: 'Telegram' };
