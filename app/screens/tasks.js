/* ---------------------------------------------------------------------------
   tasks.js — E1 Task list / My Work, E2 Task detail, E3 New task,
   E4 Complete task, E6 Field observation, E7 Photo disease check.

   The Worker view is not a permission-filtered copy of the Supervisor view.
   WF5.114 is explicit: "stripped to what, how much, where, when, and one big
   button. No status chips, no metadata, no comment threads." So E2 branches on
   role into two genuinely different screens rather than hiding widgets.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back, switchTab } from '../core/router.js';
import { icon, TASK_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, req, chips, pillTabs, select, field, input,
  textarea, radioList, fab, divider, avatar, lockBox,
} from '../ui/components.js';
import { num, date, dateTime, dayLabel, ago, NOW, duration } from '../core/format.js';
import {
  tasksFor, taskById, groupedTasks, isOverdue, farmById, plotById, memberById, personById,
  membersOf, visibleFarms, adviceById, treeById, me, farmFilterLabel,
} from '../data/selectors.js';
import { can } from '../core/capabilities.js';
import { has } from '../core/entitlements.js';
import { completeTask, startTask, blockTask, createTask, addObservation } from '../data/actions.js';
import { workerId } from './badges.js';
import { mapSvg } from '../ui/map.js';

const TASK_TYPES = ['irrigation', 'fertiliser', 'spraying', 'planting', 'pruning', 'harvest', 'inspection', 'maintenance', 'other'];
const TYPE_LABEL = {
  irrigation: 'Irrigation', fertiliser: 'Fertiliser', spraying: 'Spraying', planting: 'Planting',
  pruning: 'Pruning', harvest: 'Harvest', inspection: 'Inspection', maintenance: 'Maintenance', other: 'Other',
};

/* -- E1 · Task list (Supervisor) / My Work (Worker) ----------------------

   There is no SUGGESTED section here any more, and its removal is the largest
   single consequence of the review.

   The build used to take the reading that an advisory item is "pre-packaged as
   a task" literally: a task existed the moment its advice did, unassigned and
   undated, and E1 listed it. Review settled the question the other way, and
   more sharply than a preference — A TASK IS AN ADVICE THAT HAS BEEN ASSIGNED.
   Assigning is not a property somebody sets on an existing task; it is the
   event that brings the task into being.

   Everything follows from that. Assign and Ignore are advice actions and appear
   on advice screens only. Mark as complete is a task action and appears on task
   screens only. And this list contains work that has been given to somebody,
   which is what makes "3 tasks today" a number a supervisor can trust. */

export function E1() {
  const isWorker = state.session.role === 'worker';
  const tab = state.ui.taskTab;
  const farmFilter = state.ui.farmFilter;
  const all = tasksFor({ farmId: farmFilter });
  const groups = groupedTasks(all, tab);
  const todayCount = groupedTasks(all, 'today').reduce((sum, g) => sum + g.items.length, 0);

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', isWorker ? t('nav.mywork', 'My Work') : t('nav.tasks', 'Tasks')),
        when(!isWorker, () => h('button.chip', {
          onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('tasks'); } }),
        }, h('span', farmFilterLabel(farmFilter) ?? t('filter.allfarms', 'All farms')), icon('chevronDown', 15)))),
      pillTabs([
        { id: 'today', label: t('e1.today', 'Today'), count: todayCount },
        { id: 'upcoming', label: t('e1.upcoming', 'Upcoming') },
        { id: 'done', label: t('e1.done', 'Done') },
      ], tab, (id) => { state.ui.taskTab = id; commit('tasks'); })),

    body: page(
      groups.length
        ? groups.map((group) => section(t(`e1.group.${group.id}`, group.label.toUpperCase()), {},
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              group.items.map((task) => taskCard(task, isWorker)))))
        : emptyState({
            iconName: 'check',
            title: isWorker ? t('e1.empty.worker', 'Nothing to do right now') : t('e1.empty.title', 'No tasks here'),
            body: isWorker
              ? t('e1.empty.worker.body', 'When your supervisor sends you a job it will appear here.')
              : t('e1.empty.body', 'Assign a piece of advice, or create a task from scratch.'),
            action: can('task.create')
              ? { label: t('nav.advice', 'Advice'), onclick: () => switchTab('advice') }
              : null,
          }),
      when(!isWorker, () => h('div', { style: { height: '48px' } }))),

    // WF5.107 — the ADD button at the bottom right of the task list is the ONLY
    // manual entry point for a task in the whole app, so it goes straight to E3
    // rather than opening a menu of three things. WF5.110 expects it to be
    // rare: it is built to work, not built to be prominent.
    //
    // WF5.108 gives the button to every role, Workers included — what a Worker
    // cannot do is give the task to somebody else (WF8.006), which E3 enforces.
    fab: fab(t('e3.title', 'New task'), () => go('E3:'), 'plus'),
  };
}

function taskCard(task, isWorker) {
  const overdue = isOverdue(task);
  const assignee = personById(task.assigneeId);
  const plotNames = task.plotIds.map((id) => plotById(id).name).join(', ');
  const stateIcon = task.state === 'done' ? 'check' : task.state === 'in_progress' ? 'circle-half' : task.state === 'cancelled' ? 'close' : 'circle-dashed';

  return card({ accent: overdue ? 'urgent' : task.state === 'done' ? 'good' : null, onclick: () => go(`E2:${task.id}`) },
    cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { style: { color: overdue ? 'var(--st-urgent)' : 'var(--ink-500)', display: 'flex' } },
          icon(stateIcon === 'circle-half' || stateIcon === 'circle-dashed' ? stateIcon : stateIcon, 18)),
        h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon(TASK_ICON[task.type] ?? 'flag', 18)),
        h('span', { style: { fontWeight: 650, flex: 1 } }, task.title),
        h('span', { style: { color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 18, 'flip'))),
      when(plotNames || task.treeCount, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        [plotNames, task.treeCount ? t('e1.trees', '{n} trees', { n: num(task.treeCount) }) : null].filter(Boolean).join(' · '))),
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: 'var(--t-meta)' } },
        when(!isWorker && assignee, () => h('span', { style: { color: 'var(--ink-600)' } }, shortName(assignee.name))),
        h('span', {
          style: { color: overdue ? 'var(--st-urgent)' : 'var(--ink-500)', fontWeight: overdue ? 700 : 500 },
        }, task.state === 'done'
          ? t('e1.completed', 'done {when}', { when: dayLabel(task.completedAt ?? task.dueAt) })
          : task.state === 'cancelled'
            ? t('e1.cancelled', 'could not be done')
            : task.state === 'in_progress'
              ? t('e1.inprogress', 'in progress')
              : t('e1.due', 'due {when}', { when: dayLabel(task.dueAt) }))),
      when(task.quantity, () => h('div.num', task.quantity))));
}

function shortName(name) {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : name;
}

/* -- E2 · Task detail ----------------------------------------------------- */

export function E2(taskId) {
  const task = taskById(taskId);
  return state.session.role === 'worker' ? workerTask(task) : supervisorTask(task);
}

/* WF5.114 — the Worker view: what, how much, where, when, one big button. */
function workerTask(task) {
  const plot = task.plotIds[0] ? plotById(task.plotIds[0]) : null;
  return {
    top: appBar({ title: '' }),
    body: h('div.page', { style: { alignItems: 'center', textAlign: 'center', gap: '18px', paddingTop: '10px' } },
      h('div', {
        style: {
          width: '86px', height: '86px', borderRadius: '50%', background: 'var(--brand-050)',
          color: 'var(--brand-700)', display: 'grid', placeItems: 'center',
        },
      }, icon(TASK_ICON[task.type] ?? 'flag', 44)),
      h('h1', { style: { margin: 0, fontSize: 'var(--t-head)', lineHeight: 1.2 } }, task.title),
      when(task.quantity, () => h('div', { style: { fontSize: 'var(--t-hero)', fontWeight: 700 } }, task.quantity)),
      when(task.description, () => h('p', { style: { margin: 0, fontSize: 'var(--t-lead)', color: 'var(--ink-700)', maxWidth: '30ch' } }, task.description)),
      h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 650 } },
        `${dayLabel(task.dueAt)}${new Date(task.dueAt).getUTCHours() ? `, ${t('e2.before', 'before')} ${String(new Date(task.dueAt).getUTCHours()).padStart(2, '0')}:00` : ''}`),
      // WF5.070 — Show me where: map centred on the target, with a distance.
      btn(t('e2.showme', 'Show me where'), {
        variant: 'secondary', size: 'big', icon: 'map',
        onclick: () => openSheet('SHOW_WHERE', { taskId: task.id }),
      }),
      when(task.state === 'done', () => h('div.status.status--good.status--lg', icon('check', 18), t('e2.donealready', 'You marked this done')))),
    dock: task.state === 'done' ? null : actionDock(
      btn(t('e2.markdone', 'Mark as done'), {
        variant: 'primary', size: 'big', icon: 'check', onclick: () => go(`E4:${task.id}`),
      }),
      btn(t('e2.cannot', 'I cannot do this'), {
        variant: 'ghost', onclick: () => openSheet('CANNOT_DO', { taskId: task.id }),
      })),
  };
}

function supervisorTask(task) {
  const farm = farmById(task.farmId);
  const assignee = personById(task.assigneeId);
  const creator = memberById(task.createdById);
  const advice = task.fromAdviceId ? adviceById(task.fromAdviceId) : null;
  const overdue = isOverdue(task);

  return {
    top: appBar({
      title: task.title, subtitle: farm.name,
      actions: [overflowAction(() => openSheet('TASK_MENU', { taskId: task.id }))],
    }),
    body: page(
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span.status', {
          class: `status status--${task.state === 'done' ? 'good' : overdue ? 'urgent' : task.state === 'cancelled' ? 'nodata' : 'watch'}`,
        }, icon(task.state === 'done' ? 'check' : overdue ? 'triangle-filled' : 'clock', 15),
           h('span', taskStateLabel(task, overdue))),
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          icon(TASK_ICON[task.type] ?? 'flag', 16), t(`e3.type.${task.type}`, TYPE_LABEL[task.type]))),

      when(task.description, () => h('p', { style: { margin: 0, fontSize: 'var(--t-lead)' } }, task.description)),
      when(task.quantity, () => h('div.bignum', task.quantity)),

      card({}, cardPad(kv([
        [t('e3.assignee', 'Assigned to'), assignee ? `${assignee.name} · ${t(`role.${assignee.role}`, assignee.role)}` : '—'],
        [t('e3.due', 'Due'), dateTime(task.dueAt)],
        [t('e3.priority', 'Priority'), t(`e3.priority.${task.priority}`, task.priority)],
        task.plotIds.length ? [t('e3.plots', 'Plots'), task.plotIds.map((id) => plotById(id).name).join(', ')] : null,
        task.treeCount ? [t('e3.trees', 'Trees'), num(task.treeCount)] : null,
        [t('e2.createdby', 'Created by'), creator?.name ?? '—'],
      ]))),

      when(advice, () => section(t('e2.fromadvice', 'Made from this advice'), {},
        card({ onclick: () => go(`D2:${advice.id}`) }, cardPad(
          h('div', { style: { fontWeight: 650 } }, advice.action),
          h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, advice.reason))))),

      when(task.state === 'done', () => section(t('e2.completion', 'Completion'), {},
        card({}, cardPad(
          kv([
            [t('e2.completedat', 'Completed'), dateTime(task.completedAt)],
            task.completedQuantity ? [t('e2.applied', 'Applied'), task.completedQuantity] : null,
            task.completedNote ? [t('e2.note', 'Note'), task.completedNote] : null,
          ]),
          when(task.photoCount > 0, () => h('div', { style: { display: 'flex', gap: '8px' } },
            Array.from({ length: task.photoCount }, (_, i) => h('div', {
              style: {
                width: '82px', height: '82px', borderRadius: 'var(--radius-sm)',
                background: `linear-gradient(${120 + i * 50}deg, var(--brand-300), var(--st-watch-bg))`,
                display: 'grid', placeItems: 'center', color: 'var(--ink-700)',
              },
            }, icon('camera', 22))))),
          // WF5.157 — photographs are stamped with GPS, time, task, plot and user.
          when(task.photoCount > 0, () => h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
            t('e2.photostamp', 'Every photo records its location, the time, the task and who took it.'), req('WF5.157'))))))),

      when(task.state === 'cancelled', () => disclaimer(
        t('e2.blocked', 'Could not be done: {reason}', { reason: task.blockedReason ?? '' }), true))),

    // A task raised from advice completes through D7, which asks the question
    // that matters for advice: was the advised amount applied, a different one,
    // or none — which is what feeds "advised versus applied" on the plot. A task
    // somebody typed has no advised amount to compare against, so it takes the
    // plain completion form.
    dock: ['open', 'in_progress'].includes(task.state) ? actionDock(
      task.state === 'open'
        ? btn(t('e2.start', 'Mark as in progress'), { variant: 'secondary', onclick: () => startTask(task) })
        : null,
      btn(t('e2.markdone', 'Mark as done'), {
        variant: 'primary', icon: 'check',
        onclick: () => go(task.fromAdviceId ? `D7:${task.fromAdviceId}` : `E4:${task.id}`),
      }),
    ) : null,
  };
}

function taskStateLabel(task, overdue) {
  if (task.state === 'done') return t('e1.done', 'Done');
  if (task.state === 'cancelled') return t('task.cancelled', 'Cancelled');
  if (overdue) return t('e1.overdue', 'Overdue');
  if (task.state === 'in_progress') return t('e1.inprogress', 'In progress');
  return t('task.open', 'Open');
}

/* -- E3 · New task, WF5.104 … WF5.113 -------------------------------------- */

export function E3(param = '') {
  const [kind, value] = String(param).split('=');
  const advice = kind === 'advice' ? adviceById(value) : null;
  const prefillPlot = kind === 'plot' ? plotById(value) : null;
  const tree = kind === 'tree' ? treeById(value) : null;
  const [treeFarmId, treeCount] = kind === 'trees' ? String(value).split('|') : [];

  const key = `e3-${param}`;
  // WF5.111 — creating from a recommendation pre-fills title, description
  // (including what and how much), type, plot and a suggested due date.
  const d = local(key, {
    title: advice ? advice.action : tree ? `Inspect ${tree.id}` : treeCount ? `Inspect ${treeCount} trees` : '',
    description: advice ? `${advice.amount ?? ''}${advice.amount ? '. ' : ''}${advice.reason}` : '',
    type: advice ? adviceTypeToTask(advice.type) : 'inspection',
    farmId: advice?.farmId ?? prefillPlot?.farmId ?? tree?.farmId ?? treeFarmId ?? visibleFarms()[0]?.id,
    plotIds: advice?.plotIds ?? (prefillPlot ? [prefillPlot.id] : tree ? [tree.plotId] : []),
    treeCount: Number(treeCount ?? (tree ? 1 : 0)),
    assigneeId: '', dueAt: suggestedDue(advice), priority: advice?.severity === 'urgent' ? 'high' : 'normal',
    quantity: advice?.amount ?? '',
  });

  const farm = farmById(d.farmId);
  const team = membersOf(d.farmId);
  // WF5.138 — a task may go to an app user or to a §5.6 worker record, so
  // the name has to be looked up across both.
  const canAssign = can('task.assign');
  const assignee = personById(canAssign ? d.assigneeId : workerId());
  const plots = state.db.plots.filter((p) => p.farmId === d.farmId);

  return {
    tabs: false,
    top: appBar({ title: t('e3.title', 'New task') }),
    body: page(
      when(advice, () => disclaimer(t('e3.prefilled', 'Filled in from the advice for {plots}. Add an assignee and save.', { plots: advice.plotNames.join(', ') }))),

      field(t('e3.title.field', 'Title'), input({ value: d.title, oninput: (e) => { d.title = e.target.value; } }), { required: true }),
      field(t('e3.description', 'Description'), textarea({ value: d.description, oninput: (e) => { d.description = e.target.value; } })),
      field(t('e3.type', 'Type'),
        select(TASK_TYPES.map((v) => ({ value: v, label: t(`e3.type.${v}`, TYPE_LABEL[v]) })), d.type, (v) => { d.type = v; commit('e3'); })),
      field(t('e3.farm', 'Farm'),
        select(visibleFarms().map((f) => ({ value: f.id, label: f.name })), d.farmId,
          (v) => { d.farmId = v; d.plotIds = []; d.assigneeId = ''; commit('e3'); })),
      field(t('e3.plots', 'Plots'),
        h('button.row', {
          onclick: () => openSheet('PLOT_PICKER', { farmId: d.farmId, selected: d.plotIds, onPick: (ids) => { d.plotIds = ids; commit('e3'); } }),
          style: { border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)', background: 'var(--paper)' },
        }, h('div.row__main', h('div.row__title',
             d.plotIds.length ? d.plotIds.map((id) => plotById(id).name).join(', ') : t('e3.anyplot', 'Whole farm'))),
           h('span.row__chev', icon('chevronDown', 20))),
        // WF5.107 — a task may cover many plots or many trees.
        { hint: d.treeCount ? t('e3.treecount', 'Covers {n} trees', { n: num(d.treeCount) }) : null }),

      // WF8.006 — a Worker may create a manual task but may not assign one to
      // anyone else, so for them there is no picker: the task is their own.
      canAssign
        ? field(t('e3.assignee', 'Assign to'),
          h('button.row', {
            onclick: () => openSheet('ASSIGNEE_PICKER', { farmId: d.farmId, onPick: (id) => { d.assigneeId = id; commit('e3'); } }),
            style: { border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)', background: 'var(--paper)' },
          }, when(assignee, () => avatar(assignee.initials)),
          h('div.row__main',
            h('div.row__title', assignee ? assignee.name : t('e3.pickperson', 'Choose someone')),
            when(assignee, () => h('div.row__sub', `${t(`role.${assignee.role}`, assignee.role)} · ${t('e3.opentasks', '{n} open tasks', { n: num(assignee.openTasks) })} · ${assignee.language}`))),
          h('span.row__chev', icon('chevronDown', 20))),
        { required: true, hint: assignee ? t('e3.langnote', 'They will be told in {lang}, not in your language.', { lang: assignee.language }) : null })
        : h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('e3.ownonly', 'This will be your own task. Only an owner or a supervisor can give work to someone else.'),
          req('WF8.006')),

      field(t('e3.due', 'Due'), input({
        type: 'datetime-local', value: d.dueAt.slice(0, 16),
        onchange: (e) => { d.dueAt = `${e.target.value}:00Z`; commit('e3'); },
      }), { required: true }),
      field(t('e3.priority', 'Priority'),
        select([
          { value: 'low', label: t('e3.priority.low', 'Low') },
          { value: 'normal', label: t('e3.priority.normal', 'Normal') },
          { value: 'high', label: t('e3.priority.high', 'High') },
        ], d.priority, (v) => { d.priority = v; commit('e3'); })),
      field(t('e3.quantity', 'Quantity'), input({ value: d.quantity, placeholder: '693 m³', oninput: (e) => { d.quantity = e.target.value; } })),

      // WF11.004 — creating a task offline is refused calmly, by name.
      when(state.session.connectivity === 'offline', () => disclaimer(
        t('offline.need.task', 'You need a connection to assign a task. Your other work still saves on the phone.'), true))),

    dock: actionDock(btn(t('e3.save', 'Create and send'), {
      variant: 'primary',
      disabled: !d.title.trim() || (canAssign && !d.assigneeId),
      onclick: () => {
        // WF8.006 — a Worker's manual task is their own; there is nobody to pick.
        const created = createTask({
          ...d,
          assigneeId: canAssign ? d.assigneeId : workerId(),
          fromAdviceId: advice?.id ?? null,
        });
        if (!created) return;
        resetLocal(key);
        if (canAssign) {
          // WF5.147 — the assignee is notified in THEIR language.
          toast(t('e3.sent', 'Sent to {name} in {lang}', {
            name: shortName(personById(created.assigneeId)?.name ?? ''),
            lang: personById(created.assigneeId)?.language ?? 'English',
          }));
        } else {
          toast(t('e3.added', 'Added to your work'));
        }
        back();
      },
    })),
  };
}

function adviceTypeToTask(type) {
  return ({ irrigation: 'irrigation', nutrition: 'fertiliser', protection: 'spraying', harvest: 'harvest', weather: 'other' })[type] ?? 'other';
}

function suggestedDue(advice) {
  const days = advice?.severity === 'urgent' ? 0 : advice?.bucket === 'week' ? 3 : 1;
  const due = new Date(NOW.getTime() + days * 86400000);
  due.setUTCHours(16, 0, 0, 0);
  return due.toISOString();
}

/* -- E4 · Complete task, WF5.115 … WF5.118 -------------------------------- */

export function E4(taskId) {
  const task = taskById(taskId);
  const d = local(`e4-${taskId}`, { photos: 0, quantity: '', unit: 'm3', note: '' });

  return {
    tabs: false,
    top: appBar({ title: t('e4.title', 'Mark as done') }),
    body: page(
      // WF5.116 — everything here is optional except the confirm tap.
      h('button', {
        onclick: () => { d.photos += 1; commit('e4'); toast(t('e4.photoadded', 'Photo added')); },
        style: {
          width: '100%', minHeight: '150px', borderRadius: 'var(--radius)',
          border: '2px dashed var(--ink-300)', background: 'var(--ink-050)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '8px', color: 'var(--ink-600)', cursor: 'pointer', font: 'inherit',
        },
      }, icon('camera', 34),
         h('span', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } }, t('e4.photo', 'Take a photo')),
         h('span', { style: { fontSize: 'var(--t-meta)' } }, t('e4.optional', '(optional)'))),

      when(d.photos > 0, () => h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        Array.from({ length: d.photos }, (_, i) => h('div', {
          style: {
            width: '78px', height: '78px', borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(${120 + i * 40}deg, var(--brand-300), var(--st-watch-bg))`,
            display: 'grid', placeItems: 'center', color: 'var(--ink-700)',
          },
        }, icon('check', 22))))),

      field(t('e4.howmuch', 'How much did you apply? (optional)'),
        h('div.inputgroup.inputgroup--suffix',
          input({ type: 'number', inputmode: 'decimal', value: d.quantity, oninput: (e) => { d.quantity = e.target.value; } }),
          select([
            { value: 'm3', label: t('unit.m3', 'm³') },
            { value: 'mm', label: t('unit.mm', 'mm') },
            { value: 'kg', label: t('unit.kg', 'kg') },
            { value: 'l', label: t('unit.litre', 'L') },
          ], d.unit, (v) => { d.unit = v; commit('e4'); }))),

      field(t('e4.note', 'Note (optional)'), textarea({ value: d.note, oninput: (e) => { d.note = e.target.value; } })),

      // WF5.118 — the whole flow works offline and says so.
      when(state.session.connectivity === 'offline', () => h('div.status.status--nodata',
        icon('offline', 15), t('e4.offline', 'Offline — this will send when you have signal')))),

    dock: actionDock(btn(t('action.confirm', 'Confirm'), {
      variant: 'primary', size: 'big',
      onclick: () => {
        completeTask(task, {
          quantity: d.quantity ? `${d.quantity} ${d.unit === 'm3' ? 'm³' : d.unit}` : null,
          note: d.note || null, photoCount: d.photos,
        });
        resetLocal(`e4-${taskId}`);
        go('E1', { replace: true });
      },
    })),
  };
}

/* -- E6 · Field observation, WF5.122 / WF5.123 / WF5.125 ------------------- */

const OBS_CATEGORIES = [
  { id: 'pest', label: 'Pest', icon: 'warning' },
  { id: 'disease', label: 'Disease', icon: 'shield' },
  { id: 'weed', label: 'Weed', icon: 'leaf' },
  { id: 'water', label: 'Water', icon: 'droplet' },
  { id: 'damage', label: 'Damage', icon: 'wind' },
  { id: 'other', label: 'Other', icon: 'flag' },
];

export function E6(param = '') {
  const [, plotIdRaw] = String(param).split('=');
  const farms = visibleFarms();
  const d = local(`e6-${param}`, {
    farmId: farms[0]?.id, plotId: plotIdRaw || state.db.plots.find((p) => p.farmId === farms[0]?.id)?.id,
    category: 'pest', severity: 'medium', note: '', photos: 0,
  });
  const plots = state.db.plots.filter((p) => p.farmId === d.farmId);

  return {
    tabs: false,
    top: appBar({ title: t('e6.title', 'Field observation') }),
    body: page(
      h('button', {
        onclick: () => { d.photos += 1; commit('e6'); },
        style: {
          width: '100%', minHeight: '132px', borderRadius: 'var(--radius)',
          border: '2px dashed var(--ink-300)', background: 'var(--ink-050)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '6px', color: 'var(--ink-600)', cursor: 'pointer', font: 'inherit',
        },
      }, icon('camera', 30), h('span', { style: { fontWeight: 650 } }, t('e6.photo', 'Add photos'))),
      when(d.photos > 0, () => h('div', { style: { display: 'flex', gap: '8px' } },
        Array.from({ length: d.photos }, (_, i) => h('div', {
          style: {
            width: '72px', height: '72px', borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(${100 + i * 50}deg, var(--st-good-bg), var(--brand-300))`,
          },
        })))),

      field(t('e6.category', 'What did you see?'),
        chips(OBS_CATEGORIES.map((c) => ({ id: c.id, label: t(`e6.cat.${c.id}`, c.label), icon: c.icon })),
          d.category, (id) => { d.category = id; commit('e6'); }, { wrap: true })),

      field(t('e6.farm', 'Farm'),
        select(farms.map((f) => ({ value: f.id, label: f.name })), d.farmId,
          (v) => { d.farmId = v; d.plotId = state.db.plots.find((p) => p.farmId === v)?.id; commit('e6'); })),
      field(t('e6.plot', 'Plot'),
        select(plots.map((p) => ({ value: p.id, label: `${p.name} · ${p.cropName}` })), d.plotId,
          (v) => { d.plotId = v; commit('e6'); })),
      field(t('e6.severity', 'How bad is it?'),
        chips([
          { id: 'low', label: t('e6.sev.low', 'Slight') },
          { id: 'medium', label: t('e6.sev.medium', 'Moderate') },
          { id: 'high', label: t('e6.sev.high', 'Severe') },
        ], d.severity, (id) => { d.severity = id; commit('e6'); })),
      field(t('e6.note', 'Note'), textarea({ value: d.note, oninput: (e) => { d.note = e.target.value; } })),

      h('div.status.status--nodata', icon('pin', 15),
        t('e6.location', 'Your position is recorded with this observation')),

      // WF5.124 / WF5.125 — photo disease detection needs a connection; it is
      // queued with a clear state rather than failing.
      when(d.photos > 0 && d.category === 'disease', () => (has('disease.photo')
        ? btn(t('e7.check', 'Check this photo for a disease'), {
            variant: 'secondary', icon: 'scan', onclick: () => go(`E7:${d.plotId}`),
          })
        : lockBox('disease.photo')))),

    dock: actionDock(btn(t('action.save', 'Save observation'), {
      variant: 'primary',
      onclick: () => { addObservation(d); resetLocal(`e6-${param}`); back(); },
    })),
  };
}

/* -- E7 · Photo disease check, WF5.124 / WF6.025 -------------------------- */

export function E7(plotId) {
  const plot = plotById(plotId);
  const d = local(`e7-${plotId}`, { stage: state.session.connectivity === 'offline' ? 'queued' : 'result', accepted: null });

  const result = { name: 'Dubas bug (Ommatissus lybicus)', confidence: 0.78, alt: 'Sooty mould (secondary)' };

  return {
    tabs: false,
    top: appBar({ title: t('e7.title', 'Photo disease check') }),
    body: page(
      h('div', {
        style: {
          width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius)',
          background: 'linear-gradient(150deg, var(--brand-300), var(--st-watch-bg))',
          display: 'grid', placeItems: 'center', color: 'var(--ink-700)',
        },
      }, icon('camera', 46)),

      d.stage === 'queued'
        // WF5.125 — a clear "will be checked when you have signal" state.
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div.status.status--nodata.status--lg', icon('clock', 17), t('e7.queued', 'Queued')),
            h('p', { style: { margin: 0 } }, t('e7.queued.body', 'This photo will be checked when you have signal. Your observation is already saved.')))
        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            card({ accent: 'watch' }, cardPad(
              h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, t('e7.likely', 'Most likely')),
              h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 700 } }, result.name),
              // WF6.025 — never presented as certain; the confidence is shown and
              // the user may reject it.
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h('span', { style: { flex: 1, height: '10px', borderRadius: '5px', background: 'var(--ink-100)', overflow: 'hidden' } },
                  h('span', { style: { display: 'block', height: '100%', width: `${result.confidence * 100}%`, background: 'var(--st-watch)' } })),
                h('span', { style: { fontWeight: 700 } }, `${Math.round(result.confidence * 100)}%`)),
              h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
                t('e7.alt', 'Also possible: {alt}', { alt: result.alt })),
              req('WF6.025'))),
            disclaimer(t('e7.notcertain', 'This is an automated suggestion, not a diagnosis. Always confirm on the ground before acting.')),
            h('div', { style: { display: 'flex', gap: '8px' } },
              btn(t('e7.accept', 'That looks right'), {
                variant: d.accepted === true ? 'primary' : 'secondary', block: false,
                onclick: () => { d.accepted = true; commit('e7'); },
              }),
              btn(t('e7.reject', 'That is not it'), {
                variant: d.accepted === false ? 'primary' : 'secondary', block: false,
                onclick: () => { d.accepted = false; commit('e7'); },
              })))),
    dock: actionDock(btn(t('action.done', 'Done'), { variant: 'primary', onclick: back })),
  };
}
