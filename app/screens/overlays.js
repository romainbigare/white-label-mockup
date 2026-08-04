/* ---------------------------------------------------------------------------
   overlays.js — bottom sheets and modal dialogs.

   The upgrade sheet is here and nowhere else. WF-713 asks for "a single,
   consistent upgrade sheet", so every locked control in the app routes through
   openModal('UPGRADE', { featureKey }) and gets identical copy, drawn from the
   one table in entitlements.js.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, LANGUAGES, setLanguage } from '../core/i18n.js';
import { go, closeOverlay, openModal, openSheet, enterOnboarding, switchTab } from '../core/router.js';
import { icon, TASK_ICON, ADVICE_ICON } from '../ui/icons.js';
import {
  sheetShell, btn, row, card, cardPad, statusChip, statusIcon, kv, field, input,
  textarea, select, radioList, disclaimer, avatar, chips, divider, section, req, switchRow,
} from '../ui/components.js';
import { num, date, area, price, dateTime, dayLabel } from '../core/format.js';
import {
  plotById, farmById, visibleFarms, measures, measureByKey, membersOf, memberById,
  adviceById, taskById, treeById, plotsOf, allVisiblePlots, rawPlot,
} from '../data/selectors.js';
import { lock, has, PLANS } from '../core/entitlements.js';
import { can, ROLE_LABEL } from '../core/capabilities.js';
import { blockTask, removeMember, closeCropCycle } from '../data/actions.js';
import { mapSvg } from '../ui/map.js';
import { adviceCard } from './advice.js';
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

const OVERLAYS = {

  /* -- WF-713: the one upgrade sheet ------------------------------------- */
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
      }, `${t('a12.compare', 'Compare all plans')} →`),
      req('WF-713', 'WF-714'));
  },

  /* -- WF-167: the demo conversion sheet --------------------------------- */
  DEMO_CONVERT() {
    return modal(
      centrepiece('warning', 'warn'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('demo.convert.title', 'This is a demo')),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('demo.convert.body', 'Nothing you do here is saved, and the data is not from a real farm.')),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('demo.convert.body2', 'Create an account to add your own farm and get advice for it.')),
      btn(t('demo.create', 'Create an account'), {
        variant: 'primary',
        onclick: () => { state.session.demo = false; closeOverlay(); enterOnboarding('A3'); },
      }),
      btn(t('demo.keep', 'Keep looking around'), { variant: 'secondary', onclick: closeOverlay }),
      req('WF-167'));
  },

  DEMO_EXIT() {
    return modal(
      centrepiece('warning', 'warn'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('demo.exit.title', 'Leave the demo?')),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('demo.exit.body', 'The demo is not saved. Closing it takes you back to the start.')),
      btn(t('demo.create', 'Create an account'), {
        variant: 'primary',
        onclick: () => { state.session.demo = false; closeOverlay(); enterOnboarding('A3'); },
      }),
      btn(t('demo.exit', 'Exit demo'), {
        variant: 'secondary',
        onclick: () => { state.session.demo = false; closeOverlay(); enterOnboarding('A6'); },
      }),
      btn(t('demo.keep', 'Keep looking around'), { variant: 'ghost', onclick: closeOverlay }));
  },

  /* -- WF-783: an action that needs a connection ------------------------- */
  NEEDS_CONNECTION({ what }) {
    return modal(
      centrepiece('offline', 'warn'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('offline.title', 'You are offline')),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('offline.body', 'You need {what}. Everything you capture in the field still saves on your phone.', { what })),
      btn(t('action.ok', 'OK'), { variant: 'primary', onclick: closeOverlay }),
      req('WF-783'));
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

  /* -- C3: the plot bottom sheet, WF-255 --------------------------------- */
  C3({ plotId }) {
    const plot = plotById(plotId);
    const farm = farmById(plot.farmId);
    const measure = measureByKey(state.ui.measure);
    const m = plot.measures[measure.key] ?? { value: 0, delta: 0 };
    return sheetShell(null,
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        statusIcon(plot.status, 22),
        h('div', { style: { flex: 1 } },
          h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, plot.name),
          h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            `${plot.cropName}${plot.variety ? ` — ${plot.variety}` : ''} · ${area(plot.areaHa, { bare: true })}`)),
        statusChip(plot.status)),
      card({}, cardPad(
        h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          h('div.metric',
            h('span.metric__label', t(`measure.${measure.key}`, measure.plain)),
            h('span.num', num(m.value, 2))),
          h('div.metric',
            h('span.metric__label', t('b3.vs7', 'vs 7 days ago')),
            h('span.num', {
              style: { color: m.delta > 0 ? 'var(--st-good)' : m.delta < 0 ? 'var(--st-urgent)' : 'var(--ink-600)' },
            }, m.delta === 0 ? t('delta.nochange', 'no change') : `${m.delta > 0 ? '↑' : '↓'} ${num(Math.abs(m.delta), 2)}`))),
        h('div', { style: { color: 'var(--ink-700)' } }, plot.interpretation))),
      h('div', { style: { display: 'flex', gap: '10px' } },
        btn(t('c3.open', 'Open plot'), { variant: 'primary', block: false, onclick: () => { closeOverlay(); go(`B4:${plot.id}`); } }),
        when(can('task.create', farm), () => btn(t('e3.title', 'Create task'), {
          variant: 'secondary', block: false, onclick: () => { closeOverlay(); go(`E3:plot=${plot.id}`); },
        }))),
      req('WF-255'));
  },

  /* -- pickers ------------------------------------------------------------ */

  MEASURE_PICKER({ onPick }) {
    return sheetShell(t('measure.picker', 'Choose a measure'),
      card({}, measures().map((m) => {
        const locked = !has(m.featureKey);
        return row({
          title: t(`measure.${m.key}`, m.plain),
          // WF-215 — plain-language name first, technical name secondary.
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
        req('WF-215')));
  },

  FARM_PICKER({ onPick }) {
    return sheetShell(t('filter.farm', 'Choose a farm'),
      card({},
        row({ title: t('filter.allfarms', 'All farms'), chevron: false, onclick: () => { onPick?.('all'); closeOverlay(); } }),
        visibleFarms().map((f) => row({
          title: f.name, sub: `${area(f.areaHa, { bare: true })} · ${f.type}`,
          statusKey: f.status, chevron: false,
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

  /* -- WF-301: assignee picker ------------------------------------------- */
  ASSIGNEE_PICKER({ farmId, onPick }) {
    const people = membersOf(farmId);
    return sheetShell(t('e3.assignee', 'Assign to'),
      card({}, people.map((m) => h('button.row', {
        onclick: () => { onPick?.(m.id); closeOverlay(); },
      },
      avatar(m.initials),
      h('div.row__main',
        h('div.row__title', m.name),
        h('div.row__sub', `${t(`role.${m.role}`, ROLE_LABEL[m.role])} · ${m.language}`)),
      h('span.row__value', t('e3.opentasks', '{n} open', { n: num(m.openTasks) })),
      h('span.row__chev', icon('forward', 20, 'flip'))))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('e3.onlyaccess', 'Only people with access to this farm are listed. They are told in their own language.'),
        req('WF-301', 'WF-302')));
  },

  CROP_PICKER({ onPick }) {
    const d = local('croppicker', { query: '', category: 'all' });
    const cats = [{ id: 'all', label: t('crop.all', 'All') }, ...[...new Set(state.db.crops.map((c) => c.category))]
      .map((c) => ({ id: c, label: t(`crop.cat.${c}`, c.replace('-', ' ')) }))];
    const query = d.query.toLowerCase();
    // WF-228 — searchable, grouped by category, last five used at the top.
    const recent = ['alfalfa', 'date-palm', 'wheat', 'potato', 'olive']
      .map((id) => state.db.crops.find((c) => c.id === id)).filter(Boolean);
    let list = state.db.crops;
    if (d.category !== 'all') list = list.filter((c) => c.category === d.category);
    if (query) list = list.filter((c) => c.name.toLowerCase().includes(query) || c.varieties.some((v) => v.toLowerCase().includes(query)));

    return sheetShell(t('b6.pickcrop', 'Choose a crop'),
      input({ type: 'search', placeholder: t('crop.search', 'Search crops and varieties'), value: d.query, oninput: (e) => { d.query = e.target.value; commit('crop'); } }),
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

  ROLE_PICKER({ memberId }) {
    const m = memberById(memberId);
    return sheetShell(t('f4.changerole', 'Change their role'),
      radioList([
        { id: 'supervisor', label: ROLE_LABEL.supervisor, sub: state.db.capabilityNotes?.find((n) => n.role === 'supervisor')?.summary },
        { id: 'worker', label: ROLE_LABEL.worker, sub: state.db.capabilityNotes?.find((n) => n.role === 'worker')?.summary },
      ], m.role, (id) => { m.role = id; toast(t('f4.rolechanged', 'Role changed')); closeOverlay(); }),
      disclaimer(t('f4.rolenote', 'A role change takes effect on their next request, not at their next login.')));
  },

  /* -- menus -------------------------------------------------------------- */

  /* WF-219 — the exact contents of the plot ⋮ menu. */
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
        when(can('task.create', farm), () => item('plus', t('e3.title', 'Create task'), () => go(`E3:plot=${plot.id}`))),
        item('share', t('plotmenu.share', 'Share plot summary'), () => toast(t('share.opened', 'Opening the share sheet…'))),
        // WF-219 — Delete requires typing the plot name and is Owner-only.
        when(can('plot.delete', farm), () => item('trash', t('plotmenu.delete', 'Delete plot'), () => openModal('DELETE_PLOT', { plotId })))));
  },

  TREE_MENU({ treeId }) {
    const tree = treeById(treeId);
    return sheetShell(tree.id,
      card({},
        row({ iconName: 'plus', title: t('e3.title', 'Create task'), chevron: false, onclick: () => { closeOverlay(); go(`E3:tree=${tree.id}`); } }),
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

  ADVICE_MENU({ adviceId }) {
    const a = adviceById(adviceId);
    return sheetShell(null,
      card({},
        row({ iconName: 'share', title: t('advicemenu.share', 'Share this advice'), chevron: false, onclick: () => { closeOverlay(); toast(t('share.opened', 'Opening the share sheet…')); } }),
        row({ iconName: 'document', title: t('advicemenu.log', 'How this was worked out'), chevron: false, onclick: () => { closeOverlay(); openSheet('ADVISORY_LOG', { adviceId }); } }),
        row({ iconName: 'map', title: t('advicemenu.plot', 'Open the plot'), chevron: false, onclick: () => { closeOverlay(); go(`B4:${a.plotIds[0]}`); } })));
  },

  NEW_MENU() {
    return sheetShell(t('new.title', 'What would you like to add?'),
      card({},
        when(can('task.create'), () => row({ iconName: 'check', title: t('e3.title', 'A task'), sub: t('new.task.sub', 'Send a job to someone on your team'), chevron: false, onclick: () => { closeOverlay(); go('E3:'); } })),
        row({ iconName: 'camera', title: t('e6.title', 'A field observation'), sub: t('new.obs.sub', 'A photo and a note from where you are standing'), chevron: false, onclick: () => { closeOverlay(); go('E6:'); } }),
        when(can('farm.create'), () => row({ iconName: 'home', title: t('new.farm', 'A farm'), sub: t('new.farm.sub', 'Draw a new boundary'), chevron: false, onclick: () => { closeOverlay(); go('B12'); } }))));
  },

  /* -- WF-309: I cannot do this ------------------------------------------ */
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
        t('cannot.note', 'We will tell the person who set this task straight away.'), req('WF-309')));
  },

  /* -- WF-304: show me where -------------------------------------------- */
  SHOW_WHERE({ taskId }) {
    const task = taskById(taskId);
    const plot = task.plotIds[0] ? plotById(task.plotIds[0]) : null;
    const farm = farmById(task.farmId);
    return sheetShell(t('e2.showme', 'Show me where'),
      h('div.mapbox', { style: { height: '230px', borderRadius: 'var(--radius)' } },
        mapSvg({
          plots: plot ? [plot] : plotsOf(farm.id), measure: 'ndvi',
          layers: { labels: true }, selectedId: plot?.id, gps: [200, 820],
        }),
        plot && h('svg', {
          viewBox: '0 0 1000 1000', preserveAspectRatio: 'xMidYMid slice',
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
        }, h('line', {
          x1: 200, y1: 820, x2: plot.centroid[0], y2: plot.centroid[1],
          stroke: '#fff', 'stroke-width': 5, 'stroke-dasharray': '14 10',
        }))),
      card({}, cardPad(kv([
        [t('e2.target', 'Go to'), plot ? `${plot.name} · ${plot.cropName}` : farm.name],
        [t('e2.distance', 'Distance'), '1.4 km'],
        [t('e2.walk', 'About'), t('e2.walkmins', '18 minutes on foot')],
      ]))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('e2.notrouting', 'A straight line and a distance — not turn-by-turn directions.'), req('WF-304')));
  },

  /* -- WF-277 / WF-616: editable assumptions ---------------------------- */
  ASSUMPTIONS({ adviceId }) {
    const a = adviceById(adviceId);
    const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
    const d = local(`assump-${adviceId}`, { efficiency: '85', soil: plot?.cropName ? 'Sandy loam' : 'Sandy loam', flow: String(plot?.flowRateM3h ?? '') });
    return sheetShell(t('advice.assumptions', 'Assumptions we used'),
      field(t('assump.efficiency', 'Irrigation efficiency'),
        h('div.inputgroup.inputgroup--suffix', input({ type: 'number', value: d.efficiency, oninput: (e) => { d.efficiency = e.target.value; } }),
          h('span.input', { style: { width: '58px', display: 'grid', placeItems: 'center' } }, '%'))),
      field(t('a11.soil', 'Soil type'),
        select(['Sandy', 'Sandy loam', 'Loam', 'Clay loam', 'Clay'].map((v) => ({ value: v, label: v })), d.soil, (v) => { d.soil = v; commit('assump'); })),
      field(t('b4.flow', 'System flow rate'),
        h('div.inputgroup.inputgroup--suffix', input({ type: 'number', value: d.flow, oninput: (e) => { d.flow = e.target.value; } }),
          h('span.input', { style: { width: '68px', display: 'grid', placeItems: 'center' } }, 'm³/h'))),
      disclaimer(t('assump.note', 'These are saved against the plot, not against this one recommendation, and future advice is recalculated from them. The advice you are looking at now is kept as it was.')),
      btn(t('action.save', 'Save'), {
        variant: 'primary',
        onclick: () => {
          // WF-616 — the correction is stored against the PLOT, not the advice.
          if (plot) { const rec = rawPlot(plot.id); rec.flowRateM3h = Number(d.flow) || rec.flowRateM3h; }
          toast(t('assump.saved', 'Saved. Future advice will use these.'));
          closeOverlay();
        },
      }),
      req('WF-277', 'WF-616'));
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
      req('WF-600', 'WF-601', 'WF-614', 'WF-615'));
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
        input({ value: d.typed, oninput: (e) => { d.typed = e.target.value; commit('del'); } })),
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
    const old = true;   // WF-237 — farms with >90 days of data need a second confirmation
    return modal(
      centrepiece('trash', 'danger'),
      h('h2', { style: { margin: 0, textAlign: 'center', fontSize: 'var(--t-title)' } }, t('delfarm.title', 'Delete {name}?', { name: farm.name })),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('delfarm.body', 'Every plot, boundary, crop cycle, task and report for this farm is lost. This cannot be undone.')),
      when(old, () => disclaimer(t('delfarm.second', 'This farm has more than 90 days of history, so we will ask you again in 24 hours before anything is removed.'), true)),
      field(t('delfarm.type', 'Type {name} to confirm', { name: farm.name }),
        input({ value: d.typed, oninput: (e) => { d.typed = e.target.value; commit('del'); } })),
      btn(t('b11.delete', 'Delete farm'), {
        variant: 'danger', disabled: d.typed.trim() !== farm.name,
        onclick: () => { closeOverlay(); toast(t('delfarm.queued', 'We will confirm with you again in 24 hours'), 'warn'); },
      }),
      btn(t('action.cancel', 'Cancel'), { variant: 'ghost', onclick: closeOverlay }));
  },

  /* -- WF-337: delete my account ---------------------------------------- */
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
      req('WF-337'));
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
      req('WF-225', 'WF-226'));
  },

  /* -- misc sheets -------------------------------------------------------- */

  SEARCH() {
    const d = local('search', { query: '' });
    const q = d.query.toLowerCase();
    // WF-263 — farm name, plot name, crop name and tree ID.
    const farms = q ? visibleFarms().filter((f) => f.name.toLowerCase().includes(q)) : [];
    const plots = q ? allVisiblePlots().filter((p) => p.name.toLowerCase().includes(q) || p.cropName.toLowerCase().includes(q)) : [];
    const trees = q ? state.db.trees.filter((tr) => tr.id.toLowerCase().includes(q)) : [];
    const empty = q && !farms.length && !plots.length && !trees.length;

    return sheetShell(null,
      input({ type: 'search', placeholder: t('c1.search', 'Search farms, plots and trees'), value: d.query, oninput: (e) => { d.query = e.target.value; commit('search'); }, autofocus: true }),
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
    ];
    return sheetShell(t('notif.title', 'Notifications'),
      card({}, items.map((n) => row({
        iconName: n.icon, title: n.title, sub: n.sub, value: n.when,
        // WF-656 — every notification opens the exact object it concerns.
        onclick: n.route ? () => { closeOverlay(); go(n.route); } : undefined, chevron: !!n.route,
      }))),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('notif.deeplink', 'Every message opens the exact task, advice or report it is about — even from a cold start.'), req('WF-656')));
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
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { width: '22px', height: '22px', borderRadius: '6px', background: 'var(--brand-700)' } }),
        h('span', { style: { fontWeight: 750 } }, 'Wafra')),
      h('div.skeleton', { style: { height: '13px', width: '70%' } }),
      h('div.skeleton', { style: { height: '13px', width: '90%' } }),
      h('div.skeleton', { style: { height: '46px' } }),
      h('div.skeleton', { style: { height: '13px', width: '55%' } })),
      field(t('f1.language', 'Language'),
        select(LANGUAGES.map((l) => ({ value: l.code, label: l.english })), state.session.lang, (v) => setLanguage(v))),
      // WF-318 — shareable through the OS share sheet.
      h('div', { style: { display: 'flex', gap: '8px' } },
        btn(t('f1.pdf', 'Download PDF'), { variant: 'primary', block: false, icon: 'download', onclick: () => { closeOverlay(); toast(t('f1.downloading', 'Generating your PDF…')); } }),
        btn(t('action.share', 'Share'), { variant: 'secondary', block: false, icon: 'share', onclick: () => { closeOverlay(); toast(t('share.opened', 'Opening the share sheet…')); } })),
      when(custom, () => btn(t('f1.excel', 'Export to Excel'), { variant: 'ghost', icon: 'document', onclick: () => { closeOverlay(); toast(t('f1.excel.done', 'Excel export queued')); } })),
      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('f1.serverside', 'Produced on our servers, never assembled on your phone, and carrying Wafra branding only.'), req('WF-316', 'WF-317')));
  },

  PLAN_CHOOSER() {
    const family = state.db && 'complete';
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
      req('WF-330'));
  },

  QR_SCAN({ kind }) {
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
        kind === 'tree' ? t('qr.tree', 'Point the camera at the tag on a tree.') : t('qr.invite', 'Point the camera at the code on the other phone.')),
      btn(t('qr.simulate', 'Simulate a scan'), {
        variant: 'primary',
        onclick: () => { closeOverlay(); if (kind === 'tree') go('B10:T-2841'); else toast(t('qr.joined', 'Invitation accepted')); },
      }));
  },

  QR_SHOW({ code }) {
    return sheetShell(t('f3.showqr', 'Show the QR code'),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' } },
        h('div.qr', { style: { width: '210px', height: '210px' } }, qrPattern(code)),
        h('div', { style: { fontSize: 'var(--t-hero)', fontWeight: 750, letterSpacing: '.14em' } }, code)),
      h('p', { style: { margin: 0, textAlign: 'center', color: 'var(--ink-600)' } },
        t('f3.qrnote', 'Single use, expires in 7 days, and carries only the role and farms you chose.')),
      req('WF-326'));
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
      req('WF-342', 'WF-343'));
  },

  CONTACT() {
    return sheetShell(t('f13.title', 'Contact Wafra'),
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('f13.hours', 'Sunday to Thursday, 08:00–17:00. Arabic and English.')),
      btn(t('f13.whatsapp', 'WhatsApp us'), { variant: 'primary', icon: 'whatsapp', onclick: () => { closeOverlay(); openModal('CONTACT_PREVIEW', { channel: 'whatsapp' }); } }),
      btn(t('f13.email', 'Email us'), { variant: 'secondary', icon: 'mail', onclick: () => { closeOverlay(); openModal('CONTACT_PREVIEW', { channel: 'email' }); } }));
  },

  /* WF-117 — Terms and Privacy open in-app, in the user's language. */
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
      req('WF-623', 'WF-904'));
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
