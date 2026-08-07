/* ---------------------------------------------------------------------------
   trees.js — B9 Tree list, B10 Tree detail.

   WF5.045 is the reason `missing` is a status in its own right in status.js and
   not an alias for urgent: "Missing and dead trees are shown as a distinct
   state with their own count, not folded into urgent."
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, meter, divider, gate,
} from '../ui/components.js';
import { num, pct, date, area, NOW } from '../core/format.js';
import { countByStatus, statusLabel, STATUS, bySeverity } from '../core/status.js';
import { farmById, treesOf, treeById, plotsOf, plotById } from '../data/selectors.js';
import { has, lock } from '../core/entitlements.js';
import { trendChart, axisLabels, donut, proportionBar } from '../ui/charts.js';
import { statusColour, treeLocatorSvg, metresBetween, bearingBetween, locatorSpan, M_PER_UNIT } from '../ui/map.js';
import { createTask } from '../data/actions.js';

/* -- B9 · Tree list, WF5.041 … WF5.046 ------------------------------------- */

const TREE_FILTERS = [
  { id: 'attention', label: 'Action + Urgent' },
  { id: 'all', label: 'All trees' },
  { id: 'declining', label: 'Declining' },
  { id: 'missing', label: 'Missing / dead' },
  { id: 'good', label: 'Healthy' },
];

export function B9(farmId) {
  const farm = farmById(farmId);
  const ui = local(`b9-${farm.id}`, { filter: 'attention', plot: 'all', row: 'all', year: 'all' });
  const all = treesOf(farm.id);
  const counts = countByStatus(all);

  let list = all;
  if (ui.filter === 'attention') list = all.filter((tr) => ['action', 'urgent'].includes(tr.status));
  else if (ui.filter === 'declining') list = all.filter((tr) => tr.declining);
  else if (ui.filter === 'missing') list = all.filter((tr) => tr.status === 'missing');
  else if (ui.filter === 'good') list = all.filter((tr) => tr.status === 'good');
  if (ui.plot !== 'all') list = list.filter((tr) => tr.plotId === ui.plot);
  if (ui.row !== 'all') list = list.filter((tr) => String(tr.row) === ui.row);
  if (ui.year !== 'all') list = list.filter((tr) => String(tr.plantedYear) === ui.year);
  list = [...list].sort(bySeverity);

  const rows = ['good', 'watch', 'action', 'urgent'];
  const plots = plotsOf(farm.id);
  const years = [...new Set(all.map((tr) => tr.plantedYear))].sort();

  return {
    top: appBar({
      title: t('b9.title', 'Trees'), subtitle: farm.name,
      actions: [barAction('search', t('action.search', 'Search'), () => openSheet('SEARCH'))],
    }),
    body: page(
      h('div', { style: { color: 'var(--ink-600)' } },
        `${num(farm.treeCount)} ${t('farm.trees', 'trees').toLowerCase()} · ${all[0]?.species ?? ''}`),

      // WF5.041 — lead with the distribution.
      card({}, cardPad(
        h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center' } },
          donut(rows.map((k) => ({ value: counts[k], colour: statusColour(k) })), 104),
          h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' } },
            rows.map((k) => h('div.stat',
              statusIcon(k, 16), h('span', statusLabel(k)),
              h('span.stat__num', num(scaleUp(counts[k], all.length, farm.treeCount))),
              h('span', { style: { width: '46px', textAlign: 'end', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
                pct((counts[k] / all.length) * 100)))))),
        divider(),
        // WF5.045 — its own row, its own count.
        h('div.stat',
          statusIcon('missing', 16), h('span', statusLabel('missing')),
          h('span.stat__num', num(scaleUp(counts.missing, all.length, farm.treeCount))),
          req('WF5.059')))),

      // WF5.042 — filters: status, plot, row, species, planting year, declining.
      chips(TREE_FILTERS.map((f) => ({ id: f.id, label: t(`b9.filter.${f.id}`, f.label) })), ui.filter,
        (id) => { ui.filter = id; commit('b9'); }),
      h('div', { style: { display: 'flex', gap: '8px' } },
        select([{ value: 'all', label: t('b9.allplots', 'All plots') }, ...plots.map((p) => ({ value: p.id, label: p.name }))],
          ui.plot, (v) => { ui.plot = v; commit('b9'); }),
        select([{ value: 'all', label: t('b9.allyears', 'All years') }, ...years.map((y) => ({ value: String(y), label: String(y) }))],
          ui.year, (v) => { ui.year = v; commit('b9'); })),

      list.length
        ? list.map((tree) => treeRow(tree))
        : emptyState({
            iconName: 'tree', title: t('b9.empty.title', 'No trees match these filters'),
            body: t('b9.empty.body', 'Widen the filter to see more of the orchard.'),
            action: { label: t('b9.showall', 'Show all trees'), onclick: () => { ui.filter = 'all'; ui.plot = 'all'; ui.year = 'all'; commit('b9'); } },
          })),

    // WF5.055 — the tree list creates no tasks. Filtering to a condition —
    // four declining trees on P-02, seventy showing the same stress — is an
    // ANALYTICS view, and where those trees need work the advisory layer
    // raises it and the task is created there. This screen used to carry a
    // bulk "create one task for these 70 trees" button, and it was the last
    // exception left to §5.8.1.
    dock: null,
  };
}

/* The fixture holds a 60-tree sample; the farm has thousands. Scale the sample
   proportionally so the distribution reads against the real tree count. */
function scaleUp(count, sampleSize, total) {
  return Math.round((count / sampleSize) * total);
}

function treeRow(tree) {
  return card({ accent: tree.status, onclick: () => go(`B10:${tree.id}`) }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon(tree.status, 18),
      h('span', { style: { fontWeight: 650 } }, tree.id),
      h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        `${plotById(tree.plotId).name} · ${t('b9.row', 'row {n}', { n: tree.row })}`),
      h('span', { style: { marginInlineStart: 'auto', color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),
    h('div', { style: { display: 'flex', gap: '14px' } },
      h('span', `${t('b10.health', 'Health')} `, h('b', num(tree.health)),
        tree.healthDelta ? h('span', { style: { color: tree.healthDelta < 0 ? 'var(--st-urgent)' : 'var(--st-good)' } },
          ` ${tree.healthDelta < 0 ? '↓' : '↑'}`) : null),
      h('span', `${t('b10.water', 'Water')} `, h('b', num(tree.water)))),
    h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, tree.note)));
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
      title: tree.id, subtitle: `${plot.name} · ${t('b9.row', 'row {n}', { n: tree.row })}`,
      actions: [overflowAction(() => openSheet('TREE_MENU', { treeId: tree.id }))],
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
          // WF5.046 — a measure outside the plan is listed and locked, never omitted.
          has('tree.chlorophyll')
            ? row({ title: t('b10.chlorophyll', 'Chlorophyll'), value: num(tree.chlorophyll), chevron: false })
            : lockedRow('tree.health.full', t('b10.chlorophyll', 'Chlorophyll')),
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
  const metres = gps ? metresBetween(gps, tree.point) : null;
  const bearing = gps ? bearingBetween(gps, tree.point) : null;

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
          mapKey('rgba(120,132,126,.9)', t('b10.otherrows', 'Other trees'))),
        granted
          ? h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
              h('span.num', t('b10.metresaway', '{n} m away', { n: num(Math.round(metres)) })),
              h('span', { style: { color: 'var(--ink-600)' } },
                t('b10.direction', 'to the {dir}', { dir: t(`compass.${bearing}`, bearing) })),
              h('span', { style: { color: 'var(--ink-600)' } },
                `${t('b9.row', 'row {n}', { n: tree.row })} · ${t('b10.pos', 'position {n}', { n: tree.position })}`))
          // WF4.036's rule for the boundary editor applies here too: refusing
          // location must not take the screen away, only the parts of it that
          // genuinely need a position.
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              h('div', { style: { color: 'var(--ink-600)' } },
                t('b10.nolocation', 'Location is off, so we cannot show how far away you are. The tree is still marked on the map.')),
              btn(t('b10.turnon', 'Use my location'), {
                variant: 'secondary', size: 'sm', icon: 'locate', block: false,
                onclick: () => { state.session.gpsGranted = true; commit('gps'); },
              })),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('b10.straightline', 'A straight line and a distance, not turn-by-turn directions.'),
          req('WF5.087')))));
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
