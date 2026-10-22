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
  statusIcon, kv, emptyState, disclaimer, lockBox, req, divider, segmented, deckMark, upgradeSheet,
} from '../ui/components.js';
import { num, date, dateTime, area, ago, timeWindow, clock } from '../core/format.js';
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
  // Asked of the farms the inbox is showing — one, or all of them — since what
  // the plan gives depends on what is on each farm.
  const advisoryInPlan = farmsForFilter(farmFilter).some((farm) => ['advisory.operations', 'fertiliser.insights', 'irrigation.schedule', 'irrigation.schedule.tree']
    .some((key) => has(key, farm)));

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

    body: page(
      when(!advisoryInPlan, () => lockBox('advisory.operations', {
        title: t('d1.locked.title', 'Advice is part of the Pro plan'),
        body: t('d1.locked.body', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind each recommendation.'),
      })),

      filterBar(chosenWords, screen.sort ?? 'field', { farmFilter, clearFilters }),

      groups.length
        ? groups.map((group) => section(group.label, {},
            group.items.length
              ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
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

/* PLANT DIAGNOSIS IS PREMIUM (`disease.photo`), and it belongs to no farm: the
   farmer photographs a plant, whichever farm it stands on. So it is open when
   any farm the person can see has it — one rule, asked by its three doors (the
   D1 button, the More row and D5 itself). Locked, each door stays in place and
   opens the upgrade sheet (WF9.033). */
export function diagnosisOpen() {
  return visibleFarms().some((farm) => has('disease.photo', farm));
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
    statusChip(status, { label: upper(statusLabel(status)) }),
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
    // The status filter's own word for the state: `advice.recorded.done` is
    // B2's "Recorded", and one key cannot carry both.
    when(a.status === 'completed', () => h('div.status.status--good', { style: { alignSelf: 'flex-start' } },
      icon('check', 15), t('d1.status.completed', 'Completed'))),

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
        statusChip(status, { label: upper(statusLabel(status)) }),
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
  return section(title ?? t('d2.calendar', 'This week’s weather conditions'), {},
    h('div.weather-calendar', days.map((day, index) => {
      const condition = !hasUnsuitable && index === 1
        ? fallback
        : day.activity?.[activity] ?? { status: 'good' };
      const suggestion = activity === 'irrigation' ? split.find((item) => item.date === day.date) : null;
      return h(`div.weather-day.weather-day--${condition.status}`,
        h('div.weather-day__head', h('strong', day.day), h('span', day.date.slice(-2))),
        h('div.weather-day__marker', statusIcon(condition.status, 13)),
        h('div.weather-day__condition',
          h('strong', condition.status === 'good' ? t('d2.suitable', 'Suitable') : t('d2.unsuitable', 'Unsuitable')),
          h('span', CONDITION_TEXT[condition.reason]?.(condition) ?? t('d2.suitable', 'Suitable'))),
        when(suggestion, () => h('div.weather-day__suggestion',
          h('span', t('d2.irrigate', 'Irrigate')),
          h('strong', suggestion.volume ?? suggestion.volumeM3Ha),
          h('small', suggestion.window ?? timeWindow(suggestion.fromHour, suggestion.toHour)))));
    })));
}

export function D2(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const d = a.detail;
  const direction = d.watering?.direction ?? null;
  const moisture = plot ? measureScore({ key: 'moisture', ...(plot.measures?.moisture ?? {}) }) : null;

  return adviceDetail(a, [
    card({}, cardPad(
      // What is wrong, in two words, before how much: the reason this advice
      // exists at all is that the water on this plot is off.
      when(direction, () => h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        statusIcon('monitor', 18),
        h('span', { style: { fontWeight: 700 } }, direction === 'over'
          ? t('d2.isover', 'This plot is getting too much water')
          : t('d2.isunder', 'This plot is short of water')))),
      /* WF5.113 — cubic metres per hectare, the rate the system is set by,
         with the plot's total under it to check against. */
      h('div.bignum', d.headline),
      when(d.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, d.headlineSub)),
      when(d.totalVolume, () => h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 600, color: 'var(--ink-700)' } },
        t('d2.total', '{volume} in total across {area}', {
          volume: d.totalVolume, area: area(d.areaHa ?? plot?.areaHa ?? 0),
        }))),
      h('div', { style: { color: 'var(--ink-700)' } }, t('d2.once', 'Once, on top of the schedule. Your normal schedule carries on after it.')),
      req('WF5.113'))),

    // The reading that raised it, in the map's own colours and words.
    when(plot && moisture != null, () => card({}, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } },
          h('span', { style: { fontWeight: 650 } }, metricName('moisture', plot)),
          h('span', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, a.reason)),
        // The word, not the number: numbers are on the plot page (v1.7.3).
        metricWord('moisture', moisture))))),

    when(plot, () => card({}, h('button.row', {
      type: 'button', onclick: () => go(`B12:${plot.id}`),
      'data-deck-to': 'B12',
    }, icon('calendar', 20),
    h('div.row__main',
      h('div.row__title', t('d2.toschedule', 'See this plot’s irrigation schedule')),
      h('div.row__sub', t('d2.toschedule.sub2', 'The week’s waterings, per hectare'))),
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
      when(a.detail.applicationMethod === 'foliar-spray', () => h('div', { style: { fontWeight: 700, color: 'var(--brand-700)' } }, t('d3.foliar', 'Apply as a foliar spray'))),
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
    card({}, cardPad(
      h(`div.pestword.pestword--${word.tone}`, { style: { fontSize: 'var(--t-lead)' } }, word.label),
      // WF5.091 / WF6.009 — lead with the active ingredient and rate.
      h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, t('d4.ai', 'Active ingredient')),
      h('div', { style: { fontSize: 'var(--t-head)', fontWeight: 700, lineHeight: 1.15 } }, d.activeIngredient ?? a.action),
      when(d.mixing || d.rate, () => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, d.mixing ? mixingLine(d.mixing) : d.rate)))),

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
        t('d4.earliest', 'Earliest safe harvest: {date}', { date: date(d.earliestSafeHarvest) })),
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
    return {
      tabs: false,
      top: appBar({ title: t('d5.title2', 'Plant diagnosis'), onBack: () => back() }),
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

        h('p', { style: { margin: 0, color: 'var(--ink-700)' } },
          t('d5.for', 'For pests, disease, and plants getting too much or too little water.')),

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
          onclick: () => go('D6:leaf'),
        }),
        h('div', { style: { textAlign: 'center', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('d5.mockhint', 'Mockup: the shutter opens the example result.'))),
    };
  }

  const { first, second, confidence } = result;
  return {
    tabs: false,
    top: appBar({ title: t('d5.title2', 'Plant diagnosis'), subtitle: t('d5.result.title', 'What we think this is'), onBack: () => back() }),
    body: page(
      // The name and how sure we are, together, because neither means anything
      // without the other.
      card({ accent: first.severity }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          statusIcon(first.severity, 22),
          h('span', { style: { fontWeight: 750, fontSize: 'var(--t-lead)' } }, first.name),
          // How sure, in a word: no percentage on a pest or a disease (v1.7.3).
          statusChip(first.severity, { label: confidence >= 70 ? t('d5.likely', 'Likely match') : t('d5.possible', 'Possible match') })),
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
        card({}, h('button.row', { onclick: () => go(`F16:${second.id}`) },
          statusIcon(second.severity, 20),
          h('div.row__main',
            h('div.row__title', second.name),
            h('div.row__sub', t('d5.other.sub', 'Read how to tell them apart'))),
          h('span.row__chev', icon('forward', 18, 'flip')))))),

      disclaimer(t('d5.result.note', 'This is a reading of one photograph. Check the plant before you spray, and log what you applied so the record stays straight.'))),
    dock: actionDock(
      btn(t('d5.open', 'Open the full entry'), {
        variant: 'primary',
        onclick: () => go(`F16:${first.id}`),
      }),
      btn(t('d5.again', 'Take another photo'), {
        variant: 'quiet',
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
