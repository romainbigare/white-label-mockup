/* ---------------------------------------------------------------------------
   field.js — E6 Field observation, E7 Photo disease check.

   WHAT THIS FILE IS, AND WHY IT IS NOT CALLED tasks.js ANY MORE.

   Task management has gone: the list, the detail screen, the new-task form and
   the complete-task form went with it, because an advice sent to the supervisor
   IS the job and needed no second object beside it.

   These two did not go, and they were never tasks. They are field CAPTURE — a
   person standing in a plot with a phone, recording something the satellite
   cannot see. E6 is what he noticed; E7 is a photograph of a leaf and a guess
   at what is wrong with it. Both are reached from the plot, both work with no
   signal, and neither has anything to do with who was told to do what.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local, resetLocal } from '../core/local.js';
import { t } from '../core/i18n.js';
import { go, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, page, card, cardPad, btn, actionDock,
  disclaimer, req, chips, select, field, textarea, lockBox,
} from '../ui/components.js';
import { plotById, visibleFarms } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { addObservation } from '../data/actions.js';

const OBS_CATEGORIES = [
  { id: 'pest', label: 'Pest', icon: 'warning' },
  { id: 'disease', label: 'Disease', icon: 'shield' },
  { id: 'weed', label: 'Weed', icon: 'leaf' },
  { id: 'water', label: 'Water', icon: 'droplet' },
  { id: 'damage', label: 'Damage', icon: 'wind' },
  { id: 'other', label: 'Other', icon: 'flag' },
];

export function E6(param = '') {
  const [, plotIdRaw] = String(param).split('=');
  const farms = visibleFarms();
  const d = local(`e6-${param}`, {
    farmId: farms[0]?.id, plotId: plotIdRaw || state.db.plots.find((p) => p.farmId === farms[0]?.id)?.id,
    category: 'pest', severity: 'medium', note: '', photos: 0,
  });
  const plots = state.db.plots.filter((p) => p.farmId === d.farmId);

  return {
    tabs: false,
    top: appBar({ title: t('e6.title', 'Field observation') }),
    body: page(
      h('button', {
        onclick: () => { d.photos += 1; commit('e6'); },
        style: {
          width: '100%', minHeight: '132px', borderRadius: 'var(--radius)',
          border: '2px dashed var(--ink-300)', background: 'var(--ink-050)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '6px', color: 'var(--ink-600)', cursor: 'pointer', font: 'inherit',
        },
      }, icon('camera', 30), h('span', { style: { fontWeight: 650 } }, t('e6.photo', 'Add photos'))),
      when(d.photos > 0, () => h('div', { style: { display: 'flex', gap: '8px' } },
        Array.from({ length: d.photos }, (_, i) => h('div', {
          style: {
            width: '72px', height: '72px', borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(${100 + i * 50}deg, var(--st-good-bg), var(--brand-300))`,
          },
        })))),

      field(t('e6.category', 'What did you see?'),
        chips(OBS_CATEGORIES.map((c) => ({ id: c.id, label: t(`e6.cat.${c.id}`, c.label), icon: c.icon })),
          d.category, (id) => { d.category = id; commit('e6'); }, { wrap: true })),

      field(t('e6.farm', 'Farm'),
        select(farms.map((f) => ({ value: f.id, label: f.name })), d.farmId,
          (v) => { d.farmId = v; d.plotId = state.db.plots.find((p) => p.farmId === v)?.id; commit('e6'); })),
      field(t('e6.plot', 'Plot'),
        select(plots.map((p) => ({ value: p.id, label: `${p.name} · ${p.cropName}` })), d.plotId,
          (v) => { d.plotId = v; commit('e6'); })),
      field(t('e6.severity', 'How bad is it?'),
        chips([
          { id: 'low', label: t('e6.sev.low', 'Slight') },
          { id: 'medium', label: t('e6.sev.medium', 'Moderate') },
          { id: 'high', label: t('e6.sev.high', 'Severe') },
        ], d.severity, (id) => { d.severity = id; commit('e6'); })),
      field(t('e6.note', 'Note'), textarea({ value: d.note, oninput: (e) => { d.note = e.target.value; } })),

      h('div.status.status--nodata', icon('pin', 15),
        t('e6.location', 'Your position is recorded with this observation')),

      // WF5.124 / WF5.125 — photo disease detection needs a connection; it is
      // queued with a clear state rather than failing.
      when(d.photos > 0 && d.category === 'disease', () => (has('disease.photo')
        ? btn(t('e7.check', 'Check this photo for a disease'), {
            variant: 'secondary', icon: 'scan', onclick: () => go(`E7:${d.plotId}`),
          })
        : lockBox('disease.photo')))),

    dock: actionDock(btn(t('action.save', 'Save observation'), {
      variant: 'primary',
      onclick: () => { addObservation(d); resetLocal(`e6-${param}`); back(); },
    })),
  };
}

/* -- E7 · Photo disease check, WF5.124 / WF6.025 -------------------------- */

export function E7(plotId) {
  const plot = plotById(plotId);
  const d = local(`e7-${plotId}`, { stage: state.session.connectivity === 'offline' ? 'queued' : 'result', accepted: null });

  const result = { name: 'Dubas bug (Ommatissus lybicus)', confidence: 0.78, alt: 'Sooty mould (secondary)' };

  return {
    tabs: false,
    top: appBar({ title: t('e7.title', 'Photo disease check') }),
    body: page(
      h('div', {
        style: {
          width: '100%', aspectRatio: '4 / 3', borderRadius: 'var(--radius)',
          background: 'linear-gradient(150deg, var(--brand-300), var(--st-watch-bg))',
          display: 'grid', placeItems: 'center', color: 'var(--ink-700)',
        },
      }, icon('camera', 46)),

      d.stage === 'queued'
        // WF5.125 — a clear "will be checked when you have signal" state.
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div.status.status--nodata.status--lg', icon('clock', 17), t('e7.queued', 'Queued')),
            h('p', { style: { margin: 0 } }, t('e7.queued.body', 'This photo will be checked when you have signal. Your observation is already saved.')))
        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            card({ accent: 'watch' }, cardPad(
              h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, t('e7.likely', 'Most likely')),
              h('div', { style: { fontSize: 'var(--t-title)', fontWeight: 700 } }, result.name),
              // WF6.025 — never presented as certain; the confidence is shown and
              // the user may reject it.
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h('span', { style: { flex: 1, height: '10px', borderRadius: '5px', background: 'var(--ink-100)', overflow: 'hidden' } },
                  h('span', { style: { display: 'block', height: '100%', width: `${result.confidence * 100}%`, background: 'var(--st-watch)' } })),
                h('span', { style: { fontWeight: 700 } }, `${Math.round(result.confidence * 100)}%`)),
              h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
                t('e7.alt', 'Also possible: {alt}', { alt: result.alt })),
              req('WF6.025'))),
            disclaimer(t('e7.notcertain', 'This is an automated suggestion, not a diagnosis. Always confirm on the ground before acting.')),
            h('div', { style: { display: 'flex', gap: '8px' } },
              btn(t('e7.accept', 'That looks right'), {
                variant: d.accepted === true ? 'primary' : 'secondary', block: false,
                onclick: () => { d.accepted = true; commit('e7'); },
              }),
              btn(t('e7.reject', 'That is not it'), {
                variant: d.accepted === false ? 'primary' : 'secondary', block: false,
                onclick: () => { d.accepted = false; commit('e7'); },
              })))),
    dock: actionDock(btn(t('action.done', 'Done'), { variant: 'primary', onclick: back })),
  };
}
