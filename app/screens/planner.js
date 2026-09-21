/* ---------------------------------------------------------------------------
   planner.js — B15 Crop planner, B16 Farm progress.

   TWO SCREENS THE CATALOGUE ALREADY SOLD AND THE APP NEVER DREW. The 13/09
   feature review went through the plan's own key list and kept two of the
   entries nothing routed to: `orchard.planner`, which every tree plan carries,
   and `progress.1y`, which every crop plan carries. Both are here, and both are
   FARM-level, which is the gap they fill — everything else in the build answers
   a question about one plot on one date.

   WHAT EACH ONE IS FOR, IN ONE LINE EACH.

     B15  the farm's ground, twelve months FORWARD. The app records a crop cycle
          one plot at a time on B5 — what went in, when it came off, what it
          gave — and nothing has ever laid those records side by side. A farmer
          who cannot see all of them at once cannot see that four plots come
          free in the same month, and cannot see that a field is going into a
          second or third season of the family it has just grown.

     B16  one measure, twelve months BACK, across the whole farm. B4 charts one
          plot's trend and C4 puts the whole farm at two dates beside each
          other; neither says whether the farm as a whole is better than it was
          a year ago, which is the question a season is judged on.

   B16 IS NOT THE FARM HEALTH SCORE COMING BACK. B2 deliberately carries no
   farm-level health average, on the stated argument that plant health at farm
   level averages crops that cannot be averaged, and nothing here disputes that.
   This is one measure the farmer chose, plotted over time, with the mixing said
   out loud on the screen and a read-out naming the plots above and below the
   line — so the average is never the last word, it is the thing the plot list
   underneath it explains. A single number standing for the health of a farm is
   still not offered anywhere in this app.

   THE TWO WINDOWS POINT IN OPPOSITE DIRECTIONS ON PURPOSE. A planner that shows
   you last spring is a diary, and a progress chart that shows you next spring is
   a forecast the satellite cannot make. So B15 starts at the current month and
   runs forward, and B16 ends at the current month and runs back.

   ONE THING BOTH GIVE UP. The app prints both calendars wherever a date appears,
   and a twelve-column ruler cannot carry two of them — a Gregorian month and a
   Hijri month do not line up and never will. So the grids are Gregorian, and
   every actual DATE either screen prints goes through date() and carries both.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc, isRtl } from '../core/i18n.js';
import { go, openModal } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, page, section, card, cardPad, row, chips, select, checkbox,
  statusIcon, healthScore, emptyState, disclaimer,
} from '../ui/components.js';
import { area, num, date, digits, NOW } from '../core/format.js';
import { farmById, plotsOf, measures, measureByKey, cropById } from '../data/selectors.js';
import { has } from '../core/entitlements.js';

/* -- the twelve months, shared -------------------------------------------

   A month is held as `{ y, m }` rather than as a Date, because everything both
   screens do with one is arithmetic on the calendar — step twelve of them, ask
   which one a harvest falls in, ask whether a sowing window is open — and a
   Date invites a timezone into a question that has none in it. The English
   names come off the same array format.js uses, with the same keys, so the
   month above a column and the month inside a printed date are one translation
   and not two. */

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthName(m) {
  return t(`month.${MONTHS_EN[m].toLowerCase()}`, MONTHS_EN[m]);
}

/** Twelve months from `{ y, m }` inclusive, in order. Counted in absolute
    months so that stepping BACKWARDS over a new year — which is what B16 does
    every January — is the same arithmetic as stepping forwards. */
function monthsFrom(y, m, count = 12) {
  const base = y * 12 + m;
  return Array.from({ length: count }, (_, i) => ({
    y: Math.floor((base + i) / 12),
    m: (((base + i) % 12) + 12) % 12,
  }));
}

const monthStart = (month) => Date.UTC(month.y, month.m, 1);
const monthEnd = (month) => Date.UTC(month.y, month.m + 1, 1);
const monthKey = (month) => `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
const thisMonth = () => ({ y: NOW.getUTCFullYear(), m: NOW.getUTCMonth() });

/** The month a date falls in, spelled the way a column heading spells it. */
function monthLabelOf(months, time) {
  const found = months.find((month) => time >= monthStart(month) && time < monthEnd(month));
  if (!found) return null;
  return found.y === NOW.getUTCFullYear()
    ? monthName(found.m)
    : `${monthName(found.m)} ${digits(found.y)}`;
}

/** Where a moment sits across the whole band, 0 … 1. */
function fractionIn(months, time) {
  const from = monthStart(months[0]);
  const to = monthEnd(months[months.length - 1]);
  return (time - from) / (to - from);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const timeOf = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime() : null);

/* =============================================================================
   B15 · Crop planner
   ========================================================================== */

/* WHAT THE PLANNER KNOWS, AND WHERE IT STOPS.

   It reads three things off each plot and invents nothing: the cycle in the
   ground now, the cycles closed before it, and the crop guide the app already
   ships — season length and the months each crop is sown in. From those it
   works out when the ground comes free and what could sensibly follow, and it
   says which of the two it is showing at every point.

   THE SUGGESTION IS A SUGGESTION AND IS DRAWN AS ONE. A solid bar is a RECORD:
   a cycle the farmer entered, positioned by the dates he entered. A dashed bar
   is a PROPOSAL the app is making. Mixing the two in one colour is how a
   planner becomes a thing nobody trusts, so they never share a treatment, the
   legend names both, and the proposal layer can be switched off entirely — a
   farmer checking what is actually in his ground should be able to see his own
   record without the app talking over it.

   IT DOES NOT WRITE ANYTHING. Nothing here books a sowing, and there is no
   "accept" button: a crop cycle is created on B6 and lives on B5, and a second
   place that can start one would be a second place where the record can go
   wrong. Every row opens the plot's own cycle screen instead.

   AND IT IS NOT ADVICE. The Advice tab issues work with a date and an amount on
   it, reviewed and sent to somebody. This is a rotation the farmer is free to
   ignore — it comes off his own history and a sowing calendar, not off the
   satellite — so it is stated as an opinion and never counted as a job.

   NOR DOES IT BALANCE THE FARM. Each plot is answered from its OWN record, so a
   farm whose fields have all had the same history will be offered the same crop
   on all of them — which is true, and is the farmer's decision to take or leave.
   Spreading a holding's cropping across markets and harvest crews is a business
   judgement with prices in it, and the app has no way to make it. */

const NAME_W = 78;      // px — the plot column, wide enough for "Plot 12"
const MONTH_W = 30;     // px — the SMALLEST a month column may be; see calendarBand()

export function B15(farmId) {
  const farm = farmById(farmId);
  // "Remove trees from the crop planner — trees aren't rotated, so they're not
  // relevant here." See the note on planFor().
  const plots = plotsOf(farm.id).filter((p) => p.kind !== 'trees');
  const months = monthsFrom(thisMonth().y, thisMonth().m);
  const ui = local(`b15-${farm.id}`, { showNext: true });
  const rows = plots.map((plot) => planFor(plot, months)).sort(byFreeDate);
  const clusters = freeClusters(rows, months);

  return {
    top: appBar({
      title: t('b15.title', 'Crop planner'),
      subtitle: farm.name,
      help: {
        title: t('b15.title', 'Crop planner'),
        body: t('b15.help', 'Every open-field plot on this farm across the next twelve months. Bars are the cycles you have recorded; the rings on them are the field work each one needs — tillage, planting, fertilisation, harvest. Tree groups are not here: trees are not rotated. Nothing is booked until you record it on the plot.'),
      },
    }),
    body: page(
      when(!plots.length, () => emptyState({
        iconName: 'calendar',
        title: t('b15.empty', 'Nothing to plan yet'),
        body: t('b15.empty.body', 'Once this farm has open-field plots with a crop on them, this is where you will see when each one comes free and what it needs.'),
      })),

      when(plots.length, () => h('div', { style: { color: 'var(--ink-600)' } },
        t('b15.intro', 'The whole farm on one calendar — when each plot comes free, and the work each crop needs between now and then.'))),

      /* THE ONE SENTENCE THIS SCREEN EXISTS TO SAY. A calendar makes a cluster
         visible; it does not make it legible. Four plots ending in the same
         month is a fact about the farm — it is one sowing, one crew and one
         water bill — and it is worth a line of type above the picture rather
         than something the farmer has to notice for himself. It appears only
         when two or more plots really do land in the same month. */
      when(clusters.length, () => h('div', {
        style: { display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: 650, color: 'var(--brand-700)' },
      }, h('span', { style: { display: 'flex', flex: '0 0 auto' } }, icon('calendar', 20)),
         h('div', clusters.map((c) => h('div', c.label))))),

      when(plots.length, () => card({}, cardPad(
        calendarBand(rows, months, ui),
        bandLegend(rows, ui),
        checkbox(t('b15.shownext', 'Show the field work on each plot'), ui.showNext,
          (v) => { ui.showNext = v; commit('b15'); })))),

      /* THE BAND IS A PICTURE, THE LIST IS THE SCREEN. A thirty-pixel row in a
         scrolling grid is not a control — it cannot carry a sentence and it is
         half the height a finger is entitled to — so nothing in the band is
         tappable and every plot in it appears again underneath as a proper row
         with the reasoning written out and a way through to its own record. */
      when(rows.length, () => section(t('b15.byplot', 'Plot by plot'), {},
        card({}, rows.map((plan) => planRow(plan, months))))),

      when(plots.length, () => h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('b15.note', 'Mockup: the task dates are placed off the planting date and the length of the season. What MMC can really supply decides the list — see Thursday’s call.')))),
  };
}

/* -- what we know about one plot's year ------------------------------------

   `freeAt` is the hinge of the whole screen, and it takes the first answer it
   gets in descending order of authority: a harvest the satellite actually
   watched happen, a harvest date recorded on the cycle, the harvest the app
   models from the crop and the planting date, and — for a plot with no cycle at
   all — today, because ground with nothing recorded on it is ground nobody is
   waiting for.

   THERE ARE NO TREE GROUPS ON THIS SCREEN ANY MORE. Review 21/09: "Remove trees
   from the crop planner — trees aren't rotated, so they're not relevant here."
   They used to appear as a full-width muted bar reading "standing planting, the
   ground is not free", which was honest and was still a row on a planning
   screen that could not be planned. A farm of date palms now sees the plots it
   can actually do something about, and nothing else.

   AND WHAT THE SCREEN PLANS IS WORK, NOT CROPS. See the note on cycleFieldWork. */
function planFor(plot, months) {
  const cycle = (plot.cropCycles ?? []).find((c) => c.state === 'current') ?? null;
  const awaiting = !!plot.harvestDetectedOn;
  const guide = cropById(plot.cropId)?.guide ?? null;

  const startedAt = timeOf(cycle?.startDate ?? plot.plantedOn);
  const modelled = cycle?.expectedHarvest
    ? timeOf(cycle.expectedHarvest)
    : (startedAt && guide?.seasonDays ? startedAt + guide.seasonDays * 86400000 : null);
  const freeAt = timeOf(plot.harvestDetectedOn) ?? timeOf(cycle?.actualHarvest) ?? modelled ?? NOW.getTime();

  const repeat = familyRun(plot, cycle);
  return {
    plot, cycle, awaiting, startedAt, freeAt, repeat,
    fieldwork: cycleFieldWork(startedAt, freeAt, months),
  };
}

/* -- THE TASKS, WHICH ARE WHAT THIS SCREEN IS FOR SINCE REVIEW 21/09 --------

   The planner used to answer "what should I grow next", and Mark closed that
   down on the call for a reason that has nothing to do with the screen:

     "One thing missing from a 'what to grow' recommendation is market pricing
      data, which we don't have — so for this version, even though I like the
      feature, I think it's premature."

   Which is right, and it is the whole of the argument: a crop recommendation
   that cannot see prices is a recommendation about agronomy offered to a
   decision about money. What he wanted instead he had pictured from the start —
   "more of a calendar overview across all plots — tillage, planting, pruning,
   harvest dates" — and then found in MMC's own deck, slide 67: a crop calendar
   task by task, land sampling through to harvest.

   THIS IS THE BASIC VERSION HE ASKED FOR. "I don't want you spending too much
   time on this before we've talked it through with MMC on Thursday — a quick,
   basic mock-up is enough for now." Five pieces of work, placed off the
   planting date and the length of the season, because those are the two facts
   the app already holds. What MMC can really supply decides the rest.

   IT IS CALLED FIELD WORK AND NOT A TASK, ON PURPOSE. tools/syntax.sh forbids
   the word in live code, and the ban is right: task management was taken out of
   this app deliberately, and it grew back last time "one convenience at a
   time". Nothing here is assigned to anybody, holds a state, or can be
   completed — these are dates on a calendar, not work somebody is carrying.
   Naming them after the thing that was deleted is how it comes back. */
const FIELD_WORK = [
  { id: 'tillage', at: -0.06, key: 'b15.work.tillage', en: 'Tillage' },
  { id: 'planting', at: 0, key: 'b15.work.planting', en: 'Planting' },
  { id: 'fert1', at: 0.28, key: 'b15.work.fert', en: 'Fertilisation' },
  { id: 'fert2', at: 0.58, key: 'b15.work.fert2', en: 'Second fertilisation' },
  { id: 'harvest', at: 1, key: 'b15.work.harvest', en: 'Harvest' },
];

function cycleFieldWork(startedAt, freeAt, months) {
  if (!startedAt || !freeAt || freeAt <= startedAt) return [];
  const span = freeAt - startedAt;
  const first = monthStart(months[0]);
  const last = monthStart(months[months.length - 1]) + 31 * 86400000;
  return [
    ...FIELD_WORK.map((item) => ({ ...item, when: startedAt + item.at * span })),
    /* AND THE GROUND WORK THAT FOLLOWS A HARVEST, which belongs to no crop.

       Most cycles on a real farm started before this band opens, so without
       this the only mark on a row is its harvest — one ring at the end of a
       bar, and a calendar that appears to know about one piece of work a year.
       Clearing and tilling after a harvest happens whatever goes in next, so it
       can be drawn without naming a crop, which is the line review 21/09 drew:
       the work is ours to show, the choice of crop is not. */
    { id: 'aftertillage', key: 'b15.work.clear', en: 'Clear and till', when: freeAt + 21 * 86400000 },
  ]
    // Only what falls inside the twelve months the band draws. A tillage date
    // three weeks before a band that opens in August is a marker with nowhere
    // to sit.
    .filter((item) => item.when >= first && item.when <= last)
    .sort((a, b) => a.when - b.when);
}

/* Worst-timed first: the plots that are already free or free soonest are the
   ones a decision is owed on, and the trees — which are never free — go last
   because there is no decision in them at all. */
function byFreeDate(a, b) {
  return (a.freeAt ?? Infinity) - (b.freeAt ?? Infinity)
    || a.plot.shortName.localeCompare(b.plot.shortName);
}

/* HOW MANY SEASONS OF THE SAME FAMILY THIS GROUND HAS TAKEN, counting the crop
   standing on it now. Two in a row is already the point at which a grower
   starts paying for it in disease carry-over and in nitrogen; three is the case
   the review described. The count runs backwards from the present and stops at
   the first cycle from another family, so a wheat–potato–wheat plot reads as
   one season of cereals and not as three. */
function familyRun(plot, current) {
  const closed = (plot.cropCycles ?? [])
    .filter((c) => c.state === 'closed')
    .sort((a, b) => String(b.actualHarvest ?? b.startDate).localeCompare(String(a.actualHarvest ?? a.startDate)));
  const chain = [current, ...closed].filter(Boolean).map((c) => familyOf(c.cropId));
  const family = chain[0];
  if (!family) return null;
  let n = 0;
  while (n < chain.length && chain[n] === family) n += 1;
  return { family, seasons: n };
}

const familyOf = (cropId) => cropById(cropId)?.category ?? null;

/* The family in the farmer's words. `crop.cat.*` is the catalogue the crop
   picker already uses, so "cereals" is translated once for both screens. */
function familyLabel(family) {
  return family ? t(`crop.cat.${family}`, family.replace('-', ' ')) : null;
}


/* -- the band -------------------------------------------------------------

   ONE GRID, NOT A ROW OF LITTLE ONES. The header and every plot row share a
   single `grid-template-columns`, which is what guarantees that the bar under
   "Nov" is under "Nov" — twelve independently laid-out rows drift the moment
   one plot name is longer than another.

   It is the only thing in the app allowed to be wider than the phone, so it
   carries its own horizontal scroller and nothing else on the screen has to
   move with it. The plot name sticks to the leading edge while the months run
   under it: a bar with no name against it is a bar about nobody.

   AND IT MIRRORS FOR FREE. The months are grid columns and the bars are
   positioned with `inset-inline-start`, so an Arabic or Pashto session reads
   the calendar right to left without this code asking which way round it is. */
function calendarBand(rows, months, ui) {
  /* THE COLUMNS ARE EQUAL AND AS WIDE AS THE LONGEST MONTH NAME, which is a
     sentence about translation rather than about layout. "Sep" is three
     characters and سبتمبر is twice the width, and a fixed 30-pixel column that
     fits the English throws the Arabic over its neighbour. `minmax(30px, 1fr)`
     inside a `max-content` grid makes every track take the size of the widest
     one — so the band is wider in Arabic, which is what it costs, and the time
     axis stays uniform, which is what the bars depend on. */
  const template = `${NAME_W}px repeat(${months.length}, minmax(${MONTH_W}px, 1fr))`;
  return h('div', {
    style: { overflowX: 'auto', overflowY: 'hidden', paddingBottom: '2px' },
    role: 'group',
    'aria-label': t('b15.band', 'Twelve-month calendar for every plot'),
  },
  h('div', { style: { display: 'grid', gridTemplateColumns: template, rowGap: '6px', alignItems: 'center', width: 'max-content' } },
    h('div', { style: stickyCell() }),
    months.map((month, i) => monthHead(month, i)),
    rows.map((plan) => [nameCell(plan), trackCell(plan, months, ui)])));
}

function stickyCell(extra = {}) {
  return {
    position: 'sticky', insetInlineStart: '0', zIndex: '2',
    background: 'var(--paper)', ...extra,
  };
}

function monthHead(month, i) {
  const now = i === 0;
  /* The year is printed only where it changes, which on a twelve-month band is
     once, and it is the SHORT form because a column is as wide as "Sep" and
     "2027" is not. It goes ABOVE the month rather than under it, with the cells
     aligned to their bottoms: that way the twelve month names sit on one line
     and the year reads as a band over the two columns it belongs to, instead of
     shoving January half a line out of the row. */
  const newYear = i === 0 || month.m === 0;
  return h('div', {
    style: {
      textAlign: 'center', lineHeight: '1.1', alignSelf: 'end',
      fontSize: 'var(--t-micro)', fontWeight: now ? '700' : '600',
      color: now ? 'var(--brand-700)' : 'var(--ink-500)',
    },
  }, when(newYear, () => h('div', { style: { color: 'var(--ink-500)', fontWeight: '500' } },
       `’${digits(String(month.y).slice(2))}`)),
     h('div', monthName(month.m)));
}

function nameCell(plan) {
  return h('div', {
    style: stickyCell({
      paddingInlineEnd: '6px', borderInlineEnd: '1px solid var(--ink-200)',
      fontSize: 'var(--t-micro)', fontWeight: '600', color: 'var(--ink-800)',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }),
    title: plan.plot.shortName,
  }, plan.plot.shortName);
}

function trackCell(plan, months, ui) {
  const bars = [];

  if (plan.cycle && plan.freeAt > monthStart(months[0])) {
    const from = fractionIn(months, plan.startedAt ?? monthStart(months[0]));
    const to = fractionIn(months, plan.freeAt);
    bars.push(bar({
      from, to, kind: 'current',
      label: plan.cycle.cropName,
      title: t('b15.bar.current', '{crop}, off around {when}', {
        crop: plan.cycle.cropName, when: date(new Date(plan.freeAt), { noYear: true, short: true }),
      }),
    }));
  }

  /* THE TASKS, AS MARKS ON THE SEASON RATHER THAN A SECOND BAR. A bar says
     "this ground is busy from here to here"; a day's work happens on a day, and
     drawing it as a bar would be claiming a duration nobody has. */
  const marks = ui.showNext
    ? plan.fieldwork.map((item) => h('span', {
      title: `${t(item.key, item.en)} · ${date(new Date(item.when), { noYear: true, short: true })}`,
      style: {
        position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
        insetInlineStart: `${fractionIn(months, item.when) * 100}%`,
        width: '13px', height: '13px', borderRadius: '50%',
        background: 'var(--paper)', border: '2px solid var(--brand-700)',
        zIndex: 2,
      },
    }))
    : [];

  return h('div', {
    style: {
      gridColumn: `span ${months.length}`, position: 'relative', height: '30px',
      background: 'var(--ink-050)', borderRadius: '4px', overflow: 'hidden',
    },
  },
  // The month this farmer is standing in, tinted the whole height of the row so
  // the eye has somewhere to start. It is always the first column, which is why
  // there is no "today" hairline: a line drawn two days into a twelve-month
  // band sits on the border and says nothing.
  h('span', { style: { position: 'absolute', top: '0', bottom: '0', insetInlineStart: '0', width: `${100 / months.length}%`, background: 'var(--brand-050)' } }),
  marks,
  h('div', { style: { position: 'absolute', inset: '0', display: 'flex' } },
    months.map((_, i) => h('span', {
      style: { flex: '1 1 0', borderInlineStart: i ? '1px solid var(--ink-200)' : '0' },
    }))),
  bars);
}

/* A bar. Square on whichever end runs off the edge of the band, rounded on the
   end that is really the end — which is how a cycle sown in February reads as
   something that started before this calendar did, without a second glyph to
   explain it. The crop's name is INSIDE the bar rather than beside it: colour
   alone never carries a meaning in this app, and a bar with a word in it is
   also a bar you can read in a photocopy. */
function bar({ from, to, kind, label, title }) {
  const a = clamp01(from);
  const b = clamp01(to);
  const width = Math.max(b - a, 0.02);
  const before = from < 0;
  const after = to > 1;
  const fill = {
    current: 'var(--brand-600)',
    standing: 'var(--brand-100)',
    next: 'transparent',
  }[kind];

  return h('span', {
    title,
    style: {
      position: 'absolute', top: '3px', bottom: '3px',
      insetInlineStart: `${a * 100}%`, width: `${width * 100}%`,
      display: 'flex', alignItems: 'center', gap: '3px',
      padding: '0 5px', borderRadius: '4px',
      ...(before ? { borderStartStartRadius: '0', borderEndStartRadius: '0' } : {}),
      ...(after ? { borderStartEndRadius: '0', borderEndEndRadius: '0' } : {}),
      background: fill,
      border: kind === 'next' ? '1.5px dashed var(--brand-500)' : '0',
      color: kind === 'current' ? 'var(--paper)' : 'var(--ink-800)',
      fontSize: 'var(--t-micro)', fontWeight: '600',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
  }, label);
}

/* The key, and it is not optional decoration: three treatments mean three
   different kinds of claim — a record, a proposal, and ground that is committed
   for twenty years — and a farmer who cannot tell them apart is reading a
   different screen from the one this is. An entry appears only when the band
   below it actually contains that kind of bar: a farm of open field is never
   told what the colour for trees would have meant. */
function bandLegend(rows, ui) {
  const items = [
    rows.some((r) => r.cycle)
      ? { fill: 'var(--brand-600)', label: t('b15.key.current', 'In the ground now') } : null,
    ui.showNext && rows.some((r) => r.fieldwork.length)
      ? { fill: 'var(--paper)', ring: true, label: t('b15.key.tasks', 'Field work — tillage, planting, fertilisation, harvest') } : null,
  ].filter(Boolean);

  return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
    items.map((item) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
      h('span', {
        style: {
          width: item.ring ? '12px' : '16px', height: item.ring ? '12px' : '11px',
          borderRadius: item.ring ? '50%' : '3px', background: item.fill,
          border: item.ring ? '2px solid var(--brand-700)' : '0',
        },
      }),
      h('span', item.label))));
}

/* -- one plot, written out ------------------------------------------------ */

function planRow(plan, months) {
  const { plot } = plan;
  const free = plan.freeAt ? monthLabelOf(months, plan.freeAt) : null;
  const overdue = plan.freeAt != null && plan.freeAt <= NOW.getTime();

  return row({
    title: plot.shortName,
    sub: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
      h('div', currentLine(plan)),
      when(plan.fieldwork.length, () => h('div', { style: { color: 'var(--brand-700)', fontWeight: 600 } }, nextLine(plan, months))),
      // The one thing on this screen that is allowed to be a warning. It is a
      // count of seasons, not a verdict on the farmer: the number is the whole
      // of the argument, so the line states it and stops.
      when((plan.repeat?.seasons ?? 0) >= 2, () => h('div', {
        style: { color: 'var(--st-monitor)', fontWeight: 600 },
      }, t('b15.repeat', '{n} seasons of {family} in a row, counting the one growing now.', {
        n: num(plan.repeat.seasons), family: familyLabel(plan.repeat.family),
      })))),
    value: overdue ? t('b15.value.now', 'Free now') : free,
    statusKey: plan.awaiting ? 'urgent' : null,
    onclick: () => go(`B5:${plot.id}`),
    deckTo: 'B5',
  });
}

/* THE NEXT PIECE OF WORK, IN A SENTENCE. It replaced "Next: barley, sown around
   September" — a proposal about a crop — with the next thing that has to happen
   on ground already committed. Only the next one: a row on a list is one line,
   and the band above it carries the rest. */
function nextLine(plan, months) {
  const upcoming = plan.fieldwork.find((item) => item.when >= NOW.getTime()) ?? null;
  if (!upcoming) return null;
  return t('b15.nextwork', 'Next: {work}, around {when}', {
    work: t(upcoming.key, upcoming.en),
    when: monthLabelOf(months, upcoming.when) ?? date(new Date(upcoming.when), { noYear: true, short: true }),
  });
}

function currentLine(plan) {
  const { plot, cycle } = plan;
  // The satellite watched this field being cleared and the app has not been
  // told what replaced it. That is not a missing bar, it is the most useful row
  // on the screen: this is ground that is free TODAY.
  if (plan.awaiting) {
    return t('b15.line.awaiting', '{area} · cleared on {when}, crop not set', {
      area: area(plot.areaHa), when: date(plot.harvestDetectedOn, { noYear: true, short: true }),
    });
  }
  if (!cycle) {
    return t('b15.line.bare', '{area} · nothing recorded in the ground', { area: area(plot.areaHa) });
  }
  return t('b15.line.current', '{crop} · {area} · planted {when}', {
    crop: cycle.cropName, area: area(plot.areaHa),
    when: date(cycle.startDate, { noYear: true, short: true }),
  });
}

/* WHEN THE GROUND COMES FREE, COUNTED. Plots already free are one group whatever
   month they fell in — a field cleared in July and a field cleared last week are
   the same decision — and everything else groups by the month it lands in.
   Groups of one are dropped: "one plot comes free in March" is the calendar
   read aloud, and the whole value of the count is that it finds the months where
   several land together. */
function freeClusters(rows, months) {
  const out = [];
  const open = rows.filter((r) => r.freeAt != null);

  const now = open.filter((r) => r.freeAt <= NOW.getTime());
  if (now.length >= 2) {
    out.push({ label: t('b15.freenow', '{n} plots — {area} — are free now', {
      n: num(now.length), area: area(now.reduce((sum, r) => sum + r.plot.areaHa, 0)),
    }) });
  }

  const buckets = new Map();
  for (const plan of open) {
    if (plan.freeAt <= NOW.getTime()) continue;
    const month = months.find((mo) => plan.freeAt >= monthStart(mo) && plan.freeAt < monthEnd(mo));
    if (!month) continue;
    const key = monthKey(month);
    buckets.set(key, [...(buckets.get(key) ?? []), plan]);
  }
  for (const [, group] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (group.length < 2) continue;
    out.push({ label: t('b15.cluster', '{n} plots — {area} — come free in {month}', {
      n: num(group.length),
      area: area(group.reduce((sum, r) => sum + r.plot.areaHa, 0)),
      month: monthLabelOf(months, group[0].freeAt),
    }) });
  }
  return out;
}

/* =============================================================================
   B16 · Farm progress
   ========================================================================== */

/* ONE MEASURE AT A TIME, AND THE PICKER IS THE SCREEN'S ONLY MODE.

   Five lines on one chart would be five scales on one axis — plant health and
   water stress are both 0–100 and mean opposite things at 20 — so the screen
   shows one, named, with the farm's own vocabulary for it. The picker is the
   same five names the map and the plot screen use, and a measure outside the
   plan is shown locked rather than hidden, exactly as it is on B4.

   THE MONTH IS CHOSEN FROM A LIST RATHER THAN BY TAPPING THE CHART. Twelve
   points across a phone is twenty-five pixels each, which is half a finger; a
   chart whose only way in is a tap nobody can land is a chart with no way in.
   So the month is a picker sitting on the figure it governs, and the chart
   marks whichever month that picker is on.

   WHAT IS AVERAGED, SAID ON THE SCREEN. Every plot with a reading that month
   counts ONCE, whatever its size — an area-weighted figure would be a better
   number and a worse answer, because it would move when a big field was
   harvested and the farmer would read that as the farm getting worse. The
   sentence under the chart says what the figure is and what it is not, and the
   plots above and below it are listed underneath so the average is never the
   only thing on the screen. */

export function B16(farmId) {
  const farm = farmById(farmId);
  const plots = plotsOf(farm.id);
  const list = measures();
  // The screen opens on whichever reading the farmer was last looking at on the
  // map or the plot, so arriving here from a plot keeps the subject and changes
  // only the scope. After that the choice is this screen's own.
  const ui = local(`b16-${farm.id}`, { measure: measureByKey(state.ui.measure).key, month: null });

  const measure = measureByKey(ui.measure);
  const months = backTwelve();
  const series = farmSeries(plots, measure.key, months);
  const withData = series.filter((p) => p.value != null);
  // Default to the latest month that has anything in it, and hold the farmer's
  // choice once he has made one.
  const selectedKey = withData.some((p) => p.key === ui.month)
    ? ui.month
    : withData[withData.length - 1]?.key ?? null;
  const selected = series.find((p) => p.key === selectedKey) ?? null;
  const ranked = selected ? plotStandings(plots, measure.key, selected) : [];

  return {
    top: appBar({
      title: t('b16.title', 'Farm progress'),
      subtitle: farm.name,
      help: {
        title: t('b16.title', 'Farm progress'),
        body: t('b16.help', 'One reading, averaged across every plot that has it, month by month for a year. It is a direction of travel for the whole holding — the plots underneath say who is pulling it up and who is pulling it down.'),
      },
    }),
    body: page(
      /* TAGGED TBD ON THE SCREEN, BECAUSE IT IS A PLACEHOLDER AND A REVIEWER
         CANNOT TELL FROM A SCREENSHOT.

         Review 21/09: "It'd be good to get input from Hany and possibly MMC on
         how to frame that. Since it's placeholder, can you tag it clearly as
         'TBD' in the mock-up so it's not mistaken for a finished design?"

         What is unresolved is not the chart but the question it answers.
         "Health, water stress, nutrition as an overall farm scorecard for
         selected metrics — I'm not sure how useful that framing actually is."
         Romain's own guess is that this ends up an aggregation of growth-stage
         data already shown at crop-detail level rather than a measure of its
         own, which would make it a roll-up and not a screen. Hany and MMC's
         master deck settle it. */
      disclaimer(t('b16.tbd', 'This screen is a placeholder. WafraGreentech and MMC to discuss what can and cannot be done here.')),

      when(!plots.length, () => emptyState({
        iconName: 'trend',
        title: t('b16.empty', 'Nothing measured yet'),
        body: t('b16.empty.body', 'Once this farm has plots we are watching, a year of readings builds up here.'),
      })),

      when(plots.length, () => chips(
        list.map((m) => ({
          id: m.key,
          label: t(`measure.${m.key}`, m.plain),
          icon: has(m.featureKey) ? null : 'lock',
        })),
        ui.measure,
        (key) => {
          const chosen = measureByKey(key);
          if (!has(chosen.featureKey)) { openModal('UPGRADE', { featureKey: chosen.featureKey }); return; }
          ui.measure = key;
          commit('b16');
        },
      )),

      when(plots.length && !withData.length, () => card({ accent: 'nodata' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon('nodata', 20),
          h('span', { style: { fontWeight: 650 } }, t('b16.nodata', 'No readings for this yet'))),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('b16.nodata.body', 'We have not measured {name} on this farm in the last twelve months.', {
            name: t(`measure.${measure.key}`, measure.plain),
          }))))),

      when(withData.length, () => card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' } },
          h('strong', { style: { fontSize: 'var(--t-lead)' } }, t(`measure.${measure.key}`, measure.plain)),
          h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b16.window', 'the last twelve months'))),
        yearChart(series, selectedKey, t(`measure.${measure.key}`, measure.plain)),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('b16.scale', 'Each point is the farm’s average for that month on the 0–100 scale.')),
        when(series.some((p) => p.value == null), () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('b16.gaps', 'Shaded months have no reading in our record of this farm.'))),
        directionLine(withData)))),

      /* THE SENTENCE THAT KEEPS THIS OFF B2. It is not a footnote and it is not
         behind an ⓘ: the whole risk of a farm-level figure is that it gets read
         as a score, so the qualification sits in the reading order between the
         chart and the numbers it produced. */
      when(withData.length, () => disclaimer(t('b16.mixing',
        'This is an average across plots growing different things — date palms and open field count the same, and each plot counts once whatever its size. Read it as a direction, not as a score for the farm.'))),

      when(selected && ranked.length, () => section(t('b16.standings', 'Plots against the farm line'), {},
        card({},
          // The month picker sits ON the figure it governs rather than in the
          // section rule above it: it is not a filter over the list, it is the
          // question the number underneath is an answer to, and the chart marks
          // whichever month it is on.
          cardPad(h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
            h('div', { style: { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { style: { maxWidth: '168px' } }, select(
                withData.map((p) => ({ value: p.key, label: p.label })),
                selectedKey,
                (v) => { ui.month = v; commit('b16'); },
                { 'aria-label': t('b16.month', 'Which month?') },
              )),
              h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
                t('b16.fromplots', 'the farm’s average, from {n} plots', { n: num(selected.count) }))),
            healthScore(selected.value))),

          standingsList(ranked.filter((r) => r.diff > 0), t('b16.above', 'Above the farm line')),
          standingsList(ranked.filter((r) => r.diff < 0), t('b16.below', 'Below the farm line'))))),
    ),
  };
}

/* The twelve months ending with this one — the year a season is judged on,
   rather than the calendar year, which in August would be eight months of
   history and four of nothing. */
function backTwelve() {
  const now = thisMonth();
  return monthsFrom(now.y, now.m - 11);
}

/* -- the farm's own line ---------------------------------------------------

   Built from the same per-plot readings B4 charts, bucketed by month: a plot's
   figure for a month is the mean of its readings in it, and the farm's figure
   is the mean of the plots. Doing it in that order is what keeps a plot that
   happened to be photographed five times in March from counting five times. */
function farmSeries(plots, key, months) {
  return months.map((month) => {
    const mk = monthKey(month);
    const values = plots
      .map((plot) => monthMean(plot.series?.[key], mk))
      .filter((v) => v != null);
    return {
      key: mk,
      label: month.y === NOW.getUTCFullYear() ? monthName(month.m) : `${monthName(month.m)} ${digits(month.y)}`,
      short: monthName(month.m),
      value: values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null,
      count: values.length,
    };
  });
}

function monthMean(points, mk) {
  const inMonth = (points ?? []).filter((p) => String(p.date).slice(0, 7) === mk);
  if (!inMonth.length) return null;
  return inMonth.reduce((sum, p) => sum + p.value, 0) / inMonth.length;
}

/** Every plot with a reading in the chosen month, furthest from the line first. */
function plotStandings(plots, key, month) {
  return plots
    .map((plot) => {
      const value = monthMean(plot.series?.[key], month.key);
      return value == null ? null : { plot, value: Math.round(value), diff: Math.round(value) - month.value };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.plot.shortName.localeCompare(b.plot.shortName));
}

/* Three rows a side. The list exists to name the plots that move the average,
   and a farm of thirty would otherwise print thirty rows of which twenty-four
   say "about the same as everyone else". The count of the rest is kept, because
   "and 9 others" is the fact that says whether the three are outliers or the
   start of a pattern. */
function standingsList(items, title) {
  if (!items.length) return null;
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  return h('div', {},
    h('div', {
      style: {
        padding: '10px var(--sp-4) 4px', fontSize: 'var(--t-meta)',
        fontWeight: 700, color: 'var(--ink-600)',
      },
    }, title),
    shown.map((item) => row({
      title: item.plot.shortName,
      sub: [item.plot.cropName, item.diff > 0
        ? t('b16.pointsabove', '{n} points above', { n: num(item.diff) })
        : t('b16.pointsbelow', '{n} points below', { n: num(Math.abs(item.diff)) })].filter(Boolean).join(' · '),
      value: healthScore(item.value),
      onclick: () => go(`${item.plot.kind === 'trees' ? 'B13' : 'B4'}:${item.plot.id}`),
      deckTo: item.plot.kind === 'trees' ? 'B13' : 'B4',
    })),
    when(rest > 0, () => h('div', {
      style: { padding: '4px var(--sp-4) 10px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' },
    }, t('b16.more', 'and {n} more', { n: num(rest) }))));
}

/* THE ANSWER TO THE QUESTION THE SCREEN WAS OPENED WITH. A year of points is a
   picture; "eight points higher than last September" is the sentence a farmer
   repeats to somebody else. Inside two points either way it says neither — a
   measure that reports its own noise as progress is a measure nobody believes
   the second time. */
function directionLine(withData) {
  if (withData.length < 2) return null;
  const first = withData[0];
  const last = withData[withData.length - 1];
  const diff = last.value - first.value;
  const text = Math.abs(diff) <= 2
    ? t('b16.flat', 'About where it was in {month}.', { month: first.label })
    : diff > 0
      ? t('b16.up', '{n} points higher than in {month}.', { n: num(diff), month: first.label })
      : t('b16.down', '{n} points lower than in {month}.', { n: num(Math.abs(diff)), month: first.label });
  return h('div', { style: { fontWeight: 650, color: 'var(--ink-800)' } }, text);
}

/* -- the chart ------------------------------------------------------------

   DRAWN HERE RATHER THAN WITH trendChart(), for two reasons that are both about
   honesty. trendChart scales its y-axis to the data, which turns three points
   of drift into a mountain range; a farm-level figure on a fixed 0–100 axis is
   the only version of this chart that can be compared with the same chart next
   month. And it joins every point to the next, which would draw a confident
   line straight through the months this farm was not photographed in.

   So: a fixed axis with its two ends labelled, a shaded column wherever there
   is no reading, and a line that BREAKS at a gap and picks up on the other
   side. The month labels live inside the viewBox, centred under their own
   points, which is the only way they stay aligned when the chart is stretched
   to the width of the phone. Direction comes from isRtl(), like every other
   chart in the app. */

const CHART_W = 320;

function yearChart(points, selectedKey, label) {
  const height = 168;
  const padX = 28;          // room for the "100" and "0" ticks outside the plot
  const padTop = 12;
  const padBottom = 30;     // room for the month names under the baseline
  const plotW = CHART_W - padX * 2;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i) => {
    const frac = points.length > 1 ? i / (points.length - 1) : 0.5;
    return padX + (isRtl() ? 1 - frac : frac) * plotW;
  };
  const y = (v) => padTop + (1 - v / 100) * (height - padTop - padBottom);

  // Consecutive runs of months that actually have a reading; each becomes its
  // own path, so a gap is a gap rather than an invented straight line.
  const runs = [];
  points.forEach((p, i) => {
    if (p.value == null) { runs.push(null); return; }
    const last = runs[runs.length - 1];
    if (Array.isArray(last)) last.push({ ...p, i });
    else runs.push([{ ...p, i }]);
  });
  const paths = runs.filter(Array.isArray).filter((run) => run.length > 1);
  const dots = runs.filter(Array.isArray).flat();

  return h('svg', {
    viewBox: `0 0 ${CHART_W} ${height}`, class: 'chart',
    role: 'img', 'aria-label': t('b16.chartlabel', '{name}, twelve months', { name: label }),
  },
  // The gaps first, so everything else draws over them.
  points.map((p, i) => (p.value != null ? null : h('rect', {
    x: x(i) - step / 2, y: padTop, width: Math.max(step, 6), height: height - padTop - padBottom,
    fill: 'var(--ink-100)', opacity: 0.55,
  }))),
  [0, 50, 100].map((v) => h('line', {
    x1: padX, x2: CHART_W - padX, y1: y(v), y2: y(v),
    stroke: v === 0 ? 'var(--ink-300)' : 'var(--ink-100)', 'stroke-width': 1, fill: 'none',
  })),
  [100, 0].map((v) => h('text', {
    x: isRtl() ? CHART_W - padX + 5 : padX - 5, y: y(v) + 3,
    'text-anchor': isRtl() ? 'start' : 'end',
    'font-size': 10, fill: 'var(--ink-500)',
  }, num(v))),

  // The month the read-out underneath is about.
  points.map((p, i) => (p.key === selectedKey ? h('line', {
    x1: x(i), x2: x(i), y1: padTop, y2: y(0),
    stroke: 'var(--brand-300)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', fill: 'none',
  }) : null)),

  paths.map((run) => h('path', {
    d: run.map((p, i) => `${i ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' '),
    fill: 'none', stroke: 'var(--brand-600)', 'stroke-width': 2.4,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  })),
  dots.map((p) => h('circle', {
    cx: x(p.i), cy: y(p.value), r: p.key === selectedKey ? 4.5 : 2.6,
    fill: p.key === selectedKey ? 'var(--brand-700)' : 'var(--brand-600)',
  })),

  /* EVERY THIRD MONTH IS NAMED, AND THE LAST ONE. Twelve labels fit under a
     phone-width chart in English and collide into each other in Arabic, where
     سبتمبر is twice the width of "Sep" — and a chart that is legible in one
     language and a smear in another is not finished. The stride is the same in
     every language rather than measured per script, because a reviewer holding
     the English and the Arabic beside each other should be looking at the same
     chart. Nothing is lost: the month the read-out is about is marked on the
     line and named in full in the picker under it. */
  points.map((p, i) => (i % 3 === 0 || i === points.length - 1
    ? h('text', {
      x: x(i), y: height - 10, 'text-anchor': 'middle', 'font-size': 10,
      fill: p.key === selectedKey ? 'var(--ink-800)' : 'var(--ink-500)',
      'font-weight': p.key === selectedKey ? 700 : 400,
    }, p.short)
    : null)));
}
