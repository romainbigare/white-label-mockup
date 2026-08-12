/* ---------------------------------------------------------------------------
   advice.js — D1 Advice inbox, D2–D6 detail screens, D7 Record what you did.

   §5.8 calls this the primary surface of the app: everything else exists to
   support it. It works like a message inbox — items arrive, are read, are acted
   on, and are cleared — and that sets the whole structure.

   Two things follow, and both are requirements rather than taste:

     * WF5.099 — every item arrives PRE-PACKAGED AS A TASK, with a description,
       a time and a suggested assignee already filled in. The farmer is
       approving a message, not composing one, which is why the card names the
       person and the deadline before it offers a button.
     * WF5.096 — four actions on every card: assign, ignore, remind me tomorrow,
       mark as complete. Ignore and remind are the same mechanism said two ways,
       and WF5.097 gives them no interval menu — the only option is tomorrow.

   The card body order is fixed by WF5.095 — what to do, how much, why — and the
   reason is mandatory. `adviceCard()` renders those three in that order and
   nothing may reorder them.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back, switchTab } from '../core/router.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, actionDockPair, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockBox, req, chips, pillTabs, select, divider, field, input, radioList,
} from '../ui/components.js';
import { num, date, dateTime, dayLabel, volume, depth, area, ago, pct, timeWindow } from '../core/format.js';
import { adviceFor, adviceById, groupedAdvice, severityToStatus, farmById, plotById, visibleFarms, assigneeName, assignees, farmFilterLabel, taskFromAdvice, unassignedAdvice } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { recordAction, markAdviceSeen, deferAdvice, restoreAdvice } from '../data/actions.js';
import { statusLabel } from '../core/status.js';
import { detailRouteFor } from './plot.js';

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'irrigation', label: 'Irrigation', icon: 'droplet' },
  { id: 'nutrition', label: 'Nutrition', icon: 'sprout' },
  { id: 'protection', label: 'Crop protection', icon: 'shield' },
  { id: 'weather', label: 'Weather', icon: 'cloud' },
];

/* -- D1 · Advice inbox, WF5.094 … WF5.105 --------------------------------- */

export function D1() {
  const tab = state.ui.adviceTab;
  const farmFilter = state.ui.farmFilter;
  const typeFilter = state.ui.adviceTypeFilter;
  const whoFilter = state.ui.adviceWhoFilter;

  // WF5.105 — where the plan has no advisory, the tab still exists and shows
  // weather alerts plus a locked card describing what would appear. Never empty.
  const advisoryInPlan = has('advisory.operations') || has('fertiliser.insights') || has('irrigation.schedule') || has('irrigation.schedule.tree');

  const all = adviceFor({ farmId: farmFilter, status: tab === 'done' ? 'done' : tab === 'all' ? 'all' : 'open', type: typeFilter });
  const bySeverityTab = tab === 'needs' ? all.filter((a) => a.severity !== 'watch') : all;
  // An owner with three workers wants to see what each of them has outstanding,
  // and a supervisor wants their own. Every item already names a suggested
  // assignee (WF5.099), so the filter is on that.
  const list = whoFilter === 'all' ? bySeverityTab
    : bySeverityTab.filter((a) => a.suggestedAssigneeId === whoFilter);
  const people = assignees(farmFilter === 'all' ? null : farmFilter);
  const groups = groupedAdvice(list);
  const needsCount = adviceFor({ status: 'open' }).filter((a) => a.severity !== 'watch').length;
  const doneCount = adviceFor({ status: 'done' }).length;

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', t('nav.advice', 'Advice')),
        h('button.chip', { onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('advice'); } }) },
          h('span', farmFilterLabel(farmFilter) ?? t('filter.allfarms', 'All farms')),
          icon('chevronDown', 15))),
      // WF5.102 — filters: farm, plot, type, status. Two rows, because status and
      // type are independent; 8 dp apart, which is WF2.004's minimum clearance
      // and therefore as tight as the pair is allowed to sit.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--touch-gap)', paddingBottom: '6px' } },
        pillTabs([
          { id: 'needs', label: t('d1.needs', 'Needs action'), count: needsCount },
          { id: 'all', label: t('d1.all', 'All') },
          { id: 'done', label: t('d1.done', 'Done'), count: doneCount },
        ], tab, (id) => { state.ui.adviceTab = id; commit('advice'); }),
        h('div', { style: { display: 'flex', gap: 'var(--touch-gap)', alignItems: 'center' } },
          h('div', { style: { flex: 1, minWidth: 0 } },
            chips(TYPE_FILTERS.map((f) => ({ ...f, label: t(`advice.type.${f.id}`, f.label) })), typeFilter,
              (id) => { state.ui.adviceTypeFilter = id; commit('advice'); })),
          select([{ value: 'all', label: t('d1.anyone', 'Anyone') },
            ...people.map((p) => ({ value: p.id, label: p.name }))],
          whoFilter, (v) => { state.ui.adviceWhoFilter = v; commit('advice'); },
          { style: { flex: '0 0 auto', maxWidth: '140px' } })))),

    body: page(
      when(!advisoryInPlan, () => lockBox('advisory.operations', {
        title: t('d1.locked.title', 'Advice is part of the Pro plan'),
        body: t('d1.locked.body', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind it.'),
      })),

      autoAssignBar(farmFilter),

      groups.length
        ? groups.map((group) => section(t(`d1.group.${group.id}`, group.label.toUpperCase()), {},
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              group.items.map((a) => adviceCard(a)))))
        : emptyState({
            iconName: 'check',
            title: tab === 'done' ? t('d1.empty.done', 'Nothing recorded yet') : t('d1.empty.title', 'Nothing needs your attention'),
            body: tab === 'done'
              ? t('d1.empty.done.body', 'Advice you act on will be listed here.')
              : t('d1.empty.body', 'When a plot needs water, feeding or protection we will put it here.'),
            action: whoFilter !== 'all'
              ? { label: t('d1.showanyone', 'Show everyone'), onclick: () => { state.ui.adviceWhoFilter = 'all'; commit('advice'); } }
              : tab !== 'all' ? { label: t('d1.showall', 'See all advice'), onclick: () => { state.ui.adviceTab = 'all'; commit('advice'); } } : null,
          })),
  };
}

/* Review C443 … C445 — approving fourteen pieces of advice one card at a time,
   every morning, sending all of them to the same supervisor, is a farmer doing
   by hand what the app can see he is doing.

   So: one control that turns every unassigned item into work for one person,
   and an option to keep doing it. The default assignee is the supervisor,
   because that is who the farmer picks in the picker every time anyway.

   It is deliberately NOT silent. A farmer who has switched this on still sees
   what went out and to whom, and can turn it off from the same line — an inbox
   that quietly empties itself is one nobody trusts. */
function autoAssignBar(farmFilter) {
  const pending = unassignedAdvice({ farmId: farmFilter });
  const people = assignees(farmFilter === 'all' ? null : farmFilter);
  const preferred = state.session.autoAssignTo
    ? people.find((p) => p.id === state.session.autoAssignTo)
    : null;
  if (!pending.length || !people.length || !can('task.assign')) return null;

  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('users', 20)),
      h('span', { style: { fontWeight: 650, flex: 1 } },
        t('d1.unassigned', '{n} not sent to anyone yet', { n: num(pending.length) }))),
    when(preferred, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      t('d1.autoassign.on', 'New advice goes to {who} automatically.', { who: preferred.name }))),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      btn(preferred
        ? t('d1.assignallto', 'Send all to {who}', { who: preferred.name.split(' ')[0] })
        : t('d1.assignall', 'Send them all to one person'), {
        variant: 'emphasis', size: 'sm', block: false,
        onclick: () => openSheet('AUTO_ASSIGN', { farmId: farmFilter }),
      }),
      when(preferred, () => btn(t('d1.autoassign.off', 'Stop doing this'), {
        variant: 'secondary', size: 'sm', block: false,
        onclick: () => {
          state.session.autoAssignTo = null;
          toast(t('d1.autoassign.stopped', 'Advice will wait for you again'));
          commit('advice');
        },
      })))));
}

/** WF5.095 … WF5.099 — the card contract. */
export function adviceCard(a, opts = {}) {
  markAdviceSeen(a.id);
  const status = severityToStatus(a.severity);
  const farm = farmById(a.farmId);
  const superseded = a.status === 'superseded';
  // The task raised from this advice, if the farmer has approved one. It is
  // what turns the card from a decision into a thing being waited on.
  const sent = a.status === 'open' ? taskFromAdvice(a.id) : null;

  return card({ accent: status }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusChip(status, { label: statusLabel(status).toUpperCase() }),
      h('span', { style: { color: 'var(--ink-500)' } }, '·'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-600)', fontWeight: 600 } },
        icon(ADVICE_ICON[a.type] ?? 'advice', 17),
        t(`advice.type.${a.type}`, a.type[0].toUpperCase() + a.type.slice(1)))),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      `${a.plotNames.join(', ')}${a.cropName ? ` ${a.cropName}` : ''} · ${farm.name}`),

    // 1. what to do
    h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, a.action),
    // 2. how much
    when(a.amount, () => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 650 } }, a.amount)),
    // 3. why — mandatory. Named the same thing here as on the detail screen,
    // so the short form and the long form are recognisably the same field.
    h('div', { style: { color: 'var(--ink-600)' } },
      h('b', t('advice.diagnosis.label', 'Diagnosis: ')), a.reason),

    // WF5.104 — superseded advice is marked and links to its replacement.
    when(superseded, () => h('button.locked', {
      onclick: () => { const next = adviceById(a.supersededBy); if (next) go(`${detailRouteFor(next)}:${next.id}`); },
      style: { alignSelf: 'flex-start' },
    }, icon('refresh', 15), t('advice.superseded', 'Superseded — see the newer advice'))),

    when(a.status === 'done', () => h('div.status.status--good', { style: { alignSelf: 'flex-start' } },
      icon('check', 15), t('advice.recorded.done', 'Recorded'))),

    // WF5.098 — a deferred item is not deleted; it comes back tomorrow.
    when(a.status === 'deferred', () => h('button.locked', {
      style: { alignSelf: 'flex-start' },
      onclick: () => restoreAdvice(a.id),
    }, icon('clock', 15), t('advice.deferred', 'Hidden until tomorrow — put it back'))),

    // WF5.099 — who it is already addressed to, and by when. The farmer is
    // approving a message rather than writing one, so this is above the buttons.
    when(a.status === 'open' && !opts.hideActions, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ink-600)', fontSize: 'var(--t-meta)' },
    }, icon('users', 15), sent ? sentLine(sent) : suggestedLine(a))),

    // ASSIGN and IGNORE, and nothing else — the two dispositions of a piece of
    // advice, which is what this card is.
    //
    // "Mark as complete" used to appear here once the work had been sent, and
    // it has gone from every advice surface in the app. A task is an advice
    // that has been assigned; completing work is therefore something that
    // happens to a TASK, on a task screen, by the person who did it. Offering
    // it here let the farmer close an advice behind the back of the worker
    // still holding the job, and left the task open with nothing to close it.
    //
    // Once the work HAS been sent there is nothing left to decide from here, so
    // the buttons go and the line above says where the work went.
    when(a.status === 'open' && !opts.hideActions && can('advice.acknowledge', farm), () => h('div', {
      style: { display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' },
    },
    sent
      ? btn(t('advice.opentask', 'Open the task'), {
        variant: 'secondary', size: 'sm', block: false, icon: 'check',
        onclick: () => go(`E2:${sent.id}`),
      })
      : [
        // WF2.010 — the inbox has many cards; none may claim the screen's single
        // primary action, so the emphasised card action is its own variant.
        can('task.assign', farm) ? btn(t('advice.assign', 'Assign'), {
          variant: 'emphasis', size: 'sm', block: false,
          onclick: () => go(`E3:advice=${a.id}`),
        }) : null,
        btn(t('advice.ignore', 'Ignore'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => deferAdvice(a.id),
        }),
      ],
    h('span', { style: { flex: 1 } }),
    h('button.iconbtn.iconbtn--bare', {
      onclick: () => openSheet('ADVICE_MENU', { adviceId: a.id }),
      'aria-label': t('action.more', 'More'),
    }, icon('dots', 22)))),

    when(a.status !== 'open' || opts.hideActions, () => h('button.textlink', {
      onclick: () => go(`${detailRouteFor(a)}:${a.id}`),
      style: { alignSelf: 'flex-end' },
    }, `${t('action.open', 'Open')} →`))));
}

/* WF5.099 — the suggested assignee, named, in the language they will read it
   in. WF5.100 asks that the farmer see WHO it goes to before confirming, and a
   name with no language beside it hides the part most likely to be wrong. */
function suggestedLine(a) {
  const who = a.suggestedAssigneeId ? assigneeName(a.suggestedAssigneeId) : null;
  if (!who) return t('advice.unassigned', 'Not addressed to anyone yet');
  return t('advice.suggested', '{who} · {when}', { who, when: a.suggestedDue ?? t('advice.soon', 'soon') });
}

/* Once the task exists the same line reports rather than proposes, and says so
   in the verb — "Ahmed · today" and "Sent to Ahmed · today" are the difference
   between a suggestion the farmer still owns and work already on a phone. */
function sentLine(task) {
  return t('advice.sentto', 'Sent to {who} · due {when}', {
    who: assigneeName(task.assigneeId),
    when: dayLabel(task.dueAt),
  });
}

/* -- shared detail shell -------------------------------------------------- */

function adviceDetail(a, extra) {
  const farm = farmById(a.farmId);
  const status = severityToStatus(a.severity);
  return {
    top: appBar({
      title: t(`advice.type.${a.type}`, a.type[0].toUpperCase() + a.type.slice(1)),
      subtitle: a.plotNames.join(', '),
      actions: [overflowAction(() => openSheet('ADVICE_MENU', { adviceId: a.id }))],
    }),
    body: page(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        statusChip(status, { label: statusLabel(status).toUpperCase() }),
        h('span', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
          t('advice.issued', 'issued {when}', { when: dateTime(a.issuedAt) }))),
      ...extra,
      // WF5.118 / WF6.025 — present on every advisory detail screen, not dismissible.
      disclaimer(t('advice.disclaimer', 'This is advice, not a prescription. Check conditions on the ground.')),
      h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
        t('advice.rule', 'Rule version {v}', { v: a.ruleVersion }), req('WF6.018'))),
    // The same two dispositions the card carries, in the same order. A
    // supervisor who cannot assign gets Ignore alone: completing is a task
    // action, and there is no task until somebody has been sent the work.
    dock: a.status === 'open' ? (can('task.assign', farm)
      ? actionDockPair(
        btn(t('advice.ignore', 'Ignore'), { variant: 'secondary', onclick: () => { deferAdvice(a.id); back(); } }),
        btn(t('advice.assign', 'Assign'), { variant: 'primary', onclick: () => go(`E3:advice=${a.id}`) }))
      : actionDock(
        btn(t('advice.ignore', 'Ignore'), { variant: 'primary', onclick: () => { deferAdvice(a.id); back(); } }))
    ) : null,
  };
}

/* WF5.101 asks the detail view to say why the recommendation was made, what was
   assumed and which measures were used. That block has a name: Diagnosis. The
   heading matters more than it looks — "Why" reads as a justification the app is
   offering for itself, and a farmer deciding whether to act on 693 m³ is
   reading a diagnosis, which is a thing he can agree or disagree with. */
function whyBlock(a) {
  // WF5.116 / WF6.019 — every input used, with its value.
  return section(t('advice.diagnosis', 'Diagnosis'), {},
    card({}, cardPad(
      h('ul', { style: { margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '5px' } },
        (a.detail.why ?? []).map((w) => h('li', h('span', { style: { color: 'var(--ink-600)' } }, `${w.label}: `), h('b', w.value)))),
      req('WF5.116'))));
}

function assumptionsBlock(a) {
  if (!a.detail.assumptions) return null;
  // WF5.117 / WF6.020 — editable, and the edit is recorded against the PLOT.
  //
  // WF4.096 removed the irrigation SYSTEM — drip, pivot, sprinkler — from the
  // schema entirely. What survives here is what the calculation actually uses:
  // efficiency, soil type and the pump's flow rate. Knowing a farm is on drip
  // tells the model nothing that 85% efficiency does not tell it better.
  return section(t('advice.assumptions', 'Assumptions we used'), {
    action: { label: t('action.edit', 'Edit'), onclick: () => openSheet('ASSUMPTIONS', { adviceId: a.id }) },
  }, card({}, cardPad(
    h('div', a.detail.assumptions),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      t('advice.assumptions.note', 'Correcting these recalculates future advice and is saved against the plot, not just this recommendation.')))));
}

/* -- D2 · Irrigation advice, WF5.111 … WF5.118 ----------------------------
   This screen was rebuilt around one finding: a farmer opening it wants to know
   how much water, on which days, and whether that is more or less than usual.
   Everything else on it was working against those three answers.

     * ONE total, for the week. It used to print the weekly volume, then the
       volume per watering, then the same water as pump-hours, then again as
       litres per tree — four numbers describing one decision, and the farmer
       had to work out which one to act on.
     * A DAY and a TIME for each watering. That was the thing genuinely missing,
       and it is a two-hour window rather than a start time and a duration:
       without a measured flow rate "6 p.m. for 2 h 6 m" is a precision the app
       does not have.
     * The recommendation stated as a CHANGE. "693 m³" means nothing to somebody
       who does not know what he usually applies; "20% more than usual" is the
       same advice in the units he actually thinks in.
     * The DIAGNOSIS section has gone. Five model inputs with their values —
       crop water use in mm/day, soil moisture depletion, available water
       capacity — is an agronomist's working, and this screen is read by the
       person opening the valve. It is all still recorded, and still readable,
       behind ⋯ → "How this was worked out", which is where an audit belongs.
     * The ASSUMPTIONS section went with it, replaced by the one line of it that
       is actionable: the efficiency rating.

   Scheduling is PER PLOT and says so. One plot has one irrigation system and
   one schedule; a per-tree schedule is not a thing that can be carried out.
   Warnings may still be per tree — an individual palm can be drowning while its
   plot is short — but the instruction cannot be. */

const EFFICIENCY_LEVELS = {
  good: { status: 'good', label: 'Good', meaning: 'Most of the water you apply reaches the roots.' },
  fair: { status: 'watch', label: 'Fair', meaning: 'Some of what you apply is not reaching the roots.' },
  poor: { status: 'urgent', label: 'Poor', meaning: 'Much of what you apply is lost before it reaches the roots.' },
};

export function D2(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const d = a.detail;
  const eff = EFFICIENCY_LEVELS[d.efficiency?.level ?? 'good'];

  return adviceDetail(a, [
    // WF5.114 / review S42 — at the top, for this plot, showing the level that
    // applies and not the three that do not.
    card({ accent: eff.status }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('span', { style: { fontWeight: 650 } }, t('d2.efficiency', 'Irrigation efficiency')),
        statusChip(eff.status, { label: t(`d2.eff.${d.efficiency?.level ?? 'good'}`, eff.label) }),
        h('span', { style: { color: 'var(--ink-600)' } }, pct(d.efficiency?.pct ?? 85))),
      h('div', { style: { color: 'var(--ink-700)' } },
        t(`d2.eff.${d.efficiency?.level ?? 'good'}.meaning`, eff.meaning)))),

    card({}, cardPad(
      // WF5.113 — cubic metres, and only cubic metres.
      h('div.bignum', d.headline),
      when(d.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, d.headlineSub)),
      // Review S40 — the number the farmer can actually judge.
      when(d.vsUsualPct, () => h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650, color: d.vsUsualPct > 0 ? 'var(--st-action)' : 'var(--st-good)' } },
        d.vsUsualPct > 0
          ? t('d2.vsusual.up', 'An increase of {pct} on your usual watering', { pct: pct(d.vsUsualPct) })
          : t('d2.vsusual.down', 'A reduction of {pct} on your usual watering', { pct: pct(Math.abs(d.vsUsualPct)) }))),
      h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
        t('d2.perplot', 'For {plot} as a whole. One plot, one schedule.', { plot: plot?.shortName ?? '' })),
      req('WF5.113'))),

    // Review S39 — the day and the time, which is what somebody has to be told
    // in order to go and do it.
    when((d.split ?? []).length > 0, () => section(t('d2.plan', 'This week'), {},
      card({}, d.split.map((s) => row({
        iconName: 'droplet',
        title: s.when,
        sub: s.fromHour != null ? timeWindow(s.fromHour, s.toHour) : null,
        value: s.volume, chevron: false,
      }))))),

    // Review S43 — over- and under-watering is feedback, and it belongs where
    // the farmer is being told what to do about it.
    when(d.watering, () => card({ accent: 'watch' }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('watch', 18),
        h('span', { style: { fontWeight: 650 } },
          d.watering.direction === 'over'
            ? t('d2.over', 'You are watering more than we advise')
            : t('d2.under', 'You are watering less than we advise'))),
      h('div', { style: { color: 'var(--ink-700)' } },
        d.watering.direction === 'over'
          ? t('d2.over.body', 'About {pct} more than advised over the last month. Reduce it towards the amounts above.', { pct: pct(d.watering.pct) })
          : t('d2.under.body', 'About {pct} less than advised over the last month. Increase it towards the amounts above.', { pct: pct(d.watering.pct) }))))),

    // WF5.115 — the flow rate is still worth having, so it is still asked for,
    // but it no longer promises a pumping time we then print as fact.
    when(plot && !plot.flowRateM3h, () => card({}, h('button.row', {
      onclick: () => toast(t('b4.addflow.done', 'We will ask for this when you next log irrigation')),
    }, icon('info', 18),
       h('div.row__main', h('div.row__title', t('d2.noflow', 'Add your system flow rate')),
         h('div.row__sub', t('d2.noflow.sub', 'It sharpens the window we give you.'))),
       h('span.row__chev', icon('forward', 18, 'flip'))))),
  ]);
}

/* -- D3 · Nutrition advice, WF5.088 … WF5.090 ----------------------------- */

export function D3(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();

  return adviceDetail(a, [
    card({}, cardPad(
      h('div.bignum', a.detail.headline),
      when(a.detail.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, a.detail.headlineSub)),
      divider(),
      // WF5.089 — elemental N, P, K, Ca, Mg per hectare. Never lead with a product.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('d3.elemental', 'Given as elemental nutrient per hectare. Product equivalents appear once you record which fertilisers you hold.'),
        req('WF5.120')))),

    when((a.detail.split ?? []).length > 0, () => section(t('d3.windows', 'Application windows'), {},
      card({}, a.detail.split.map((s) => row({ title: s.when, value: `${s.depth ?? ''} ${s.volume ?? ''}`.trim(), chevron: false }))))),

    whyBlock(a),
    assumptionsBlock(a),

    // WF5.090 — say so explicitly rather than implying a fertigation schedule.
    disclaimer(t('d3.nofertigation', 'This is a fertiliser recommendation, not a fertigation schedule. A combined fertigation plan is not part of any plan we sell.'), false),
  ]);
}

/* -- D4 · Crop protection advice, WF5.091 … WF5.096 ----------------------- */

export function D4(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const d = a.detail;

  return adviceDetail(a, [
    card({}, cardPad(
      // WF5.091 / WF6.009 — lead with the active ingredient and rate.
      h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, t('d4.ai', 'Active ingredient')),
      h('div', { style: { fontSize: 'var(--t-head)', fontWeight: 700, lineHeight: 1.15 } }, d.activeIngredient ?? a.action),
      when(d.rate, () => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, d.rate)))),

    // WF5.093 / WF6.010 — the pre-harvest interval, prominently, and the earliest
    // safe harvest as a DATE, not a number of days.
    when(d.preHarvestIntervalDays != null, () => card({ accent: 'action' }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        icon('calendar', 20),
        h('span', { style: { fontWeight: 700 } }, t('d4.phi', 'Pre-harvest interval'))),
      h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 700 } },
        t('d4.phidays', '{n} days', { n: num(d.preHarvestIntervalDays) })),
      h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650 } },
        t('d4.earliest', 'Earliest safe harvest: {date}', { date: d.earliestSafeHarvest })),
      when(d.reentryHours, () => h('div', { style: { color: 'var(--ink-600)' } },
        t('d4.reentry', 'Do not re-enter the plot for {n} hours after spraying', { n: num(d.reentryHours) }))),
      req('WF5.123')))),

    // WF5.092 / WF6.008 — products only where the register holds a verified
    // registration for THIS country.
    when((d.products ?? []).length > 0, () => section(t('d4.products', 'Registered products in your country'), {},
      card({}, d.products.map((p) => row({
        title: p.name, sub: `${t('d4.regno', 'Registration')} ${p.registration} · ${p.registrant}`, chevron: false,
      })),
      h('div', { style: { padding: '10px 16px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('d4.registernote', 'Only products registered where your farm is are shown. Where an entry has not been verified in the last 12 months we show the active ingredient alone.'),
        req('WF6.011', 'WF6.017'))))),

    // WF5.095 — symptom photographs and a short identification guide.
    when(d.identification, () => section(t('d4.identify', 'Check before you spray'), {},
      card({}, cardPad(
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto' } },
          [0, 1, 2].map((i) => h('div', {
            style: {
              flex: '0 0 auto', width: '104px', height: '82px', borderRadius: 'var(--radius-sm)',
              background: `linear-gradient(${140 + i * 40}deg, var(--brand-200), var(--st-watch-bg))`,
              display: 'grid', placeItems: 'center', color: 'var(--ink-600)',
            },
          }, icon('camera', 22)))),
        h('p', { style: { margin: 0 } }, d.identification),
        h('ul', { style: { margin: 0, paddingInlineStart: '18px' } }, (d.symptoms ?? []).map((s) => h('li', s))))))),

    whyBlock(a),

    // WF5.094 / WF6.023 — permanent, non-dismissible.
    disclaimer(t('d4.label', 'Check the product label and your local regulations before applying. This is advice, not a prescription.'), true),
  ]);
}

/* -- D6 · Weather alert, WF5.097 / WF5.098 --------------------------------- */

const ALERT_TYPES = [
  { id: 'frost', label: 'Frost', icon: 'snow' },
  { id: 'heat', label: 'Heat stress', icon: 'thermometer' },
  { id: 'wind', label: 'High wind (spraying)', icon: 'wind' },
  { id: 'rain', label: 'Heavy rain', icon: 'rain' },
  { id: 'dust', label: 'Sandstorm and dust', icon: 'dust' },
  { id: 'humidity', label: 'High humidity (disease)', icon: 'droplet' },
];

export function D6(param) {
  // D6 is reachable both from an advice item and from a farm's weather strip.
  const a = adviceById(param);
  const farm = a ? farmById(a.farmId) : farmById(param);
  const alert = farm.weather.alert;

  const body = [
    card({ accent: a ? severityToStatus(a.severity) : (alert?.severity ?? 'watch') }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { color: 'var(--st-action)', display: 'flex' } }, icon('thermometer', 30)),
        h('div',
          h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, a?.action ?? alert?.title ?? t('d6.none', 'No active alert')),
          h('div', { style: { color: 'var(--ink-600)' } }, a?.amount ?? alert?.detail ?? ''))),
      // WF5.097 — the threshold crossed, the window, and what it means.
      kv([
        [t('d6.threshold', 'Threshold crossed'), a?.detail?.why?.[0]?.value ?? '44 °C air temperature'],
        [t('d6.window', 'Window'), a?.detail?.why?.[1]?.value ?? 'Tuesday 4 August, 12:00–16:00'],
        [t('d6.meaning', 'What it means'), a?.reason ?? alert?.detail ?? ''],
      ]),
      req('WF5.097'))),

    section(t('d6.forecast', 'Next 7 days'), {},
      card({}, cardPad(
        h('div', { style: { display: 'flex', gap: '10px', overflowX: 'auto' } },
          farm.weather.forecast.slice(0, 7).map((f) => h('div', { style: { flex: '0 0 auto', textAlign: 'center', minWidth: '48px' } },
            h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, f.day),
            h('div', { style: { display: 'flex', justifyContent: 'center', color: 'var(--ink-500)' } },
              icon(f.rainMm > 0 ? 'rain' : f.condition === 'Clear' ? 'sun' : 'cloud', 20)),
            h('div', { style: { fontWeight: 700 } }, `${num(f.hiC)}°`),
            h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } }, `${num(f.loC)}°`))))))),

    section(t('d6.types', 'Alerts we watch for'), {},
      card({}, ALERT_TYPES.map((type) => row({
        iconName: type.icon, title: t(`d6.type.${type.id}`, type.label), chevron: false,
        value: h('span.status.status--good', icon('check', 14), t('d6.on', 'On')),
      })))),

    h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
      t('d6.push', 'Severe weather alerts are always pushed, in each person’s own language, and ignore quiet hours.'), req('WF5.098')),
  ];

  if (a) return adviceDetail(a, body);

  return {
    top: appBar({ title: t('d6.title', 'Weather alert'), subtitle: farm.name }),
    body: page(...body),
  };
}

/* -- D7 · Record what you did, WF5.099 … WF5.102 -------------------------- */

const NOT_DONE_REASONS = [
  { id: 'nowater', label: 'No water available' },
  { id: 'pump', label: 'Pump failure' },
  { id: 'weather', label: 'Weather' },
  { id: 'notneeded', label: 'Not needed' },
  { id: 'other', label: 'Other' },
];

export function D7(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const d = local(`d7-${adviceId}`, { choice: null, amount: '', unit: 'm3', reason: null, note: '' });
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const isTree = plot?.treeCount > 0;

  const submit = (kind) => {
    recordAction(a, {
      kind,
      amount: d.amount || null,
      unit: d.unit,
      reason: d.reason,
      note: d.note || null,
    });
    back();
  };

  return {
    top: appBar({ title: t('d7.title', 'What did you do?') }),
    body: page(
      h('div', { style: { color: 'var(--ink-600)' } },
        `${t(`advice.type.${a.type}`, a.type)} · ${a.plotNames.join(', ')} · ${t('d7.advised', 'advised {x}', { x: a.detail.headline })}`),

      // WF5.099 — three big choices, one tap each.
      btn(t('d7.full', 'I applied the full amount'), {
        variant: d.choice === 'full' ? 'primary' : 'secondary', size: 'huge', icon: 'check',
        onclick: () => { d.choice = 'full'; commit('d7'); },
      }),
      btn(t('d7.different', 'I applied a different amount'), {
        variant: d.choice === 'different' ? 'primary' : 'secondary', size: 'huge', icon: 'edit',
        onclick: () => { d.choice = 'different'; commit('d7'); },
      }),
      btn(t('d7.notdone', 'I did not do this'), {
        variant: d.choice === 'notdone' ? 'primary' : 'secondary', size: 'huge', icon: 'close',
        onclick: () => { d.choice = 'notdone'; commit('d7'); },
      }),

      when(d.choice === 'different', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        field(t('d7.howmuch', 'How much did you apply?'),
          h('div.inputgroup.inputgroup--suffix',
            input({ type: 'number', inputmode: 'decimal', value: d.amount, oninput: (e) => { d.amount = e.target.value; } }),
            select([
              { value: 'mm', label: t('unit.mm', 'mm') },
              { value: 'm3', label: t('unit.m3', 'm³') },
              ...(isTree ? [{ value: 'lpt', label: t('unit.lpertree', 'litres per tree') }] : []),
            ], d.unit, (v) => { d.unit = v; commit('d7'); }))),
        field(t('d7.note', 'Note (optional)'), input({ value: d.note, oninput: (e) => { d.note = e.target.value; } })))),

      when(d.choice === 'notdone', () => field(t('d7.why', 'Why not?'),
        radioList(NOT_DONE_REASONS.map((r) => ({ id: r.id, label: t(`d7.reason.${r.id}`, r.label) })),
          d.reason, (id) => { d.reason = id; commit('d7'); }))),

      // WF5.102 — this screen works offline.
      when(state.session.connectivity === 'offline', () => disclaimer(
        t('d7.offline', 'You are offline. We will save this on your phone and send it when you have signal.')))),

    dock: d.choice ? actionDock(btn(t('action.confirm', 'Confirm'), {
      variant: 'primary',
      disabled: d.choice === 'notdone' && !d.reason,
      onclick: () => submit(d.choice === 'full' ? 'full' : d.choice === 'different' ? 'different' : 'not-done'),
    })) : null,
  };
}

function notFound() {
  return {
    top: appBar({ title: '' }),
    body: emptyState({
      iconName: 'info', title: t('advice.gone.title', 'This advice is no longer available'),
      body: t('advice.gone.body', 'It may have been superseded. Open the advice inbox to see the current list.'),
      action: { label: t('nav.advice', 'Advice'), onclick: () => switchTab('advice') },
    }),
  };
}
