/* ---------------------------------------------------------------------------
   planner.js — B7 Crop planner, B8 Farm progress.

   TWO SCREENS THE CATALOGUE ALREADY SOLD AND THE APP NEVER DREW. The 13/09
   feature review went through the plan's own key list and kept two of the
   entries nothing routed to: `orchard.planner`, which every tree plan carries,
   and `progress.1y`, which every crop plan carries. Both are here, and both are
   FARM-level, which is the gap they fill — everything else in the build answers
   a question about one plot on one date.

   WHAT EACH ONE IS FOR, IN ONE LINE EACH.

     B7  the farm's ground, twelve months FORWARD. The app records a crop cycle
          one plot at a time on B3 — what went in, when it came off, what it
          gave — and nothing has ever laid those records side by side. A farmer
          who cannot see all of them at once cannot see that four plots come
          free in the same month, and cannot see that a field is going into a
          second or third season of the family it has just grown.

     B8  one measure, twelve months BACK, across the whole farm. B2 charts one
          plot's trend and C4 puts the whole farm at two dates beside each
          other; neither says whether the farm as a whole is better than it was
          a year ago, which is the question a season is judged on.

   B8 IS NOT THE FARM HEALTH SCORE COMING BACK. B1 deliberately carries no
   farm-level health average, on the stated argument that plant health at farm
   level averages crops that cannot be averaged, and nothing here disputes that.
   This is one measure the farmer chose, plotted over time, with the mixing said
   out loud on the screen and a read-out naming the plots above and below the
   line — so the average is never the last word, it is the thing the plot list
   underneath it explains. A single number standing for the health of a farm is
   still not offered anywhere in this app.

   THE TWO WINDOWS POINT IN OPPOSITE DIRECTIONS ON PURPOSE. A planner that shows
   you last spring is a diary, and a progress chart that shows you next spring is
   a forecast the satellite cannot make. So B7 starts at the current month and
   runs forward, and B8 ends at the current month and runs back.

   ONE THING BOTH GIVE UP. The app prints both calendars wherever a date appears,
   and a twelve-column ruler cannot carry two of them — a Gregorian month and a
   Hijri month do not line up and never will. So the grids are Gregorian, and
   every actual DATE either screen prints goes through date() and carries both.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc, isRtl } from '../core/i18n.js';
import { go, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, page, section, card, cardPad, row, chips, select, checkbox,
  statusIcon, healthScore, emptyState, disclaimer,
} from '../ui/components.js';
import { area, num, date, digits, NOW } from '../core/format.js';
import { farmById, plotById, plotsOf, measures, measureByKey, cropById } from '../data/selectors.js';
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
    months so that stepping BACKWARDS over a new year — which is what B8 does
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
   B7 · Crop planner
   ========================================================================== */

/* WHAT THE PLANNER IS, SINCE REVIEW 21/09 (SECOND PASS).

   It was a twelve-month band of every plot with a dashed bar on each saying
   what we would put in next. The call took the recommendation away — "one
   thing missing from a 'what to grow' recommendation is market pricing data,
   which we don't have… I think it's premature" — and the second pass says what
   replaces it:

     "We decided the crop planner was going to look like a full calendar of each
      step for the selected crop on the selected plot."

   with MMC's own table as the structure: operations down the side, the twelve
   months across, the months each operation falls in filled, and a comment
   column saying what we actually do at each one.

   SO THE SUBJECT CHANGED FROM THE FARM TO ONE PLOT. That is the whole of the
   redesign and it is worth being explicit about, because the old screen was an
   answer to "which ground is free in March" and this one answers "what does
   this crop need, and when". A farm-wide view of work would be twelve rows of
   thirteen operations, which is a spreadsheet; a plot at a time is a page.

   WHAT IS REAL AND WHAT IS PLACED. The plot, its crop, its planting date and
   its expected harvest are the record. WHERE each operation falls is worked out
   from those two dates and the fractions in OPERATIONS below — the app has no
   agronomic calendar per crop yet, and inventing thirteen dates per crop for
   thirty-seven crops would be inventing agronomy. The comments are MMC's own
   words from the deck Mark walked through, because what a scan delivers is
   MMC's to state and not ours. Thursday's call settles how much of this they
   can really supply, and the note at the foot says so on the screen.

   IT STILL WRITES NOTHING. No operation can be ticked, scheduled or assigned —
   see the note on the word "task" in cycleFieldWork's ancestor, tools/syntax.sh
   and the deleted task manager. This is a calendar to read. */

const NAME_W = 78;      // px — the plot column, wide enough for "Plot 12"
const MONTH_W = 30;     // px — the SMALLEST a month column may be; see calendarBand()

/* THE THIRTEEN OPERATIONS, IN MMC'S ORDER AND WITH MMC'S COMMENTS.

   `from`/`to` are fractions of the season — 0 is the planting date, 1 the
   expected harvest — and they may fall outside that range: land sampling and
   levelling happen before anything is planted, and developing new land after
   everything is off. `scan` is whether a satellite pass is involved, which is
   the one column of MMC's table that is about us rather than about the farmer:
   two of the thirteen say "no scan is needed" and they are drawn grey, because
   a farmer paying for satellite monitoring should be able to see which of his
   operations it touches. */
const OPERATIONS = [
  { id: 'sampling', from: -0.20, to: -0.16, scan: true, key: 'b15.op.sampling', en: 'Land sampling',
    note: 'Ground cover profiling; historical report' },
  { id: 'levelling', from: -0.14, to: -0.11, scan: true, key: 'b15.op.levelling', en: 'Levelling',
    note: 'Drainage estimation, planning and topography; 3D digital model' },
  { id: 'fert1', from: -0.08, to: -0.05, scan: true, key: 'b15.op.fert1', en: 'Fertilisation',
    note: 'Uses the previous season’s flight report; nutrients variable map' },
  { id: 'prep', from: -0.05, to: -0.02, scan: false, key: 'b15.op.prep', en: 'Plant prep',
    note: 'No scan is needed' },
  { id: 'herb1', from: -0.03, to: 0, scan: true, key: 'b15.op.herb1', en: 'Herbicides/bare',
    note: 'Scan the land for initial weeds or insects; weed and insect detection' },
  { id: 'planting', from: 0, to: 0.03, scan: true, key: 'b15.op.planting', en: 'Planting',
    note: 'Plant stand evaluation against target; sowing quality' },
  { id: 'herb2', from: 0.05, to: 0.22, scan: true, key: 'b15.op.herb2', en: 'Herbicides/green',
    note: 'Scan before spraying to find the areas of interest; weed management' },
  { id: 'cultivation', from: 0.15, to: 0.30, scan: false, key: 'b15.op.cultivation', en: 'Cultivation',
    note: 'No scan is needed' },
  { id: 'fert2', from: 0.30, to: 0.40, scan: true, key: 'b15.op.fert2', en: 'Fertilisation',
    note: 'In-season nitrogen management; nutrients variable map' },
  { id: 'irrigation', from: 0.40, to: 0.70, scan: true, key: 'b15.op.irrigation', en: 'Irrigation',
    note: 'Crop health in the field; irrigation map' },
  { id: 'harvest', from: 0.92, to: 1.04, scan: true, key: 'b15.op.harvest', en: 'Harvest',
    note: 'The right time to harvest; biomass and yield estimation' },
  { id: 'newland', from: 1.10, to: 1.22, scan: true, key: 'b15.op.newland', en: 'New land',
    note: 'Terrain, rock, tree and obstacle mapping' },
];

/** Which plot this screen is about: the one asked for, or the farm's first
    open-field plot. Tree groups are not here — trees are not rotated, which is
    what took them off this screen at the first pass. */
function plannerPlot(farm, plotId) {
  const open = plotsOf(farm.id).filter((p) => p.kind !== 'trees');
  return open.find((p) => p.id === plotId) ?? open[0] ?? null;
}

export function B7(param) {
  /* The route carries a FARM or a PLOT. B1 and the deck open it with a farm and
     get that farm's first open plot; the plot picker sends a plot id back. One
     parameter either way, because a route with two is a route people get
     wrong. */
  const byPlot = param && String(param).startsWith('plot-') ? plotById(param) : null;
  const farm = byPlot ? farmById(byPlot.farmId) : farmById(param);
  const plot = plannerPlot(farm, byPlot?.id);
  const cycle = plot ? (plot.cropCycles ?? []).find((c) => c.state === 'current') ?? null : null;
  /* THE BAND RUNS THE CROP'S OWN YEAR, NOT THE CALENDAR'S.

     The old farm-wide planner opened on THIS month, which was right when the
     question was "which ground comes free next". This screen answers "what does
     this crop need, and when", and a crop planted in February has its land
     sampling in January — so a band starting in August draws eleven empty
     columns and three operations. It starts at the month the first operation
     falls in, which is MMC's own table: January to December of the season,
     wherever the season happens to sit. */
  const season = plot ? seasonSpan(plot, cycle) : null;
  const months = season
    ? monthsFrom(new Date(season.first).getUTCFullYear(), new Date(season.first).getUTCMonth())
    : monthsFrom(thisMonth().y, thisMonth().m);
  const rows = plot ? operationRows(plot, cycle, months) : [];
  const others = plotsOf(farm.id).filter((p) => p.kind !== 'trees');

  return {
    top: appBar({
      title: t('b15.title', 'Crop planner'),
      subtitle: farm.name,
      help: {
        title: t('b15.title', 'Crop planner'),
        body: t('b15.help', 'Every operation one crop needs, across the twelve months it is in the ground. The filled months are when each one falls, worked out from the planting date and the expected harvest on this plot; the note beside each says what our satellite delivers for it. Nothing here is booked and nothing can be ticked off.'),
      },
    }),
    body: page(
      when(!plot, () => emptyState({
        iconName: 'calendar',
        title: t('b15.empty', 'Nothing to plan yet'),
        body: t('b15.empty.body', 'Once this farm has an open-field plot with a crop on it, its calendar appears here.'),
      })),

      when(plot, () => [
        /* WHICH PLOT AND WHICH CROP, at the top, because the whole page is
           about one of each and a calendar with no subject is a spreadsheet.
           The row is the picker: a farm with one open plot still shows it, so
           the screen never changes shape between farms. */
        card({}, row({
          iconName: 'sprout',
          title: cycle
            ? t('b15.subject', '{plot} · {crop}', { plot: plot.shortName, crop: cycle.cropName })
            : plot.shortName,
          sub: cycle
            ? [t('b5.sown', 'Started {date}', { date: date(cycle.startDate, { noYear: true }) }),
              cycle.expectedHarvest ? t('b4.expected', 'harvest around {d}', { d: date(cycle.expectedHarvest, { noYear: true }) }) : null,
            ].filter(Boolean).join(' · ')
            : t('b15.nocrop', 'No crop in the ground — the calendar below is the shape of a season, not this one'),
          value: others.length > 1 ? t('action.change', 'Change') : null,
          chevron: others.length > 1,
          deckNote: others.length > 1 ? 'Switches to another plot on this farm' : null,
          onclick: others.length > 1
            ? () => openSheet('PLANNER_PLOT', { farmId: farm.id, current: plot.id })
            : null,
        })),

        card({}, cardPad(
          /* THE YEARS, ONCE, ABOVE THE BAND. They used to sit in the column
             they changed on, which is right on a wide table and is what set the
             column width here — "’26" is three characters against a
             single-letter month, so twelve columns were sized by two labels.
             Said once, the band fits a phone. */
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', marginBottom: '4px' } },
            t('b15.span', '{from} to {to}', {
              from: date(new Date(monthStart(months[0])), { noYear: false, short: true }),
              to: date(new Date(monthStart(months[months.length - 1])), { noYear: false, short: true }),
            })),
          operationBand(rows, months),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: 'var(--t-meta)', color: 'var(--ink-600)', marginTop: '10px' } },
            legendSwatch('var(--brand-600)', t('b15.key.scan', 'We scan for this')),
            legendSwatch('var(--ink-300)', t('b15.key.noscan', 'No scan needed'))))),

        /* MMC'S COMMENTS COLUMN, UNDER THE TABLE RATHER THAN BESIDE IT. On the
           original it is a column as wide as the calendar itself; on a phone
           that is either a second horizontal scroller or four words per line,
           and neither is readable. Below, each operation carries its months and
           its note on one row — the same information, in the one direction a
           phone has to spare. */
        section(t('b15.ops', 'What happens at each step'), {},
          card({}, rows.map((r) => row({
            title: t(r.key, r.en),
            sub: t(`${r.key}.note`, r.note),
            value: r.label,
            chevron: false,
            statusKey: r.scan ? null : 'nodata',
          })))),

        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('b15.note', 'Mockup: the operations and their notes come from MMC’s own crop calendar; where each one falls is placed off this plot’s planting date and expected harvest. What MMC can really supply per crop is for Thursday’s call.')),
      ])),
  };
}

/** The planting date and the expected harvest this plot's calendar is built
    from, plus the moment the FIRST operation falls — which is what the band
    opens on. */
function seasonSpan(plot, cycle) {
  const guide = cropById(plot.cropId)?.guide ?? null;
  const startedAt = timeOf(cycle?.startDate ?? plot.plantedOn) ?? NOW.getTime();
  const endedAt = timeOf(cycle?.expectedHarvest)
    ?? (guide?.seasonDays ? startedAt + guide.seasonDays * 86400000 : startedAt + 120 * 86400000);
  const span = Math.max(endedAt - startedAt, 30 * 86400000);
  const earliest = Math.min(...OPERATIONS.map((op) => op.from));
  return { startedAt, span, first: startedAt + earliest * span };
}

/** One row per operation: where it falls in the band, and the months it covers
    written out for the list underneath. */
function operationRows(plot, cycle, months) {
  const { startedAt, span } = seasonSpan(plot, cycle);

  return OPERATIONS.map((op) => {
    const from = startedAt + op.from * span;
    const to = startedAt + op.to * span;
    return {
      ...op,
      from, to,
      label: monthSpanLabel(months, from, to),
    };
  });
}

/** "Feb" or "Apr – Jun", in the months the band actually draws. */
function monthSpanLabel(months, from, to) {
  const a = monthLabelOf(months, from);
  const b = monthLabelOf(months, to);
  if (!a && !b) return t('b15.outside', 'Outside this year');
  if (!a || !b || a === b) return a ?? b;
  return `${a} – ${b}`;
}

/* -- the band -------------------------------------------------------------

   ONE GRID, NOT A ROW OF LITTLE ONES. The header and every operation row share
   a single `grid-template-columns`, which is what guarantees that the cell
   under "Nov" is under "Nov" — thirteen independently laid-out rows drift the
   moment one operation name is longer than another.

   It is the only thing in the app allowed to be wider than the phone, so it
   carries its own horizontal scroller and nothing else on the screen has to
   move with it. The operation name sticks to the leading edge while the months
   run under it: a filled cell with no name against it is a cell about nothing.

   AND IT MIRRORS FOR FREE. The months are grid columns and the fills are
   positioned with `inset-inline-start`, so an Arabic or Pashto session reads
   the calendar right to left without this code asking which way round it is. */
function operationBand(rows, months) {
  /* THE COLUMNS ARE EQUAL AND AS WIDE AS THE LONGEST MONTH NAME, which is a
     sentence about translation rather than about layout. "Sep" is three
     characters and سبتمبر is twice the width, and a fixed 30-pixel column that
     fits the English throws the Arabic over its neighbour. `minmax(30px, 1fr)`
     inside a `max-content` grid makes every track take the size of the widest
     one — so the band is wider in Arabic, which is what it costs, and the time
     axis stays uniform, which is what the cells depend on. */
  /* ALL TWELVE MONTHS ON THE SCREEN AT ONCE, which is the whole point of the
     picture: a calendar you have to scroll sideways to read is a calendar
     nobody reads. The operation names need about 130 px, so what has to give is
     the month column — and the thing a month column is sized by is its label.

     SO THE LABELS ARE INITIALS HERE. J F M A M J J A S O N D is the standard
     compaction for a year on a phone, and nothing is lost by it: the year sits
     above the column it changes on, and the list underneath names every
     operation's months in words ("Apr – Jun"). MMC's own table has three-letter
     months because it was drawn for a slide two feet wide. */
  const template = `140px repeat(${months.length}, minmax(13px, 1fr))`;
  return h('div', {
    style: { overflowX: 'auto', overflowY: 'hidden', paddingBottom: '2px' },
    role: 'group',
    'aria-label': t('b15.band', 'The twelve months of this crop, operation by operation'),
  },
  h('div', { style: { display: 'grid', gridTemplateColumns: template, rowGap: '3px', alignItems: 'center', width: '100%', minWidth: 'max-content' } },
    h('div', { style: stickyCell() }),
    months.map((month, i) => monthHead(month, i, { initial: true })),
    rows.map((r) => [opNameCell(r), opTrackCell(r, months)])));
}

function opNameCell(r) {
  return h('div', {
    style: stickyCell({
      paddingInlineEnd: '8px', borderInlineEnd: '1px solid var(--ink-200)',
      fontSize: 'var(--t-micro)', fontWeight: '600',
      color: r.scan ? 'var(--ink-800)' : 'var(--ink-500)',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      lineHeight: '24px',
    }),
    title: t(r.key, r.en),
  }, t(r.key, r.en));
}

function opTrackCell(r, months) {
  const from = clamp01(fractionIn(months, r.from));
  const to = clamp01(fractionIn(months, r.to));
  const width = Math.max(to - from, 0);
  return h('div', {
    style: {
      gridColumn: `span ${months.length}`, position: 'relative', height: '24px',
      background: 'var(--ink-050)', borderRadius: '3px', overflow: 'hidden',
    },
  },
  // The month grid, so an empty row still reads as twelve months.
  h('div', { style: { position: 'absolute', inset: '0', display: 'flex' } },
    months.map((_, i) => h('span', {
      style: { flex: '1 1 0', borderInlineStart: i ? '1px solid var(--ink-200)' : '0' },
    }))),
  when(width > 0, () => h('span', {
    style: {
      position: 'absolute', top: '3px', bottom: '3px',
      insetInlineStart: `${from * 100}%`, width: `${width * 100}%`,
      minWidth: '10px', borderRadius: '3px',
      // Grey where MMC's table says no scan is needed: a farmer paying for
      // satellite monitoring should see which of his operations it touches.
      background: r.scan ? 'var(--brand-600)' : 'var(--ink-300)',
    },
  })));
}

function legendSwatch(colour, label) {
  return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
    h('span', { style: { width: '16px', height: '11px', borderRadius: '3px', background: colour } }),
    h('span', label));
}

function stickyCell(extra = {}) {
  return {
    position: 'sticky', insetInlineStart: '0', zIndex: '2',
    background: 'var(--paper)', ...extra,
  };
}

function monthHead(month, i, { initial = false } = {}) {
  const now = i === 0;
  /* The year is printed only where it changes, which on a twelve-month band is
     once, and it is the SHORT form because a column is as wide as "Sep" and
     "2027" is not. */
  const newYear = i === 0 || month.m === 0;
  return h('div', {
    style: {
      textAlign: 'center', lineHeight: '1.1', alignSelf: 'end',
      fontSize: 'var(--t-micro)', fontWeight: now ? '700' : '600',
      color: now ? 'var(--brand-700)' : 'var(--ink-500)',
    },
  }, when(newYear && !initial, () => h('div', { style: { color: 'var(--ink-500)', fontWeight: '500' } },
       `’${digits(String(month.y).slice(2))}`)),
     h('div', initial ? monthName(month.m).slice(0, 1) : monthName(month.m)));
}

/* =============================================================================
   B8 · Farm progress
   ========================================================================== */

/* ONE MEASURE AT A TIME, AND THE PICKER IS THE SCREEN'S ONLY MODE.

   Five lines on one chart would be five scales on one axis — plant health and
   water stress are both 0–100 and mean opposite things at 20 — so the screen
   shows one, named, with the farm's own vocabulary for it. The picker is the
   same five names the map and the plot screen use, and a measure outside the
   plan is shown locked rather than hidden, exactly as it is on B2.

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

export function B8(farmId) {
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

      /* THE SENTENCE THAT KEEPS THIS OFF B1. It is not a footnote and it is not
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

   Built from the same per-plot readings B2 charts, bucketed by month: a plot's
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
      onclick: () => go(`${item.plot.kind === 'trees' ? 'B5' : 'B2'}:${item.plot.id}`),
      deckTo: item.plot.kind === 'trees' ? 'B5' : 'B2',
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
