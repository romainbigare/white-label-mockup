/* ---------------------------------------------------------------------------
   trees.js — B9 Tree list, B10 Tree detail, B13 Harvest planning and yield.

   WF-243 is the reason `missing` is a status in its own right in status.js and
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
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, meter, divider, gate,
} from '../ui/components.js';
import { num, pct, date, area, NOW } from '../core/format.js';
import { countByStatus, statusLabel, STATUS, bySeverity } from '../core/status.js';
import { farmById, treesOf, treeById, plotsOf, plotById } from '../data/selectors.js';
import { has, lock } from '../core/entitlements.js';
import { trendChart, axisLabels, donut, proportionBar } from '../ui/charts.js';
import { statusColour } from '../ui/map.js';
import { createTask } from '../data/actions.js';

/* -- B9 · Tree list, WF-238 … WF-244 ------------------------------------- */

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
      actions: [
        // WF-242 — QR scanning is Tree Pro; on Basic the scanner is visible and locked.
        has('tree.qr')
          ? barAction('qr', t('b9.scan', 'Scan'), () => openModal('QR_SCAN', { kind: 'tree' }))
          : barAction('lock', t('b9.scan', 'Scan'), () => openModal('UPGRADE', { featureKey: 'tree.qr' })),
        barAction('search', t('action.search', 'Search'), () => openSheet('SEARCH')),
      ],
    }),
    body: page(
      h('div', { style: { color: 'var(--ink-600)' } },
        `${num(farm.treeCount)} ${t('farm.trees', 'trees').toLowerCase()} · ${all[0]?.species ?? ''}`),

      // WF-238 — lead with the distribution.
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
        // WF-243 — its own row, its own count.
        h('div.stat',
          statusIcon('missing', 16), h('span', statusLabel('missing')),
          h('span.stat__num', num(scaleUp(counts.missing, all.length, farm.treeCount))),
          req('WF-243')))),

      // WF-239 — filters: status, plot, row, species, planting year, declining.
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

    // WF-240 — one bulk action covering everything in the filtered list.
    dock: list.length ? actionDock(btn(
      t('b9.bulk', 'Create task for these {n} trees', { n: num(list.length) }),
      { variant: 'primary', icon: 'plus', onclick: () => go(`E3:trees=${farm.id}|${list.length}`) },
    )) : null,
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

/* -- B10 · Tree detail, WF-241 / WF-244 ---------------------------------- */

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
      actions: [barAction('dots', t('action.more', 'More'), () => openSheet('TREE_MENU', { treeId: tree.id }))],
    }),
    body: page(
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } },
        h('div', { style: { flex: 1 } },
          statusChip(tree.status, { large: true }),
          h('div', { style: { marginTop: '8px' } },
            h('span.bignum', num(tree.health)),
            h('span', { style: { color: 'var(--ink-500)' } }, ` / 100 ${t('b10.healthscore', 'health score')}`)),
          h('div', { style: { color: 'var(--ink-600)' } }, tree.note)),
        // WF-241 — the tree's QR code (Tree Pro).
        has('tree.qr')
          ? h('div.qr', qrSvg(tree.id))
          : h('button.lockbox', {
              onclick: () => openModal('UPGRADE', { featureKey: 'tree.qr' }),
              style: { width: '132px', padding: '14px 8px' },
            }, icon('lock', 22), h('span.lockbox__body', t('b10.qrlocked', 'QR code')))),

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
          // WF-244 — a measure outside the plan is listed and locked, never omitted.
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

    dock: actionDock(btn(t('e3.title', 'Create a task'), {
      variant: 'primary', icon: 'plus', onclick: () => go(`E3:tree=${tree.id}`),
    })),
  };
}

/* A deterministic pseudo-QR block. It is decoration, not a real code. */
function qrSvg(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = [];
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const ring = corner && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) || (x > 15 && x < 19 && y > 1 && y < 5) || (x > 1 && x < 5 && y > 15 && y < 19));
      const on = corner ? ring : ((hash >> ((x * 7 + y * 3) % 30)) & 1) === 1 && (x + y) % 3 !== 0;
      if (on) cells.push(h('rect', { x, y, width: 1, height: 1, fill: 'var(--ink-900)' }));
    }
  }
  return h('svg', { viewBox: '0 0 21 21', 'aria-hidden': 'true' }, cells);
}

/* -- B13 · Harvest planning and yield, WF-245 … WF-250 ------------------- */

const RIPENESS = [
  { id: 'ready', label: 'Ready', pct: 38, colour: 'var(--st-good)' },
  { id: 'near', label: 'Near ready', pct: 27, colour: 'var(--brand-400)' },
  { id: 'developing', label: 'Developing', pct: 31, colour: 'var(--st-watch)' },
  { id: 'immature', label: 'Immature', pct: 4, colour: 'var(--ink-300)' },
];

export function B13(farmId) {
  const farm = farmById(farmId);

  // WF-250 — where the plan does not include harvest planning, the entry point
  // is visible and locked. B2 already locks the row; this is the direct route.
  if (!has('harvest.planning')) {
    const info = lock('harvest.planning');
    return {
      top: appBar({ title: t('b13.title', 'Harvest'), subtitle: farm.name }),
      body: page(emptyState({
        iconName: 'lock', title: info.name, body: info.benefit,
        action: { label: t('locked.cta', 'See {plan} plan', { plan: info.plan }), onclick: () => openModal('UPGRADE', { featureKey: 'harvest.planning' }) },
      })),
    };
  }

  const plots = plotsOf(farm.id).filter((p) => p.treeCount > 0);
  const pickOrder = plots
    .map((p, i) => ({
      plot: p,
      readyPct: Math.max(6, 62 - i * 11),
      window: date(`2026-08-0${Math.min(9, 4 + i * 2)}`, { noYear: true }),
      tonnes: Math.round(p.treeCount * 0.152),
    }))
    .sort((a, b) => b.readyPct - a.readyPct)
    .slice(0, 5);

  const totalTonnes = plots.reduce((sum, p) => sum + p.treeCount * 0.0338, 0);

  return {
    top: appBar({ title: t('b13.title', 'Harvest'), subtitle: farm.name }),
    body: page(
      h('div', { style: { color: 'var(--ink-600)' } }, t('b13.season', 'Season 2026 · {crop}', { crop: plots[0]?.cropName ?? 'Date palm' })),

      // WF-245 — orchard and per tree, with a confidence range and last season.
      card({}, cardPad(
        h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, t('b13.estimated', 'Estimated yield')),
        h('div.bignum', t('b13.tonnes', '{n} tonnes', { n: num(totalTonnes, 0) })),
        h('div', { style: { color: 'var(--ink-600)' } },
          `± 12% · ${num(33.8, 1)} kg/${t('unit.tree', 'tree')}`),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          h('span', { style: { color: 'var(--ink-500)' } }, t('b13.lastseason', 'Last season')),
          h('span', { style: { fontWeight: 650 } }, t('b13.tonnes', '{n} tonnes', { n: num(totalTonnes * 0.918, 0) })),
          h('span', { style: { color: 'var(--st-good)', fontWeight: 700 } }, '↑ 9%')),
        req('WF-245'))),

      // WF-246 — ripeness as a proportion of the trees in each stage.
      section(t('b13.ripeness', 'Ripeness'), {},
        card({}, cardPad(
          proportionBar(RIPENESS.map((r) => ({ label: r.label, value: r.pct, colour: r.colour })), { height: '16px' }),
          RIPENESS.map((r) => meter(t(`b13.ripe.${r.id}`, r.label), r.pct, { colour: r.colour, text: pct(r.pct) }))))),

      // WF-247 — plots ranked by readiness, each with window, tonnage, tree count.
      section(t('b13.pickorder', 'Pick order'), {},
        card({}, pickOrder.map((entry, i) => h('button.row', { onclick: () => go(`B4:${entry.plot.id}`) },
          h('span', { style: { fontWeight: 750, color: 'var(--brand-700)', width: '18px' } }, String(i + 1)),
          h('div.row__main',
            h('div.row__title', `${entry.plot.name} · ${t('b13.ready', 'Ready {p}', { p: pct(entry.readyPct) })}`),
            h('div.row__sub', `${t('b13.tonnes', '{n} t', { n: num(entry.tonnes) })} · ${t('farm.treecount', '{n} trees', { n: num(entry.plot.treeCount) })}`)),
          h('span.row__value', `~${entry.window}`),
          h('span.row__chev', icon('forward', 20, 'flip')))))),

      // WF-249 — yield optimisation advice as one plain line above the action.
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-start' } },
        h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('advice', 20)),
        h('div',
          h('div', { style: { fontWeight: 600 } },
            t('b13.advice', 'Pick {plot} within 5 days. Ripeness is rising fastest on the east side.', { plot: pickOrder[0]?.plot.name ?? 'P-04' })),
          when(has('advisory.personalised'), () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('b13.learned', 'Based on three seasons on this farm'))))),

      disclaimer(t('advice.disclaimer', 'This is advice, not a prescription. Check conditions on the ground.'))),

    // WF-248 — one task per plot in the pick order, pre-filled.
    dock: actionDock(btn(t('b13.createtasks', 'Create harvest tasks'), {
      variant: 'primary', icon: 'basket',
      onclick: () => openModal('CONFIRM', {
        title: t('b13.createtasks', 'Create harvest tasks'),
        body: t('b13.createtasks.body', 'We will create {n} tasks — one per plot in the pick order — each with the estimated window as its due date and the tonnage in the description. You assign them and save.', { n: pickOrder.length }),
        confirmLabel: t('action.create', 'Create'),
        onConfirm: () => {
          pickOrder.forEach((entry, i) => createTask({
            title: t('b13.tasktitle', 'Harvest {plot}', { plot: entry.plot.name }),
            description: t('b13.taskdesc', 'About {n} tonnes from {trees} trees. Pick window around {w}.', {
              n: num(entry.tonnes), trees: num(entry.plot.treeCount), w: entry.window,
            }),
            type: 'harvest', farmId: farm.id, plotIds: [entry.plot.id],
            assigneeId: 'user-2', dueAt: `2026-08-0${Math.min(9, 4 + i * 2)}T15:00:00Z`,
            quantity: `${entry.tonnes} t`, priority: i === 0 ? 'high' : 'normal',
          }));
          go('E1');
        },
      }),
    })),
  };
}
