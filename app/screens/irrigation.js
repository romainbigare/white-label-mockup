/* ---------------------------------------------------------------------------
   irrigation.js — B12 Irrigation schedule.

   NEW AT v1.7.2, AND IT IS WHAT D2 USED TO BE. The review split irrigation in
   two: "irrigation advice is one shot only — we give an advice for irrigation
   if something is wrong, under irrigated or over irrigated. General irrigation
   schedules move to another page in plot details." So the standing plan for
   the week — how much water, on which days, in which window — lives here, on
   every plot and tree group, opened by pressing the irrigation box on the plot
   page (B2, B5). D2 keeps only the correction.

   WHAT v1.7.3 TOOK OFF IT — the October review:

     * "WHY THIS MUCH WATER?" The reference ET × crop coefficient sum. It is
       the working, and the farmer reads the answer.
     * THE SOIL, THE SYSTEM, THE FLOW RATE AND THE EFFICIENCY. The soil and
       the efficiency belong to the farm and are on My Farm (B1) and Farm
       settings (B11); the system and its flow rate are not asked for in this
       version. So nothing here is in minutes — "irrigate for 30 minutes" needs
       a flow rate — and every amount is water per hectare, with the total.

   WHAT IT KEEPS: the week, scrolling; the rate per hectare and the total for
   the plot; and the fertiliser that goes in with the water, now called what
   it is — "Fertilisers needed", not "Feed with this water" — in kilograms per
   HECTARE, which is the same content and the same words as the plot page's
   fertilisation box.

   Scheduling is PER AREA and says so. A field is watered over its hectares; a
   tree group over the hectares it covers, never per tree.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { appBar, page, card, cardPad, statusChip, kv, disclaimer, req, titledCard, lockedRow } from '../ui/components.js';
import { has } from '../core/entitlements.js';
import { num, area, pct, volume } from '../core/format.js';
import { plotById, farmById } from '../data/selectors.js';
import { weatherCalendar } from './advice.js';

const rate = (m3ha) => t('irr.rate', '{n} m³/ha', { n: num(m3ha) });

export function B12(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const plan = plot.irrigationSchedule;
  const trees = plot.kind === 'trees';

  return {
    top: appBar({ title: t('irr.title', 'Irrigation schedule'), subtitle: `${plot.shortName} · ${farm.name}` }),
    body: page(
      !plan
        ? disclaimer(t('irr.noplan', 'No forecast for this farm yet, so there is no schedule to work out.'), true)
        : card({}, cardPad(
          /* WF5.113 — cubic metres per hectare, the rate the system is set
             by, with the plot's total under it to check the bill against. */
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)', fontWeight: 650 } },
            t('irr.thisweek', 'This week')),
          h('div.bignum', rate(plan.weeklyM3Ha)),
          h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } },
            t('irr.events', 'in {n} waterings', { n: num(plan.events.length) })),
          h('div', { style: { fontSize: 'var(--t-lead)', fontWeight: 600, color: 'var(--ink-700)' } },
            trees
              ? t('irr.total.trees', '{volume} in total across the {area} this group covers', { volume: volume(plan.totalM3), area: area(plot.areaHa ?? 0) })
              : t('d2.total', '{volume} in total across {area}', { volume: volume(plan.totalM3), area: area(plot.areaHa ?? 0) })),
          // The number the farmer can actually judge: the change.
          when(Math.abs(plan.vsUsualPct) >= 3, () => h('div', {
            style: { fontSize: 'var(--t-lead)', fontWeight: 650, color: plan.vsUsualPct > 0 ? 'var(--st-monitor)' : 'var(--st-good)' },
          }, plan.vsUsualPct > 0
            ? t('d2.vsusual.up', 'An increase of {pct} on your usual watering', { pct: pct(plan.vsUsualPct) })
            : t('d2.vsusual.down', 'A reduction of {pct} on your usual watering', { pct: pct(Math.abs(plan.vsUsualPct)) }))),
          req('WF5.111', 'WF5.113'))),

      // The days, with the window for each watering and the weather that
      // decided it.
      when(plan, () => weatherCalendar(farm, {
        title: t('irr.calendar', 'This week’s waterings'),
        split: plan.events.map((e) => ({ ...e, volume: rate(e.volumeM3Ha) })),
        invent: false,
      })),

      /* 602 — FERTIGATION, as a column on the watering plan rather than a plan
         of its own, and only where the plumbing carries it: a drip plot. Per
         hectare, never the plot's total (v1.7.3). Premium on crops: on
         Basic the card is one locked row (the plan sheet, Oct 2026). */
      when(plot.fertigation && !has('fertigation', farm), () => card({}, lockedRow('fertigation', t('d2.fertneeded', 'Fertilisers needed')))),
      when(plot.fertigation && has('fertigation', farm), () => titledCard(t('d2.fertneeded', 'Fertilisers needed'), {
        aside: statusChip('good', { label: t('d2.fertigation.drip', 'Drip') }),
      },
      kv([
        [t('d2.fert.product', 'Product'), plot.fertigation.product],
        [t('d2.fert.rate', 'Rate'), t('d2.fert.ratevalue', '{n} kg per hectare, per irrigation', { n: num(plot.fertigation.kgPerEventPerHa) })],
        [t('d2.fert.events', 'Split across'), t('d2.fert.eventsvalue', '{n} of this week’s irrigations', { n: num(plot.fertigation.events) })],
      ]),
      h('div', { style: { color: 'var(--ink-700)' } }, plot.fertigation.targets.includes('maintenance')
        ? t('d2.fert.maintenance', 'Maintenance rate only — nothing is short this week.')
        : t('d2.fert.split', 'Split across the week’s irrigations rather than applied in one dose.')))),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('irr.oneshot', 'If a plot is getting too much or too little water, we will also send you an irrigation advice to put it right.'),
        req('WF5.116'))),
  };
}
