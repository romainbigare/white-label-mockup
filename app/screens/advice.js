/* ---------------------------------------------------------------------------
   advice.js — D1 Advice inbox and D2–D6, the detail screens.

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
     open, shared     out with somebody on the team
     done             the farmer marked it completed
     deferred         ignored or put off; it comes back tomorrow

   AND SHARING REPLACED ASSIGNING. An advice used to be assigned to one man and
   the app kept the account of it: who held it, whether he had closed it, and a
   screen (D7) asking how much was actually applied. None of that is kept now.
   The farmer picks somebody from his team, the advice goes out, and closing it
   is one button he presses himself. A farm where the owner rings the man who
   cannot read is not a farm that will keep a ledger in an app.

   The card is a three-line summary; the detail screens carry everything else.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { t } from '../core/i18n.js';
import { go, openSheet, back, switchTab } from '../core/router.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockBox, req, select, divider,
} from '../ui/components.js';
import { num, dateTime, area, ago, pct, timeWindow } from '../core/format.js';
import { adviceFor, adviceById, groupedAdvice, severityToStatus, farmById, plotById, visibleFarms, farmFilterLabel, supervisorOf, personName, isSent, unsentAdvice } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { markAdviceSeen, deferAdvice, restoreAdvice, completeAdvice } from '../data/actions.js';
import { statusLabel, bySeverity } from '../core/status.js';
import { detailRouteFor } from './plot.js';

/* -- D1's screener, WF5.102 -----------------------------------------------

   REVIEW 06/09 REBUILT IT, AND THE NOTE IS WORTH KEEPING WHOLE: "The screener
   is confusing with boxes and drop down menus. It seems there are three types
   of screening: by severity — urgent action, needs action, etc; by level of
   completion — done, assigned but not done, not completed; by type — irrigation,
   nutrition, etc. It seems three drop down menus are the easiest? The setting
   from the last login should be maintained. Also, can we develop the taxonomy
   of all available options under each type?"

   He read the screen correctly and then read it better than it was built. There
   were three filters, and they were drawn as three different KINDS of control —
   a pill-tab row, a scrolling chip strip and a select — which is why it looked
   like more than three. Worse, the pill tabs mixed two of his axes into one:
   "Needs action" is a severity, "Done" is a completion state, and "All" meant
   neither, so choosing one silently moved the other.

   So: three menus, one shape, one line each, and one axis each. Nothing is lost
   — every combination the chips and tabs could reach is reachable — and two
   combinations that were unreachable are not any more, because severity and
   completion no longer share a control.

   THE TAXONOMY IS BELOW, and it is the answer to his last question: these are
   all the options under each menu, and there are no others.

     severity     the four-state scale of WF2.008, unchanged and in the same
                  words the plot list uses. `good` is in the list for
                  completeness even though nothing raises a "good" advice —
                  leaving it out would make the scale look like three states in
                  one place and four everywhere else.
     completion   where the work has got to, which is the state machine at the
                  top of this file read as a filter: nobody told, told and
                  waiting, closed. `deferred` is not offered — an ignored item
                  is out of the inbox until tomorrow, and a filter for things
                  the app is deliberately not showing is a trap.
     type         the three kinds of advice the app raises, which is the same
                  list D2, D3 and D4 are the detail screens for. Weather is not
                  among them — see isAdvice() in selectors.js.

   AND THE SETTINGS ARE REMEMBERED. `state.session` is what this mockup has in
   place of an account, and the three live on it beside the layer choices, which
   WF5.075 already keeps for exactly this reason. */

const SEVERITY_FILTERS = ['all', 'urgent', 'action', 'watch'];

const COMPLETION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'notsent', label: 'Not actioned yet' },
  { id: 'sent', label: 'Shared' },
  { id: 'done', label: 'Done' },
];

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'nutrition', label: 'Fertilisation' },
  { id: 'protection', label: 'Crop protection' },
];

/* -- how the list is ordered ----------------------------------------------

   The inbox used to have one order — as things arrived, urgent first within the
   day — and the argument against it was that six urgent items from two fields
   arrive interleaved, so a farmer reading down the list never has all his
   tomato work in one place. The argument for it was that a list which moves
   around is a list in which you cannot find the thing that came in this
   morning.

   Both are right, which is why this is a choice rather than a rule. It is the
   one an email client offers, and the three answers are the three the farmer
   actually thinks in: when it arrived, how bad it is, and which piece of ground
   it is about. The choice is remembered beside the three filters. */
export const SORTS = [
  // `short` is what the section head shows — it already says "sorted by" in its
  // position, so the word only has to name the axis.
  { id: 'time', label: 'Delivery time', short: 'Newest' },
  { id: 'severity', label: 'Severity', short: 'Severity' },
  { id: 'field', label: 'Field', short: 'Field' },
];

/* The sort decides the headings as well as the order: a list sorted by field
   whose headings still say Today / This week / Later is sorted by one thing and
   grouped by another. */
function sortedGroups(list, sort) {
  if (sort === 'severity') {
    return ['urgent', 'action', 'watch']
      .map((key) => ({ id: `sev-${key}`, label: statusLabel(key), items: list.filter((a) => severityToStatus(a.severity) === key) }))
      .filter((g) => g.items.length);
  }
  if (sort === 'field') {
    const seen = new Map();
    for (const a of list) {
      const key = a.plotNames.join(', ') || t('d1.nofield', 'No field');
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(a);
    }
    return [...seen.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({ id: `field-${label}`, label, items: items.sort((x, y) => bySeverity(x, y, (i) => severityToStatus(i.severity))) }));
  }
  return groupedAdvice(list);
}

/* -- D1 · Advice inbox, WF5.094 … WF5.105 --------------------------------- */

export function D1() {
  const farmFilter = state.ui.farmFilter;
  const screen = state.session.adviceFilters;
  const set = (key, value) => { screen[key] = value; commit('advice'); };

  // WF5.105 — where the plan has no advisory, the tab still exists and shows
  // weather alerts plus a locked card describing what would appear. Never empty.
  const advisoryInPlan = has('advisory.operations') || has('fertiliser.insights') || has('irrigation.schedule') || has('irrigation.schedule.tree');

  // Completion decides which side of the open/done line the list starts on;
  // the other two narrow it. Done is a status in the data, the two open states
  // are told apart by whether anyone has been sent the job.
  const all = adviceFor({
    farmId: farmFilter,
    status: screen.completion === 'done' ? 'done' : screen.completion === 'all' ? 'all' : 'open',
    type: screen.type,
  });
  const byCompletion = all.filter((a) => {
    if (screen.completion === 'sent') return isSent(a);
    if (screen.completion === 'notsent') return a.status === 'open' && !a.sentAt;
    return true;
  });
  const list = screen.severity === 'all' ? byCompletion
    : byCompletion.filter((a) => severityToStatus(a.severity) === screen.severity);
  const groups = sortedGroups(list, screen.sort ?? 'time');

  const menu = (label, options, value, onchange) => h('div.screener__menu',
    h('span.screener__label', label),
    select(options, value, onchange, { 'aria-label': label }));

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
      /* WF5.102 — farm, severity, progress, type. The farm is a picker in the
         bar because it scopes everything under it; the other three are the
         screener, and since review 06/09 they are three menus of one shape.
         Each carries its own label: a bare select showing "Urgent" says what is
         chosen and not what was asked, and three of them side by side would be
         three answers to three invisible questions. */
      h('div.screener',
        menu(t('d1.by.severity', 'Severity'),
          SEVERITY_FILTERS.map((id) => ({
            value: id,
            label: id === 'all' ? t('d1.all', 'All') : statusLabel(id),
          })), screen.severity, (v) => set('severity', v)),
        // Type sits in the middle because its answers are one word each and
        // Progress's are three; the long menu takes the end of the row.
        menu(t('d1.by.type', 'Type'),
          TYPE_FILTERS.map((f) => ({ value: f.id, label: t(`advice.type.${f.id}`, f.label) })),
          screen.type, (v) => set('type', v)),
        menu(t('d1.by.progress', 'Progress'),
          COMPLETION_FILTERS.map((f) => ({ value: f.id, label: t(`d1.progress.${f.id}`, f.label) })),
          screen.completion, (v) => set('completion', v)))),

    body: page(
      when(!advisoryInPlan, () => lockBox('advisory.operations', {
        title: t('d1.locked.title', 'Advice is part of the Pro plan'),
        body: t('d1.locked.body', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind each recommendation.'),
      })),

      sendAllBar(farmFilter),

      /* THE SORT SITS ON THE FIRST HEADING, not in the screener. It is not a
         fourth filter — it does not change which advice is listed, only the
         order and therefore the headings themselves — and given a labelled menu
         of its own it took a whole row of a screen that only ever shows two
         cards. On the heading it is beside the thing it governs, and it reads
         as a quiet aside rather than a question the farmer has to answer. */
      groups.length
        ? groups.map((group, i) => section(t(`d1.group.${group.id}`, group.label.toUpperCase()), {
            aside: i === 0 ? sortAside(screen.sort ?? 'time') : null,
          },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              group.items.map((a) => adviceCard(a)))))
        : emptyState({
            iconName: 'check',
            title: screen.completion === 'done' ? t('d1.empty.done', 'Nothing recorded yet') : t('d1.empty.title', 'Nothing needs your attention'),
            body: screen.completion === 'done'
              ? t('d1.empty.done.body', 'Advice you act on will be listed here.')
              : t('d1.empty.body', 'When a plot needs water, feeding or protection we will put it here.'),
            // One way out of an over-narrowed screener, rather than one per
            // menu: a farmer who has filtered himself into an empty list wants
            // the list back, not a lesson in which of the three did it.
            action: (screen.severity !== 'all' || screen.completion !== 'all' || screen.type !== 'all')
              ? {
                  label: t('d1.clearscreen', 'Clear the filters'),
                  onclick: () => {
                    screen.severity = 'all'; screen.completion = 'all'; screen.type = 'all';
                    commit('advice');
                  },
                }
              : null,
          })),
  };
}

/* A word and a chevron, in the section head's own weight and colour, so it
   belongs to the heading rather than competing with it. Three options are too
   few to be worth a labelled select and too many for a toggle, so it opens the
   sheet the rest of the app opens for a choice of three. */
function sortAside(current) {
  return h('button.sortaside', {
    type: 'button',
    onclick: () => openSheet('ADVICE_SORT'),
    'aria-label': t('d1.by.sort', 'Sort by'),
  },
  icon('sort', 14),
  h('span', t(`d1.sort.short.${current}`, SORTS.find((o) => o.id === current)?.short ?? '')),
  icon('chevronDown', 14));
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
  if (!pending.length || !can('advice.send')) return null;
  const farmId = pending[0]?.farmId ?? (farmFilter === 'all' ? visibleFarms()[0]?.id : farmFilter);
  const who = personName(state.session.autoSendTo) ?? supervisorOf(farmId)?.name ?? null;

  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('users', 20)),
      h('span', { style: { fontWeight: 650, flex: 1 } },
        t('d1.unsent', '{n} not actioned yet', { n: num(pending.length) }))),
    when(state.session.autoSend && who, () => h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
      t('d1.autosend.on', 'New advice goes to {who} automatically.', { who }))),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      // "Send all to Hassan" named one man because the app had exactly one to
      // name. It has a team now, so the button asks who rather than assuming.
      btn(t('d1.sendallto', 'Send all to…'), {
        variant: 'emphasis', size: 'sm', block: false, icon: 'share',
        onclick: () => openSheet('SEND_TO', { farmId, list: pending }),
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
          onclick: () => openSheet('SEND_TO', { farmId, always: true }),
        }))));
}

/* -- the card, WF5.095 … WF5.099 ------------------------------------------

   THE CARD IS THREE LINES NOW, and that is the whole of this change: the
   severity and the kind, the ground it is about, and what to do. What came off
   it — the amount, the diagnosis, the two action buttons and the state line —
   is on the detail screen, one tap away, where there is room to grow it.

   The argument for the old card was that the farmer could act without leaving
   the list. The argument against it is what a list of fourteen of them looks
   like: a screen of rectangles each the height of a paragraph, through which
   nobody can scan. The alternative considered and set aside was an expanding
   box — same number of taps, no second screen — and it lost because a detail
   that has to fit inside a list item can never carry a chart, a week's
   schedule, or the reasoning behind the recommendation, and those are where
   this screen is going.

   The share control stays on the card, because sharing is the one thing a
   farmer does without needing to read further. */
export function adviceCard(a, opts = {}) {
  markAdviceSeen(a.id);
  const status = severityToStatus(a.severity);
  const farm = farmById(a.farmId);
  const sent = isSent(a);
  const open = () => go(`${detailRouteFor(a)}:${a.id}`);

  return card({ accent: status, onclick: opts.hideActions ? null : open }, cardPad(
    // 1. what kind of thing this is, and how bad
    /* No separator between the chip and the kind. At 360 dp a middot and its two
       gaps are thirteen pixels, and thirteen pixels was the difference between
       "Crop protection" and "Crop protec…". A filled pill beside plain text does
       not need a mark to say they are two things. */
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
      statusChip(status, { label: statusLabel(status).toUpperCase() }),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-600)', fontWeight: 600, flex: '1 1 0', minWidth: 0 } },
        icon(ADVICE_ICON[a.type] ?? 'advice', 17),
        h('span', { style: { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
          t(`advice.type.${a.type}`, a.type[0].toUpperCase() + a.type.slice(1))))),

    // 2. which ground. A tree group is NAMED after what grows on it, so printing
    // the crop after the plot gave "Date palms Date palm · Al Kharj North".
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      [a.plotNames.join(', '), a.cropName && !a.plotNames.some((n) => n.startsWith(a.cropName)) ? a.cropName : null, farm.name]
        .filter(Boolean).join(' · ')),

    /* 3. what to do — and the share control beside it rather than up on the
       first line. A 48 dp target is 48 dp the severity chip and the kind cannot
       have, and at 360 dp they need all of it; here the sentence takes what it
       needs and wraps, and the icon sits at the end of the card where the eye
       finishes reading. It overhangs the padding, which is how a 48 dp box fits
       against a 16 dp gutter without pushing the text in. */
    h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '4px', marginInlineEnd: '-10px' } },
      h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)', flex: '1 1 0', minWidth: 0 } }, a.action),
      when(a.status === 'open' && !opts.hideActions && can('advice.send', farm), () => h('button.iconbtn.iconbtn--bare', {
        onclick: (e) => { e.stopPropagation(); openSheet('SEND_TO', { farmId: a.farmId, list: [a] }); },
        'aria-label': t('advice.share', 'Send to'),
        style: { marginTop: '-6px' },
      }, icon('share', 20)))),

    // Anything that is not one of those three is a state, and a state only
    // earns a line when it is true.
    when(a.status === 'superseded', () => h('button.locked', {
      onclick: (e) => { e.stopPropagation(); const next = adviceById(a.supersededBy); if (next) go(`${detailRouteFor(next)}:${next.id}`); },
      style: { alignSelf: 'flex-start' },
    }, icon('refresh', 15), t('advice.superseded', 'Superseded — see the newer advice'))),

    when(a.status === 'done', () => h('div.status.status--good', { style: { alignSelf: 'flex-start' } },
      icon('check', 15), t('advice.recorded.done', 'Completed'))),

    when(a.status === 'deferred', () => h('button.locked', {
      style: { alignSelf: 'flex-start' },
      onclick: (e) => { e.stopPropagation(); restoreAdvice(a.id); },
    }, icon('clock', 15), t('advice.deferred', 'Hidden until tomorrow — put it back'))),

    when(sent && !opts.hideActions, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-700)', fontSize: 'var(--t-meta)' },
    }, icon('check', 15), t('advice.sentto', 'Sent to {who} {when}', {
      who: personName(a.sentTo) ?? t('advice.thesupervisor', 'your supervisor'),
      when: ago(a.sentAt),
    })))));
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
    /* THE THREE DISPOSITIONS, IN THE SHAPE THE REVIEW DREW THEM: send to,
       full width, at the top of the dock, because it is the thing the farmer
       came here to do; ignore and completed side by side beneath it.

       "Completed" used to live behind the ⋯ menu, which is where an action
       nobody can find lives. It closes the advice outright — there is no longer
       a screen asking how much was actually applied, because the app stopped
       tracking who was accountable for what and a record nobody reads is a form
       nobody fills in. A supervisor cannot send work to himself, so he gets the
       lower pair alone. */
    dock: a.status === 'open' ? actionDock(
      when(can('advice.send', farm), () => btn(t('advice.share', 'Send to'), {
        variant: 'primary', icon: 'share',
        onclick: () => openSheet('SEND_TO', { farmId: a.farmId, list: [a] }),
      })),
      h('div.actiondock__pair',
        btn(t('advice.ignore', 'Ignore'), { variant: 'secondary', onclick: () => { deferAdvice(a.id); back(); } }),
        btn(t('advice.complete', 'Completed'), { variant: 'secondary', icon: 'check', onclick: () => { completeAdvice(a.id); back(); } })),
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
      /* WF5.113 — cubic metres, and only cubic metres. Review 01/09 —
         "EXPRESS WATER REQUIREMENTS IN VOLUMETRIC RATES PER PLOT (m³/ha) rather
         than simple millimeter depths."

         The screen was already in cubic metres, and the figure it printed was
         already a rate: 8.4 mm/day of crop water use over a week at 85%
         efficiency is 693 m³ PER HECTARE, and it was labelled as the plot's
         total. On a 137 ha block of palms that is a hundredfold error in the
         one number the farmer acts on.

         So the headline is the rate, said as a rate, and the plot's total is
         underneath it with the area it was worked out from — which is the pair
         a farmer needs: one to set the system by, one to check the bill
         against. Every weekly amount below is in the same unit. */
      h('div.bignum', d.headline),
      when(d.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, d.headlineSub)),
      when(d.totalVolume, () => h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 600, color: 'var(--ink-700)' } },
        t('d2.total', '{volume} in total across {area}', {
          volume: d.totalVolume, area: area(d.areaHa ?? plot?.areaHa ?? 0),
        }))),
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
      // WF5.089 — elemental N, P, K, Ca, Mg per hectare. The recommendation is
      // still made in the nutrient, because that is what the crop is short of.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('d3.elemental2', 'Shown as elemental nutrient per hectare, with the products that supply it below.'),
        req('WF5.120')))),

    /* Review 01/09 — "PROVIDE APPLICATION RATES IN ACTUAL FERTILIZER PRODUCT
       TERMS (e.g. kg/ha of Urea or NPK formulation) rather than elemental
       values alone."

       The screen used to end the elemental block with a promise — "once you
       tell us which fertilisers you use, we'll show product equivalents too" —
       which asked the farmer for a shopping list before it would answer the
       question he came with: how much of what do I put on. He can convert
       41% K₂O into kilograms of sulphate; he should not have to.

       So the common products are worked out for him, with the rate per hectare
       and the amount for this plot, and MORE THAN ONE where more than one will
       do — the second line is what to buy if the first is not on the shelf.
       Whichever he uses, the nutrient above is the same. */
    when((a.detail.products ?? []).length > 0, () => section(t('d3.products', 'What to apply'), {},
      card({}, a.detail.products.map((product) => row({
        iconName: 'basket',
        title: product.name,
        sub: product.total,
        value: product.rate,
        chevron: false,
      }))))),

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
