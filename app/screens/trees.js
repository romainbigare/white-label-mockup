/* ---------------------------------------------------------------------------
   trees.js — B13 Tree group, B10 Tree detail.

   WF5.045 is the reason `missing` is a status in its own right in status.js and
   not an alias for urgent: "Missing and dead trees are shown as a distinct
   state with their own count, not folded into urgent."
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back, switchTab } from '../core/router.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip, deckMark,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, meter, divider, gate,
} from '../ui/components.js';
import { num, pct, date, area, NOW } from '../core/format.js';
import { countByStatus, statusLabel, STATUS, bySeverity } from '../core/status.js';
import { farmById, treesOf, treeById, plotById, measureByKey, adviceForPlot } from '../data/selectors.js';
import { has, lock } from '../core/entitlements.js';
import { trendChart, axisLabels, donut, proportionBar } from '../ui/charts.js';
import { statusColour, treeLocatorSvg, locatorSpan, mapSvg, M_PER_UNIT } from '../ui/map.js';

/* -- B13 · Tree group, WF5.041 … WF5.046 ----------------------------------

   THIS IS WHAT B9 BECAME, and the difference is the scope. B9 was every tree on
   a FARM — a list of eight thousand palms behind a plot filter, on a screen
   reached from a row called "Trees". The review folded it into the thing that
   now owns those trees: press a tree group in the plot list and you get the
   group, with its map, its readings, its health spread and its trees, in that
   order.

   The plot filter went with the change. A tree group IS the plot, so a filter
   asking which plot to look at had one answer. The variety filter stayed: a
   group of date palms holding Khalas and Sukkari is a real question, and it is
   the one filter a grower actually reaches for.
   ------------------------------------------------------------------------- */

/* WF5.054's status filter, on the group rather than the farm. */
const TREE_FILTERS = [
  { id: 'attention', label: 'Urgent + Planned' },
  { id: 'all', label: 'All trees' },
  { id: 'declining', label: 'Declining' },
  { id: 'missing', label: 'Missing / dead' },
  { id: 'good', label: 'Healthy' },
];

const GROUP_MEASURES = [
  // "Plant health" everywhere, including here. It read "Canopy health" on this
  // screen alone, which is the same measure under a second name — and a
  // translator handed one key and two English strings ships whichever rendered
  // first, in every language.
  { key: 'ndvi', label: 'Plant health' },
  { key: 'ndwi', label: 'Water stress' },
  { key: 'ndre', label: 'Nutrition status' },
];

export function B13(plotId) {
  const group = plotById(plotId);
  const farm = farmById(group.farmId);
  const ui = local(`b13-${group.id}`, { filter: 'attention', variety: 'all' });
  // The fixture samples one group; every other one is drawn from the same
  // sample so the screen is never blank on a farm whose trees were not sampled.
  const sample = treesOf(farm.id).filter((tr) => tr.plotId === group.id);
  const all = sample.length ? sample : treesOf(farm.id);
  const counts = countByStatus(all);
  const rows = ['good', 'watch', 'action', 'urgent'];

  let list = all;
  if (ui.filter === 'attention') list = all.filter((tr) => ['action', 'urgent'].includes(tr.status));
  else if (ui.filter === 'declining') list = all.filter((tr) => tr.declining);
  else if (ui.filter === 'missing') list = all.filter((tr) => tr.status === 'missing');
  else if (ui.filter === 'good') list = all.filter((tr) => tr.status === 'good');
  if (ui.variety !== 'all') list = list.filter((tr) => tr.variety === ui.variety);
  list = [...list].sort(bySeverity);

  const varieties = [...new Set(all.map((tr) => tr.variety))].filter(Boolean).sort();

  return {
    top: appBar({
      title: group.shortName, subtitle: farm.name,
      actions: [barAction('search', t('action.search', 'Search'), () => openSheet('SEARCH'),
        { deckNote: 'Finds a tree by its number' })],
    }),
    body: page(
      // WHERE THEY STAND. A group's whole reason for existing is that its trees
      // are not in one place, so the map comes first and draws every one of them.
      h('div.mapbox', { style: { height: '190px', borderRadius: 'var(--radius)' } },
        mapSvg({ plots: [group], measure: 'ndvi', layers: { labels: false, trees: true } }),
        h('button.mapchip.mapchip--quiet', {
          style: { position: 'absolute', insetInlineEnd: '6px', bottom: '2px' },
          onclick: () => { state.ui.farmFilter = farm.id; switchTab('map'); },
          ...deckMark({ deckTo: 'C1' }),
        }, t('b2.openmap', 'Open map'), icon('forward', 13, 'flip'))),

      // Counted, not measured — the hectares its parcels happen to cover are
      // not what a tree group is priced on or advised per.
      h('div', { style: { color: 'var(--ink-600)' } },
        [t('farm.treecount', '{n} trees', { n: num(group.treeCount) }),
          group.cropName,
          (group.parcels ?? 1) > 1 ? t('b3.parcels', 'in {n} places on the farm', { n: num(group.parcels) }) : null,
        ].filter(Boolean).join(' · ')),

      // WHAT THE SATELLITE READS OVER THEM. Three numbers, the same three the
      // farm screen used to average across crops and no longer does — here they
      // mean something, because a tree group is one crop by definition.
      section(t('b13.readings', 'What we can see from above'), {},
        card({}, GROUP_MEASURES.map((m) => {
          const reading = group.measures[m.key];
          const measure = measureByKey(m.key);
          if (!has(measure.featureKey)) return lockedRow(measure.featureKey, t(`measure.${m.key}`, m.label));
          return row({
            title: t(`measure.${m.key}`, m.label),
            sub: measure.technical,
            value: reading ? num(reading.value, 2) : t('b3.noreading', 'No reading yet'),
            chevron: false,
            statusKey: group.status,
          });
        }))),

      // WF5.041 — lead the tree half with the distribution.
      section(t('b13.health', 'How the trees are doing'), {},
        card({}, cardPad(
          h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center' } },
            donut(rows.map((k) => ({ value: counts[k], colour: statusColour(k) })), 104),
            h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' } },
              rows.map((k) => h('div.stat',
                statusIcon(k, 16), h('span', statusLabel(k)),
                h('span.stat__num', num(scaleUp(counts[k], all.length, group.treeCount))),
                h('span', { style: { width: '46px', textAlign: 'end', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
                  pct((counts[k] / all.length) * 100)))))),
          divider(),
          // WF5.045 — its own row, its own count. Missing is not urgent.
          h('div.stat',
            statusIcon('missing', 16), h('span', statusLabel('missing')),
            h('span.stat__num', num(scaleUp(counts.missing, all.length, group.treeCount))),
            req('WF5.059'))))),

      section(t('b13.trees', 'Every tree'), {},
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
          chips(TREE_FILTERS.map((f) => ({ id: f.id, label: t(`b9.filter.${f.id}`, f.label) })), ui.filter,
            (id) => { ui.filter = id; commit('b13'); }),
          when(varieties.length > 1, () => select(
            [{ value: 'all', label: t('b9.allvarieties', 'All varieties') },
              ...varieties.map((v) => ({ value: v, label: v }))],
            ui.variety, (v) => { ui.variety = v; commit('b13'); })),

          list.length
            ? list.map((tree) => treeRow(tree))
            : emptyState({
              iconName: 'tree', title: t('b9.empty.title', 'No trees match these filters'),
              body: t('b9.empty.body', 'Widen the filter to see more of the group.'),
              action: { label: t('b9.showall', 'Show all trees'), onclick: () => { ui.filter = 'all'; ui.variety = 'all'; commit('b13'); } },
            }))),
    ),

    // WF5.055 — the tree list creates no work. Filtering to a condition — four
    // declining trees, seventy showing the same stress — is an ANALYTICS view,
    // and where those trees need something the advisory layer raises it.
    dock: null,
  };
}

/* The fixture holds a 60-tree sample; the farm has thousands. Scale the sample
   proportionally so the distribution reads against the real tree count. */
function scaleUp(count, sampleSize, total) {
  return Math.round((count / sampleSize) * total);
}

/* Three things per row: which tree, how it is, and what has to be done to it.
   The last of those is the reason anyone opens this list — a status column with
   no action beside it tells a farmer he has a problem and nothing else. It is
   still an analytics view, so the row REPORTS the work rather than creating it
   (WF5.055); the advice that raised it came from the advisory. */
function treeRow(tree) {
  const jobs = adviceForPlot(tree.plotId);
  return card({ accent: tree.status, onclick: () => go(`B10:${tree.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon(tree.status, 18),
      h('span', { style: { fontWeight: 650 } }, tree.id),
      // The row and the position, and nothing else. The group is named in the
      // app bar above this list, so repeating it on every one of eight thousand
      // rows was the farm's name printed eight thousand times.
      h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${t('b9.row', 'row {n}', { n: tree.row })} · ${t('b9.pos', 'no. {n}', { n: tree.position })}`),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),
    h('div', { style: { display: 'flex', gap: '14px' } },
      h('span', `${t('b10.health', 'Health')} `, h('b', num(tree.health)),
        tree.healthDelta ? h('span', { style: { color: tree.healthDelta < 0 ? 'var(--st-urgent)' : 'var(--st-good)' } },
          ` ${tree.healthDelta < 0 ? '↓' : '↑'}`) : null),
      h('span', `${t('b10.water', 'Water')} `, h('b', num(tree.water)))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, tree.note),
    jobs.length
      ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
        jobs.slice(0, 2).map((a) => h('span.status.status--action',
          icon(ADVICE_ICON[a.type] ?? 'advice', 13), a.action)),
        when(jobs.length > 2, () => h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)', alignSelf: 'center' } },
          t('b9.morejobs', '+{n} more', { n: num(jobs.length - 2) }))))
      : h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('b9.nojobs', 'Nothing to do'))));
}

/* -- B10 · Tree detail, WF5.044 / WF5.046 ---------------------------------- */

export function B10(treeId) {
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
      h('div', {},
        statusChip(tree.status, { large: true }),
        h('div', { style: { marginTop: '8px' } },
          h('span.bignum', num(tree.health)),
          h('span', { style: { color: 'var(--ink-500)' } }, ` / 100 ${t('b10.healthscore', 'health score')}`)),
        h('div', { style: { color: 'var(--ink-600)' } }, tree.note)),

      // Finding one tree among thousands is the whole problem on the ground, so
      // the map comes before the record. WF5.070 defines the interaction: the map
      // centred on the target, a line and a distance from where you are, and
      // deliberately not a routing engine.
      treeLocator(tree, plot),

      section(t('b10.about', 'This tree'), {},
        card({}, cardPad(kv([
          [t('b10.id', 'Tree ID'), tree.id],
          [t('b10.species', 'Species'), `${tree.species}${tree.variety ? ` — ${tree.variety}` : ''}`],
          [t('b10.planted', 'Planted'), `${num(tree.plantedYear)} · ${t('b4.age', '{n} years', { n: num(2026 - tree.plantedYear) })}`],
          [t('b10.position', 'Position'), `${plot.name} · ${t('b9.row', 'row {n}', { n: tree.row })} · ${t('b10.pos', 'position {n}', { n: tree.position })}`],
          [t('b10.coords', 'Coordinates'), `${num(plot.lat, 4)}, ${num(plot.lon, 4)}`],
          [t('b10.canopy', 'Canopy area'), `${num(tree.canopyM2, 1)} m²`],
        ])))),

      section(t('b10.measures', 'Measures'), {},
        card({},
          row({ title: t('b10.health', 'Health'), value: num(tree.health), chevron: false }),
          row({ title: t('b10.water', 'Water content'), value: num(tree.water), chevron: false }),
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
            : lockedRow('ripeness', t('b10.ripeness', 'Ripeness')))),

      section(t('b10.trend', '12-month health'), {},
        card({}, cardPad(
          trendChart(history, { colour: tree.declining ? 'var(--st-urgent)' : 'var(--brand-600)', label: 'Tree health' }),
          axisLabels(['Sep', 'Nov', 'Jan', 'Mar', 'May', 'Jul'])))),

      section(t('b10.history', 'History'), {},
        card({},
          row({ iconName: 'camera', title: t('b10.obs', 'Observation with 2 photos'), sub: 'Dubas bug nymphs, east edge', value: date('2026-07-28', { noYear: true, short: true }), chevron: false }),
          row({ iconName: 'droplet', title: t('b10.irrigated', 'Irrigation logged'), sub: '480 m³ across the plot', value: date('2026-08-01', { noYear: true, short: true }), chevron: false }),
          row({ iconName: 'scissors', title: t('b10.pruned', 'Pruning completed'), sub: 'Bilal H.', value: date('2026-05-14', { noYear: true, short: true }), chevron: false })))),

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

  return section(t('b10.find', 'Find this tree'), {},
    card({},
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
