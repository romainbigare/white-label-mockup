/* ---------------------------------------------------------------------------
   overlays.js — bottom sheets and modal dialogs.

   The upgrade sheet is here and nowhere else. WF9.014 asks for "a single,
   consistent upgrade sheet", so every locked control in the app routes through
   openModal('UPGRADE', { featureKey }) and gets identical copy, drawn from the
   one table in entitlements.js.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc, LANGUAGES, setLanguage } from '../core/i18n.js';
import { go, closeOverlay, openModal, openSheet, switchTab } from '../core/router.js';
import { icon, TASK_ICON, ADVICE_ICON } from '../ui/icons.js';
import { logo } from '../ui/brand.js';
import {
  sheetShell, btn, row, card, cardPad, statusChip, statusIcon, kv, field, input,
  textarea, select, radioList, disclaimer, avatar, chips, divider, section, req, switchRow,
} from '../ui/components.js';
import { num, date, area, price, dateTime, dayLabel } from '../core/format.js';
import {
  plotById, farmById, visibleFarms, measures, measureByKey, membersOf, memberById, workerById, estates,
  adviceById, taskById, treeById, plotsOf, allVisiblePlots, rawPlot, rawFarm, assignees,
} from '../data/selectors.js';
import { lock, has, PLANS } from '../core/entitlements.js';
import { can, ROLE_LABEL } from '../core/capabilities.js';
import { blockTask, closeCropCycle, deferAdvice } from '../data/actions.js';
import {
  decidedAreas, LAND_USE, LAND_USE_META,
  setAreaKind, setAreaIncluded, splitArea, removeArea,
} from '../data/survey.js';
import { mapSvg, treeLocatorSvg, bearingBetween, metresBetween } from '../ui/map.js';
import { adviceCard } from './advice.js';
import { plotSheetBody } from './mapscreens.js';
import { detailRouteFor } from './plot.js';

export function renderOverlay(overlay) {
  const build = OVERLAYS[overlay.view];
  const content = build ? build(overlay.params ?? {}) : h('div.sheet', h('div.sheet__body', `No overlay "${overlay.view}"`));
  return h(`div.overlay${overlay.kind === 'modal' ? '.overlay--center' : ''}`, {
    onclick: (e) => { if (e.target === e.currentTarget) closeOverlay(); },
  }, content);
}

function modal(...children) {
  return h('div.modal',
    h('button.iconbtn.modal__close', { onclick: closeOverlay, 'aria-label': t('action.close', 'Close') }, icon('close', 22)),
    ...children);
}

function centrepiece(iconName, tone = 'brand') {
  const bg = { brand: 'var(--brand-050)', lock: 'var(--lock-bg)', warn: 'var(--st-action-bg)', danger: 'var(--st-urgent-bg)' }[tone];
  const fg = { brand: 'var(--brand-700)', lock: 'var(--lock)', warn: 'var(--st-action)', danger: 'var(--st-urgent)' }[tone];
  return h('div', {
    style: { width: '72px', height: '72px', borderRadius: '50%', background: bg, color: fg, display: 'grid', placeItems: 'center', alignSelf: 'center' },
  }, icon(iconName, 34));
}

export const OVERLAYS = {

  /* -- WF9.014: the one upgrade sheet ------------------------------------- */
  UPGRADE({ featureKey }) {
    const info = lock(featureKey);
    return modal(
      centrepiece('lock', 'lock'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } },
        t('upgrade.title', '{name} is part of the {plan} plan', { name: info.name, plan: info.plan })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } }, info.benefit),
      btn(t('upgrade.see', 'See the {plan} plan', { plan: info.plan }), {
        variant: 'primary', onclick: () => { closeOverlay(); openSheet('PLAN_CHOOSER'); },
      }),
      h('button.textlink', {
        onclick: () => { closeOverlay(); go('F6'); },
      }, `${t('a13.compare', 'Compare all features')} →`),
      req('WF9.034', 'WF9.035'));
  },

  /* -- WF11.004: an action that needs a connection ------------------------- */
  NEEDS_CONNECTION({ what }) {
    return modal(
      centrepiece('offline', 'warn'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('offline.title', 'You are offline')),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('offline.body', 'You need {what}. Everything you capture in the field still saves on your phone.', { what })),
      btn(t('action.ok', 'OK'), { variant: 'primary', onclick: closeOverlay }),
      req('WF11.004'));
  },

  CONFIRM({ title, body, confirmLabel, onConfirm, destructive }) {
    return modal(
      centrepiece(destructive ? 'warning' : 'info', destructive ? 'danger' : 'brand'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, title),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } }, body),
      btn(confirmLabel ?? t('action.confirm', 'Confirm'), {
        variant: destructive ? 'danger' : 'primary',
        onclick: () => { closeOverlay(); onConfirm?.(); },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }));
  },

  /* -- C3: the plot bottom sheet, WF5.061 --------------------------------- */
  C3({ plotId }) {
    const plot = plotById(plotId);
    // WF5.073 — one body, drawn here as a sheet and by C3 as a screen, so the
    // "no create-task action here" rule cannot hold in one and not the other.
    return sheetShell(null, ...plotSheetBody(plot, {
      onOpen: () => { closeOverlay(); go(`B4:${plot.id}`); },
    }));
  },

  /* -- pickers ------------------------------------------------------------ */

  MEASURE_PICKER({ onPick }) {
    return sheetShell(t('measure.picker', 'Choose a measure'),
      card({}, measures().map((m) => {
        const locked = !has(m.featureKey);
        return row({
          title: t(`measure.${m.key}`, m.plain),
          // WF5.018 — plain-language name first, technical name secondary.
          sub: `${m.technical} · ${m.help}`,
          locked,
          value: !locked && m.key === state.ui.measure ? icon('check', 20) : null,
          chevron: false,
          onclick: () => {
            if (locked) { closeOverlay(); openModal('UPGRADE', { featureKey: m.featureKey }); return; }
            state.ui.measure = m.key;
            onPick?.(m.key);
            closeOverlay();
          },
        });
      })),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('measure.note', 'The plain name is used everywhere in the app. The technical name appears in the map legend and in reports.'),
        req('WF5.022')));
  },

  FARM_PICKER({ onPick }) {
    const farms = visibleFarms();
    const groups = estates();
    return sheetShell(t('filter.farm', 'Which farm?'),
      card({},
        row({
          iconName: 'grid', title: t('filter.allfarms', 'All farms'), chevron: false,
          onclick: () => { onPick?.('all'); closeOverlay(); },
        }),
        // An estate is not the same request as "all farms": these three adjoin,
        // so they draw as one continuous map rather than three outlines on one
        // canvas.
        ...groups.map((group) => row({
          iconName: 'map',
          title: t('filter.estate', '{first} estate', { first: group[0].name }),
          sub: group.map((f) => f.name).join(' · '),
          chevron: false,
          onclick: () => { onPick?.(`estate:${group[0].id}`); closeOverlay(); },
        })),
        ...farms.map((f) => row({
          iconName: 'home', title: f.name, sub: f.region, chevron: false,
          onclick: () => { onPick?.(f.id); closeOverlay(); },
        }))));
  },

  PLOT_PICKER({ farmId, selected = [], onPick }) {
    const d = local(`plotpicker-${farmId}`, { ids: [...selected] });
    return sheetShell(t('e3.plots', 'Plots'),
      card({}, plotsOf(farmId).map((p) => row({
        title: p.name, sub: `${p.cropName} · ${area(p.areaHa, { bare: true })}`,
        statusKey: p.status, chevron: false,
        value: d.ids.includes(p.id) ? icon('check', 20) : null,
        onclick: () => {
          d.ids = d.ids.includes(p.id) ? d.ids.filter((x) => x !== p.id) : [...d.ids, p.id];
          commit('picker');
        },
      }))),
      btn(t('action.done', 'Done'), { variant: 'primary', onclick: () => { onPick?.(d.ids); closeOverlay(); } }));
  },

  /* -- WF5.144: assignee picker --------------------------------------------
     Two kinds of person, one list. App users have accounts and can open a task
     screen; §5.6 worker records have a phone number and a language and nothing
     else. WF5.138 lets a task go to either, so the picker cannot be a list of
     accounts — that would leave the people who actually do the work
     unassignable, which is the exact gap Workforce exists to close. */
  ASSIGNEE_PICKER({ farmId, onPick }) {
    const people = assignees(farmId);
    const members = people.filter((p) => p.kind === 'member');
    const workers = people.filter((p) => p.kind === 'worker');

    const personRow = (m) => h('button.row', {
      onclick: () => { onPick?.(m.id); closeOverlay(); },
    },
    avatar(initialsOf(m.name)),
    h('div.row__main',
      h('div.row__title', m.name),
      // WF5.100 — the language is on the row, because it is the part of "who
      // will get this" most likely to be wrong and least likely to be checked.
      h('div.row__sub', `${t(`role.${m.role}`, ROLE_LABEL[m.role] ?? m.role)} · ${m.language}`)),
    h('span.row__value', t('e3.opentasks', '{n} open', { n: num(m.openTasks) })),
    h('span.row__chev', icon('forward', 20, 'flip')));

    return sheetShell(t('e3.assignee', 'Assign to'),
      when(members.length, () => h('div',
        h('div.sheet__label', t('e3.withapp', 'They use the app')),
        card({}, members.map(personRow)))),
      when(workers.length, () => h('div',
        h('div.sheet__label', t('e3.withoutapp', 'They get a message')),
        card({}, workers.map(personRow)))),
      h('button.row', { onclick: () => { closeOverlay(); go(`G2:${farmId}`); } },
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('plus', 20)),
        h('div.row__main', h('div.row__title', t('g2.title', 'Add a worker'))),
        h('span.row__chev', icon('forward', 20, 'flip'))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('e3.onlyaccess', 'Only people on this farm are listed. Each is told in their own language.'),
        req('WF5.144', 'WF5.138')));
  },

    CROP_PICKER({ onPick }) {
    const d = local('croppicker', { query: '', category: 'all' });
    const cats = [{ id: 'all', label: t('crop.all', 'All') }, ...[...new Set(state.db.crops.map((c) => c.category))]
      .map((c) => ({ id: c, label: t(`crop.cat.${c}`, c.replace('-', ' ')) }))];
    const query = d.query.toLowerCase();
    // WF5.031 — searchable, grouped by category, last five used at the top.
    const recent = ['alfalfa', 'date-palm', 'wheat', 'potato', 'olive']
      .map((id) => state.db.crops.find((c) => c.id === id)).filter(Boolean);
    let list = state.db.crops;
    if (d.category !== 'all') list = list.filter((c) => c.category === d.category);
    if (query) list = list.filter((c) => c.name.toLowerCase().includes(query) || c.varieties.some((v) => v.toLowerCase().includes(query)));

    return sheetShell(t('b6.pickcrop', 'Choose a crop'),
      input({ type: 'search', placeholder: t('crop.search', 'Search crops and varieties'), value: d.query, oninput: (e) => { d.query = e.target.value; } }),
      chips(cats, d.category, (id) => { d.category = id; commit('crop'); }),
      when(!query && d.category === 'all', () => section(t('crop.recent', 'Recently used'), {},
        card({}, recent.map((c) => row({ title: c.name, sub: c.varieties.slice(0, 3).join(', '), chevron: false, onclick: () => { onPick?.(c); closeOverlay(); } }))))),
      card({}, list.map((c) => row({
        title: c.name, sub: c.varieties.slice(0, 3).join(', '), iconName: c.isTree ? 'tree' : 'sprout',
        chevron: false, onclick: () => { onPick?.(c); closeOverlay(); },
      }))));
  },

  LANG_PICKER() {
    return sheetShell(t('a1.title', 'Choose your language'),
      card({}, LANGUAGES.map((l) => row({
        title: h('span', { dir: l.dir }, l.native), sub: l.english,
        value: l.code === state.session.lang ? icon('check', 20) : null, chevron: false,
        onclick: () => { setLanguage(l.code); closeOverlay(); },
      }))));
  },

  /* -- menus -------------------------------------------------------------- */

  /* WF5.022 — the exact contents of the plot ⋮ menu. */
  PLOT_MENU({ plotId }) {
    const plot = plotById(plotId);
    const farm = farmById(plot.farmId);
    const item = (iconName, label, onclick, disabled) => row({
      iconName, title: label, chevron: false,
      onclick: disabled ? undefined : () => { closeOverlay(); onclick(); },
    });
    return sheetShell(plot.name,
      card({},
        when(can('plot.create', farm), () => item('edit', t('plotmenu.edit', 'Edit plot'), () => toast(t('plotmenu.edit.mock', 'Plot details would open here')))),
        when(can('farm.boundary.edit', farm), () => item('map', t('plotmenu.boundary', 'Edit boundary'), () => go(`C5:${plot.id}`))),
        when(can('cropcycle.manage', farm), () => item('sprout', t('plotmenu.cycle', 'Add crop cycle'), () => go(`B6:${plot.id}`))),
        item('camera', t('plotmenu.observation', 'Add observation'), () => go(`E6:plot=${plot.id}`)),
        item('share', t('plotmenu.share', 'Share plot summary'), () => toast(t('share.opened', 'Opening the share sheet…'))),
        // WF5.106 — no Create task here: advisory and the ADD button on E1 are
        // the only two places a task is made.
        // WF5.026 — Delete requires typing the plot name and is Owner-only.
        when(can('plot.delete', farm), () => item('trash', t('plotmenu.delete', 'Delete plot'), () => openModal('DELETE_PLOT', { plotId })))));
  },

  TREE_MENU({ treeId }) {
    const tree = treeById(treeId);
    return sheetShell(tree.id,
      card({},
        row({ iconName: 'map', title: t('e2.showme', 'Show me where'), chevron: false, onclick: () => openSheet('SHOW_WHERE', { treeId: tree.id }) }),
        row({ iconName: 'camera', title: t('plotmenu.observation', 'Add observation'), chevron: false, onclick: () => { closeOverlay(); go(`E6:plot=${tree.plotId}`); } }),
        when(can('tree.override'), () => row({
          iconName: 'edit', title: t('treemenu.override', 'Correct this tree’s record'),
          sub: t('treemenu.override.sub', 'Mark it as replanted, removed or misidentified'),
          chevron: false, onclick: () => { closeOverlay(); toast(t('treemenu.saved', 'Correction recorded')); },
        })),
        row({ iconName: 'share', title: t('treemenu.share', 'Share tree card'), chevron: false, onclick: () => { closeOverlay(); toast(t('share.opened', 'Opening the share sheet…')); } })));
  },

  TASK_MENU({ taskId }) {
    const task = taskById(taskId);
    return sheetShell(task.title,
      card({},
        row({ iconName: 'users', title: t('taskmenu.reassign', 'Reassign'), chevron: false, onclick: () => { closeOverlay(); openSheet('ASSIGNEE_PICKER', { farmId: task.farmId, onPick: (id) => { task.assigneeId = id; toast(t('taskmenu.reassigned', 'Reassigned')); commit('task'); } }); } }),
        row({ iconName: 'calendar', title: t('taskmenu.reschedule', 'Change the due date'), chevron: false, onclick: () => { closeOverlay(); toast(t('taskmenu.rescheduled', 'Due date updated')); } }),
        row({ iconName: 'close', title: t('taskmenu.cancel', 'Cancel this task'), chevron: false, onclick: () => { closeOverlay(); openModal('CONFIRM', { title: t('taskmenu.cancel', 'Cancel this task'), body: t('taskmenu.cancel.body', 'The person it is assigned to will be told.'), confirmLabel: t('action.confirm', 'Confirm'), destructive: true, onConfirm: () => blockTask(task, 'Cancelled by supervisor') }); } })));
  },

  /* WF5.096 — the two quieter of the card's four actions live here, with the
     rest of the per-item menu. WF5.097 gives the reminder no interval picker:
     the only option is tomorrow, so it is a row and not a submenu. */
  ADVICE_MENU({ adviceId }) {
    const a = adviceById(adviceId);
    return sheetShell(null,
      card({},
        when(a.status === 'open', () => row({
          iconName: 'clock',
          title: t('advice.remind', 'Remind me tomorrow'),
          chevron: false,
          onclick: () => { closeOverlay(); deferAdvice(adviceId, { asReminder: true }); },
        })),
        when(a.status === 'open', () => row({
          iconName: 'check',
          title: t('advice.complete', 'Mark as complete'),
          sub: t('advice.complete.sub', 'It is already done — record it without making a task'),
          chevron: false,
          onclick: () => { closeOverlay(); go(`D7:${adviceId}`); },
        })),
        row({ iconName: 'share', title: t('advicemenu.share', 'Share this advice'), chevron: false, onclick: () => { closeOverlay(); toast(t('share.opened', 'Opening the share sheet…')); } }),
        row({ iconName: 'document', title: t('advicemenu.log', 'How this was worked out'), chevron: false, onclick: () => { closeOverlay(); openSheet('ADVISORY_LOG', { adviceId }); } }),
        row({ iconName: 'map', title: t('advicemenu.plot', 'Open the plot'), chevron: false, onclick: () => { closeOverlay(); go(`B4:${a.plotIds[0]}`); } })),
      req('WF5.096', 'WF5.097'));
  },

  /* §5.7.1 — finding a tree in the field, WF5.085 … WF5.089. The control is on
     the map because that is where the farmer is standing; this sheet turns a
     tree id into a direction and a distance, and hands off to SHOW_WHERE, which
     already draws the locator for a task. */
  TREE_FINDER({ farmId }) {
    const d = local('treefinder', { q: '' });
    const q = d.q.trim().toUpperCase();
    const pool = state.db.trees.filter((tr) => tr.farmId === farmId);
    const matches = q ? pool.filter((tr) => tr.id.toUpperCase().includes(q)).slice(0, 6) : pool.slice(0, 4);
    const gps = state.session.gpsGranted ? state.session.gps : null;
    // Nearest by position — the tree the operator is TOUCHING, not the one they
    // are looking at.
    const nearest = gps
      ? [...pool].sort((a, b) => metresBetween(gps, a.point) - metresBetween(gps, b.point))[0]
      : null;

    return sheetShell(t('c1.findtree', 'Find a tree'),
      /* Two ways in, because the conditions that defeat one are exactly the
         conditions the other handles. Heading answers "which of those trees am
         I looking at" across an open planting; it cannot help in an old farm
         where young trees have been put in between the mature ones, the canopy
         has closed over and the spacing is irregular. There, the operator walks
         up and puts a hand on the trunk, and the question becomes "which tree
         am I touching" — which is a different question with a simpler answer. */
      when(nearest, () => btn(t('treefinder.here', 'I am standing at the tree'), {
        variant: 'primary', icon: 'tree',
        onclick: () => { closeOverlay(); go(`B10:${nearest.id}`); },
      })),
      when(!gps, () => disclaimer(
        t('treefinder.nogps', 'Turn location on and you can walk up to a tree and ask the app which one it is.'))),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } }),
        h('span', t('login.or', 'or')),
        h('span', { style: { flex: 1, height: '1px', background: 'var(--ink-200)' } })),
      input({
        type: 'search', value: d.q, autofocus: true,
        placeholder: t('treefinder.ph', 'T-2841'),
        oninput: (e) => { d.q = e.target.value; },
        onchange: () => commit('treefinder'),
      }),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('treefinder.hint', 'Type the number on the tree, or pick one that needs looking at.')),
      card({}, matches.map((tr) => row({
        iconName: 'tree', title: tr.id,
        sub: `${tr.plotId} · ${t('b9.row', 'row {n}', { n: tr.row })}`,
        chevron: false,
        onclick: () => openSheet('SHOW_WHERE', { treeId: tr.id }),
      }))),
      when(!matches.length, () => h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('treefinder.none', 'No tree with that number on this farm.'))),
      req('WF5.085', 'WF5.086', 'WF5.088'));
  },

  /* WF5.082 / WF5.083 — what the measure means, behind the info button, never
     as a paragraph laid over the map. */
  MEASURE_INFO({ key }) {
    const m = measureByKey(key);
    return sheetShell(t(`measure.${m.key}`, m.plain),
      h('p', { style: { margin: 0, color: 'var(--ink-700)' } }, tc(`measure.${m.key}.help`, m.help ?? m.plain)),
      h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('measureinfo.tech', 'Known technically as {tech}.', { tech: m.technical })),
      req('WF5.082'));
  },

  /* WF5.081 — the map search, which accepts a place, a farm, a plot, a crop or
     a tree id. One field, because a farmer looking for T-2841 should not first
     have to say what kind of thing it is. */
  MAP_SEARCH() {
    const d = local('mapsearch', { q: '' });
    const q = d.q.trim().toLowerCase();
    const plots = q ? allVisiblePlots().filter((p) => `${p.name} ${p.cropName}`.toLowerCase().includes(q)).slice(0, 6) : [];
    const trees = q ? state.db.trees.filter((tr) => tr.id.toLowerCase().includes(q)).slice(0, 4) : [];
    const farms = q ? visibleFarms().filter((f) => f.name.toLowerCase().includes(q)).slice(0, 4) : [];
    return sheetShell(t('c1.search', 'Search a place, farm, plot or tree'),
      input({
        type: 'search', value: d.q, autofocus: true,
        placeholder: t('mapsearch.ph', 'Al Kharj, P-04, date palm, T-2841…'),
        oninput: (e) => { d.q = e.target.value; },
        onchange: () => commit('mapsearch'),
      }),
      when(!q, () => h('p', { style: { margin: 0, color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('mapsearch.hint', 'A place name, an address, a pair of coordinates, or anything on your farms.'))),
      when(farms.length, () => card({}, farms.map((f) => row({
        iconName: 'home', title: f.name, chevron: false,
        onclick: () => { closeOverlay(); state.ui.farmFilter = f.id; commit('mapsearch'); },
      })))),
      when(plots.length, () => card({}, plots.map((p) => row({
        iconName: 'grid', title: p.name, sub: p.cropName, chevron: false,
        onclick: () => { closeOverlay(); go(`B4:${p.id}`); },
      })))),
      when(trees.length, () => card({}, trees.map((tr) => row({
        iconName: 'tree', title: tr.id, sub: tr.plotId, chevron: false,
        onclick: () => { closeOverlay(); go(`B10:${tr.id}`); },
      })))),
      req('WF5.081'));
  },

  /* WF5.091 — the plot operations the boundary editor owns. Available on any
     farm at any time, not only while a survey is being confirmed. */
  PLOT_SHAPE_MENU({ plotId }) {
    const plot = plotById(plotId);
    return sheetShell(t('c5.shape', 'This plot'),
      card({},
        row({
          iconName: 'split', title: t('a11.split', 'Split into two'),
          sub: t('c5.split.sub', 'One outline covering two things you work separately'),
          chevron: false,
          onclick: () => { closeOverlay(); toast(t('c5.split.done', 'Drag the new line, then save')); },
        }),
        row({
          iconName: 'grid', title: t('a11.join', 'Join with another plot'),
          sub: t('c5.join.sub', 'Two outlines you now work as one'),
          chevron: false,
          onclick: () => { closeOverlay(); openSheet('JOIN_PLOT_PICKER', { farmId: plot.farmId, exclude: plot.id }); },
        }),
        row({
          iconName: 'plus', title: t('a11.add', 'Add a plot'),
          sub: t('c5.add.sub', 'Land we missed, or new ground'),
          chevron: false,
          onclick: () => { closeOverlay(); go('A9D'); },
        }),
        row({
          iconName: 'trash', title: t('c5.remove', 'Remove this plot'),
          sub: t('c5.remove.sub', 'Its history is kept and stops being measured'),
          chevron: false,
          onclick: () => {
            closeOverlay();
            openModal('CONFIRM', {
              title: t('c5.remove.q', 'Remove {name}?', { name: plot.name }),
              body: t('c5.remove.body', 'It stops being measured and stops being charged for. Its history stays on the farm.'),
              confirmLabel: t('c5.remove.yes', 'Remove'),
              destructive: true,
              onConfirm: () => toast(t('c5.removed', '{name} removed', { name: plot.name })),
            });
          },
        })),
      req('WF5.091'));
  },

  JOIN_PLOT_PICKER({ farmId, exclude }) {
    const plots = plotsOf(farmId).filter((p) => p.id !== exclude);
    return sheetShell(t('c5.join', 'Join with which plot?'),
      card({}, plots.map((p) => row({
        iconName: 'grid', title: p.name, sub: p.cropName, chevron: false,
        onclick: () => { closeOverlay(); toast(t('c5.joined', 'Joined with {name}', { name: p.name })); },
      }))));
  },

  /* -- WF5.150: I cannot do this ------------------------------------------ */
  CANNOT_DO({ taskId }) {
    const task = taskById(taskId);
    const REASONS = [
      { id: 'nowater', label: t('cannot.nowater', 'No water available'), icon: 'droplet' },
      { id: 'pump', label: t('cannot.pump', 'The pump is not working'), icon: 'wrench' },
      { id: 'weather', label: t('cannot.weather', 'The weather stopped me'), icon: 'wind' },
      { id: 'access', label: t('cannot.access', 'I could not reach the plot'), icon: 'pin' },
      { id: 'material', label: t('cannot.material', 'I do not have what I need'), icon: 'basket' },
      { id: 'other', label: t('cannot.other', 'Something else'), icon: 'flag' },
    ];
    return sheetShell(t('cannot.title', 'What stopped you?'),
      card({}, REASONS.map((r) => row({
        iconName: r.icon, title: r.label, chevron: false,
        onclick: () => { blockTask(task, r.label); closeOverlay(); go('E1', { replace: true }); },
      }))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('cannot.note', 'We will tell the person who set this task straight away.'), req('WF5.149')));
  },

  /* -- WF5.070: show me where --------------------------------------------
     "the map centred on the target plot OR TREE". One sheet serves both, so a
     worker sent to a tree and a supervisor checking one see the same thing. */
  SHOW_WHERE({ taskId, treeId }) {
    const gps = state.session.gpsGranted ? state.session.gps : null;
    const tree = treeId ? treeById(treeId) : null;
    const task = tree ? null : taskById(taskId);
    const plot = tree ? plotById(tree.plotId) : (task.plotIds[0] ? plotById(task.plotIds[0]) : null);
    const farm = farmById(tree ? tree.farmId : task.farmId);
    const target = tree ? tree.point : plot?.centroid;

    return sheetShell(t('e2.showme', 'Show me where'),
      h('div.mapbox', { style: { height: '260px', borderRadius: 'var(--radius)' } },
        tree
          ? treeLocatorSvg({ plot, tree, gps })
          : h('div', { style: { position: 'absolute', inset: 0 } },
              mapSvg({
                plots: plot ? [plot] : plotsOf(farm.id), measure: 'ndvi',
                layers: { labels: true }, selectedId: plot?.id, gps,
              }))),
      card({}, cardPad(kv([
        [t('e2.target', 'Go to'), tree
          ? `${tree.id} · ${plot.name} · ${t('b9.row', 'row {n}', { n: tree.row })}`
          : (plot ? `${plot.name} · ${plot.cropName}` : farm.name)],
        // No distance, and no walking time either — the walk was only the
        // distance said a second way, and both invited a precision the app has
        // no business claiming among trees eight metres apart.
        gps ? [t('e2.direction', 'Direction'), t(`compass.${bearingBetween(gps, target)}`, bearingBetween(gps, target))] : null,
      ].filter(Boolean)))),
      when(!gps, () => disclaimer(
        t('e2.nolocation', 'Location is off, so we cannot tell you which way to walk. The target is still marked on the map.'))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('e2.notrouting', 'This shows you which tree, not the way to it.'), req('WF5.086')));
  },

  /* -- WF5.086 / WF6.017: editable assumptions ---------------------------- */
  ASSUMPTIONS({ adviceId }) {
    const a = adviceById(adviceId);
    const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
    // WF6.020 — the three assumptions a farmer may correct, read off the PLOT
    // because that is where they are stored and where the correction goes back.
    const d = local(`assump-${adviceId}`, {
      efficiency: String(plot?.irrigationEfficiencyPct ?? 85),
      soil: plot?.soil || 'Sandy loam',
      flow: String(plot?.flowRateM3h ?? ''),
    });
    return sheetShell(t('advice.assumptions', 'Assumptions we used'),
      field(t('assump.efficiency', 'Irrigation efficiency'),
        h('div.inputgroup.inputgroup--suffix', input({ type: 'number', value: d.efficiency, oninput: (e) => { d.efficiency = e.target.value; } }),
          h('span.input', { style: { width: '58px', display: 'grid', placeItems: 'center' } }, '%'))),
      field(t('a12.soil', 'Soil type'),
        select(['Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay'].map((v) => ({ value: v, label: v })), d.soil, (v) => { d.soil = v; commit('assump'); })),
      field(t('b4.flow', 'System flow rate'),
        h('div.inputgroup.inputgroup--suffix', input({ type: 'number', value: d.flow, oninput: (e) => { d.flow = e.target.value; } }),
          h('span.input', { style: { width: '68px', display: 'grid', placeItems: 'center' } }, 'm³/h'))),
      disclaimer(t('assump.note', 'These are saved against the plot, not against this one recommendation, and future advice is recalculated from them. The advice you are looking at now is kept as it was.')),
      btn(t('action.save', 'Save'), {
        variant: 'primary',
        onclick: () => {
          // WF6.020 — the correction is stored against the PLOT, not the advice.
          if (plot) {
            const rec = rawPlot(plot.id);
            rec.flowRateM3h = Number(d.flow) || rec.flowRateM3h;
            rec.irrigationEfficiencyPct = Number(d.efficiency) || rec.irrigationEfficiencyPct;
            rec.soil = d.soil;
          }
          toast(t('assump.saved', 'Saved. Future advice will use these.'));
          closeOverlay();
        },
      }),
      req('WF5.117', 'WF6.020'));
  },

  /* -- §6.3 the advisory log, as the user can see it -------------------- */
  ADVISORY_LOG({ adviceId }) {
    const a = adviceById(adviceId);
    return sheetShell(t('log.title', 'How this was worked out'),
      card({}, cardPad(kv([
        [t('log.rule', 'Rule version'), a.ruleVersion],
        [t('log.issued', 'Generated'), dateTime(a.issuedAt)],
        [t('log.language', 'Rendered in'), 'English'],
        [t('log.plots', 'Applies to'), a.plotNames.join(', ')],
        [t('log.crop', 'Crop'), a.cropName ?? '—'],
        [t('log.status', 'Status'), a.status],
      ]))),
      section(t('log.inputs', 'Inputs used, with their values'), {},
        card({}, (a.detail.why ?? []).map((w) => row({ title: w.label, value: w.value, chevron: false })))),
      disclaimer(t('log.writeonce', 'Every recommendation is written to a log the moment it is generated, before anyone sees it. The log can be added to but never changed or deleted, and it is kept for seven years.')),
      req('WF6.001', 'WF6.002', 'WF6.015', 'WF6.016'));
  },

  /* -- destructive confirmations ---------------------------------------- */

  DELETE_PLOT({ plotId }) {
    const plot = plotById(plotId);
    const d = local(`delplot-${plotId}`, { typed: '' });
    return modal(
      centrepiece('trash', 'danger'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('delplot.title', 'Delete {name}?', { name: plot.name })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('delplot.body', 'Its boundary, crop history and measurements go with it. This cannot be undone.')),
      field(t('delplot.type', 'Type {name} to confirm', { name: plot.name }),
        input({ value: d.typed, oninput: (e) => { d.typed = e.target.value; } })),
      btn(t('plotmenu.delete', 'Delete plot'), {
        variant: 'danger', disabled: d.typed.trim() !== plot.name,
        onclick: () => {
          state.db.plots = state.db.plots.filter((p) => p.id !== plotId);
          toast(t('delplot.done', 'Plot deleted'));
          closeOverlay();
          go(`B3:${plot.farmId}`, { replace: true });
        },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }));
  },

  DELETE_FARM({ farmId }) {
    const farm = farmById(farmId);
    const d = local(`delfarm-${farmId}`, { typed: '' });
    const old = true;   // WF5.040 — farms with >90 days of data need a second confirmation
    return modal(
      centrepiece('trash', 'danger'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('delfarm.title', 'Delete {name}?', { name: farm.name })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('delfarm.body', 'Every plot, boundary, crop cycle, task and report for this farm is lost. This cannot be undone.')),
      when(old, () => disclaimer(t('delfarm.second', 'This farm has more than 90 days of history, so we will ask you again in 24 hours before anything is removed.'), true)),
      field(t('delfarm.type', 'Type {name} to confirm', { name: farm.name }),
        input({ value: d.typed, oninput: (e) => { d.typed = e.target.value; } })),
      btn(t('b11.delete', 'Delete farm'), {
        variant: 'danger', disabled: d.typed.trim() !== farm.name,
        onclick: () => { closeOverlay(); toast(t('delfarm.queued', 'We will confirm with you again in 24 hours'), 'warn'); },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }));
  },

  /* -- WF5.148: delete my account ---------------------------------------- */
  DELETE_ACCOUNT() {
    return modal(
      centrepiece('trash', 'danger'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('delacct.title', 'Delete my account')),
      section(t('delacct.removed', 'What is deleted'), {},
        h('ul', { style: { margin: 0, paddingInlineStart: '20px', color: 'var(--ink-700)' } },
          [t('delacct.r1', 'Your name, mobile number and email'),
           t('delacct.r2', 'Your farms, boundaries and crop history'),
           t('delacct.r3', 'Photographs you have taken'),
           t('delacct.r4', 'Your subscription, at its next renewal')].map((x) => h('li', x)))),
      section(t('delacct.kept', 'What is kept'), {},
        h('ul', { style: { margin: 0, paddingInlineStart: '20px', color: 'var(--ink-700)' } },
          [t('delacct.k1', 'Advice records, for seven years, with your personal details removed'),
           t('delacct.k2', 'Work you completed on farms owned by someone else, attributed to a removed user')].map((x) => h('li', x)))),
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('delacct.timing', 'We create a deletion request and complete it within 30 days.')),
      btn(t('delacct.request', 'Request deletion'), {
        variant: 'danger',
        onclick: () => { closeOverlay(); toast(t('delacct.done', 'Deletion requested. We have emailed you the details.'), 'warn'); },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }),
      req('WF5.148'));
  },

  CLOSE_CYCLE({ plotId, cycleId }) {
    const plot = plotById(plotId);
    const cycle = plot.cropCycles.find((c) => c.id === cycleId);
    const d = local(`closecycle-${cycleId}`, { harvest: '2026-08-03', yield: '' });
    return modal(
      h('h2', { style: { margin: 0, fontSize: 'var(--t-title)' } }, t('closecycle.title', 'Close the {crop} cycle', { crop: cycle.cropName })),
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('closecycle.body', 'Record when it was harvested. The yield is optional. Closing a cycle never deletes it — it stays in this plot’s history.')),
      field(t('b6.actual', 'Harvest date'), input({ type: 'date', value: d.harvest, onchange: (e) => { d.harvest = e.target.value; } }), { required: true }),
      field(t('b6.actualyield', 'Actual yield'), input({ value: d.yield, placeholder: '6.1 t/ha', oninput: (e) => { d.yield = e.target.value; } })),
      btn(t('closecycle.confirm', 'Close the cycle'), {
        variant: 'primary',
        onclick: () => { closeCropCycle(cycle, d.harvest, d.yield); closeOverlay(); toast(t('closecycle.done', 'Cycle closed and kept in the history')); },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }),
      req('WF5.034', 'WF5.035'));
  },

  /* -- misc sheets -------------------------------------------------------- */

  SEARCH() {
    const d = local('search', { query: '' });
    const q = d.query.toLowerCase();
    // WF5.069 — farm name, plot name, crop name and tree ID.
    const farms = q ? visibleFarms().filter((f) => f.name.toLowerCase().includes(q)) : [];
    const plots = q ? allVisiblePlots().filter((p) => p.name.toLowerCase().includes(q) || p.cropName.toLowerCase().includes(q)) : [];
    const trees = q ? state.db.trees.filter((tr) => tr.id.toLowerCase().includes(q)) : [];
    const empty = q && !farms.length && !plots.length && !trees.length;

    return sheetShell(null,
      input({ type: 'search', placeholder: t('c1.search', 'Search farms, plots and trees'), value: d.query, oninput: (e) => { d.query = e.target.value; }, autofocus: true }),
      when(!q, () => h('p', { style: { margin: 0, color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        t('search.hint', 'Try a farm name, a plot like P-04, a crop like alfalfa, or a tree ID like T-2841.'))),
      when(farms.length, () => section(t('b1.myfarms', 'Farms'), {}, card({}, farms.map((f) => row({ title: f.name, statusKey: f.status, chevron: false, onclick: () => { closeOverlay(); go(`B2:${f.id}`); } }))))),
      when(plots.length, () => section(t('b3.title', 'Plots'), {}, card({}, plots.slice(0, 12).map((p) => row({ title: `${p.name} · ${farmById(p.farmId).name}`, sub: p.cropName, statusKey: p.status, chevron: false, onclick: () => { closeOverlay(); go(`B4:${p.id}`); } }))))),
      when(trees.length, () => section(t('b9.title', 'Trees'), {}, card({}, trees.slice(0, 12).map((tr) => row({ title: tr.id, sub: `${plotById(tr.plotId).name} · ${t('b9.row', 'row {n}', { n: tr.row })}`, statusKey: tr.status, chevron: false, onclick: () => { closeOverlay(); go(`B10:${tr.id}`); } }))))),
      when(empty, () => h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('search.none', 'Nothing matched “{q}”.', { q: d.query }))));
  },

  NOTIFICATIONS() {
    const items = [
      { icon: 'droplet', title: t('notif.1', 'Urgent: irrigate P-04 today'), sub: t('notif.1s', '693 m³. Soil moisture is low and 44 °C is forecast.'), when: '05:00', route: 'D2:adv-01' },
      { icon: 'cloud', title: t('notif.2', 'Do not spray Tuesday'), sub: t('notif.2s', 'Wind 28–34 km/h from 10:00.'), when: 'Yesterday', route: null },
      { icon: 'check', title: t('notif.3', 'Ahmed completed “Apply nitrogen P-07”'), sub: t('notif.3s', 'With one photo.'), when: '2 days ago', route: null },
      { icon: 'document', title: t('notif.4', 'Your weekly report is ready'), sub: t('notif.4s', 'Week 31 · 27 Jul – 2 Aug'), when: '3 days ago', route: null },
      // WF4.045 — the message that brings a farmer back after a survey.
      { icon: 'scan', title: t('notif.survey', 'Your farm survey is ready'), sub: t('notif.survey.s', 'Tabuk River Estate · confirm what we found'), when: '1 hour ago', route: 'A11:farm-6' },
    ];
    return sheetShell(t('notif.title', 'Notifications'),
      card({}, items.map((n) => row({
        iconName: n.icon, title: n.title, sub: n.sub, value: n.when,
        // WF7.007 — every notification opens the exact object it concerns.
        onclick: n.route ? () => { closeOverlay(); go(n.route); } : undefined, chevron: !!n.route,
      }))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('notif.deeplink', 'Every message opens the exact task, advice or report it is about — even from a cold start.'), req('WF7.007')));
  },

  REPORT({ reportId, custom }) {
    const report = state.db.reports.find((r) => r.id === reportId);
    return sheetShell(report?.title ?? t('f1.generate', 'Generate a report'),
      when(report, () => h('div', { style: { color: 'var(--ink-600)' } }, report.period)),
      h('div', {
        style: {
          height: '190px', borderRadius: 'var(--radius)', background: 'var(--paper)',
          border: '1px solid var(--ink-200)', display: 'flex', flexDirection: 'column',
          gap: '8px', padding: '16px', overflow: 'hidden',
        },
      },
      // WF5.132 — the letterhead is the label's, and only the label's.
      logo('lockup', 24),
      h('div.skeleton', { style: { height: '13px', width: '70%' } }),
      h('div.skeleton', { style: { height: '13px', width: '90%' } }),
      h('div.skeleton', { style: { height: '46px' } }),
      h('div.skeleton', { style: { height: '13px', width: '55%' } })),
      field(t('f1.language', 'Language'),
        select(LANGUAGES.map((l) => ({ value: l.code, label: l.english })), state.session.lang, (v) => setLanguage(v))),
      // WF5.130 — shareable through the OS share sheet.
      h('div', { style: { display: 'flex', gap: '8px' } },
        btn(t('f1.pdf', 'Download PDF'), { variant: 'primary', block: false, icon: 'download', onclick: () => { closeOverlay(); toast(t('f1.downloading', 'Generating your PDF…')); } }),
        btn(t('action.share', 'Share'), { variant: 'secondary', block: false, icon: 'share', onclick: () => { closeOverlay(); toast(t('share.opened', 'Opening the share sheet…')); } })),
      when(custom, () => btn(t('f1.excel', 'Export to Excel'), { variant: 'ghost', icon: 'document', onclick: () => { closeOverlay(); toast(t('f1.excel.done', 'Excel export queued')); } })),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('f1.serverside', 'Produced on our servers, never assembled on your phone, and carrying Wafra branding only.'), req('WF5.162', 'WF5.163')));
  },

  /* WF4.081 … WF4.083 — everything the farmer can do to one surveyed area.
     Reclassifying and including are cheap corrections; redrawing the outline is
     the expensive one, and it used to be refused outright — the old screen told
     the farmer to exclude the bad shape and draw it again from scratch, which
     is two more screens to fix a corner in the wrong place. */
  AREA_EDIT({ farmId, areaId }) {
    const farm = rawFarm(farmId);
    const area = decidedAreas(farm).find((a) => a.id === areaId);
    if (!area) return sheetShell(t('areaedit.title', 'Edit this area'));
    const done = () => { closeOverlay(); commit('areaedit'); };

    return sheetShell(t('areaedit.title', 'Edit this area'),
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('areaedit.lead', 'Area {label} — we read it as {kind}.', {
          label: area.label, kind: t(`landuse.${area.kind}`, area.kind),
        })),

      section(t('areaedit.kind', 'What is it?'), {},
        card({}, LAND_USE.map((kind) => row({
          iconName: LAND_USE_META[kind].icon,
          title: t(`landuse.${kind}`, kind),
          onclick: () => { setAreaKind(farm, areaId, kind); done(); },
          chevron: false,
          value: kind === area.kind ? t('areaedit.current', 'Now') : null,
        })))),

      section(t('areaedit.shape', 'Its outline'), {},
        card({},
          // WF4.082 — the same interaction as A9 and C5, on the shape the
          // survey drew.
          row({
            iconName: 'edit',
            title: t('areaedit.redraw', 'Redraw the outline'),
            sub: t('areaedit.redraw.sub', 'Tap to add a corner, drag to move one'),
            // A surveyed area is not a plot yet, so it cannot be addressed by a
            // plot id — C5 takes an explicit area target instead.
            onclick: () => { closeOverlay(); go(`C5:area=${farmId}|${areaId}`); },
          }),
          row({
            iconName: 'split',
            title: t('a11.split', 'Split'),
            sub: t('areaedit.split.sub', 'We read two parcels as one'),
            onclick: () => { splitArea(farm, areaId); done(); },
          }),
          row({
            iconName: 'trash',
            title: t('a11.remove', 'Remove'),
            sub: t('areaedit.remove.sub', 'It is not part of this farm'),
            onclick: () => { removeArea(farm, areaId); done(); },
          }))),

      btn(area.included ? t('a11.exclude', 'Leave out') : t('a11.include', 'Put back'), {
        variant: 'secondary',
        onclick: () => { setAreaIncluded(farm, areaId, !area.included); done(); },
      }),
      req('WF4.081', 'WF4.082', 'WF4.083'));
  },

  PLAN_CHOOSER() {
    const options = Object.entries(PLANS).filter(([id]) => id !== 'trial_expired');
    return sheetShell(t('plan.choose', 'Choose a plan'),
      card({}, options.map(([id, p]) => row({
        title: p.label,
        sub: SUPPLIER_LABEL(id),
        value: id === state.session.plan ? icon('check', 20) : null,
        chevron: false,
        onclick: () => { state.session.plan = id; toast(t('plan.changed', 'Now on {plan}', { plan: p.label })); closeOverlay(); },
      }))),
      disclaimer(t('plan.iap', 'In the real app this opens Apple In-App Purchase or Google Play Billing. Payment never happens anywhere else.')),
      req('WF5.176'));
  },

  /* Invitations only — see §4.1. Trees are found by row and position, and by
     the locator map on B10, not by a code on the trunk. */
  QR_SCAN() {
    return sheetShell(t('qr.title', 'Scan a code'),
      h('div', {
        style: {
          aspectRatio: '1', borderRadius: 'var(--radius)', background: 'var(--ink-900)',
          display: 'grid', placeItems: 'center', color: '#fff', position: 'relative',
        },
      }, icon('scan', 68),
         h('div', {
           style: {
             position: 'absolute', inset: '18%', border: '3px solid rgba(255,255,255,.7)',
             borderRadius: 'var(--radius)',
           },
         })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('qr.invite', 'Point the camera at the code on the other phone.')),
      btn(t('qr.simulate', 'Simulate a scan'), {
        variant: 'primary',
        onclick: () => { closeOverlay(); toast(t('qr.joined', 'Invitation accepted')); },
      }));
  },

  /* WF4.007 — four delivery routes, all carrying the SAME single-use token:
     WhatsApp, SMS, a six-character code read aloud, and this QR on the owner's
     screen. The code is bound to the worker record it was issued from, so
     redeeming it attaches the person to the history the owner already built for
     them rather than creating a second, empty identity. */
  QR_SHOW({ code, workerId }) {
    const worker = workerId ? workerById(workerId) : null;
    return sheetShell(t('g3.sendcode', 'Send them the code'),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' } },
        h('div.qr', { style: { width: '190px', height: '190px' } }, qrPattern(code)),
        h('div', { style: { fontSize: 'var(--t-hero)', fontWeight: 750, letterSpacing: '.14em' } }, code)),
      when(worker, () => h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-700)' } },
        t('g3.codefor', 'For {name}, on {phone}', { name: worker.name, phone: `${worker.dial} ${worker.phone}` }))),
      h('div', { style: { display: 'flex', gap: '8px' } },
        btn(t('g3.sendwhatsapp', 'WhatsApp'), { variant: 'primary', size: 'sm', block: false, icon: 'whatsapp', onclick: () => { closeOverlay(); toast(t('g3.codesent', 'Code sent')); } }),
        btn(t('g3.sendsms', 'SMS'), { variant: 'secondary', size: 'sm', block: false, onclick: () => { closeOverlay(); toast(t('g3.codesent', 'Code sent')); } })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('g3.qrnote', 'Single use, expires in 7 days, and grants Worker access to this farm only. They keep the work already recorded against them.')),
      req('WF4.006', 'WF4.007', 'WF5.067'));
  },

  CONTACT_PREVIEW({ channel }) {
    const isWhatsApp = channel === 'whatsapp';
    return sheetShell(isWhatsApp ? t('f13.whatsapp', 'WhatsApp us') : t('f13.email', 'Email us'),
      card({}, cardPad(kv([
        [isWhatsApp ? t('contact.number', 'Number') : t('contact.address', 'Address'),
          isWhatsApp ? '+966 54 810 0443' : 'info@wafragreen.com'],
        [t('contact.prefilled', 'We will include'), t('contact.diag', 'Your account reference, the app version and the screen you were on')],
        [t('contact.version', 'App version'), 'v1.0.0 (build 214)'],
      ]))),
      btn(isWhatsApp ? t('contact.open.whatsapp', 'Open WhatsApp') : t('contact.open.mail', 'Open your mail app'), {
        variant: 'primary', onclick: () => { closeOverlay(); toast(t('contact.opening', 'Opening…')); },
      }),
      req('WF5.191', 'WF5.193'));
  },

  CONTACT() {
    return sheetShell(t('f13.title', 'Contact Wafra'),
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('f13.hours', 'Sunday to Thursday, 08:00–17:00. Arabic and English.')),
      btn(t('f13.whatsapp', 'WhatsApp us'), { variant: 'primary', icon: 'whatsapp', onclick: () => { closeOverlay(); openModal('CONTACT_PREVIEW', { channel: 'whatsapp' }); } }),
      btn(t('f13.email', 'Email us'), { variant: 'secondary', icon: 'mail', onclick: () => { closeOverlay(); openModal('CONTACT_PREVIEW', { channel: 'email' }); } }));
  },

  /* WF4.018 — Terms and Privacy open in-app, in the user's language. */
  LEGAL({ doc }) {
    const terms = doc === 'terms';
    return sheetShell(terms ? t('a3.terms', 'Terms of Use') : t('a3.privacy', 'Privacy Policy'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--ink-700)' } },
        terms
          ? [
              h('p', { style: { margin: 0 } }, t('legal.t1', 'Everything this app tells you about your crop is decision support. It is advice, not a prescription.')),
              h('p', { style: { margin: 0 } }, t('legal.t2', 'You remain responsible for what is applied on your land. Complying with local pesticide regulation rests with whoever applies the product.')),
              h('p', { style: { margin: 0 } }, t('legal.t3', 'Satellite measurements can be affected by cloud, dust and the timing of a pass. Where we cannot measure something we say so rather than estimating it.')),
              h('p', { style: { margin: 0 } }, t('legal.t4', 'Subscriptions are billed through the App Store or Google Play and renew until you cancel there.')),
            ]
          : [
              h('p', { style: { margin: 0 } }, t('legal.p1', 'We hold your name, mobile number, the farms you add and the work recorded against them.')),
              h('p', { style: { margin: 0 } }, t('legal.p2', 'Photographs taken in the field record where and when they were taken and who took them. Your supervisor and the farm owner can see them. We do not track anyone’s position at any other time.')),
              h('p', { style: { margin: 0 } }, t('legal.p3', 'Photographs are served through short-lived private links. A link that leaks stops working.')),
              h('p', { style: { margin: 0 } }, t('legal.p4', 'You can ask us to delete your personal data. Advice records are kept for seven years with your personal details removed.')),
            ]),
      btn(t('action.close', 'Close'), { variant: 'primary', onclick: closeOverlay }),
      req('WF6.027'));
  },
};

function SUPPLIER_LABEL(id) {
  return PLANS[id]?.keys.length ? t('plan.features', '{n} features', { n: num(PLANS[id].keys.length) }) : '';
}

function qrPattern(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  const cells = [];
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const ring = corner && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) || (x > 15 && x < 19 && y > 1 && y < 5) || (x > 1 && x < 5 && y > 15 && y < 19));
      const on = corner ? ring : ((hash >> ((x * 5 + y * 11) % 30)) & 1) === 1 && (x * y) % 4 !== 0;
      if (on) cells.push(h('rect', { x, y, width: 1, height: 1, fill: 'var(--ink-900)' }));
    }
  }
  return h('svg', { viewBox: '0 0 21 21', 'aria-hidden': 'true' }, cells);
}

/* A worker record carries no precomputed initials; an app member does. One
   helper so a mixed list looks like one list. */
function initialsOf(name) {
  return (name ?? '').split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}
