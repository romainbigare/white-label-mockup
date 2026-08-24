/* ---------------------------------------------------------------------------
   advice.js — D1 Advice inbox, D2–D6 detail screens, D7 Record what you did.

   §5.8 calls this the primary surface of the app: everything else exists to
   support it. It works like a message inbox — items arrive, are read, are acted
   on, and are cleared — and that sets the whole structure.

   ADVICE IS THE ONLY UNIT OF WORK IN THE APP. There used to be a second one: an
   advice that had been assigned became a TASK, on a task list, with a task
   screen and a task badge. The review deleted it, and this file is where that
   decision lands.

   The reasoning was Mark's, and it was about the farm rather than the software.
   A farm has an owner and one trusted supervisor. The owner reads the advice,
   decides, and sends it to that one man — by WhatsApp, with a link that says
   "I've done it". So the thing being decided, the thing being sent and the
   thing being waited on are one object, and giving them two names meant every
   screen had to keep the two in step.

   What survives is a state on the advice:

     open, not sent   the farmer has not decided
     open, sent       out with the supervisor, waiting to be closed
     done             somebody recorded what was actually done
     deferred         ignored or put off; it comes back tomorrow

   WF5.096's four actions become three, because "mark as complete" was only ever
   the task's, and WF5.097 still gives ignore no interval menu — the only option
   is tomorrow.

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
import { adviceFor, adviceById, groupedAdvice, severityToStatus, farmById, plotById, visibleFarms, farmFilterLabel, supervisorOf, personName, isSent, unsentAdvice } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { recordAction, markAdviceSeen, deferAdvice, restoreAdvice, sendAdvice, unsendAdvice, sendAllAdvice } from '../data/actions.js';
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

/* THE SECOND FILTER IS ON THE STATE OF THE WORK, NOT ON WHO HOLDS IT.

   It used to read "Anyone", with a list of people under it, and that was an
   error in the mockup rather than a design choice: an advice is not addressed
   to anybody until the farmer sends it, so filtering the inbox by assignee
   filtered on a field that is null for everything in it.

   What the review asked for instead is the four-state scale plus everything —
   all actions, urgent, action needed, watch, good — which is the same control
   the plot list carries, in the same words. */
const STATE_FILTERS = ['all', 'urgent', 'action', 'watch'];

export function D1() {
  const tab = state.ui.adviceTab;
  const farmFilter = state.ui.farmFilter;
  const typeFilter = state.ui.adviceTypeFilter;
  const stateFilter = state.ui.adviceStateFilter;

  // WF5.105 — where the plan has no advisory, the tab still exists and shows
  // weather alerts plus a locked card describing what would appear. Never empty.
  const advisoryInPlan = has('advisory.operations') || has('fertiliser.insights') || has('irrigation.schedule') || has('irrigation.schedule.tree');

  const all = adviceFor({ farmId: farmFilter, status: tab === 'done' ? 'done' : tab === 'all' ? 'all' : 'open', type: typeFilter });
  const bySeverityTab = tab === 'needs' ? all.filter((a) => a.severity !== 'watch') : all;
  const list = stateFilter === 'all' ? bySeverityTab
    : bySeverityTab.filter((a) => severityToStatus(a.severity) === stateFilter);
  const groups = groupedAdvice(list);
  const needsCount = adviceFor({ status: 'open' }).filter((a) => a.severity !== 'watch').length;
  const doneCount = adviceFor({ status: 'done' }).length;

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', t('nav.advice', 'Advice')),
        h('button.chip', {
          onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('advice'); } }),
          title: t('d1.pickfarm', 'Choose a farm'),
        },
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
        // Two controls, two rows. They were side by side and the type chips —
        // a scrolling strip of five — were squeezed to nothing beside a select
        // wide enough to hold the longest state name.
        chips(TYPE_FILTERS.map((f) => ({ ...f, label: t(`advice.type.${f.id}`, f.label) })), typeFilter,
          (id) => { state.ui.adviceTypeFilter = id; commit('advice'); }),
        select(STATE_FILTERS.map((id) => ({
          value: id,
          label: id === 'all' ? t('d1.allactions', 'All actions') : statusLabel(id),
        })), stateFilter, (v) => { state.ui.adviceStateFilter = v; commit('advice'); }))),

    body: page(
      when(!advisoryInPlan, () => lockBox('advisory.operations', {
        title: t('d1.locked.title', 'Advice is part of the Pro plan'),
        body: t('d1.locked.body', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind each recommendation.'),
      })),

      sendAllBar(farmFilter),

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
            action: stateFilter !== 'all'
              ? { label: t('d1.showallactions', 'Show all actions'), onclick: () => { state.ui.adviceStateFilter = 'all'; commit('advice'); } }
              : tab !== 'all' ? { label: t('d1.showall', 'See all advice'), onclick: () => { state.ui.adviceTab = 'all'; commit('advice'); } } : null,
          })),
  };
}

/* Review C443 … C445 — approving fourteen pieces of advice one card at a time,
   every morning, and sending all of them to the same man, is a farmer doing by
   hand what the app can see he is doing.

   So: one control that sends everything waiting, and an option to keep doing it
   without being asked. There is no picker any more — a farm has one supervisor
   and the app knows which one, which is the simplification the review bought.

   It is deliberately NOT silent. A farmer who has switched this on still sees
   what went out and to whom, and can turn it off from the same line. */
function sendAllBar(farmFilter) {
  const pending = unsentAdvice({ farmId: farmFilter });
  const who = supervisorOf(pending[0]?.farmId ?? (farmFilter === 'all' ? visibleFarms()[0]?.id : farmFilter));
  if (!pending.length || !who || !can('advice.send')) return null;

  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('users', 20)),
      h('span', { style: { fontWeight: 650, flex: 1 } },
        t('d1.unsent', '{n} not sent to anyone yet', { n: num(pending.length) }))),
    when(state.session.autoSend, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      t('d1.autosend.on', 'New advice goes to {who} automatically.', { who: who.name }))),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      btn(t('d1.sendallto', 'Send all to {who}', { who: who.name.split(' ')[0] }), {
        variant: 'emphasis', size: 'sm', block: false, icon: 'send',
        onclick: () => {
          const n = sendAllAdvice(pending);
          if (n) toast(t('d1.sentall', 'Sent {n} to {who}', { n: num(n), who: who.name.split(' ')[0] }));
        },
      }),
      state.session.autoSend
        ? btn(t('d1.autosend.off', 'Stop doing this'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => {
            state.session.autoSend = false;
            toast(t('d1.autosend.stopped', 'Advice will wait for you again'));
            commit('advice');
          },
        })
        : btn(t('d1.autosend.set', 'Always send automatically'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => {
            state.session.autoSend = true;
            toast(t('d1.autosend.started', 'New advice will go straight to {who}', { who: who.name.split(' ')[0] }));
            commit('advice');
          },
        }))));
}

/** WF5.095 … WF5.099 — the card contract. */
export function adviceCard(a, opts = {}) {
  markAdviceSeen(a.id);
  const status = severityToStatus(a.severity);
  const farm = farmById(a.farmId);
  const superseded = a.status === 'superseded';
  const sent = isSent(a);

  return card({ accent: status }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusChip(status, { label: statusLabel(status).toUpperCase() }),
      h('span', { style: { color: 'var(--ink-500)' } }, '·'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-600)', fontWeight: 600 } },
        icon(ADVICE_ICON[a.type] ?? 'advice', 17),
        t(`advice.type.${a.type}`, a.type[0].toUpperCase() + a.type.slice(1)))),
    // A tree group is NAMED after what grows on it, so printing the crop after
    // the plot gave "Date palms Date palm · Al Kharj North".
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      [a.plotNames.join(', '), a.cropName && !a.plotNames.some((n) => n.startsWith(a.cropName)) ? a.cropName : null, farm.name]
        .filter(Boolean).join(' · ')),

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

    // WHERE THE WORK IS. Above the buttons, because it changes what they say.
    when(a.status === 'open' && !opts.hideActions, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: sent ? 'var(--brand-700)' : 'var(--ink-600)', fontSize: 'var(--t-meta)' },
    }, icon(sent ? 'check' : 'users', 15), sent ? sentLine(a) : notSentLine(a))),

    // SEND and IGNORE, and nothing else — the two dispositions of a piece of
    // advice, which is what this card is.
    //
    // Once it HAS gone out the pair changes rather than disappears: the farmer
    // can still take it back if he changes his mind before anyone acts, and he
    // can still record what was done when the answer comes back by phone
    // instead of through the link.
    when(a.status === 'open' && !opts.hideActions && can('advice.acknowledge', farm), () => h('div', {
      style: { display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' },
    },
    sent
      ? [
        btn(t('advice.record', 'Record what was done'), {
          variant: 'secondary', size: 'sm', block: false, icon: 'check',
          onclick: () => go(`D7:${a.id}`),
        }),
        can('advice.send', farm) ? btn(t('advice.unsend', 'Take it back'), {
          variant: 'ghost', size: 'sm', block: false,
          onclick: () => unsendAdvice(a.id),
        }) : null,
      ]
      : [
        // WF2.010 — the inbox has many cards; none may claim the screen's single
        // primary action, so the emphasised card action is its own variant.
        can('advice.send', farm) ? btn(t('advice.send', 'Send to {who}', { who: (supervisorOf(a.farmId)?.name ?? '').split(' ')[0] }), {
          variant: 'emphasis', size: 'sm', block: false, icon: 'send',
          onclick: () => sendAdvice(a.id),
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

function notSentLine(a) {
  const who = supervisorOf(a.farmId);
  return who
    ? t('advice.notsent', 'Not sent yet · {who} would get it', { who: who.name })
    : t('advice.unassigned', 'Not sent to anyone yet');
}

/* Once it has gone out the same line reports rather than proposes, and says so
   in the verb — the difference between a suggestion the farmer still owns and a
   job already on somebody's phone. The second sentence is the mechanism, in the
   farmer's words: he is waiting for a tap, not for a status change. */
function sentLine(a) {
  return t('advice.sentto', 'Sent to {who} {when} · waiting for them to confirm', {
    who: personName(a.sentTo) ?? t('advice.thesupervisor', 'your supervisor'),
    when: ago(a.sentAt),
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
    // supervisor cannot send work to himself, so he gets Ignore alone.
    dock: a.status === 'open' ? (can('advice.send', farm)
      ? (isSent(a)
        ? actionDockPair(
          btn(t('advice.unsend', 'Take it back'), { variant: 'secondary', onclick: () => { unsendAdvice(a.id); back(); } }),
          btn(t('advice.record', 'Record what was done'), { variant: 'primary', onclick: () => go(`D7:${a.id}`) }))
        : actionDockPair(
          btn(t('advice.ignore', 'Ignore'), { variant: 'secondary', onclick: () => { deferAdvice(a.id); back(); } }),
          btn(t('advice.send', 'Send to {who}', { who: (supervisorOf(a.farmId)?.name ?? '').split(' ')[0] }),
            { variant: 'primary', icon: 'send', onclick: () => sendAdvice(a.id) })))
      : actionDock(
        btn(t('advice.ignore', 'Ignore'), { variant: 'primary', onclick: () => { deferAdvice(a.id); back(); } }))
    ) : null,
  };
}

/* WHY THERE IS NO DIAGNOSIS SECTION, AND NO ASSUMPTIONS SECTION, ON ANY OF THESE
   SCREENS.

   WF5.101 asks the detail view to say why the recommendation was made, what was
   assumed and which measures were used, and the build used to answer it with
   two blocks on every advice screen: a Diagnosis list of the model's inputs
   with their values — crop water use in mm/day, soil moisture depletion,
   available water capacity — and an editable Assumptions line beneath it.

   Both are gone. They are an agronomist's working, and these screens are read
   by the person who is about to open a valve or load a sprayer. Printing the
   arithmetic under the instruction does not make the instruction more
   trustworthy; it makes it longer, and it invites a farmer to audit a model he
   has no way to check rather than to act on advice he can.

   Nothing is lost from the record. Every input is still written to the advisory
   log the moment the recommendation is generated (§6.3), and the log is
   readable from ⋯ → "How this was worked out" on every one of these screens —
   which is where WF5.116 and WF6.019 are actually satisfied, because an audit
   trail that can be edited by the person being audited was never one.

   The one assumption a farmer can genuinely act on — how much of the water he
   applies reaches the roots — survives on D2 as the efficiency rating, at the
   top, in plain words. */

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
        t('d3.elemental', 'Shown as elemental nutrient per hectare. Once you tell us which fertilisers you use, we’ll show product equivalents too.'),
        req('WF5.120')))),

    when((a.detail.split ?? []).length > 0, () => section(t('d3.windows', 'Application windows'), {},
      card({}, a.detail.split.map((s) => row({ title: s.when, value: `${s.depth ?? ''} ${s.volume ?? ''}`.trim(), chevron: false }))))),

    // WF5.090 — say so explicitly rather than implying a fertigation schedule.
    disclaimer(t('d3.nofertigation', 'This is a fertiliser recommendation, not a fertigation schedule. Combined fertigation planning isn’t part of any current plan.'), false),
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
        t('d4.registernote', 'Only products registered in your country are shown. If a registration hasn’t been verified in the last 12 months, only the active ingredient appears.'),
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
