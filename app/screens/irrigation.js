/* ---------------------------------------------------------------------------
   irrigation.js — the irrigation schedule block of the plot page (B2, B5).

   WAS B12, A SCREEN OF ITS OWN; IS NOW THE END OF THE PAGE (Nov 2026). The
   standing plan for the week used to open from an "Irrigation" box on the plot
   page, and a "Fertilisation" box sat under it. The review put the schedule on
   the plot page itself, in place of both boxes: one section, under a heavy
   rule and a header of its own, so the farmer scrolls from how the field is
   doing (the map, the scorecard, the trends) to what to do about it.

   WHAT THE SECTION HOLDS, top to bottom:

     * THE WEEK'S WATER AS THE HERO, first under the header: the rate per
       hectare, how many waterings, the plot's total, and the change on the
       usual as a pill. (An advice about water or feed is not repeated here:
       it is in the inbox, D1.)
     * THE WEEK AS A DAY STRIP: each watering on its day, with its window and
       the weather that decided it. A day that carries fertiliser says so on
       its own card.
     * THE FERTILISER, KEPT TO A GLANCE (Premium): the product and its dose,
       and the week as seven days with the fertiliser days filled in.
       "Calcium nitrate 15.5, 15 kg/ha per irrigation, 3 this week" read as a
       sentence left the farmer asking which three days. Fertiliser is given
       through the irrigation, so it sits straight under it.

   WHAT IT DOES NOT HAVE, and is not coming back: "Why this much water?", and
   the soil, the irrigation system, its flow rate and its efficiency. The soil
   and the efficiency belong to the farm (B1, B11) and the system is not asked
   for in this version, so nothing here is in minutes: every amount is water
   per hectare, with the plot's total.

   Scheduling is PER AREA and says so. A field is watered over its hectares; a
   tree group over the hectares it covers, never per tree.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { disclaimer, req, heroCard, pill, card, lockedRow, partSection } from '../ui/components.js';
import { has } from '../core/entitlements.js';
import { num, area, pct, volume, splitFigure } from '../core/format.js';
import { farmById } from '../data/selectors.js';
import { weatherCalendar } from './advice.js';

const rate = (m3ha) => t('irr.rate', '{n} m³/ha', { n: num(m3ha) });

/** The product's name and its N-P-K, from "Calcium nitrate 15.5-0-0". */
function productParts(product) {
  const m = /^(.*?)\s*(\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?)$/.exec(String(product ?? '').trim());
  return m ? { name: m[1] || 'NPK', npk: m[2] } : { name: product, npk: null };
}

/* THE FERTILISER, AS LITTLE AS IT CAN BE: what it is and how much (the product
   and the dose each time), and which days (the week, seven boxes, the days it
   goes in on filled). No bars, no nutrient names, no totals. */
function fertiliserCard(plot, farm) {
  const f = plot.fertigation;
  if (!f) return null;
  if (!has('fertigation')) return card({}, lockedRow('fertigation', t('fert.title', 'Fertiliser')));

  const { name, npk } = productParts(f.product);
  const on = new Set(f.dates);
  return card({}, h('div.card__pad', h('div.fert',
    h('div.fert__top',
      h('span.fert__tile', icon('sprout', 24)),
      h('div.fert__product', h('b', name), when(npk, () => h('span', npk))),
      h('div.fert__dose',
        h('b', t('fert.dose', '{n} kg/ha', { n: num(f.kgPerEventPerHa) })),
        h('span', t('fert.each', 'each time')))),
    h('div.fert__week', { role: 'list', 'aria-label': t('fert.title', 'Fertiliser') },
      farm.weather.forecast.slice(0, 7).map((d) => h(`span.fert__day${on.has(d.date) ? '.fert__day--on' : ''}`, { role: 'listitem' }, d.day))))));
}

export function irrigationSchedule(plot) {
  const farm = farmById(plot.farmId);
  const plan = plot.irrigationSchedule;
  const trees = plot.kind === 'trees';
  const fertDays = has('fertigation') && plot.fertigation ? new Set(plot.fertigation.dates) : new Set();

  return partSection({
    iconName: 'droplet',
    title: t('irr.title', 'Irrigation schedule'),
    sub: t('irr.sub', 'The week’s water and fertiliser, per hectare'),
  },
  !plan
    ? disclaimer(t('irr.noplan', 'No forecast for this farm yet, so there is no schedule to work out.'), true)
    /* THE WEEK'S WATER AS THE HERO (v1.8): the rate per hectare the system is
       set by (WF5.113), how many waterings, the plot's total to check the bill
       against, and the change on the usual as a pill. */
    : (() => {
      const figure = splitFigure(rate(plan.weeklyM3Ha));
      const change = Math.abs(plan.vsUsualPct) >= 3;
      return heroCard({
        tone: 'info', wash: true, iconName: 'droplet',
        eyebrow: t('irr.thisweek', 'This week'),
        value: figure.value, unit: figure.unit, textValue: figure.whole,
        aside: t('irr.events', 'in {n} waterings', { n: num(plan.events.length) }),
        body: trees
          ? t('irr.total.trees', '{volume} in total across the {area} this group covers', { volume: volume(plan.totalM3), area: area(plot.areaHa ?? 0) })
          : t('d2.total', '{volume} in total across {area}', { volume: volume(plan.totalM3), area: area(plot.areaHa ?? 0) }),
      },
      // The number the farmer can actually judge: the change.
      when(change, () => pill(plan.vsUsualPct > 0
        ? t('d2.vsusual.up', 'An increase of {pct} on your usual watering', { pct: pct(plan.vsUsualPct) })
        : t('d2.vsusual.down', 'A reduction of {pct} on your usual watering', { pct: pct(Math.abs(plan.vsUsualPct)) }),
      { tone: plan.vsUsualPct > 0 ? 'monitor' : 'good', iconName: 'trend' })),
      req('WF5.111', 'WF5.113'));
    })(),

  // The days, with the window for each watering, the weather that decided it
  // and, where there is one, the fertiliser that goes in with it.
  when(plan, () => weatherCalendar(farm, {
    title: t('irr.calendar', 'This week’s waterings'),
    split: plan.events.map((e) => ({
      ...e,
      volume: rate(e.volumeM3Ha),
      tag: fertDays.has(e.date)
        ? { iconName: 'sprout', text: t('fert.tag', '{n} kg/ha', { n: num(plot.fertigation.kgPerEventPerHa) }) }
        : null,
    })),
    invent: false,
  })),

  /* 602 — FERTIGATION, as a column on the watering plan rather than a plan of
     its own, and only where the plumbing carries it: a drip plot. Per
     hectare, never the plot's total (v1.7.3). Premium: on Basic the card is
     one locked row (the plan sheet, Oct 2026). */
  when(plot.fertigation, () => fertiliserCard(plot, farm)),

  h('p.finetext',
    t('irr.oneshot', 'If a field is getting too much or too little water, we will also send you an irrigation advice to put it right.'),
    req('WF5.116')));
}
