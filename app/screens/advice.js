/* ---------------------------------------------------------------------------
   advice.js — D1 Advice inbox, D2–D6 detail screens, D7 Record what you did.

   §5.9 opens with "an inbox, not a dashboard: items arrive, are read, are acted
   on, and are cleared." That sentence sets the whole structure: cards carry
   their actions inline (WF5.078) so acting on advice does not require opening
   anything, and D7 is reachable in one tap from the card so that recording an
   action costs at most three taps (WF5.099).

   The card body order is fixed by WF5.077 — what to do, how much, why — and the
   reason is mandatory. `adviceCard()` renders those three in that order and
   nothing may reorder them.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back, switchTab } from '../core/router.js';
import { icon, ADVICE_ICON } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, actionDockPair, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockBox, req, chips, pillTabs, select, divider, field, input, radioList,
} from '../ui/components.js';
import { num, date, dateTime, volume, depth, area, ago } from '../core/format.js';
import { adviceFor, adviceById, groupedAdvice, severityToStatus, farmById, plotById, visibleFarms } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { recordAction, markAdviceSeen } from '../data/actions.js';
import { statusLabel } from '../core/status.js';
import { detailRouteFor } from './plot.js';

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'irrigation', label: 'Irrigation', icon: 'droplet' },
  { id: 'nutrition', label: 'Nutrition', icon: 'sprout' },
  { id: 'protection', label: 'Crop protection', icon: 'shield' },
  { id: 'weather', label: 'Weather', icon: 'cloud' },
  { id: 'harvest', label: 'Harvest', icon: 'basket' },
];

/* -- D1 · Advice inbox, WF5.076 … WF5.082 ---------------------------------- */

export function D1() {
  const tab = state.ui.adviceTab;
  const farmFilter = state.ui.farmFilter;
  const typeFilter = state.ui.adviceTypeFilter;

  // WF5.082 — where the plan has no advisory, the tab still exists and shows
  // weather alerts plus a locked card describing what would appear. Never empty.
  const advisoryInPlan = has('advisory.operations') || has('fertiliser.insights') || has('irrigation.schedule') || has('irrigation.schedule.tree');

  const all = adviceFor({ farmId: farmFilter, status: tab === 'done' ? 'done' : tab === 'all' ? 'all' : 'open', type: typeFilter });
  const list = tab === 'needs' ? all.filter((a) => a.severity !== 'watch') : all;
  const groups = groupedAdvice(list);
  const needsCount = adviceFor({ status: 'open' }).filter((a) => a.severity !== 'watch').length;
  const doneCount = adviceFor({ status: 'done' }).length;

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('div.appbar__title', t('nav.advice', 'Advice')),
        h('button.chip', { onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('advice'); } }) },
          h('span', farmFilter === 'all' ? t('filter.allfarms', 'All farms') : farmById(farmFilter).name),
          icon('chevronDown', 15))),
      // WF5.079 — filters: farm, plot, type, status. Two rows, because status and
      // type are independent; 8 dp apart, which is WF2.004's minimum clearance
      // and therefore as tight as the pair is allowed to sit.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--touch-gap)', paddingBottom: '6px' } },
        pillTabs([
          { id: 'needs', label: t('d1.needs', 'Needs action'), count: needsCount },
          { id: 'all', label: t('d1.all', 'All') },
          { id: 'done', label: t('d1.done', 'Done'), count: doneCount },
        ], tab, (id) => { state.ui.adviceTab = id; commit('advice'); }),
        chips(TYPE_FILTERS.map((f) => ({ ...f, label: t(`advice.type.${f.id}`, f.label) })), typeFilter,
          (id) => { state.ui.adviceTypeFilter = id; commit('advice'); }))),

    body: page(
      when(!advisoryInPlan, () => lockBox('advisory.operations', {
        title: t('d1.locked.title', 'Advice is part of the Pro plan'),
        body: t('d1.locked.body', 'Irrigation, nutrition and crop protection advice for every plot, with the reasoning behind it.'),
      })),

      groups.length
        ? groups.map((group) => section(t(`d1.group.${group.id}`, group.label.toUpperCase()), {},
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
              group.items.map((a) => adviceCard(a)))))
        : emptyState({
            iconName: 'check',
            title: tab === 'done' ? t('d1.empty.done', 'Nothing recorded yet') : t('d1.empty.title', 'Nothing needs your attention'),
            body: tab === 'done'
              ? t('d1.empty.done.body', 'Advice you act on will be listed here.')
              : t('d1.empty.body', 'When a plot needs water, feeding or protection we will put it here.'),
            action: tab !== 'all' ? { label: t('d1.showall', 'See all advice'), onclick: () => { state.ui.adviceTab = 'all'; commit('advice'); } } : null,
          })),
  };
}

/** WF5.077 / WF5.078 — the card contract. */
export function adviceCard(a, opts = {}) {
  markAdviceSeen(a.id);
  const status = severityToStatus(a.severity);
  const farm = farmById(a.farmId);
  const superseded = a.status === 'superseded';

  return card({ accent: status }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      statusChip(status, { label: statusLabel(status).toUpperCase() }),
      h('span', { style: { color: 'var(--ink-500)' } }, '·'),
      h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--ink-600)', fontWeight: 600 } },
        icon(ADVICE_ICON[a.type] ?? 'advice', 17),
        t(`advice.type.${a.type}`, a.type[0].toUpperCase() + a.type.slice(1)))),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      `${a.plotNames.join(', ')}${a.cropName ? ` ${a.cropName}` : ''} · ${farm.name}`),

    // 1. what to do
    h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, a.action),
    // 2. how much
    when(a.amount, () => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 650 } }, a.amount)),
    // 3. why — mandatory
    h('div', { style: { color: 'var(--ink-600)' } },
      h('b', t('advice.because', 'Because: ')), a.reason),

    // WF5.058 — a personalised recommendation says what it learned from.
    when(a.personalised && a.learnedFrom, () => h('div', {
      style: { fontSize: 'var(--t-meta)', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', gap: '5px' },
    }, icon('chart', 15), a.learnedFrom)),

    // WF5.081 — superseded advice is marked and links to its replacement.
    when(superseded, () => h('button.locked', {
      onclick: () => { const next = adviceById(a.supersededBy); if (next) go(`${detailRouteFor(next)}:${next.id}`); },
      style: { alignSelf: 'flex-start' },
    }, icon('refresh', 15), t('advice.superseded', 'Superseded — see the newer advice'))),

    when(a.status === 'done', () => h('div.status.status--good', { style: { alignSelf: 'flex-start' } },
      icon('check', 15), t('advice.recorded.done', 'Recorded'))),

    // WF5.078 — two actions inline, without opening the detail screen.
    when(a.status === 'open' && !opts.hideActions && can('advice.acknowledge', farm), () => h('div', {
      style: { display: 'flex', gap: '8px', marginTop: '2px' },
    },
    can('task.create', farm) ? btn(t('e3.title', 'Create task'), {
      variant: 'secondary', size: 'sm', block: false,
      onclick: () => go(`E3:advice=${a.id}`),
    }) : null,
    // WF2.010 — the inbox has many cards; none of them may claim the screen's
    // single primary action, so the emphasised card action is its own variant.
    btn(t('d7.idid', 'I did it'), {
      variant: 'emphasis', size: 'sm', block: false,
      onclick: () => go(`D7:${a.id}`),
    }),
    h('span', { style: { flex: 1 } }),
    h('button.iconbtn', { onclick: () => go(`${detailRouteFor(a)}:${a.id}`), 'aria-label': t('action.open', 'Open') },
      icon('forward', 22, 'flip')))),

    when(a.status !== 'open' || opts.hideActions, () => h('button.textlink', {
      onclick: () => go(`${detailRouteFor(a)}:${a.id}`),
      style: { alignSelf: 'flex-end' },
    }, `${t('action.open', 'Open')} →`))));
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
      // WF5.087 / WF6.022 — present on every advisory detail screen, not dismissible.
      disclaimer(t('advice.disclaimer', 'This is advice, not a prescription. Check conditions on the ground.')),
      h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
        t('advice.rule', 'Rule version {v}', { v: a.ruleVersion }), req('WF6.015'))),
    // WF5.078 — the same two actions.
    dock: a.status === 'open' ? actionDockPair(
      can('task.create', farm) ? btn(t('e3.title', 'Create task'), { variant: 'secondary', onclick: () => go(`E3:advice=${a.id}`) }) : null,
      btn(t('d7.idid', 'I did it'), { variant: 'primary', onclick: () => go(`D7:${a.id}`) }),
    ) : null,
  };
}

function whyBlock(a) {
  // WF5.085 / WF6.016 — every input used, with its value.
  return section(t('advice.why', 'Why'), {},
    card({}, cardPad(
      h('ul', { style: { margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '5px' } },
        (a.detail.why ?? []).map((w) => h('li', h('span', { style: { color: 'var(--ink-600)' } }, `${w.label}: `), h('b', w.value)))),
      req('WF5.085'))));
}

function assumptionsBlock(a) {
  if (!a.detail.assumptions) return null;
  // WF5.086 / WF6.017 — editable, and the edit is recorded against the PLOT.
  return section(t('advice.assumptions', 'Assumptions we used'), {
    action: { label: t('action.edit', 'Edit'), onclick: () => openSheet('ASSUMPTIONS', { adviceId: a.id }) },
  }, card({}, cardPad(
    h('div', a.detail.assumptions),
    h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
      t('advice.assumptions.note', 'Correcting these recalculates future advice and is saved against the plot, not just this recommendation.')))));
}

/* -- D2 · Irrigation advice, WF5.083 … WF5.087 ----------------------------- */

export function D2(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;

  return adviceDetail(a, [
    card({}, cardPad(
      h('div.bignum', a.detail.headline),
      when(a.detail.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 600, color: 'var(--ink-600)' } }, a.detail.headlineSub)),
      divider(),
      // WF5.083 — depth, volume and (tree farms) litres per tree, all at once.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))),
      req('WF5.083'),
      // WF5.084 — pumping time where there is a flow rate, a prompt where not.
      when(plot && !plot.flowRateM3h, () => h('button.row', {
        onclick: () => toast(t('b4.addflow.done', 'We will ask for this when you next log irrigation')),
        style: { padding: '8px 0', borderBottom: 0 },
      }, icon('info', 18),
         h('div.row__main', h('div.row__title', t('d2.noflow', 'Add your system flow rate')),
           h('div.row__sub', t('d2.noflow.sub', 'Then we can tell you how long to run the pump.'))),
         h('span.row__chev', icon('forward', 18, 'flip')))))),

    when((a.detail.split ?? []).length > 0, () => section(t('d2.split', 'Suggested split'), {},
      card({}, a.detail.split.map((s) => row({ title: s.when, value: `${s.depth} · ${s.volume}`, chevron: false }))))),

    whyBlock(a),
    assumptionsBlock(a),
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
      // WF5.089 — elemental N, P, K, Ca, Mg per hectare. Never lead with a product.
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))),
      h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('d3.elemental', 'Given as elemental nutrient per hectare. Product equivalents appear once you record which fertilisers you hold.'),
        req('WF5.089')))),

    when((a.detail.split ?? []).length > 0, () => section(t('d3.windows', 'Application windows'), {},
      card({}, a.detail.split.map((s) => row({ title: s.when, value: `${s.depth ?? ''} ${s.volume ?? ''}`.trim(), chevron: false }))))),

    whyBlock(a),
    assumptionsBlock(a),

    // WF5.090 — say so explicitly rather than implying a fertigation schedule.
    disclaimer(t('d3.nofertigation', 'This is a fertiliser recommendation, not a fertigation schedule. A combined fertigation plan is not part of any plan we sell.'), false),
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
      req('WF5.093')))),

    // WF5.092 / WF6.008 — products only where the register holds a verified
    // registration for THIS country.
    when((d.products ?? []).length > 0, () => section(t('d4.products', 'Registered products in your country'), {},
      card({}, d.products.map((p) => row({
        title: p.name, sub: `${t('d4.regno', 'Registration')} ${p.registration} · ${p.registrant}`, chevron: false,
      })),
      h('div', { style: { padding: '10px 16px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
        t('d4.registernote', 'Only products registered where your farm is are shown. Where an entry has not been verified in the last 12 months we show the active ingredient alone.'),
        req('WF6.008'))))),

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

    whyBlock(a),

    // WF5.094 / WF6.023 — permanent, non-dismissible.
    disclaimer(t('d4.label', 'Check the product label and your local regulations before applying. This is advice, not a prescription.'), true),
  ]);
}

/* -- D5 · Harvest advice -------------------------------------------------- */

export function D5(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  return adviceDetail(a, [
    card({}, cardPad(
      h('div.bignum', a.detail.headline),
      when(a.detail.headlineSub, () => h('div', { style: { fontSize: 'var(--t-title)', color: 'var(--ink-600)', fontWeight: 600 } }, a.detail.headlineSub)),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        (a.detail.units ?? []).map((u) => h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 600 } }, u))))),
    when((a.detail.split ?? []).length > 0, () => section(t('d5.plan', 'Suggested pick plan'), {},
      card({}, a.detail.split.map((s) => row({ title: s.when, value: `${s.depth ?? ''} ${s.volume ?? ''}`.trim(), chevron: false }))))),
    whyBlock(a),
    btn(t('d5.openharvest', 'Open harvest planning'), {
      variant: 'secondary', onclick: () => go(`B13:${a.farmId}`),
    }),
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

/* -- D7 · Record what you did, WF5.099 … WF5.102 -------------------------- */

const NOT_DONE_REASONS = [
  { id: 'nowater', label: 'No water available' },
  { id: 'pump', label: 'Pump failure' },
  { id: 'weather', label: 'Weather' },
  { id: 'notneeded', label: 'Not needed' },
  { id: 'other', label: 'Other' },
];

export function D7(adviceId) {
  const a = adviceById(adviceId);
  if (!a) return notFound();
  const d = local(`d7-${adviceId}`, { choice: null, amount: '', unit: 'm3', reason: null, note: '' });
  const plot = a.plotIds[0] ? plotById(a.plotIds[0]) : null;
  const isTree = plot?.treeCount > 0;

  const submit = (kind) => {
    recordAction(a, {
      kind,
      amount: d.amount || null,
      unit: d.unit,
      reason: d.reason,
      note: d.note || null,
    });
    back();
  };

  return {
    top: appBar({ title: t('d7.title', 'What did you do?') }),
    body: page(
      h('div', { style: { color: 'var(--ink-600)' } },
        `${t(`advice.type.${a.type}`, a.type)} · ${a.plotNames.join(', ')} · ${t('d7.advised', 'advised {x}', { x: a.detail.headline })}`),

      // WF5.099 — three big choices, one tap each.
      btn(t('d7.full', 'I applied the full amount'), {
        variant: d.choice === 'full' ? 'primary' : 'secondary', size: 'huge', icon: 'check',
        onclick: () => { d.choice = 'full'; commit('d7'); },
      }),
      btn(t('d7.different', 'I applied a different amount'), {
        variant: d.choice === 'different' ? 'primary' : 'secondary', size: 'huge', icon: 'edit',
        onclick: () => { d.choice = 'different'; commit('d7'); },
      }),
      btn(t('d7.notdone', 'I did not do this'), {
        variant: d.choice === 'notdone' ? 'primary' : 'secondary', size: 'huge', icon: 'close',
        onclick: () => { d.choice = 'notdone'; commit('d7'); },
      }),

      when(d.choice === 'different', () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        field(t('d7.howmuch', 'How much did you apply?'),
          h('div.inputgroup.inputgroup--suffix',
            input({ type: 'number', inputmode: 'decimal', value: d.amount, oninput: (e) => { d.amount = e.target.value; } }),
            select([
              { value: 'mm', label: t('unit.mm', 'mm') },
              { value: 'm3', label: t('unit.m3', 'm³') },
              ...(isTree ? [{ value: 'lpt', label: t('unit.lpertree', 'litres per tree') }] : []),
            ], d.unit, (v) => { d.unit = v; commit('d7'); }))),
        field(t('d7.note', 'Note (optional)'), input({ value: d.note, oninput: (e) => { d.note = e.target.value; } })))),

      when(d.choice === 'notdone', () => field(t('d7.why', 'Why not?'),
        radioList(NOT_DONE_REASONS.map((r) => ({ id: r.id, label: t(`d7.reason.${r.id}`, r.label) })),
          d.reason, (id) => { d.reason = id; commit('d7'); }))),

      // WF5.102 — this screen works offline.
      when(state.session.connectivity === 'offline', () => disclaimer(
        t('d7.offline', 'You are offline. We will save this on your phone and send it when you have signal.')))),

    dock: d.choice ? actionDock(btn(t('action.confirm', 'Confirm'), {
      variant: 'primary',
      disabled: d.choice === 'notdone' && !d.reason,
      onclick: () => submit(d.choice === 'full' ? 'full' : d.choice === 'different' ? 'different' : 'not-done'),
    })) : null,
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
