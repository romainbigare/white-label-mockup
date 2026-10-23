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
import { state, commit } from '../core/store.js';
import { t, upper } from '../core/i18n.js';
import { go, openSheet, back, switchTab } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockBox, req, segmented, deckMark, upgradeSheet,
  tile, pill, heroCard, minis, dayStrip, roundButton,
} from '../ui/components.js';
import { num, date, dateTime, area, ago, timeWindow, clock, splitFigure } from '../core/format.js';
import { adviceFor, adviceById, groupedAdvice, severityToStatus, farmById, plotById, visibleFarms, farmFilterLabel, supervisorOf, personName, isSent, unsentAdvice, diseaseById, plotsForFilter, farmsForFilter } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { markAdviceSeen, deferAdvice, restoreAdvice, completeAdvice } from '../data/actions.js';
import { statusLabel, bySeverity } from '../core/status.js';
import { detailRouteFor } from './plotparts.js';
import { metricName, metricWord } from '../ui/metric.js';
import { measureScore } from '../core/health.js';

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
                  weather alert screen, went with it: F4 is the weather screen,
                  and one product does not need two.

   AND THE SETTINGS ARE REMEMBERED. `state.session` is what this mockup has in
   place of an account, and the three live on it beside the layer choices, which
   WF5.075 already keeps for exactly this reason. */

const SEVERITY_FILTERS = ['all', 'urgent', 'monitor'];

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'completed', label: 'Completed' },
];

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

/* NO ABBREVIATIONS ANY MORE. There used to be a second, shorter set of words
   here — "Fertiliser", "Protection", "Done" — because the value had to fit in
   an 85 dp box beside three others. Nothing narrow prints a value now: the
   options are in a sheet and the state is a full-width line, so every place
   that names a kind of advice names it the way the cards do. */
const TYPE_FILTERS = ['all', 'irrigation', 'nutrition', 'protection'];

/* -- the filters, v1.7.4 -------------------------------------------------

   ONE BAR, NOT A ROW OF PILLS. Four pills, a Plots/Trees switch, the line of
   chosen values, the send-all line and the sort on the first heading took so
   much of the screen that "there's barely any space left for actual advice"
   (October review). Now the switch is in the app bar, and one bar under it
   says what the list is narrowed to and how it is sorted — "All farms · All
   advice / Sorted by field" — with the send-all line folded into its foot.
   Pressing the bar opens one sheet with every filter and the sort in it
   (ADVICE_FILTERS); its end button sorts, or clears the filters when any are
   on. Plant diagnosis is a floating button, out of the list's way.

   Each axis says what it is called, what the sheet offers, and how one chosen
   value is printed on the bar. The farm is not in this table — its answer
   lives on state.ui, app-wide — but the sheet offers it beside the three. */
export const ADVICE_AXES = {
  severity: {
    label: () => t('d1.by.severity', 'Severity'),
    iconName: 'warning',
    options: () => SEVERITY_FILTERS.map((id) => ({
      id, label: id === 'all' ? t('d1.all', 'All') : statusLabel(id),
    })),
    chosen: (v) => (v === 'all' ? null : statusLabel(v)),
  },
  type: {
    label: () => t('d1.by.type', 'Type'),
    iconName: 'layers',
    options: () => TYPE_FILTERS.map((id) => ({
      id, label: id === 'all' ? t('d1.all', 'All') : adviceTypeLabel(id),
    })),
    chosen: (v) => (v === 'all' ? null : adviceTypeLabel(v)),
  },
  status: {
    label: () => t('d1.by.status', 'Status'),
    iconName: 'check',
    options: () => STATUS_FILTERS.map((f) => ({ id: f.id, label: t(`d1.status.${f.id}`, f.label) })),
    chosen: (v) => (v === 'all' ? null : t(`d1.status.${v}`, STATUS_FILTERS.find((f) => f.id === v)?.label ?? v)),
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
   grouped by another.

   BY FIELD, EVERY PLOT IS A HEADING (v1.7.3), in number order — 1, 2 … 10,
   never 10 before 2 — and a plot with nothing to do is listed too, with "No
   action" under it. An empty plot is good news, and the farmer reading down
   his plots should see that Plot 3 is fine rather than wonder whether it was
   left out. That holds while the list is unfiltered; narrowed to "urgent" or
   to "done", only the plots with something in them are headed, because "No
   action" under a filter would be a claim about the filter, not the plot.

   `plots` is the tab's plots — fields on one tab, tree groups on the other —
   for the farm being shown. A heading names the farm too when the inbox spans
   several, because every farm has a Plot 1.

   Each group arrives with its heading already in the reader's language. Only
   the three time groups are words of this screen's own; a severity is the
   scale's word and a field is the plot's name, both localised where they come
   from. */
function sortedGroups(list, sort, { plots, everyPlot, manyFarms }) {
  if (sort === 'severity') {
    return ['urgent', 'monitor']
      .map((key) => ({ id: `sev-${key}`, label: upper(statusLabel(key)), items: list.filter((a) => severityToStatus(a.severity) === key) }))
      .filter((g) => g.items.length);
  }
  if (sort === 'field') {
    const ordered = [...plots].sort((a, b) => (manyFarms ? a.farmName.localeCompare(b.farmName) : 0)
      || a.shortName.localeCompare(b.shortName, undefined, { numeric: true }));
    return ordered
      .map((plot) => ({
        id: `field-${plot.id}`,
        label: upper(manyFarms ? `${plot.shortName} · ${plot.farmName}` : plot.shortName),
        items: list.filter((a) => a.plotIds.includes(plot.id))
          .sort((x, y) => bySeverity(x, y, (i) => severityToStatus(i.severity))),
      }))
      .filter((g) => everyPlot || g.items.length);
  }
  return groupedAdvice(list).map((g) => ({ ...g, label: t(`d1.group.${g.id}`, g.label.toUpperCase()) }));
}

/* -- D1 · Advice inbox, WF5.094 … WF5.105 --------------------------------- */

export function D1() {
  const farmFilter = state.ui.farmFilter;
  const screen = state.session.adviceFilters;

  // WF5.105 — where the plan has no advisory, the tab still exists and shows
  // weather alerts plus a locked card describing what would appear. Never empty.
  const advisoryInPlan = ['advisory.operations', 'fertiliser.insights', 'irrigation.schedule', 'irrigation.schedule.tree']
    .some((key) => has(key));

  // Completion decides which side of the open/done line the list starts on;
  // the other two narrow it. Done is a status in the data, the two open states
  // are told apart by whether anyone has been sent the job.
  const all = adviceFor({
    farmId: farmFilter,
    status: screen.status === 'completed' ? 'completed' : screen.status === 'all' ? 'all' : 'open',
    type: screen.type,
  });
  // A plot, when the inbox was opened from one. It narrows within the farm.
  const plotFilter = state.ui.plotFilter ?? null;
  const forPlot = plotFilter ? all.filter((a) => a.plotIds.includes(plotFilter)) : all;
  const byCompletion = forPlot.filter((a) => {
    if (screen.status === 'assigned') return a.status === 'open' && !!(a.assignedTo?.length || a.sentAt);
    if (screen.status === 'open') return a.status === 'open' && !(a.assignedTo?.length || a.sentAt);
    return true;
  });
  /* TWO TABS, PLOTS AND TREES (v1.7.3). The trees tab lists tree groups
     only, and a tree group exists from forty trees (core/trees.js), so a
     species below that never appears here — plotsForFilter() leaves it out. */
  const kind = screen.kind ?? 'plots';
  const tabPlots = plotsForFilter(farmFilter)
    .filter((p) => (kind === 'trees' ? p.kind === 'trees' : p.kind !== 'trees'))
    .filter((p) => !plotFilter || p.id === plotFilter);
  const tabIds = new Set(tabPlots.map((p) => p.id));
  const severityList = screen.severity === 'all' ? byCompletion
    : byCompletion.filter((a) => severityToStatus(a.severity) === screen.severity);
  const list = severityList.filter((a) => a.plotIds.some((id) => tabIds.has(id)));
  const groups = sortedGroups(list, screen.sort ?? 'field', {
    plots: tabPlots,
    everyPlot: screen.severity === 'all' && screen.type === 'all' && (screen.status === 'all' || screen.status === 'open'),
    manyFarms: new Set(tabPlots.map((p) => p.farmId)).size > 1,
  });

  /* Everything the four filters are set to, cleared in one move. It is the
     same reset behind the filter bar's end button, the sheet's "Clear all"
     and the empty state's own way out, and it includes the FARM: four filters
     and a button that cleared three of them is the trap it exists to avoid. The farm is
     app-wide scope, so this sets exactly what "All farms" in its picker sets. */
  const clearFilters = () => {
    screen.severity = 'all'; screen.status = 'all'; screen.type = 'all';
    state.ui.farmFilter = 'all';
    state.ui.plotFilter = null;
    commit('advice');
  };
  const narrowed = farmFilter !== 'all' || !!plotFilter || screen.severity !== 'all'
    || screen.type !== 'all' || screen.status !== 'all';

  // What the filters are set to, in the sheet's order, for the bar.
  const chosenWords = [
    farmFilter !== 'all' ? farmFilterLabel(farmFilter) : null,
    plotFilter ? plotById(plotFilter)?.shortName : null,
    ADVICE_AXES.severity.chosen(screen.severity ?? 'all'),
    ADVICE_AXES.type.chosen(screen.type ?? 'all'),
    ADVICE_AXES.status.chosen(screen.status ?? 'all'),
  ].filter(Boolean);

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', t('nav.advice', 'Advice')),
        h('div.appbar__spacer'),
        /* TWO TABS, PLOTS AND TREES, in the bar: they are the two halves of
           the inbox rather than a filter, so they sit with its name. */
        segmented([
          { id: 'plots', label: t('d1.tab.plots', 'Plots') },
          { id: 'trees', label: t('d1.tab.trees', 'Trees') },
        ], kind, (id) => { screen.kind = id; state.ui.plotFilter = null; commit('advice'); }, { size: 'pill' }))),

    // Light touch (v1.8): the inbox keeps its own widgets and corners.
    body: page({ class: 'page--dense' },
      when(!advisoryInPlan, () => lockBox('advisory.operations')),

      filterBar(chosenWords, screen.sort ?? 'field', { farmFilter, clearFilters }),

      groups.length
        ? groups.map((group) => section(group.label, {},
            group.items.length
              ? h('div.cardstack',
                group.items.map((a) => adviceCard(a)))
              : h('div.noaction.noaction--row', icon('check', 18), h('span', t('box.noaction', 'No action')))))
        : emptyState({
            iconName: 'check',
            title: screen.status === 'completed' ? t('d1.empty.completed', 'Nothing completed yet') : t('d1.empty.title', 'Nothing needs your attention'),
            body: screen.status === 'completed'
              ? t('d1.empty.done.body', 'Advice you act on will be listed here.')
              : t('d1.empty.body', 'When a plot needs water, feeding or protection we will put it here.'),
            // One way out of an over-narrowed list: a farmer who has filtered
            // himself into an empty list wants the list back.
            action: narrowed
              ? { label: t('d1.clearscreen', 'Clear the filters'), onclick: clearFilters }
              : null,
          }),
      // Room under the last card for the floating button.
      h('div.fabroom')),

    /* "PLANT DIAGNOSIS" — the one thing on this screen the farmer starts
       himself (701), named for what it is for: pests, disease, and too much
       or too little water. A floating button since v1.7.4, so it costs the
       list nothing; it carries a word, because a bare camera glyph is a guess. */
    fab: h('button.fabpill', {
      type: 'button',
      onclick: () => (diagnosisOpen() ? go('D5') : upgradeSheet('disease.photo')),
      title: t('d1.diagnosis.title', 'Photograph a plant to find out what is wrong with it'),
      ...deckMark({ deckTo: diagnosisOpen() ? 'D5' : null }),
    }, icon(diagnosisOpen() ? 'camera' : 'lock', 20), h('span', t('d1.diagnosis', 'Plant diagnosis'))),
  };
}

/* PLANT DIAGNOSIS IS PREMIUM (`disease.photo`) — one rule, asked by its three
   doors (the D1 button, the More row and D5 itself). Locked, each door stays
   in place and opens the upgrade sheet (WF9.033). */
export function diagnosisOpen() {
  return has('disease.photo');
}

/* THE FILTER BAR. Its main part says what the list is narrowed to and how it
   is sorted, and opens the sheet with every filter in it. The end button
   clears the filters when any are on, and sorts when none are. The foot is
   the send-all line: how many nobody has been told about, and the way to tell
   somebody. "Always send automatically" lives on F9 with the other standing
   rules. */
function filterBar(chosenWords, sort, { farmFilter, clearFilters }) {
  const on = chosenWords.length;
  const sortWord = t(`d1.sort.short.${sort}`, SORTS.find((o) => o.id === sort)?.short ?? '');
  const pending = can('advice.send') ? unsentAdvice({ farmId: farmFilter }) : [];
  const farmId = pending[0]?.farmId ?? (farmFilter === 'all' ? visibleFarms()[0]?.id : farmFilter);
  return h('div.filterbar',
    h('div.filterbar__main',
      h('button.filterbar__open', {
        type: 'button', onclick: () => openSheet('ADVICE_FILTERS'), title: t('d1.filters.title', 'Filter and sort'),
        ...deckMark({ deckNote: 'Opens every filter and the sort, in one sheet' }),
      },
      h(`span.filterbar__icon${on ? '.is-on' : ''}`, icon('filter', 18),
        when(on, () => h('b.filterbar__count', num(on)))),
      h('span.filterbar__text',
        h('span.filterbar__what', on ? chosenWords.join(' · ') : t('d1.filters.none', 'All farms · All advice')),
        h('span.filterbar__how', t('d1.sortedby', 'Sorted by {sort}', { sort: sortWord.toLocaleLowerCase() })))),
      on
        ? h('button.filterbar__end', {
          type: 'button', onclick: clearFilters,
          'aria-label': t('d1.clear', 'Clear'), title: t('d1.clear', 'Clear'),
        }, icon('close', 18))
        : h('button.filterbar__end.filterbar__end--sort', {
          type: 'button', onclick: () => openSheet('ADVICE_FILTERS'),
          'aria-label': t('d1.by.sort', 'Sort by'), title: t('d1.by.sort', 'Sort by'),
        }, icon('sort', 18))),
    when(pending.length, () => h('button.filterbar__send', {
      type: 'button', onclick: () => openSheet('SEND_TO', { farmId, list: pending }),
    },
    icon('users', 16),
    h('span', t('d1.unsent', '{n} not actioned yet', { n: num(pending.length) })),
    h('b', icon('share', 15), t('d1.sendallto', 'Send all to…')))));
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

  const sharing = a.status === 'open' && !opts.hideActions && can('advice.send', farm);
  return card({ accent: status, onclick: opts.hideActions ? null : open, class: 'advicecard' }, cardPad(
    // 1. how bad, and what kind of thing this is. The line stops short of the
    //    share button that sits in the corner.
    h(`div.advicecard__top${sharing ? '.advicecard__top--share' : ''}`,
      statusChip(status, { label: upper(statusLabel(status)) }),
      h('span.advicecard__type', adviceTypeLabel(a.type))),

    /* THE SHARE CONTROL, TOP END, OUT OF THE FLOW — sharing is the one thing a
       farmer does without reading further, so it stays on the card. */
    when(sharing, () => h('button.cardshare', {
      onclick: (e) => { e.stopPropagation(); openSheet('SEND_TO', { farmId: a.farmId, list: [a] }); },
      'aria-label': t('advice.share', 'Send to'),
      type: 'button',
    }, h('span.cardshare__disc', icon('share', 19)))),

    // 2. which ground. A tree group is NAMED after what grows on it, so the
    // crop is not printed after it twice.
    h('div.advicecard__where',
      [a.plotNames.join(', '), a.cropName && !a.plotNames.some((n) => n.startsWith(a.cropName)) ? a.cropName : null, farm.name]
        .filter(Boolean).join(' · ')),

    // 3. what to do, in one line
    h('div.advicecard__action', a.action),

    // A state only earns a line when it is true.
    when(a.status === 'completed', () => statusChip('good', { label: t('d1.status.completed', 'Completed') })),

    when(a.status === 'deferred', () => h('button.locked', {
      onclick: (e) => { e.stopPropagation(); restoreAdvice(a.id); },
    }, icon('clock', 15), t('advice.deferred', 'Hidden until tomorrow — put it back'))),

    when(sent && !opts.hideActions, () => h('div.advicecard__sent', icon('check', 15), t('advice.sharedwith', 'Shared with {who} {when}', {
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
      h('div.metaline',
        statusChip(status, { label: upper(statusLabel(status)) }),
        h('span', t('advice.issued', 'issued {when}', { when: dateTime(a.issuedAt) }))),

      /* WF5.104 — a recommendation the model has replaced. It is only ever
         reached by an old link now, because the inbox stopped listing these; the
         screen says so where the farmer has already arrived, and hands him the
         one that supersedes it. */
      when(a.status === 'superseded', () => card({ accent: 'monitor' }, cardPad(
        h('div.cardline',
          tile('refresh', { tone: 'monitor', size: 'sm' }),
          h('div.cardline__main', h('div.cardline__title', t('advice.superseded.title', 'This advice has been replaced')))),
        h('div.cardline__sub', t('advice.superseded.body', 'A newer reading of this plot changed the recommendation.')),
        btn(t('advice.superseded.open', 'Open the newer advice'), {
          variant: 'secondary', size: 'sm', block: false,
          onclick: () => { const next = adviceById(a.supersededBy); if (next) go(`${detailRouteFor(next)}:${next.id}`); },
        }),
        req('WF5.104')))),

      ...extra,
      // WF5.118 / WF6.025 — present on every advisory detail screen, not dismissible.
      disclaimer(t('advice.disclaimer', 'This is advice, not a prescription. Check conditions on the ground.')),
      h('div.finetext', t('advice.rule', 'Rule version {v}', { v: a.ruleVersion }), req('WF6.018'))),
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

   ONE SHOT, SINCE v1.7.2. "Irrigation advices are one shot only — we give an
   advice for irrigation if something is wrong, under irrigated or over
   irrigated. General irrigation schedules move to another page in plot
   details." So this screen is a correction, said once: what is wrong with the
   water on this plot, the one amount that puts it right — or the watering to
   skip — and when. The week's schedule, the arithmetic behind it, fertigation
   and the efficiency of the system are the plot's, on B12, and the last row
   here goes there. */

/* What a day's weather means for the job, in words. The forecast carries the
   verdict and the reason for it (see loadFixtures()); the sentence is written
   here, in the reader's language, and a clock time goes through clock() so it
   follows the 24-hour setting like every other time in the app. */
const CONDITION_TEXT = {
  rain: () => t('d2.cond.rain', 'Rain may reduce watering'),
  evening: (c) => t('d2.cond.evening', 'Irrigate after {time}', { time: clock(c.afterHour) }),
  heat: () => t('d2.cond.heat', '44°C heat — wait until after dusk.'),
  wind: () => t('d2.cond.wind', 'Do not spray: high wind'),
  calm: () => t('d2.cond.calm', 'Suitable for spraying'),
  gusts: () => t('d2.cond.gusts', 'Strong wind — postpone application.'),
};

/* `invent` keeps the demo honest about one thing: a week with no bad day in
   the fixtures would show a calendar with nothing on it to read, so the
   advice screens mark Tuesday unsuitable. B12 passes false — its waterings
   were placed on the real forecast, and an invented bad day would sit on top
   of one of them. */
export function weatherCalendar(farm, { activity = 'irrigation', title, split = [], invent = true } = {}) {
  const days = (farm?.weather?.forecast ?? []).slice(0, 7);
  const hasUnsuitable = !invent || days.some((day) => (day.activity?.[activity]?.status ?? 'good') !== 'good');
  const fallback = activity === 'irrigation'
    ? { status: 'urgent', reason: 'heat' }
    : { status: 'urgent', reason: 'gusts' };
  // THE WEEK AS A DAY STRIP (v1.8): each day a small card with its mark and
  // the reason in a few words; a day unsuitable for the job is tinted and
  // ringed. On B12 a watering day carries its amount and its window.
  return section(title ?? t('d2.calendar', 'This week’s weather conditions'), {},
    dayStrip(days.map((day, index) => {
      const condition = !hasUnsuitable && index === 1
        ? fallback
        : day.activity?.[activity] ?? { status: 'good' };
      const suggestion = activity === 'irrigation' ? split.find((item) => item.date === day.date) : null;
      const figure = suggestion ? splitFigure(suggestion.volume ?? suggestion.volumeM3Ha) : null;
      return {
        day: day.day,
        date: day.date.slice(-2),
        tone: condition.status,
        text: CONDITION_TEXT[condition.reason]?.(condition)
          ?? (condition.status === 'good' ? t('d2.suitable', 'Suitable') : t('d2.unsuitable', 'Unsuitable')),
        value: figure ? figure.value : null,
        valueSub: figure ? [figure.unit, suggestion.window ?? timeWindow(suggestion.fromHour, suggestion.toHour)].filter(Boolean).join(' · ') : null,
      };
    }), { label: title }));
}

/* The tone of an advice's hero card: its severity, washed in when it is one
   to act on. */
function heroTone(a) {
  const status = severityToStatus(a.severity);
  return { tone: status === 'good' || status === 'nodata' ? 'brand' : status, wash: status === 'urgent' || status === 'monitor' };
}

export function D2(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const d = a.detail;
  const direction = d.watering?.direction ?? null;
  const moisture = plot ? measureScore({ key: 'moisture', ...(plot.measures?.moisture ?? {}) }) : null;

  const figure = splitFigure(d.headline);
  return adviceDetail(a, [
    /* THE ONE NUMBER, as the hero (v1.8): what is wrong in a few words, the
       rate per hectare as large as the screen allows (WF5.113), when, and the
       plot's total to check against. */
    heroCard({
      ...heroTone(a),
      iconName: 'droplet',
      eyebrow: direction === 'over'
        ? t('d2.isover', 'This plot is getting too much water')
        : direction ? t('d2.isunder', 'This plot is short of water') : null,
      value: figure.value, unit: figure.unit, textValue: figure.whole,
      title: d.headlineSub,
      body: [
        d.totalVolume ? t('d2.total', '{volume} in total across {area}', { volume: d.totalVolume, area: area(d.areaHa ?? plot?.areaHa ?? 0) }) : null,
        t('d2.once', 'Once, on top of the schedule. Your normal schedule carries on after it.'),
      ].filter(Boolean).join('. '),
    }, req('WF5.113')),

    // The reading that raised it, in the map's own words.
    when(plot && moisture != null, () => card({}, cardPad(h('div.cardline',
      tile('thermometer', { tone: heroTone(a).tone }),
      h('div.cardline__main',
        h('div.cardline__title', metricName('moisture', plot)),
        h('div.cardline__sub', a.reason)),
      // The word, not the number: numbers are on the plot page (v1.7.3).
      h('span.pill.tone-neutral', metricWord('moisture', moisture)))))),

    when(plot, () => card({}, row({
      iconName: 'calendar', tone: 'info',
      title: t('d2.toschedule', 'See this plot’s irrigation schedule'),
      sub: t('d2.toschedule.sub2', 'The week’s waterings, per hectare'),
      onclick: () => go(`B12:${plot.id}`), deckTo: 'B12',
    }))),
  ]);
}

/* -- D3 · Fertilisation advice, WF5.088 … WF5.090 ------------------------- */

export function D3(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();

  const dose = splitFigure(a.detail.headlineSub);
  return adviceDetail(a, [
    /* The hero: what to do in words, how (a foliar spray), the dose per
       hectare as the big figure, and the elemental figures under it as small
       ones (WF5.089 — the recommendation is made in the nutrient). */
    heroCard({
      ...heroTone(a), wash: false,
      heading: a.detail.headline,
      value: a.detail.headlineSub ? dose.value : null, unit: dose.unit, textValue: dose.whole,
    },
    when(a.detail.applicationMethod === 'foliar-spray', () => pill(t('d3.foliar', 'Apply as a foliar spray'), { iconName: 'spray' })),
    when((a.detail.units ?? []).length, () => minis(a.detail.units.map((u) => {
      const f = splitFigure(u);
      return f.whole ? { value: u, label: '' } : { value: [f.value, f.unit].filter(Boolean).join(' '), label: f.rest ?? '' };
    }))),
    req('WF5.120')),

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
    /* "FERTILISERS NEEDED", PER HECTARE (v1.7.3) — the same words as the
       irrigation schedule (B12) and the plot page's fertilisation box, because
       it is the same content shown in both places. The total for the plot
       went: a dose is set per hectare, and a second figure beside it is a
       sum the farmer can do and a number he can confuse with the rate. */
    when((a.detail.products ?? []).length > 0, () => section(t('d2.fertneeded', 'Fertilisers needed'), {},
      card({}, a.detail.products.map((product) => row({
        iconName: 'basket',
        title: product.name,
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

/* How much product goes in a tank. The dose and the tank are facts on the
   record, so the sentence is written here in the reader's language rather than
   carried on the record in English. The dose keeps the decimals it was
   prescribed with: "0.02 L" rounded to the nearest litre is no dose at all.

   The units are part of the sentence, one key per dose unit, rather than
   `unit.litre`: F8 offers that key as the word "litres", and a symbol and a
   word cannot share one. */
function mixingLine(m) {
  const decimals = (String(m.dose).split('.')[1] ?? '').length;
  return t(`d4.mixing.${m.doseUnit}`, `{dose} ${m.doseUnit} per {tank} L of water`, {
    dose: num(m.dose, decimals), tank: num(m.tankVolumeL),
  });
}

/* WHAT TO DO, IN ONE OF THREE WORDS (v1.7.3): Action required, Inspect and
   report back, Monitor. Never a probability or a percentage — a farmer reads
   "54%" as a coin toss and does nothing; he reads "Inspect and report back"
   as a job. Urgent advice is action; advice that asks him to look first —
   it carries an identification guide — is inspect; the rest is monitor. */
function protectionWord(a) {
  if (severityToStatus(a.severity) === 'urgent') return { key: 'action', label: t('pest.action', 'Action required'), tone: 'urgent' };
  if (a.detail?.identification) return { key: 'inspect', label: t('pest.inspect', 'Inspect and report back'), tone: 'monitor' };
  return { key: 'monitor', label: t('pest.monitor', 'Monitor'), tone: 'quiet' };
}

export function D4(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const d = a.detail;
  const word = protectionWord(a);

  return adviceDetail(a, [
    /* The hero: the word for what to do, then the active ingredient (WF5.091
       / WF6.009) as the figure, and how much goes in a tank. */
    heroCard({
      tone: word.tone === 'quiet' ? 'neutral' : word.tone, wash: word.tone === 'urgent',
      eyebrow: word.label,
      label: t('d4.ai', 'Active ingredient'),
      value: d.activeIngredient ?? a.action, textValue: true,
    },
    when(d.mixing || d.rate, () => h('div.hero__fact', tile('spray', { tone: 'monitor', size: 'sm' }), h('span', d.mixing ? mixingLine(d.mixing) : d.rate)))),

    weatherCalendar(farmById(a.farmId), { activity: 'spraying', title: t('d4.calendar', 'This week’s spray conditions') }),

    // WF5.093 / WF6.010 — the pre-harvest interval, prominently, and the
    // earliest safe harvest as a DATE, not a number of days.
    when(d.preHarvestIntervalDays != null, () => card({}, cardPad(
      h('div.cardline',
        tile('calendar', { tone: 'monitor' }),
        h('div.cardline__main',
          h('div.cardline__title', `${t('d4.phi', 'Pre-harvest interval')} · ${t('d4.phidays', '{n} days', { n: num(d.preHarvestIntervalDays) })}`),
          h('div.cardline__sub', t('d4.earliest', 'Earliest safe harvest: {date}', { date: date(d.earliestSafeHarvest) })))),
      when(d.reentryHours, () => h('div.finetext',
        t('d4.reentry', 'Do not re-enter the plot for {n} hours after spraying', { n: num(d.reentryHours) }))),
      req('WF5.123')))),

    // WF5.092 / WF6.008 — products only where the register holds a verified
    // registration for THIS country.

    // WF5.095 — symptom photographs and a short identification guide.
    when(d.identification, () => section(t('d4.identify', 'Check before you spray'), {},
      card({}, cardPad(
        h('div.photostrip', { 'data-hscroll': '' },
          [0, 1, 2].map((i) => h('div.photostrip__ph', { style: { '--a': `${140 + i * 40}deg` } }, icon('camera', 22)))),
        h('p.lead', d.identification),
        h('ul.bullets', (d.symptoms ?? []).map((s) => h('li', s))))))),

    // WF5.094 / WF6.023 — permanent, non-dismissible.
    disclaimer(t('d4.label', 'Check the product label and your local regulations before applying. This is advice, not a prescription.'), true),
  ]);
}

/* -- D5 · Plant diagnosis, new at the 13/09 catalogue review --------------

   "PLANT DIAGNOSIS" SINCE v1.7.3, in place of "Check a photo" — on this
   screen, on its result (D6), on the inbox's button and in the More menu. It
   is for pests, disease, and water problems: too much or too little. The name
   is for now; other words may be tried.

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
   entry. `D6` renders the second state so the printed deck carries both,
   because a capture screen photographs as an empty frame.

   THE CONFIDENCE IS ON THE FACE OF IT. A diagnosis from one photograph is a
   shortlist, not a verdict, and the screen says so twice: a word beside the
   name — "Likely" or "Possible", since v1.7.3 took the percentage off every
   pest and disease — and a second candidate underneath. A farmer who sprays the wrong
   thing because an app sounded certain is a farmer who never opens it again. */

/* The mockup's own stand-in for the model's answer. Deterministic, and drawn
   from the real directory so the treatment and the pre-harvest interval on
   this screen are the same ones the entry carries — there is no second set of
   agronomy anywhere in the app. */
function photoResult() {
  return { first: diseaseById('powdery-mildew'), second: diseaseById('spider-mite'), confidence: 78 };
}

export function D5(shot) {
  const result = shot ? photoResult() : null;

  if (!diagnosisOpen()) {
    return {
      tabs: false,
      top: appBar({ title: t('d5.title2', 'Plant diagnosis'), onBack: () => back() }),
      body: page(lockBox('disease.photo')),
    };
  }

  if (!result) {
    /* THE VIEWFINDER (v1.8): the one dark screen. The mockup cannot open a
       camera, so this is the frame with the guidance inside it — what the
       farmer is looking at while he lines the shot up — and the shutter. */
    return {
      tabs: false,
      chromeBg: 'var(--night-900)',
      top: h('div.app__top.app__top--night',
        h('div.appbar',
          roundButton('back', t('a11y.back', 'Back'), () => back(), { glass: true, flip: true }),
          h('div.appbar__title.appbar__title--small', t('d5.title2', 'Plant diagnosis')))),
      body: h('div.viewfinder',
        h('div.viewfinder__frame',
          h('span.viewfinder__corner'), h('span.viewfinder__corner'), h('span.viewfinder__corner'), h('span.viewfinder__corner'),
          h('div.viewfinder__tag', t('d5.frame', 'Fill the frame with the damage')),
          h('p.viewfinder__text', t('d5.frame.sub', 'One leaf, close up, with the light behind you. Include a healthy part of the leaf if you can.'))),
        h('p.viewfinder__note', t('d5.for', 'For pests, disease, and plants getting too much or too little water.')),
        // The mockup's shutter: it moves to the result state rather than
        // pretending to open a camera it has no access to.
        h('button.shutter', { type: 'button', onclick: () => go('D6:leaf'), 'aria-label': t('d5.take', 'Take the photo'), title: t('d5.take', 'Take the photo') },
          icon('camera', 30)),
        h('p.viewfinder__note', t('d5.mockhint', 'Mockup: the shutter opens the example result.')),
        /* What makes a photo we can read, and the honest caveat, under the
           fold of the viewfinder for whoever wants them. */
        h('div.viewfinder__more',
          h('p.eyebrow', t('d5.helps', 'What makes a photo we can read')),
          kv([
            [t('d5.helps.close', 'Distance'), t('d5.helps.closev', 'A hand’s width from the leaf')],
            [t('d5.helps.light', 'Light'), t('d5.helps.lightv', 'Daylight, no flash, no shadow across it')],
            [t('d5.helps.both', 'Framing'), t('d5.helps.bothv', 'Damaged and healthy tissue in one shot')],
          ]),
          h('p.viewfinder__note', t('d5.note', 'A photograph narrows it down; it does not confirm it. We will tell you what to look for on the plant to be sure.')))),
    };
  }

  const { first, second, confidence } = result;
  const sure = confidence >= 70;
  return {
    tabs: false,
    top: appBar({ title: t('d5.title2', 'Plant diagnosis'), onBack: () => back() }),
    body: page(
      // The name and how sure we are, together, because neither means anything
      // without the other. How sure is a word, never a percentage (v1.7.3).
      card({}, cardPad(
        h('p.eyebrow', t('d5.result.title', 'What we think this is')),
        h('div.resulthead',
          h('h2.resulthead__name', first.name),
          statusChip(sure ? 'good' : 'monitor', { label: sure ? t('d5.likely', 'Likely match') : t('d5.possible', 'Possible match') })),
        h('div.cardline__sub', first.symptoms))),

      card({}, cardPad(
        h('p.eyebrow', t('d5.confirm', 'Confirm it on the plant')),
        h('div', first.conditions))),

      card({}, cardPad(
        h('p.eyebrow', t('d5.whattodo', 'What to do')),
        h('div', first.action),
        h('div.callout.tone-monitor.callout--tight', icon('clock', 18),
          h('span', t('d5.phi', 'Do not harvest for {n} days after treating.', { n: num(first.phiDays) }))))),

      // The second candidate, plainly labelled: the honest screen says which
      // other thing it might be rather than hiding the doubt.
      when(second, () => card({ onclick: () => go(`F16:${second.id}`), class: 'card--row' },
        h('div.card__pad',
          h('div.cardline',
            h('div.cardline__main',
              h('p.eyebrow', t('d5.other', 'It could also be')),
              h('div.cardline__title', second.name),
              h('div.cardline__sub', t('d5.other.sub', 'Read how to tell them apart'))),
            h('span.row__chev', icon('forward', 20, 'flip')))))),

      disclaimer(t('d5.result.note', 'This is a reading of one photograph. Check the plant before you spray, and log what you applied so the record stays straight.'))),
    dock: actionDock(
      btn(t('d5.open', 'Open the full entry'), {
        variant: 'primary',
        onclick: () => go(`F16:${first.id}`),
      }),
      btn(t('d5.again', 'Take another photo'), {
        variant: 'secondary', icon: 'camera',
        onclick: () => go('D5', { replace: true }),
      })),
  };
}

/** The result state, registered separately so the deck prints both halves. */
export const D6 = D5;

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
