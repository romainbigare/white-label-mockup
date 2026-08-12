/* ---------------------------------------------------------------------------
   localise.js — WF10.012 / WF10.013.

   The fixtures are authored in English. Everything a user reads must arrive in
   THEIR language, whoever wrote it, so the content fields go through the same
   string catalogue as the interface, keyed by record id. A missing translation
   falls back to English and is counted, exactly as for UI copy (WF10.014).

   Applied at render time rather than at load time: the language can change
   mid-session (WF10.007) and the write layer keeps working on the raw records.
   --------------------------------------------------------------------------- */

import { tc, tcList } from '../core/i18n.js';
import { state } from '../core/store.js';

/* A plot is named after the farm it belongs to — "Al Kharj North P1" — so that
   a plot name means something in a list that spans four holdings, and so that
   nobody has to remember which farm P-04 was on. The farm half is looked up
   here rather than stored on the plot: renaming a farm has to rename its plots,
   and a copy of the name on 32 plot records is a copy that goes stale.

   The crop is deliberately NOT part of it. A seasonal plot grows tomatoes this
   month and onions the next, and a name that has to be rewritten every season
   is not a name. */
function farmNameOf(farmId) {
  const farm = state.db.farms.find((f) => f.id === farmId);
  return farm ? tc(`farm.${farm.id}.name`, farm.name) : '';
}

export function lAdvice(a) {
  if (!a) return a;
  const d = a.detail ?? {};
  return {
    ...a,
    // Derived, never stored: a plot's name is its farm's name plus a number, so
    // a copy written into the advice record would be wrong the moment a farm is
    // renamed. Short names, because the farm is named beside them on the card.
    plotNames: (a.plotIds ?? []).map((id) => {
      const plot = state.db.plots.find((p) => p.id === id);
      return plot ? tc(`plot.${plot.id}.name`, plot.name) : id;
    }),
    action: tc(`adv.${a.id}.action`, a.action),
    amount: tc(`adv.${a.id}.amount`, a.amount),
    reason: tc(`adv.${a.id}.reason`, a.reason),
    learnedFrom: tc(`adv.${a.id}.learned`, a.learnedFrom),
    cropName: tc(`crop.${a.cropName}`, a.cropName),
    detail: {
      ...d,
      headline: tc(`adv.${a.id}.headline`, d.headline),
      headlineSub: tc(`adv.${a.id}.headsub`, d.headlineSub),
      units: tcList(`adv.${a.id}.units`, d.units),
      assumptions: tc(`adv.${a.id}.assumptions`, d.assumptions),
      activeIngredient: tc(`adv.${a.id}.ai`, d.activeIngredient),
      rate: tc(`adv.${a.id}.rate`, d.rate),
      identification: tc(`adv.${a.id}.ident`, d.identification),
      symptoms: tcList(`adv.${a.id}.symptom`, d.symptoms),
      earliestSafeHarvest: tc(`adv.${a.id}.safeharvest`, d.earliestSafeHarvest),
      split: (d.split ?? []).map((s, i) => ({
        ...s, when: tc(`adv.${a.id}.split.${i}`, s.when),
      })),
      why: (d.why ?? []).map((w, i) => ({
        label: tc(`adv.${a.id}.why.${i}.l`, w.label),
        value: tc(`adv.${a.id}.why.${i}.v`, w.value),
      })),
    },
  };
}

/* A worker's name goes through the catalogue keyed by record id, exactly as a
   farm's does — it is authored content, not interface copy. */
export function lWorker(w) {
  if (!w) return w;
  return { ...w, name: tc(`worker.${w.id}.name`, w.name) };
}

export function lTask(task) {
  if (!task) return task;
  return {
    ...task,
    title: tc(`task.${task.id}.title`, task.title),
    description: tc(`task.${task.id}.desc`, task.description),
    quantity: tc(`task.${task.id}.qty`, task.quantity),
    blockedReason: tc(`task.${task.id}.blocked`, task.blockedReason),
    completedNote: tc(`task.${task.id}.note`, task.completedNote),
  };
}

export function lFarm(farm) {
  if (!farm) return farm;
  return {
    ...farm,
    name: tc(`farm.${farm.id}.name`, farm.name),
    region: tc(`farm.${farm.id}.region`, farm.region),
    headline: tc(`farm.${farm.id}.headline`, farm.headline),
    imageryBlockedReason: tc(`farm.${farm.id}.blocked`, farm.imageryBlockedReason),
    weather: {
      ...farm.weather,
      condition: tc(`weather.${farm.weather.condition}`, farm.weather.condition),
      forecast: farm.weather.forecast.map((f) => ({
        ...f, day: tc(`weekday.${f.day}`, f.day), condition: tc(`weather.${f.condition}`, f.condition),
      })),
      alert: farm.weather.alert ? {
        ...farm.weather.alert,
        title: tc(`farm.${farm.id}.alert.title`, farm.weather.alert.title),
        detail: tc(`farm.${farm.id}.alert.detail`, farm.weather.alert.detail),
      } : null,
    },
  };
}

export function lPlot(plot) {
  if (!plot) return plot;
  // `shortName` is what a screen already inside one farm shows; `name` is the
  // whole thing, for every list that crosses farms.
  const shortName = tc(`plot.${plot.id}.name`, plot.name);
  const farmName = farmNameOf(plot.farmId);
  return {
    ...plot,
    shortName,
    name: farmName ? `${farmName} ${shortName}` : shortName,
    farmName,
    cropName: tc(`crop.${plot.cropName}`, plot.cropName),
    secondaryCropName: tc(`crop.${plot.secondaryCropName}`, plot.secondaryCropName),
    statusLine: tc(`plot.${plot.id}.status`, plot.statusLine),
    interpretation: tc(`plot.${plot.id}.interp`, plot.interpretation),
    soil: tc(`soil.${plot.soil}`, plot.soil),
  };
}

export function lTree(tree) {
  if (!tree) return tree;
  return {
    ...tree,
    species: tc(`crop.${tree.species}`, tree.species),
    note: tc(`tree.note.${slug(tree.note)}`, tree.note),
  };
}

export function lObservation(o) {
  return o ? { ...o, note: tc(`obs.${o.id}.note`, o.note) } : o;
}

export function lLog(entry) {
  return entry ? { ...entry, text: tc(`log.${entry.id}.text`, entry.text) } : entry;
}

/* Tree notes repeat across thousands of trees, so they are keyed by their text
   rather than by tree id — one translation covers every tree that says it. */
function slug(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
}
