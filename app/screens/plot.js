/* ---------------------------------------------------------------------------
   plot.js — B2 Plot detail, B3/B4 Crop cycles.

   B2 IS A LIST OF BLOCKS, and the blocks are plotparts.js's, so a tree group
   (B5) is built from the same ones in the same order. v1.7.3 — the October
   review — set the order, one long page:

     the map · the crop box · the scorecard · the agronomic trend · the
     irrigation trend · the growth stage · irrigation · fertilisation ·
     disease & pest

   and took the dock away: "See advice" and "Irrigation schedule" opened what
   the three boxes at the end now show, and the irrigation box opens the week.

   THE CROP BOX IS THE ONE BLOCK THAT IS B2'S OWN, because a tree group has
   none. It is the thing the farmer knows and we do not, so it sits directly
   under the picture. It is compact: the crop's name, "Wheat" rather than
   "Growing wheat", then two lines — planted, and the harvest we estimate.
   Soil, irrigation efficiency and the irrigation system are not here and are
   not coming back: the soil and the efficiency are the farm's (B1, B11), and
   the system is not asked for in this version.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openSheet, openModal, back } from '../core/router.js';
import { B5 } from './trees.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, btn, actionDock,
  statusIcon, disclaimer, req, field, input,
} from '../ui/components.js';
import { area, num, date, NOW } from '../core/format.js';
import { plotById, rawPlot, farmById } from '../data/selectors.js';
import { startCycle } from '../data/actions.js';
import { can } from '../core/capabilities.js';
import {
  plotMap, scoreCard, trendBlock, irrigationTrendBlock, growthBlock,
  irrigationBox, fertilisationBox, pestBox, stageName,
} from './plotparts.js';

/* -- B2 · Plot detail ------------------------------------------------------
   OPEN FIELD ONLY. A tree group goes to B5 instead: it has no crop, no cycle
   and no season. */

export function B2(plotId) {
  const plot = plotById(plotId);
  // A tree group has no crop and no cycle; B5 is its screen.
  if (plot.kind === 'trees') return B5(plot.id);

  const farm = farmById(plot.farmId);
  const cycle = plot.cropCycles.find((c) => c.state === 'current');

  return {
    top: appBar({
      title: plot.shortName,
      // WF5.018 — there is no block between the plot and the farm any more.
      subtitle: farm.name,
      actions: [overflowAction(() => openSheet('PLOT_MENU', { plotId: plot.id }), undefined,
        { deckNote: 'Rename, edit the boundary, remove the plot' })],
    }),
    body: page(
      plotMap(plot),
      cropBox(plot, cycle, farm),
      scoreCard(plot),
      trendBlock(plot),
      irrigationTrendBlock(plot),
      growthBlock(plot),
      irrigationBox(plot),
      fertilisationBox(plot),
      pestBox(plot),
    ),
  };
}

/* WHAT IS GROWING HERE, in two states:

     waiting  the satellite watched the field being cleared and cannot name what
              replaced it, so the box is one button that opens a new cycle.
     growing  the crop, by name — "Wheat", not "Growing wheat" (v1.7.3) — then
              two lines, Planted and Estimated harvest, then the facts about
              this planting: its area and the yield we expect. The yield stays
              for now; where MMC can get it from without the farmer is an open
              question. No variety, anywhere in the app (v1.7.4).

   NO CROP SET IS ONE BUTTON AND NOTHING ELSE (review 21/09, second pass): every
   line the box carried there was an answer to a question nobody had asked. */
function cropBox(plot, cycle, farm) {
  const awaiting = !!plot.harvestDetectedOn;
  const canEdit = can('cropcycle.manage', farm);

  if (awaiting) {
    return card({}, cardPad(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon('sprout', 24)),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
            t('b4.nocrop', 'No crop set')),
          h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
            t('b4.harvested.short', '{crop} came off on {d}', {
              crop: plot.cropName, d: date(plot.harvestDetectedOn, { noYear: true, short: true }),
            })))),
      when(canEdit, () => btn(t('b4.setcrop', 'Set the crop for this plot'), {
        variant: 'emphasis', icon: 'sprout', deckTo: 'B4',
        deckNote: 'Opens the new crop cycle screen',
        onclick: () => go(`B4:${plot.id}`),
      }))));
  }

  const facts = [
    [t('b4.area', 'Area'), area(plot.areaHa)],
    cycle?.targetYield ? [t('b4.expectedyield', 'Expected yield'), cycle.targetYield] : null,
    plot.secondaryCropName ? [t('b4.secondary', 'Also growing'), plot.secondaryCropName] : null,
  ].filter(Boolean);

  return card({}, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px' } },
      h('span', { style: { color: 'var(--brand-600)', display: 'flex', paddingTop: '2px' } }, icon('sprout', 24)),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, plot.cropName),
        cycle
          ? h('div.cropdates',
            h('div', h('span', t('b5.sownlabel', 'Planted')), h('b', date(cycle.startDate, { noYear: true }))),
            when(cycle.expectedHarvest, () => h('div',
              h('span', t('b4.estharvest', 'Estimated harvest')), h('b', date(cycle.expectedHarvest, { noYear: true })))))
          : h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } }, t('b4.nocycleyet', 'No planting date recorded'))),
      when(canEdit, () => btn(t('action.edit', 'Edit'), {
        variant: 'secondary', size: 'sm', block: false, deckTo: 'B3',
        onclick: () => go(`B3:${plot.id}`),
      }))),
    when(cycle?.detectedCropName && cycle.detectedCropName !== cycle.cropName, () => h('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--st-monitor)', fontWeight: 600 },
    }, statusIcon('monitor', 16), t('b4.mismatch.short', 'The satellite reads something else here'))),
    h('div.facts', facts.map(([label, value]) => h('div.facts__item',
      h('span', label), h('b', value))))));
}


/* -- B3 · Crop cycles ----------------------------------------------------- */

/* A cycle is a raw record — lPlot() localises the plot, not the cycles on it —
   so its crop is named here, by the English-name key the plot's crop uses. */
export function cycleCrop(cycle) {
  return tc(`crop.${cycle.cropName}`, cycle.cropName);
}

export function B3(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const current = plot.cropCycles.find((c) => c.state === 'current');
  const previous = plot.cropCycles.filter((c) => c.state === 'closed');
  const canManage = can('cropcycle.manage', farm);

  return {
    top: appBar({
      title: t('b5.title', 'Crop cycles'), subtitle: plot.shortName,
      actions: [canManage ? barAction('plus', t('action.new', 'New'), () => go(`B4:${plot.id}`), { deckTo: 'B4' }) : null].filter(Boolean),
    }),
    body: page(
      when(current, () => cropMismatch(plot, current)),

      // THE SEASON AS A BAR, not as a table of dates. What a farmer wants off
      // this screen is where he is in the season and how long is left, and a
      // list reading "Planting date 12 Feb / Harvest expected 4 Nov" makes him
      // do that arithmetic himself. The bar does it: sown at one end, harvest
      // at the other, today marked.
      when(current, () => card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('span', { style: { color: 'var(--brand-600)', display: 'flex' } }, icon('sprout', 22)),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, cycleCrop(current))),
          h('span.status.status--good', icon('check', 15), t('b5.current', 'Current'))),

        seasonBar(current),

        /* THE HEAT BESIDE THE DAYS, at the 13/09 review. The bar above counts
           calendar days to the harvest estimate; this line says how much of
           the crop's own heat requirement has actually accumulated, which is
           what decides whether that estimate holds. A season two-thirds
           through its days and half through its heat is a harvest that will
           be late, and the farmer can see that here before the estimate
           moves under him. */
        when(current.growth, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b5.gdd', '{stage} · {acc} of {target} growing degree days', {
              stage: stageName(current.growth, current.growth.stageId, current.growth.stageName),
              acc: num(current.growth.accumulated),
              target: num(current.growth.target),
            })),
          h('div.season__bar', { style: { height: '6px' } },
            h('span.season__fill', {
              style: { width: `${Math.min(100, Math.round((current.growth.accumulated / current.growth.target) * 100))}%` },
            })))),

        // The two numbers a season is judged on, side by side, only where the
        // fixture has them — a target with no yield beside it is an ambition.
        when(current.yieldSoFar || current.targetYield, () => h('div', { style: { display: 'flex', gap: '10px' } },
          when(current.yieldSoFar, () => figure(t('b5.yieldsofar', 'Yield so far'), current.yieldSoFar)),
          // "Expected", not "target", everywhere the number is shown — it is
          // our estimate and not the farmer's goal. See the note on B4.
          when(current.targetYield, () => figure(t('b4.expectedyield', 'Expected yield'), current.targetYield)))),

        /* THE FORECAST, AND IT IS A RANGE.

           The app has always carried a TARGET yield, which is the farmer's own
           ambition typed into a field, and a yield SO FAR, which is what has
           been weighed. Neither is a prediction, and the tour has been
           promising one for months.

           A single number would be the wrong shape for it twice over: MMC
           quotes about 90% accuracy on annual crops, and the 13/09 call was
           explicit that date palms need another season's work before their
           figure can be trusted. So the band is the feature — wide early,
           narrowing as the crop fills — and where it is a tree the screen says
           in as many words that the model is still being refined, rather than
           printing a confident number nobody should act on. */
        when(current.yieldForecast, () => yieldForecastBlock(current.yieldForecast)),

        // A cut crop is a season inside a season; alfalfa is cut eight times.
        when(current.cutsMonitor, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('b5.cutvalue', '{a} of {b}, next around {d}', {
              a: current.cutsDone, b: current.cutsMonitor, d: date(current.nextCut, { noYear: true }),
            })),
          h('div.cuts', Array.from({ length: current.cutsMonitor }, (_, i) => h(
            `span.cuts__mark${i < current.cutsDone ? '.cuts__mark--done' : ''}`,
          ))))),

        when(canManage, () => btn(t('b5.manage', 'Edit this cycle'), {
          variant: 'secondary', size: 'sm', block: false, deckTo: 'B4',
          onclick: () => go(`B4:${plot.id}|${current.id}`),
        }))))),

      when(!current, () => card({ accent: 'nodata' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon('nodata', 20),
          h('span', { style: { fontWeight: 650 } }, t('b5.none', 'Nothing planted here at the moment'))),
        when(canManage, () => btn(t('b5.start', 'Record a planting'), {
          variant: 'primary', size: 'sm', block: false, icon: 'plus',
          onclick: () => go(`B4:${plot.id}`),
        }))))),

      // WF5.029 — closing never deletes; the full history stays visible. It is
      // a TIMELINE rather than a stack of cards: what the history is for is
      // comparing one year with the last, and cards of equal weight down a
      // screen hide the sequence that is the whole point of keeping them.
      section(t('b5.previous', 'Previous seasons'), {},
        previous.length
          ? card({}, previous.map((cycle) => h('button.season', {
            onclick: () => go(`B4:${plot.id}|${cycle.id}`), type: 'button',
          },
          h('span.season__year', String(new Date(cycle.startDate).getUTCFullYear())),
          h('span.season__body',
            h('span.season__crop', cycleCrop(cycle)),
            // A range in a list row is the one place the second calendar is
            // dropped: two full dates either side of a dash is a paragraph
            // where the column wants a stamp, and the year beside it is what
            // the reader is scanning down anyway.
            h('span.season__dates',
              `${date(cycle.startDate, { short: true, noYear: true })} – ${date(cycle.actualHarvest, { short: true })}`)),
          h('span.season__yield', cycle.actualYield ?? '—'),
          h('span.row__chev', icon('forward', 18, 'flip')))))
          : h('p', { style: { color: 'var(--ink-500)', margin: 0 } }, t('b5.noprev', 'No earlier cycles recorded on this plot.'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b5.retained', 'Crop history is kept for good. Rotating a field never erases past cycles.'), req('WF5.029'))),
  };
}

/* WHERE THE SEASON IS, drawn rather than tabulated.

   Sowing at one end, the harvest we expect at the other, and today's position
   between them. The harvest date is OUR estimate and says so — review C287 took
   it off the farmer, and a date he did not type and cannot edit has to declare
   where it came from. */
/** The predicted harvest, as a band with its own confidence stated. Drawn as
    prose with one big figure rather than as a third `figure()` beside the
    target and the yield so far: those two are facts, this is a model's
    opinion, and setting all three in the same tiles would make it look like
    the same kind of thing. */
function yieldForecastBlock(forecast) {
  const confidence = {
    low: t('b5.forecast.low', 'Early in the season, so the range is wide.'),
    fair: t('b5.forecast.fair', 'Narrowing as the crop fills.'),
    good: t('b5.forecast.good', 'The crop is far enough along for this to be firm.'),
  }[forecast.confidence] ?? '';
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column', gap: '2px',
      borderTop: '1px solid var(--ink-200)', paddingTop: '10px',
    },
  },
  h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
    t('b5.forecast', 'Harvest forecast')),
  h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)', fontVariantNumeric: 'tabular-nums' } },
    forecast.unit === 'kg/tree'
      ? t('b5.forecast.pertree', '{low}–{high} kg/tree', { low: num(forecast.low), high: num(forecast.high) })
      : t('b5.forecast.perha', '{low}–{high} t/ha', { low: num(forecast.low, 1), high: num(forecast.high, 1) })),
  h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, confidence),
  // The one caveat the call asked to be carried rather than buried.
  when(forecast.refining, () => h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
    t('b5.forecast.refining', 'Tree yields are still being tuned for this region — treat the range as indicative.'))));
}

function seasonBar(cycle) {
  const start = new Date(cycle.startDate).getTime();
  const end = new Date(cycle.expectedHarvest ?? cycle.startDate).getTime();
  const now = NOW.getTime();
  const span = Math.max(1, end - start);
  const pctThrough = Math.max(0, Math.min(100, ((now - start) / span) * 100));
  const daysLeft = Math.round((end - now) / 86400000);

  /* THE ENDS ARE ROWS, NOT COLUMNS. They were three columns under the bar, and
     a date is two calendars wide now — "12 February 2026 - 24 Sha'ban 1447"
     does not fit a third of a phone, so all three columns wrapped into each
     other. The countdown moved above the bar, where it is the headline it
     always was, and the two dates get a full line each. */
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
    h('div', { style: { fontWeight: 650 } },
      daysLeft > 0
        ? t('b5.daysleft', '{n} days to go', { n: num(daysLeft) })
        : t('b5.overdue', 'past our estimate')),
    h('div.season__bar',
      h('span.season__fill', { style: { width: `${pctThrough}%` } }),
      h('span.season__now', { style: { insetInlineStart: `${pctThrough}%` } })),
    h('div.season__end',
      h('small', t('b5.sownlabel', 'Planted')),
      h('b', date(cycle.startDate))),
    h('div.season__end',
      h('small', t('b5.harvestlabel', 'Harvest, our estimate')),
      h('b', cycle.expectedHarvest ? date(cycle.expectedHarvest) : '—')));
}

function figure(label, value) {
  return h('div.figure',
    h('span.figure__label', label),
    h('span.figure__value', value));
}

/* Review C291 … C297 — the farmer typed tomato and the satellite reads onion.
   That is not an error state and it is not the app being right: the imagery is
   a canopy signature and the farmer was standing in the field. So both answers
   are shown, in the farmer's words, with the two dispositions that actually
   exist — take ours, or keep yours.

   It sits ABOVE the cycle card rather than inside it, because until it is
   resolved the card underneath may be describing the wrong crop, and the
   warning has to be read first. */
function cropMismatch(plot, cycle) {
  if (!cycle.detectedCropName || cycle.detectedCropName === cycle.cropName) return null;
  const detected = t(`crop.${cycle.detectedCropName.toLowerCase().replace(/\s/g, '')}`, cycle.detectedCropName);
  return card({ accent: 'monitor' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusIcon('monitor', 18),
      h('span', { style: { fontWeight: 700 } }, t('b5.mismatch', 'This may not be the right crop'))),
    h('div', { style: { color: 'var(--ink-700)' } },
      t('b5.mismatch.body', 'The satellite is seeing something different. It reads {detected}, and you entered {entered}.',
        { detected, entered: cycleCrop(cycle) })),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      // Review 21/09 asked for these two by name — "two buttons, 'ignore' or
      // 'update', when the satellite's read doesn't match what the farmer
      // entered" — and they were already here under longer labels. Shortened to
      // his words: a two-word button is read, a five-word one is parsed.
      btn(t('b5.mismatch.take', 'Update'), {
        variant: 'emphasis', size: 'sm', block: false,
        onclick: () => {
          const raw = rawPlot(plot.id).cropCycles.find((c) => c.id === cycle.id);
          if (raw) { raw.cropName = cycle.detectedCropName; raw.detectedCropName = null; }
          toast(t('b5.mismatch.taken', 'Updated to {crop}', { crop: detected }));
          commit('cycle');
        },
      }),
      btn(t('b5.mismatch.keep', 'Ignore'), {
        variant: 'secondary', size: 'sm', block: false,
        onclick: () => {
          const raw = rawPlot(plot.id).cropCycles.find((c) => c.id === cycle.id);
          if (raw) raw.detectedCropName = null;
          toast(t('b5.mismatch.kept', 'Kept as {crop}', { crop: cycleCrop(cycle) }));
          commit('cycle');
        },
      })),
    req('WF5.030')));
}

/* -- B4 · Add / edit crop cycle, WF5.028 / WF5.030 / WF5.031 ---------------- */

export function B4(param) {
  const [plotId, cycleId] = String(param).split('|');
  const plot = plotById(plotId);
  const existing = cycleId ? plot.cropCycles.find((c) => c.id === cycleId) : null;
  const openCycle = plot.cropCycles.find((c) => c.state === 'current');
  const blocked = !existing && openCycle;                       // WF5.028

  const d = local(`b6-${plotId}-${cycleId ?? 'new'}`, {
    cropId: existing?.cropId ?? '', cropName: existing?.cropName ?? '',
    startDate: existing?.startDate ?? '2026-08-03',
    actualHarvest: existing?.actualHarvest ?? '',
    actualYield: existing?.actualYield ?? '',
    notes: existing?.notes ?? '',
  });

  return {
    top: appBar({ title: existing ? t('b6.edit', 'Edit crop cycle') : t('b6.new', 'New crop cycle'), subtitle: plot.shortName }),
    body: page(
      when(blocked, () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        /* Review 21/09 shortened the instruction: "Close it out before
           entering a new crop for this plot." The old half of the sentence
           explained HOW to close it — a harvest date, optionally a yield —
           which is the next screen's job, and the button under this banner
           already opens it. */
        disclaimer(t('b6.blocked', 'This plot already has an open cycle: {crop}, started {date}. Close it out before entering a new crop for this plot.', {
          crop: cycleCrop(openCycle), date: date(openCycle.startDate),
        }), true),
        )),

      field(t('b6.crop', 'Crop'),
        h('button.row', {
          onclick: () => openSheet('CROP_PICKER', { onPick: (crop) => { d.cropId = crop.id; d.cropName = crop.name; commit('b6'); } }),
          style: { border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)', background: 'var(--paper)' },
        }, h('div.row__main', h('div.row__title', d.cropName ? tc(`crop.${d.cropName}`, d.cropName) : t('b6.pickcrop', 'Choose a crop'))),
           h('span.row__chev', icon('search', 20))),
        { required: true }),
      // "Planting date", not "sowing or planting date". Review C288/C289: the
      // two words describe the same moment for a farmer, and offering both
      // raised a distinction that then had to be explained.
      //
      // The EXPECTED HARVEST field has gone with them (C287). It was a guess
      // typed in February about a date in November, it was never revisited, and
      // the app models it from the crop, the planting date and the season —
      // which is the number B3 shows, marked as ours.
      field(t('b6.start', 'Planting date'), input({ type: 'date', value: d.startDate, onchange: (e) => { d.startDate = e.target.value; commit('b6'); } }), { required: true }),
      when(existing?.state === 'closed', () => field(t('b6.actual', 'Actual harvest date'),
        input({ type: 'date', value: d.actualHarvest, onchange: (e) => { d.actualHarvest = e.target.value; } }))),
      /* THE TARGET YIELD FIELD HAS GONE, AND THE NUMBER HAS NOT.

         Review 21/09: "It shouldn't be editable by the farmer — either he's
         using our system, in which case we determine the yield and tell him
         whether he's tracking to it, or he isn't. He shouldn't be able to
         override our number." Mark checked the distinction twice on the call,
         and it is the input being removed rather than the data: B2 still prints
         the figure, under "Expected yield" rather than "Target yield", because
         a target is a thing you set and this is a thing we work out.

         An editable field here was quietly the opposite of the feature. The
         on-track/off-track reading is only worth anything measured against OUR
         estimate; a farmer who types in his own optimistic number gets an app
         that agrees with him. */
      when(existing?.state === 'closed', () => field(t('b6.actualyield', 'Actual yield'),
        input({ value: d.actualYield, oninput: (e) => { d.actualYield = e.target.value; } }))),
      field(t('b6.notes', 'Notes'), h('textarea.textarea', { value: d.notes, oninput: (e) => { d.notes = e.target.value; } })),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('b6.mandatory', 'Just the crop and planting date are needed. We’ll estimate the harvest window and let you know if it shifts.'),
        req('WF5.036'))),
    // WF2.010 — one primary action, and it is whichever action the screen is
    // actually for: closing the blocking cycle, or saving the new one.
    dock: actionDock(blocked
      ? btn(t('b6.close', 'Close the {crop} cycle', { crop: cycleCrop(openCycle) }), {
          variant: 'primary',
          onclick: () => openModal('CLOSE_CYCLE', { plotId, cycleId: openCycle.id }),
        })
      : btn(t('action.save', 'Save'), {
      variant: 'primary', disabled: !d.cropId || !d.startDate,
      onclick: () => {
        if (existing) { Object.assign(existing, d); commit('b6'); }
        // startCycle() rather than a push from here: a new cycle also settles
        // the plot's own crop and clears the "set new crop" prompt, and both of
        // those live on the raw record this screen only holds a copy of.
        else startCycle(plotId, { ...d });
        toast(t('cycle.saved', 'Crop cycle saved'));
        back();
      },
    })),
  };
}

/* B7 AND B8 ARE GONE, and this is where they were.

   B7 drew one plot full-screen with a value probe; B8 drew the same plot at two
   dates with a divider. Both were the MAP, rebuilt at plot scope and reachable
   from nowhere else — and the review's answer was the obvious one: if you want a
   reading full-screen you want the Map tab, which already draws every plot on
   the farm, already has the layer picker, already has the date comparison, and
   is one of four things on the tab bar. So the "open in the map" button on B2
   hands the plot to C1 and the two screens have gone with their duplication.
   C1/C4 carry WF5.029…WF5.033 now. */
