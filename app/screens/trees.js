/* ---------------------------------------------------------------------------
   trees.js — B5 Tree group, B6 Tree detail.

   WF5.045 is the reason `missing` is a status in its own right in status.js and
   not an alias for urgent: "Missing and dead trees are shown as a distinct
   state with their own count, not folded into urgent."
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { t } from '../core/i18n.js';
import { openSheet } from '../core/router.js';
import {
  appBar, barAction, overflowAction, page, cardPad, row, btn, actionDock, healthScore,
  titledCard, kv, lockedRow, req,
} from '../ui/components.js';
import { num, pct, date, volume, monthName } from '../core/format.js';
import { countByStatus, statusLabel } from '../core/status.js';
import { farmById, treesOf, treeById, plotById } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { trendChart, axisLabels } from '../ui/charts.js';
import { statusColour, treeLocatorSvg, locatorSpan, M_PER_UNIT } from '../ui/map.js';
import {
  plotMap, scoreCard, adviceBlock, trendBlock, healthTrendBlock, irrigationTrendBlock,
  riskBlock, growthBlock, plotDock,
} from './plotparts.js';

/* -- B5 · Tree group, WF5.041 … WF5.046 ----------------------------------

   THE SAME SCREEN AS A CROP PLOT, BAR THE CROP CYCLE — v1.7.2. "Make sure we
   have the same widgets (except crop cycle) as with a crop page. Right now
   it's very empty." The blocks are plotparts.js's, in B2's order, and the one
   block that is the tree group's own sits after the score card: the trees that
   have recently stopped signalling, because replanting is something a farmer
   does about a group.

   "HEALTH OVERVIEW" IS THE SCORE CARD. It was three of the five metrics with a
   status triangle each; it is all five now, the same card as B2's, and its
   rows paint the map.
   ------------------------------------------------------------------------- */

export function B5(plotId) {
  const group = plotById(plotId);
  const farm = farmById(group.farmId);
  // The fixture samples one group; every other one is drawn from the same
  // sample so the screen is never blank on a farm whose trees were not sampled.
  const sample = treesOf(farm.id).filter((tr) => tr.plotId === group.id);
  const all = sample.length ? sample : treesOf(farm.id);
  const counts = countByStatus(all);

  return {
    top: appBar({
      title: group.shortName, subtitle: farm.name,
      actions: [barAction('search', t('action.search', 'Search'), () => openSheet('SEARCH'),
        { deckNote: 'Finds a tree by its number' })],
    }),
    body: page(
      plotMap(group),

      // Counted, not measured — the hectares its parcels happen to cover are
      // not what a tree group is priced on or advised per.
      h('div', { style: { color: 'var(--ink-600)' } },
        [group.cropName,
          t('farm.treecount', '{n} trees', { n: num(group.treeCount) }),
          (group.parcels ?? 1) > 1 ? t('b3.parcels', 'in {n} places on the farm', { n: num(group.parcels) }) : null,
        ].filter(Boolean).join(' · ')),

      scoreCard(group),

      /* THE ONE COUNT A FARMER CAN ACT ON (review 21/09): not urgent trees the
         app cannot name, but trees that were signalling last quarter and are
         not now — a palm to go and look at, and perhaps to replant. */
      titledCard(statusLabel('missing'), { aside: h('span.stat__num', num(scaleUp(counts.missing, all.length, group.treeCount))) },
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          t('b13.died.how', 'Worked out from the last two quarters: these trees were signalling, and have stopped.')),
        when(counts.missing > 0, () => btn(t('b13.died.list', 'See which trees'), {
          variant: 'secondary', size: 'sm', block: false,
          deckNote: 'Lists the trees that stopped signalling',
          onclick: () => openSheet('SEARCH'),
        })),
        req('WF5.045', 'WF5.059')),

      adviceBlock(group),
      trendBlock(group),
      healthTrendBlock(group),
      irrigationTrendBlock(group),
      riskBlock(group),
      growthBlock(group),
    ),

    // WF5.055 — nothing here creates work: the advice is the advisory's, and
    // the schedule is the plot's.
    dock: plotDock(group),
  };
}

/* The fixture holds a 60-tree sample; the farm has thousands. Scale the sample
   proportionally so the count reads against the real tree count. */
function scaleUp(count, sampleSize, total) {
  if (!sampleSize) return 0;
  return Math.round((count / sampleSize) * total);
}

/* -- B6 · Tree detail, WF5.044 / WF5.046 ----------------------------------

   REBUILT AT REVIEW 22/09: "we need to reorganise this screen a little bit.
   It's a lot of metrics randomly scattered."

   It was. The screen opened with a status chip, a percentage and a sentence
   floating on the page with no container round them, then the map, then SIX
   properties, then FIVE readings, then a chart of the first of those readings,
   then a log — five blocks, four of them lists of numbers, and nothing saying
   which question each answered.

   The order is a sequence of questions now, and every block is a card with its
   own title in it:

     where is it        the map, because picking tree 2841 out of eight thousand
                        is the hard part and it is why anyone opens this screen
     how is it          the status, the sentence, and the year behind it — the
                        score and its trend together, which is the same merge
                        review 21/09 asked for on B2
     what was measured  the four readings that are not the health score itself
     what it is         the record: species, age, where it stands, how big
     what has happened  the log

   TWO FIELDS WENT. The tree ID was the app bar's title printed again four
   inches below itself, and the coordinates were six decimal places nobody
   reads off a phone — the map above answers "which trunk" and the row and
   position answer it in words. */

export function B6(treeId) {
  const tree = treeById(treeId);
  const plot = plotById(tree.plotId);
  const farm = farmById(tree.farmId);
  const history = Array.from({ length: 12 }, (_, i) => ({
    date: `2025-${String(((i + 8) % 12) + 1).padStart(2, '0')}-01`,
    value: Math.max(4, Math.min(100, tree.health + (11 - i) * (tree.declining ? 4.2 : 0.7) + Math.sin(i) * 4)),
  }));

  return {
    top: appBar({
      title: tree.id, subtitle: `${plot.shortName} · ${t('b9.row', 'row {n}', { n: tree.row })}`,
      actions: [overflowAction(() => openSheet('TREE_MENU', { treeId: tree.id }), undefined,
        { deckNote: 'Replace, mark as removed, record a note' })],
    }),
    body: page(
      // Finding one tree among thousands is the whole problem on the ground, so
      // the map comes first. WF5.070 defines the interaction: the map centred on
      // the target, a line and a distance from where you are, and deliberately
      // not a routing engine.
      treeLocator(tree, plot),

      /* HOW THE TREE IS, AND THE YEAR BEHIND IT, IN ONE CARD. The score, the
         word for it and the twelve-month line were three separate things on
         three parts of the screen; they are one subject and they read as one
         only when they are in one box. */
      /* ONE VERDICT, NOT TWO. The old screen opened with a status chip and a
         percentage under it, and on this tree they disagreed — chip Monitor,
         score 43% urgent — because one comes off the record and the other off
         the reading. Side by side in one card that contradiction is the first
         thing anybody sees, so the score keeps it: it carries its own word. */
      titledCard(t('b13.measure.ndvi', 'Tree health'), { aside: healthScore(tree.health) },
        h('div', { style: { color: 'var(--ink-700)' } }, tree.note),
        h('div', { style: { marginTop: '4px' } },
          trendChart(history, { colour: tree.declining ? 'var(--st-urgent)' : 'var(--brand-600)', label: t('b13.measure.ndvi', 'Tree health') }),
          // Every other month of the twelve, named off the readings themselves.
          axisLabels(history.filter((_, i) => i % 2 === 0).map((p) => monthName(new Date(p.date).getUTCMonth()))),
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', marginTop: '4px' } },
            t('b10.trend', '12-month health')))),

      /* THE OTHER READINGS. Health is not among them any more — it is the card
         above, with its own trend, and listing it here as well was the same
         percentage printed twice on one screen. */
      titledCard(t('b10.measures', 'Measures'), { bleed: true },
        row({ title: t('b10.water', 'Water content'), value: healthScore(tree.water), chevron: false }),
        // WF5.046 — a measure outside the plan is listed and locked, never
        // omitted. It is called nutrient content, not chlorophyll: chlorophyll
        // is the thing the sensor measures, and nutrition is the thing the
        // farmer can do something about. Colour words are not farmer language.
        has('soil.nutrients')
          ? row({ title: t('b10.nutrients', 'Nutrient content'), value: num(tree.chlorophyll), chevron: false })
          : lockedRow('soil.nutrients', t('b10.nutrients', 'Nutrient content')),
        has('tree.health.full')
          ? row({ title: t('b10.canopystruct', 'Canopy structure'), value: t('b10.normal', 'Normal'), chevron: false })
          : lockedRow('tree.health.full', t('b10.canopystruct', 'Canopy structure')),
        has('ripeness')
          ? row({ title: t('b10.ripeness', 'Ripeness'), value: pct(tree.ripenessPct), chevron: false })
          : lockedRow('ripeness', t('b10.ripeness', 'Ripeness'))),

      // The record. What the tree IS, as opposed to how it is doing.
      titledCard(t('b10.about', 'This tree'), {}, kv([
        [t('b10.species', 'Species'), `${tree.species}${tree.variety ? ` — ${tree.variety}` : ''}`],
        // NO PLANTING YEAR ROW. Nothing in the data has ever carried one, so
        // every tree in the app printed "— · — years" — a row saying nothing,
        // twice. When the real record has a planting date it comes back.
        [t('b10.position', 'Position'), `${plot.name} · ${t('b9.row', 'row {n}', { n: tree.row })} · ${t('b10.pos', 'position {n}', { n: tree.position })}`],
        [t('b10.canopy', 'Canopy area'), `${num(tree.canopyM2, 1)} m²`],
      ])),

      titledCard(t('b10.history', 'History'), { bleed: true },
        row({ iconName: 'camera', title: t('b10.obs', 'Observation with 2 photos'), sub: t('b10.obs.sub', 'Dubas bug nymphs, east edge'), value: date('2026-07-28', { noYear: true, short: true }), chevron: false }),
        row({ iconName: 'droplet', title: t('b10.irrigated', 'Irrigation logged'), sub: t('b10.irrigated.sub', '{volume} across the plot', { volume: volume(480) }), value: date('2026-08-01', { noYear: true, short: true }), chevron: false }),
        row({ iconName: 'scissors', title: t('b10.pruned', 'Pruning completed'), sub: 'Bilal H.', value: date('2026-05-14', { noYear: true, short: true }), chevron: false }))),

    // WF5.058 — tree detail has no create-task action either.
    dock: actionDock(btn(t('b10.showme', 'Show me where'), {
      variant: 'primary', icon: 'map', onclick: () => openSheet('SHOW_WHERE', { treeId: tree.id }),
    })),
  };
}

/* -- "Find this tree", §5.7.1 --------------------------------------------- */

function treeLocator(tree, plot) {
  const granted = state.session.gpsGranted;
  const gps = granted ? state.session.gps : null;

  return titledCard(t('b10.find', 'Find this tree'), { bleed: true },
    h('div', {},
      h('div.mapbox', {
        style: { height: '196px' },
        onclick: () => openSheet('SHOW_WHERE', { treeId: tree.id }),
      },
      treeLocatorSvg({ plot, tree, gps }),
      // A scale bar sized from what the map is actually showing, so "how far is
      // that" is answerable from the picture as well as from the number below
      // it (WF2.013). The frame's full width is always visible, so this is exact.
      scaleBar(locatorSpan(plot))),

      cardPad(
        // WF2.014 — the legend names what each mark means. It sits below the map
        // rather than over it: the operator marker is pinned to whichever edge
        // they are beyond, so any overlay would sometimes cover the answer.
        h('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } },
          mapKey(statusColour(tree.status), tree.id),
          when(granted, () => mapKey('#2b78ff', t('b10.you', 'You'))),
          mapKey('rgba(120,132,126,.9)', t('b10.otherrows', 'Other trees')),
          req('WF5.086', 'WF5.087')),
        // The picture answers "which trunk" on its own — the marked tree, the
        // rows around it and where the operator is standing. A written direction
        // and a row/position pair underneath restated it in words and invited
        // the reading that this is a route, which it is not.
        //
        // WF4.036's rule for the boundary editor applies here: refusing location
        // must not take the screen away, only the parts of it that genuinely
        // need a position — here, the operator's own marker.
        when(!granted, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('div', { style: { color: 'var(--ink-600)' } },
            t('b10.nolocation', 'Location is turned off, so we can’t show where you are. The tree is still marked on the map.')),
          btn(t('b10.turnon', 'Use my location'), {
            variant: 'secondary', size: 'sm', icon: 'locate', block: false,
            onclick: () => { state.session.gpsGranted = true; commit('gps'); },
          }))))));
}

/** 40 m rule, drawn as a share of the frame width the SVG shows. */
function scaleBar(span) {
  const metresAcross = span * 2 * M_PER_UNIT;
  const barMetres = 40;
  return h('div', {
    style: {
      position: 'absolute', insetInlineStart: '10px', bottom: '10px',
      display: 'flex', flexDirection: 'column', gap: '3px',
      color: '#fff', fontSize: 'var(--t-micro)', fontWeight: 700, pointerEvents: 'none',
      textShadow: '0 1px 3px rgba(0,0,0,.65)',
    },
  },
  h('span', `${barMetres} m`),
  h('span', {
    style: {
      width: `${(barMetres / metresAcross) * 100}%`, minWidth: '26px', height: '3px',
      background: '#fff', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,.5)',
    },
  }));
}

function mapKey(colour, label) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-700)' } },
    h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: colour, flex: '0 0 auto' } }),
    h('span', label));
}
