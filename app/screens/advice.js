/* ---------------------------------------------------------------------------
   advice.js — D1 Advice inbox and D2, D3, D4, the detail screens.

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
import { icon } from '../ui/icons.js';
import {
  appBar, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockBox, req, divider,
} from '../ui/components.js';
import { num, date, dateTime, area, ago, pct, timeWindow, depth } from '../core/format.js';
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
                  among them — see isAdvice() in selectors.js — and D6, the
                  weather alert screen, went with it: F15 is the weather screen,
                  and one product does not need two.

   AND THE SETTINGS ARE REMEMBERED. `state.session` is what this mockup has in
   place of an account, and the three live on it beside the layer choices, which
   WF5.075 already keeps for exactly this reason. */

const SEVERITY_FILTERS = ['all', 'urgent', 'monitor'];

/* `short` is the toggle's word where the sheet's would not fit in 85 dp — the
   same split the type list makes, and for the same reason. "Completed" is what
   the option IS and it stays that in the sheet; on a toggle already headed
   STATUS, "Done" is the answer without the sentence. Its own key, because
   `d1.status.completed` is the sheet's and one key cannot hold two Englishes. */
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'completed', label: 'Completed', short: 'Done' },
];

/* THE MENU SAYS IT SHORTER THAN THE CARDS DO, and that is deliberate rather
   than sloppy. "Crop protection" is what an advice IS, and it stays that on the
   card and on D4; inside a menu already headed TYPE, the word "Crop" is the
   heading said twice, and carrying it costs the third column the width that
   truncated it to "Crop protec…".

   The short forms therefore have their OWN keys. `advice.type.*` is shared with
   the card headings, the detail screens and F9's distribution list — rewording
   it here would reword it in all of them, which is exactly the collision the
   string catalogue reports when one key is offered two Englishes. */
/* THE PROPER NAME OF EACH KIND, in one place. `advice.type.*` is read by the
   card, by the detail bar, by F9's distribution list and by the filter menu,
   and two of the three types have a real name that is not their id with a
   capital on it: "nutrition" advice is fertilisation and "protection" advice is
   crop protection. Leaving each call site to fall back to the id meant the
   English a translator receives depended on which screen rendered first. */
export const ADVICE_TYPE_LABEL = {
  irrigation: 'Irrigation',
  nutrition: 'Fertilisation',
  protection: 'Crop protection',
};

/** The name of one kind of advice, wherever it is printed. */
export function adviceTypeLabel(type) {
  return t(`advice.type.${type}`, ADVICE_TYPE_LABEL[type] ?? (type[0].toUpperCase() + type.slice(1)));
}

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'nutrition', label: 'Fertilisation', short: 'Fertiliser' },
  { id: 'protection', label: 'Crop protection', short: 'Protection' },
];

/* -- the four toggles, review 15/09 ---------------------------------------

   THE MENUS ARE NOT MENUS ANY MORE. Three drop-downs answered review 06/09 and
   held for two rounds, but they could never hold the fourth axis. The farm is a
   screener like the other three — "show me this farm's urgent irrigation" is
   one question in four parts — and it was up in the app bar purely because a
   select wide enough to read is a select there is not room for four of.

   So the control gives up the option list and keeps only the answer. A toggle
   is two lines in 85 dp: the axis, always, in small caps; and underneath it
   what the farmer has chosen. Pressing it opens the options as a sheet, which
   is where every other list of choices in this app lives — a sheet has the
   whole width of the phone for "Sent, not yet done", so the option set is no
   longer a thing the layout has to be able to afford.

   Two things fall out of it that the selects could not do. A toggle that is
   narrowing the list is TINTED, so the four together answer "why am I not
   seeing it?" at a glance instead of having to be read one at a time. And the
   farm sits with the other three, in the row that screens the list, rather
   than in the bar that names the screen.

   Each axis says where its answer is kept, what the sheet is called, the full
   options the sheet offers, and the short form the toggle shows. The toggle is
   85 dp and a sheet row is 350: "Crop protection" belongs in the sheet and
   "Protection" on the toggle, which is what the `short` forms above are for.
   FARM IS NOT IN THIS TABLE — its answer lives on state.ui, app-wide, and it
   already has a picker of its own with regions and survey states in it. */
export const ADVICE_AXES = {
  severity: {
    label: () => t('d1.by.severity', 'Severity'),
    options: () => SEVERITY_FILTERS.map((id) => ({
      id, label: id === 'all' ? t('d1.all', 'All') : statusLabel(id),
    })),
    short: (v) => (v === 'all' ? null : statusLabel(v)),
  },
  type: {
    label: () => t('d1.by.type', 'Type'),
    options: () => TYPE_FILTERS.map((f) => ({
      id: f.id, label: f.id === 'all' ? t('d1.all', 'All') : adviceTypeLabel(f.id),
    })),
    short: (v) => {
      if (v === 'all') return null;
      const f = TYPE_FILTERS.find((o) => o.id === v);
      return f?.short ? t(`d1.type.${v}`, f.short) : adviceTypeLabel(v);
    },
  },
  status: {
    label: () => t('d1.by.status', 'Status'),
    options: () => STATUS_FILTERS.map((f) => ({ id: f.id, label: t(`d1.status.${f.id}`, f.label) })),
    short: (v) => {
      if (v === 'all') return null;
      const f = STATUS_FILTERS.find((o) => o.id === v);
      return f?.short ? t(`d1.status.short.${v}`, f.short) : t(`d1.status.${v}`, f?.label ?? v);
    },
  },
};

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
  /* FIELD IS THE DEFAULT. A list ordered by arrival puts two fields' urgent
     work through each other, and a farmer walking his land works one field at a
     time — "all my tomato actions are in one place, all my cucumber actions are
     in another". Newest-first is what an inbox does, and this is not quite an
     inbox: nothing here is a message he has to answer, it is work waiting on
     ground he has to visit.

     `short` is what the section head shows. It already says "sorted by" in its
     position, so the word only has to name the axis. */
  { id: 'field', label: 'Field', short: 'Field' },
  { id: 'severity', label: 'Severity', short: 'Severity' },
  { id: 'time', label: 'Delivery time', short: 'Newest' },
];

/* The sort decides the headings as well as the order: a list sorted by field
   whose headings still say Today / This week / Later is sorted by one thing and
   grouped by another. */
function sortedGroups(list, sort) {
  if (sort === 'severity') {
    return ['urgent', 'monitor']
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
    status: screen.status === 'completed' ? 'completed' : screen.status === 'all' ? 'all' : 'open',
    type: screen.type,
  });
  const byCompletion = all.filter((a) => {
    if (screen.status === 'assigned') return a.status === 'open' && !!(a.assignedTo?.length || a.sentAt);
    if (screen.status === 'open') return a.status === 'open' && !(a.assignedTo?.length || a.sentAt);
    return true;
  });
  const list = screen.severity === 'all' ? byCompletion
    : byCompletion.filter((a) => severityToStatus(a.severity) === screen.severity);
  const groups = sortedGroups(list, screen.sort ?? 'field');

  /* One toggle: the axis it screens on, the answer, and the sheet that changes
     it. Tinted when it is narrowing the list. The chevron is on the axis line
     rather than beside the value — the value is the line that runs out of room
     first, and an arrow that pushes "Completed" into an ellipsis is an arrow
     that costs more than it says. */
  const toggle = (label, value, onclick, { on }) => h(
    `button.screener__toggle${on ? '.screener__toggle--on' : ''}`,
    { type: 'button', onclick, 'aria-label': `${label}: ${value}`, title: `${label}: ${value}` },
    h('span.screener__axis', h('span', label), icon('chevronDown', 12)),
    h('span.screener__value', value));

  const axis = (key) => {
    const spec = ADVICE_AXES[key];
    const chosen = screen[key] ?? 'all';
    return toggle(spec.label(), spec.short(chosen) ?? t('d1.all', 'All'),
      () => openSheet('ADVICE_FILTER', { axis: key }), { on: chosen !== 'all' });
  };

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', t('nav.advice', 'Advice')),
        // The spacer, and then the one control: the bar holds the screen's name
        // at one end and the job at the other, with nothing between them to
        // read past. Everything that screens the list is in the row below.
        h('div.appbar__spacer'),

        /* 701 — THE ONE THING ON THIS SCREEN THE FARMER STARTS HIMSELF.

           It spent a round as a full-width card above the list and the review
           was right to throw it out: D1 is a worklist, everything on it arrived
           from the model, and a row that begins something new sat across the
           grain of that and pushed the grouping and the sort towards the fold.

           An app bar is where the exception belongs. This file has called the
           screen an inbox from its first line, and an inbox puts compose in the
           bar — it is always there, it is outside the list, and it cannot move
           the list down. Top right, which is the corner a phone reserves for
           the thing you do rather than the thing you read. It is tinted because
           the four controls under it are filters and this one is a job; and it
           carries a WORD, because a bare camera glyph in a corner is a guess
           the farmer has to take. */
        h('button.chip.chip--action', {
          onclick: () => go('D5'),
          title: t('d1.photo.title', 'Get advice from a photo'),
        },
          icon('camera', 17),
          h('span', t('d1.photo', 'Photo check')))),

      /* WF5.102 — farm, severity, type, status, in the order a farmer narrows:
         which ground, how bad, what kind of work, how far it has got. Four
         toggles of one shape, one axis each, and the options in a sheet. */
      h('div.screener',
        toggle(t('d1.by.farm', 'Farm'),
          farmFilter === 'all' ? t('d1.all', 'All') : (farmFilterLabel(farmFilter) ?? t('d1.all', 'All')),
          () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('advice'); } }),
          { on: farmFilter !== 'all' }),
        axis('severity'),
        axis('type'),
        axis('status'))),

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
            aside: i === 0 ? sortAside(screen.sort ?? 'field') : null,
          },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              group.items.map((a) => adviceCard(a)))))
        : emptyState({
            iconName: 'check',
            title: screen.status === 'completed' ? t('d1.empty.completed', 'Nothing completed yet') : t('d1.empty.title', 'Nothing needs your attention'),
            body: screen.status === 'completed'
              ? t('d1.empty.done.body', 'Advice you act on will be listed here.')
              : t('d1.empty.body', 'When a plot needs water, feeding or protection we will put it here.'),
            // One way out of an over-narrowed screener, rather than one per
            // toggle: a farmer who has filtered himself into an empty list
            // wants the list back, not a lesson in which of the four did it.
            // The FARM is cleared with them now that it is one of the four —
            // a button that says "clear the filters" beside a row of four and
            // clears three of them is the trap this button exists to avoid.
            // It is app-wide scope, so it clears to exactly what pressing
            // "All farms" in its own picker would have set.
            action: (screen.severity !== 'all' || screen.status !== 'all' || screen.type !== 'all' || farmFilter !== 'all')
              ? {
                  label: t('d1.clearscreen', 'Clear the filters'),
                  onclick: () => {
                    screen.severity = 'all'; screen.status = 'all'; screen.type = 'all';
                    state.ui.farmFilter = 'all';
                    commit('advice');
                  },
                }
              : null,
          })),
  };
}

function sendAllBar(farmFilter) {
  const pending = unsentAdvice({ farmId: farmFilter });
  if (!pending.length || !can('advice.send')) return null;
  const farmId = pending[0]?.farmId ?? (farmFilter === 'all' ? visibleFarms()[0]?.id : farmFilter);

  /* ONE LINE, NOT A CARD OF THREE. It was a count, a state sentence and two
     full-size buttons — a block the height of an advice card, sitting above the
     advice and arguing for attention with it every morning.

     "Always send automatically" went entirely. It set a standing rule from a
     button on a list, which is a lot of consequence for one tap in the busiest
     place in the app, and the standing rules now live on F9 where they can be
     read and changed together.

     What is left is the count and the one action it implies, on one line: how
     many nobody has been told about, and the way to tell somebody. */
  return h('div.sendall',
    h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('users', 18)),
    h('span.sendall__count', t('d1.unsent', '{n} not actioned yet', { n: num(pending.length) })),
    h('button.sendall__action', {
      type: 'button',
      onclick: () => openSheet('SEND_TO', { farmId, list: pending }),
    }, icon('share', 16), h('span', t('d1.sendallto', 'Send all to…'))));
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
    /* No icon beside the kind, and no separator before it. The severity chip
       already carries a glyph, the share disc carries another, and a third on
       one line of a 360 dp card is what left "Crop protection" reading "Crop
       protec…". The word says which kind it is; the picture was saying it
       twice. */
    h('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '7px',
        // The disc overlays the corner, so the line stops short of it.
        paddingInlineEnd: (a.status === 'open' && !opts.hideActions && can('advice.send', farm)) ? '30px' : '0',
      },
    },
    statusChip(status, { label: statusLabel(status).toUpperCase() }),
    h('span', {
      style: {
        color: 'var(--ink-600)', fontWeight: 600, flex: '1 1 0', minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      },
    }, adviceTypeLabel(a.type))),

    /* THE SHARE CONTROL, TOP RIGHT, OUT OF THE FLOW.

       It sat in the first line for a while and had to be moved out: a 48 dp
       target beside the severity chip and the kind left "Crop protection" a few
       pixels short at 360 dp. Absolute rather than a flex child solves both
       halves at once — the line gets its full width back, and the button sits
       where a share control sits on every card the farmer has ever seen.

       It is DRAWN rather than bare. A grey glyph floating on a white card reads
       as decoration; a tinted disc reads as something to press, which it is,
       and it is the only thing on this card that is. Bigger was not the answer
       — the target is already 48 dp — so the weight is in the colour. */
    when(a.status === 'open' && !opts.hideActions && can('advice.send', farm), () => h('button.cardshare', {
      onclick: (e) => { e.stopPropagation(); openSheet('SEND_TO', { farmId: a.farmId, list: [a] }); },
      'aria-label': t('advice.share', 'Send to'),
      type: 'button',
    }, h('span.cardshare__disc', icon('share', 19)))),

    // 2. which ground. A tree group is NAMED after what grows on it, so printing
    // the crop after the plot gave "Date palms Date palm · Al Kharj North".
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      [a.plotNames.join(', '), a.cropName && !a.plotNames.some((n) => n.startsWith(a.cropName)) ? a.cropName : null, farm.name]
        .filter(Boolean).join(' · ')),

    // 3. what to do, in one line
    h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, a.action),

    // Anything that is not one of those three is a state, and a state only
    // earns a line when it is true. Superseded is not among them any more — a
    // replaced advice is out of the inbox altogether (see isLive() in
    // selectors.js) and says so on its own screen instead.
    when(a.status === 'completed', () => h('div.status.status--good', { style: { alignSelf: 'flex-start' } },
      icon('check', 15), t('advice.recorded.done', 'Completed'))),

    when(a.status === 'deferred', () => h('button.locked', {
      style: { alignSelf: 'flex-start' },
      onclick: (e) => { e.stopPropagation(); restoreAdvice(a.id); },
    }, icon('clock', 15), t('advice.deferred', 'Hidden until tomorrow — put it back'))),

    when(sent && !opts.hideActions, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-700)', fontSize: 'var(--t-meta)' },
    }, icon('check', 15), t('advice.sharedwith', 'Shared with {who} {when}', {
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
      title: adviceTypeLabel(a.type),
      subtitle: a.plotNames.join(', '),
      actions: [overflowAction(() => openSheet('ADVICE_MENU', { adviceId: a.id }))],
    }),
    body: page(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        statusChip(status, { label: statusLabel(status).toUpperCase() }),
        h('span', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
          t('advice.issued', 'issued {when}', { when: dateTime(a.issuedAt) }))),

      /* WF5.104 — a recommendation the model has replaced. It is only ever
         reached by an old link now, because the inbox stopped listing these; the
         screen says so where the farmer has already arrived, and hands him the
         one that supersedes it. */
      when(a.status === 'superseded', () => card({ accent: 'monitor' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650 } },
          icon('refresh', 18), t('advice.superseded.title', 'This advice has been replaced')),
        h('div', { style: { color: 'var(--ink-700)' } },
          t('advice.superseded.body', 'A newer reading of this plot changed the recommendation.')),
        btn(t('advice.superseded.open', 'Open the newer advice'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => { const next = adviceById(a.supersededBy); if (next) go(`${detailRouteFor(next)}:${next.id}`); },
        }),
        req('WF5.104')))),

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
  fair: { status: 'monitor', label: 'Fair', meaning: 'Some of what you apply is not reaching the roots.' },
  poor: { status: 'urgent', label: 'Poor', meaning: 'Much of what you apply is lost before it reaches the roots.' },
};

function weatherCalendar(farm, { activity = 'irrigation', title, split = [] } = {}) {
  const days = (farm?.weather?.forecast ?? []).slice(0, 7);
  const hasUnsuitable = days.some((day) => (day.activity?.[activity]?.status ?? 'good') !== 'good');
  const fallback = activity === 'irrigation'
    ? { status: 'urgent', message: '44°C heat — wait until after dusk.' }
    : { status: 'urgent', message: 'Strong wind — postpone application.' };
  return section(title ?? t('d2.calendar', 'This week’s weather conditions'), {},
    h('div.weather-calendar', days.map((day, index) => {
      const condition = !hasUnsuitable && index === 1
        ? fallback
        : day.activity?.[activity] ?? { status: 'good', message: 'Suitable' };
      const suggestion = activity === 'irrigation' ? split.find((item) => item.date === day.date) : null;
      return h(`div.weather-day.weather-day--${condition.status}`,
        h('div.weather-day__head', h('strong', day.day), h('span', day.date.slice(-2))),
        h('div.weather-day__marker', statusIcon(condition.status, 13)),
        h('div.weather-day__condition',
          h('strong', condition.status === 'good' ? t('d2.suitable', 'Suitable') : t('d2.unsuitable', 'Unsuitable')),
          h('span', condition.message)),
        when(suggestion, () => h('div.weather-day__suggestion',
          h('span', t('d2.irrigate', 'Irrigate')),
          h('strong', suggestion.volume ?? suggestion.volumeM3Ha),
          h('small', suggestion.window ?? timeWindow(suggestion.fromHour, suggestion.toHour)))));
    })));
}

/* 406 — today's evapotranspiration for one plot.

   ET₀ is a property of the DAY and lives on the farm's weather; Kc is a
   property of the CROP AT ITS STAGE and comes off the growth model. Neither
   belongs to the advice record, which is why this is worked out at render time
   from the two things that do carry it — and why a plot with no growth model
   yet simply gets no card rather than a made-up coefficient. */
function etToday(a, plot) {
  const farm = farmById(a.farmId);
  const et0 = farm?.weather?.forecast?.[0]?.et0Mm;
  const kc = plot?.growth?.kc;
  if (!et0 || !kc) return null;
  return { et0, kc, etc: Math.round(et0 * kc * 10) / 10 };
}

/** The sum, written out. Tabular figures so the three numbers line up, and the
    operators in the quiet ink so the eye reads the values first. */
function etSum({ et0, kc, etc }) {
  const figure = (value, label) => h('div', { style: { display: 'flex', flexDirection: 'column' } },
    h('span', { style: { fontWeight: 700, fontSize: 'var(--t-lead)', fontVariantNumeric: 'tabular-nums' } }, value),
    h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, label));
  const operator = (glyph) => h('span', { style: { color: 'var(--ink-500)', fontWeight: 600, paddingTop: '4px' } }, glyph);
  return h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' } },
    figure(depth(et0), t('d2.et.et0', 'Reference ET')),
    operator('×'),
    figure(num(kc, 2), t('d2.et.kc', 'Crop coefficient')),
    operator('='),
    figure(depth(etc), t('d2.et.etc', 'Crop use today')));
}

export function D2(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const d = a.detail;
  const eff = EFFICIENCY_LEVELS[d.efficiency?.level ?? 'good'];

  return adviceDetail(a, [
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
      when(d.vsUsualPct, () => h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 650, color: d.vsUsualPct > 0 ? 'var(--st-monitor)' : 'var(--st-good)' } },
        d.vsUsualPct > 0
          ? t('d2.vsusual.up', 'An increase of {pct} on your usual watering', { pct: pct(d.vsUsualPct) })
          : t('d2.vsusual.down', 'A reduction of {pct} on your usual watering', { pct: pct(Math.abs(d.vsUsualPct)) }))),
      req('WF5.113'))),

    /* WHERE THE NUMBER CAME FROM, WHICH IS WHAT 406 IS FOR.

       Evapotranspiration was the one feature on the 13/09 list that Mark had
       asked for by name, and it was in the app only as a glossary entry. The
       mistake would have been to give it a screen: nobody opens an ET screen.
       It is the arithmetic behind the volume above — reference ET is what the
       day would take off a standard grass surface, the crop coefficient scales
       it to what this plant at this stage actually draws, and the product is
       the depth the plot lost yesterday and has to be given back.

       So it goes directly under the figure it explains, as a sum the farmer
       can follow: ET₀ × Kc = crop use. Three numbers and an equals sign beat a
       paragraph, and they make the volume above checkable rather than handed
       down — the same argument that puts the quantities over the price on A13. */
    when(etToday(a, plot), () => card({}, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('droplet', 20)),
        h('span', { style: { fontWeight: 650 } }, t('d2.et', 'Why this much water'))),
      etSum(etToday(a, plot)),
      h('div', { style: { color: 'var(--ink-700)' } },
        t('d2.et.body', 'Reference ET is what today’s heat and wind would take off a standard grass surface. The crop coefficient scales that to what {crop} draws at {stage}, and the result is what the plot has to be given back.', {
          crop: (plot?.cropName ?? t('d2.et.thecrop', 'this crop')).toLowerCase(),
          stage: (plot?.growth?.stageName ?? t('d2.et.itsstage', 'its current stage')).toLowerCase(),
        }))))),

    when(plot?.weather?.forecast?.length || farmById(a.farmId)?.weather?.forecast?.length,
      () => weatherCalendar(farmById(a.farmId), { split: d.split ?? [] })),

    /* 602 — FERTIGATION, AS A COLUMN ON THE WATERING PLAN RATHER THAN A PLAN
       OF ITS OWN.

       The glossary has been telling farmers for months that "Wafra's irrigation
       scheduler can recommend fertigation timing and rates". It could not: the
       water advice lived here and the nutrient advice lived on D3, and nothing
       joined them, so a farmer on drip was told to water on Tuesday and to
       feed at some unrelated moment.

       Joining them IS the feature, and it has a hard precondition: fertigation
       only exists where the plumbing carries it. A pivot or a flooded field
       gets its nutrients broadcast, which is D3's business, so this card only
       appears for a drip or micro-irrigated plot — and the 13/09 review's own
       instruction, that scheduling stays inside the advice layer rather than
       becoming a standalone scheduler, is why it is a card here and not a new
       screen. */
    when(plot?.fertigation, () => card({}, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('seed', 20)),
        h('span', { style: { fontWeight: 650 } }, t('d2.fertigation', 'Feed with this water')),
        statusChip('good', { label: t('d2.fertigation.drip', 'Drip') })),
      kv([
        [t('d2.fert.product', 'Product'), plot.fertigation.product],
        [t('d2.fert.rate', 'Rate'), t('d2.fert.ratevalue', '{n} kg per hectare, per irrigation', { n: num(plot.fertigation.kgPerEventPerHa) })],
        [t('d2.fert.events', 'Split across'), t('d2.fert.eventsvalue', '{n} of this week’s irrigations', { n: num(plot.fertigation.events) })],
      ]),
      h('div', { style: { color: 'var(--ink-700)' } }, plot.fertigation.note)))),

    // WF5.114 / review S42 — the efficiency context follows the weather-adjusted
    // plan it qualifies, rather than interrupting the recommendation above it.
    card({ accent: eff.status }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        h('span', { style: { fontWeight: 650 } }, t('d2.efficiency', 'Irrigation efficiency')),
        statusChip(eff.status, { label: t(`d2.eff.${d.efficiency?.level ?? 'good'}`, eff.label) }),
        h('span', { style: { color: 'var(--ink-600)' } }, pct(d.efficiency?.pct ?? 85))),
      h('div', { style: { color: 'var(--ink-700)' } },
        t(`d2.eff.${d.efficiency?.level ?? 'good'}.meaning`, eff.meaning)))),

    // Review S43 — over- and under-watering is feedback, and it belongs where
    // the farmer is being told what to do about it.
    when(d.watering, () => card({ accent: 'monitor' }, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('monitor', 18),
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

/* -- D3 · Fertilisation advice, WF5.088 … WF5.090 ------------------------- */

export function D3(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();

  return adviceDetail(a, [
    card({}, cardPad(
      h('div.bignum', a.detail.headline),
      when(a.detail.applicationMethod === 'foliar-spray', () => h('div', { style: { fontWeight: 700, color: 'var(--brand-700)' } }, 'Apply as a foliar spray')),
      when(a.detail.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, a.detail.headlineSub)),
      divider(),
      // WF5.089 — elemental N, P, K, Ca, Mg per hectare. The recommendation is
      // still made in the nutrient, because that is what the crop is short of.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))),
      req('WF5.120'))),

    weatherCalendar(farmById(a.farmId), { activity: 'spraying', title: t('d3.calendar', 'This week’s application conditions') }),

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
    disclaimer(t('d3.nofertigation', 'Apply this to the foliage as a spray. Do not apply it through the irrigation system.'), false),
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
      when(d.mixing?.instruction || d.rate, () => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, d.mixing?.instruction ?? d.rate)))),

    weatherCalendar(farmById(a.farmId), { activity: 'spraying', title: t('d4.calendar', 'This week’s spray conditions') }),

    // WF5.093 / WF6.010 — the pre-harvest interval, prominently, and the earliest
    // safe harvest as a DATE, not a number of days.
    when(d.preHarvestIntervalDays != null, () => card({ accent: 'monitor' }, cardPad(
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

    // WF5.095 — symptom photographs and a short identification guide.
    when(d.identification, () => section(t('d4.identify', 'Check before you spray'), {},
      card({}, cardPad(
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto' } },
          [0, 1, 2].map((i) => h('div', {
            style: {
              flex: '0 0 auto', width: '104px', height: '82px', borderRadius: 'var(--radius-sm)',
              background: `linear-gradient(${140 + i * 40}deg, var(--brand-200), var(--st-monitor-bg))`,
              display: 'grid', placeItems: 'center', color: 'var(--ink-600)',
            },
          }, icon('camera', 22)))),
        h('p', { style: { margin: 0 } }, d.identification),
        h('ul', { style: { margin: 0, paddingInlineStart: '18px' } }, (d.symptoms ?? []).map((s) => h('li', s))))))),

    // WF5.094 / WF6.023 — permanent, non-dismissible.
    disclaimer(t('d4.label', 'Check the product label and your local regulations before applying. This is advice, not a prescription.'), true),
  ]);
}

/* -- D5 · Check a photo, new at the 13/09 catalogue review -----------------

   THE PHOTO CHECK CAME BACK, AND THIS TIME SOMETHING READS IT.

   A photo disease check existed once, as E7, and v1.5.4 deleted it with the
   field observation beside it — on the stated argument that "nothing in the app
   reads an observation, and a form whose output nothing consumes is a promise
   the build cannot keep". That was right then. It is not right now: the same
   round that asked for this feature also built the disease directory and the
   risk forecast, so a photographed leaf now has somewhere to land, something
   to be identified against, and a treatment to be handed on to.

   TWO STATES, ONE SCREEN. Before the shutter it is a camera with the one
   instruction that decides whether the answer is any good — get close, get the
   damage in frame, get the light behind you. After it, it is a result: what it
   most likely is, how sure we are, what to do, and the way into the directory
   entry. `D5R` renders the second state so the printed deck carries both,
   because a capture screen photographs as an empty frame.

   THE CONFIDENCE IS ON THE FACE OF IT. A diagnosis from one photograph is a
   shortlist, not a verdict, and the screen says so twice: a percentage beside
   the name, and a second candidate underneath. A farmer who sprays the wrong
   thing because an app sounded certain is a farmer who never opens it again. */

/* The mockup's own stand-in for the model's answer. Deterministic, and drawn
   from the real directory so the treatment and the pre-harvest interval on
   this screen are the same ones the entry carries — there is no second set of
   agronomy anywhere in the app. */
function photoResult() {
  const entries = state.db.diseases ?? [];
  const first = entries.find((x) => x.id === 'powdery-mildew') ?? entries[0];
  const second = entries.find((x) => x.id === 'spider-mite') ?? entries[1];
  return { first, second, confidence: 78 };
}

export function D5(shot) {
  const result = shot ? photoResult() : null;

  if (!result) {
    return {
      tabs: false,
      top: appBar({ title: t('d5.title', 'Check a photo'), onBack: () => back() }),
      body: page(
        /* THE VIEWFINDER, drawn rather than live. The mockup cannot open a
           camera, and a grey box labelled "camera" would tell a reviewer
           nothing — so this is the frame with the guidance inside it, which is
           what the farmer is actually looking at while he lines the shot up. */
        h('div', {
          style: {
            position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden',
            background: 'var(--ink-900)', color: 'var(--paper)',
            aspectRatio: '3 / 4', maxWidth: '100%',
            display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px',
          },
        },
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: .92 } },
          icon('camera', 44),
          h('div', { style: { fontWeight: 650 } }, t('d5.frame', 'Fill the frame with the damage')),
          h('div', { style: { fontSize: 'var(--t-meta)', maxWidth: '26ch' } },
            t('d5.frame.sub', 'One leaf, close up, with the light behind you. Include a healthy part of the leaf if you can.')))),

        section(t('d5.helps', 'What makes a photo we can read'), {},
          kv([
            [t('d5.helps.close', 'Distance'), t('d5.helps.closev', 'A hand’s width from the leaf')],
            [t('d5.helps.light', 'Light'), t('d5.helps.lightv', 'Daylight, no flash, no shadow across it')],
            [t('d5.helps.both', 'Framing'), t('d5.helps.bothv', 'Damaged and healthy tissue in one shot')],
          ])),

        disclaimer(t('d5.note', 'A photograph narrows it down; it does not confirm it. We will tell you what to look for on the plant to be sure.'))),
      dock: actionDock(
        btn(t('d5.take', 'Take the photo'), {
          variant: 'primary', size: 'big', icon: 'camera',
          // The mockup's shutter: it moves to the result state rather than
          // pretending to open a camera it has no access to.
          onclick: () => go('D5R:leaf'),
        }),
        h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('d5.mockhint', 'Mockup: the shutter opens the example result.'))),
    };
  }

  const { first, second, confidence } = result;
  return {
    tabs: false,
    top: appBar({ title: t('d5.result.title', 'What we think this is'), onBack: () => back() }),
    body: page(
      // The name and how sure we are, together, because neither means anything
      // without the other.
      card({ accent: first.severity }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          statusIcon(first.severity, 22),
          h('span', { style: { fontWeight: 750, fontSize: 'var(--t-lead)' } }, first.name),
          statusChip(first.severity, { label: t('d5.confidence', '{n}% match', { n: num(confidence) }) })),
        h('div', { style: { color: 'var(--ink-700)' } }, first.symptoms))),

      section(t('d5.confirm', 'Confirm it on the plant'), {},
        card({}, cardPad(
          h('div', { style: { color: 'var(--ink-700)' } }, first.conditions),
          h('div', { style: { fontWeight: 650, paddingTop: '6px' } }, t('d5.whattodo', 'What to do')),
          h('div', { style: { color: 'var(--ink-700)' } }, first.action),
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('d5.phi', 'Do not harvest for {n} days after treating.', { n: num(first.phiDays) }))))),

      // The second candidate, plainly labelled. One photograph cannot tell a
      // mildew from a mite burn every time, and the honest screen says which
      // other thing it might be rather than hiding the doubt.
      when(second, () => section(t('d5.other', 'It could also be'), {},
        card({}, h('button.row', { onclick: () => go(`F17D:${second.id}`) },
          statusIcon(second.severity, 20),
          h('div.row__main',
            h('div.row__title', second.name),
            h('div.row__sub', t('d5.other.sub', 'Read how to tell them apart'))),
          h('span.row__chev', icon('forward', 18, 'flip')))))),

      disclaimer(t('d5.result.note', 'This is a reading of one photograph. Check the plant before you spray, and log what you applied so the record stays straight.'))),
    dock: actionDock(
      btn(t('d5.open', 'Open the full entry'), {
        variant: 'primary',
        onclick: () => go(`F17D:${first.id}`),
      }),
      btn(t('d5.again', 'Take another photo'), {
        variant: 'quiet',
        onclick: () => go('D5', { replace: true }),
      })),
  };
}

/** The result state, registered separately so the deck prints both halves. */
export const D5R = D5;

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
