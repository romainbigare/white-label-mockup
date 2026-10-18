/* ---------------------------------------------------------------------------
   irrigation.js — B12 Irrigation schedule.

   NEW AT v1.7.2, AND IT IS WHAT D2 USED TO BE. The review split irrigation in
   two: "irrigation advice is one shot only — we give an advice for irrigation
   if something is wrong, under irrigated or over irrigated. General irrigation
   schedules move to another page in plot details." So the standing plan for
   the week — how much water, on which days, in which window, and why — lives
   here, on every plot and tree group, opened from the second button in its
   dock. D2 keeps only the correction: water this plot is short of, or water it
   should not be given, once.

   WHAT MOVED HERE WITH IT, from the crop cycle box on B2: the soil, the
   irrigation system, its efficiency and its flow rate. They are the inputs to
   this page's arithmetic and to nothing on that one, and "Edit these details"
   came with them.

   Scheduling is PER PLOT and says so. One plot has one irrigation system and
   one schedule; a per-tree schedule is not a thing that can be carried out.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { toast } from '../core/store.js';
import { t, lower } from '../core/i18n.js';
import { openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, page, card, cardPad, btn, statusChip, kv, disclaimer, req, titledCard,
} from '../ui/components.js';
import { num, area, pct, depth, volume } from '../core/format.js';
import { plotById, farmById } from '../data/selectors.js';
import { can } from '../core/capabilities.js';
import { weatherCalendar } from './advice.js';
import { stageName } from './plotparts.js';

const EFFICIENCY_LEVELS = {
  good: { status: 'good', label: 'Good', meaning: 'Most of the water you apply reaches the roots.' },
  fair: { status: 'monitor', label: 'Fair', meaning: 'Some of what you apply is not reaching the roots.' },
  poor: { status: 'urgent', label: 'Poor', meaning: 'Much of what you apply is lost before it reaches the roots.' },
};

const METHOD = {
  drip: () => t('irr.method.drip', 'Drip'),
  pivot: () => t('irr.method.pivot', 'Centre pivot'),
  flood: () => t('irr.method.flood', 'Basin flooding'),
};

function efficiencyLevel(pctValue) {
  return pctValue >= 82 ? 'good' : pctValue >= 70 ? 'fair' : 'poor';
}

/* 406 — today's evapotranspiration for one plot. ET₀ is a property of the DAY
   (the farm's weather); Kc is a property of the CROP AT ITS STAGE (the growth
   model). A plot with no growth model gets no card rather than a made-up
   coefficient. */
function etToday(plot) {
  const et0 = farmById(plot.farmId)?.weather?.forecast?.[0]?.et0Mm;
  const kc = plot?.growth?.kc;
  if (!et0 || !kc) return null;
  return { et0, kc, etc: Math.round(et0 * kc * 10) / 10 };
}

/** The sum, written out: ET₀ × Kc = what the plot lost today. */
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

const rate = (m3ha) => t('irr.rate', '{n} m³/ha', { n: num(m3ha) });

export function B12(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const plan = plot.irrigationSchedule;
  const et = etToday(plot);
  const effPct = plot.irrigationEfficiencyPct ?? 85;
  const level = efficiencyLevel(effPct);
  const eff = EFFICIENCY_LEVELS[level];

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
            t('d2.total', '{volume} in total across {area}', { volume: volume(plan.totalM3), area: area(plot.areaHa ?? 0) })),
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

      /* WHERE THE NUMBER CAME FROM (406): reference ET × crop coefficient =
         what the plot lost today. Three numbers and an equals sign make the
         volume above checkable rather than handed down. */
      when(et, () => titledCard(t('d2.et', 'Why this much water'), {},
        etSum(et),
        h('div', { style: { color: 'var(--ink-700)' } },
          t('d2.et.body', 'Reference ET is what today’s heat and wind would take off a standard grass surface. The crop coefficient scales that to what {crop} draws at {stage}, and the result is what the plot has to be given back.', {
            crop: lower(plot.cropName ?? t('d2.et.thecrop', 'this crop')),
            stage: lower(plot.growth ? stageName(plot.growth, plot.growth.stageId, plot.growth.stageName) : t('d2.et.itsstage', 'its current stage')),
          })))),

      /* 602 — FERTIGATION, as a column on the watering plan rather than a plan
         of its own, and only where the plumbing carries it: a drip plot. */
      when(plot.fertigation, () => titledCard(t('d2.fertigation', 'Feed with this water'), {
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

      // WF5.114 — how much of the water applied reaches the roots, in words.
      titledCard(t('d2.efficiency', 'Irrigation efficiency'), {
        card: { accent: eff.status },
        aside: statusChip(eff.status, { label: `${t(`d2.eff.${level}`, eff.label)} · ${pct(effPct)}` }),
      },
      h('div', { style: { color: 'var(--ink-700)' } }, t(`d2.eff.${level}.meaning`, eff.meaning))),

      /* THE SYSTEM THE SCHEDULE IS WORKED OUT FOR. These were the bottom half
         of B2's crop box; they are this page's inputs. WF6.020 / WF5.115 —
         the flow rate is asked for where it is missing. */
      titledCard(t('irr.system', 'Your irrigation system'), {},
        kv([
          [t('b4.soil', 'Soil'), plot.soil],
          plot.irrigationMethod ? [t('irr.method', 'Watered by'), METHOD[plot.irrigationMethod]?.() ?? plot.irrigationMethod] : null,
          [t('b4.efficiency', 'Irrigation efficiency'), pct(effPct)],
          [t('b4.flow', 'System flow rate'), plot.flowRateM3h
            ? `${num(plot.flowRateM3h)} m³/h`
            : h('button.textlink', {
              onclick: () => toast(t('b4.addflow.done', 'We will ask for this when you next log irrigation')),
            }, t('b4.addflow', 'Add a flow rate'))],
        ].filter(Boolean)),
        when(can('plot.create', farm), () => btn(t('b4.editplot', 'Edit these details'), {
          variant: 'ghost', size: 'sm', block: false, icon: 'edit',
          onclick: () => openSheet('ASSUMPTIONS', { plotId: plot.id }),
        }))),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('irr.oneshot', 'If a plot is getting too much or too little water, we will also send you an irrigation advice to put it right.'),
        req('WF5.116'))),
  };
}
