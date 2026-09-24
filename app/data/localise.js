/* ---------------------------------------------------------------------------
   localise.js — WF10.012 / WF10.013.

   The fixtures are authored in English. Everything a user reads must arrive in
   THEIR language, whoever wrote it, so the content fields go through the same
   string catalogue as the interface, keyed by record id. A missing translation
   falls back to English and is counted, exactly as for UI copy (WF10.014).

   Applied at render time rather than at load time: the language can change
   mid-session (WF10.007) and the write layer keeps working on the raw records.
   --------------------------------------------------------------------------- */

import { t, tc, tcList } from '../core/i18n.js';
import { state } from '../core/store.js';
import { num } from '../core/format.js';

/* A plot is named after the farm it belongs to — "Al Kharj North Plot 1" — so
   that a plot name means something in a list that spans four holdings, and so
   that nobody has to remember which farm plot 4 was on. The number is spelled
   "Plot 1" rather than "P1": the short form saved four characters in a list and
   cost the farmer the word that said what he was looking at. The farm half is looked up
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
      split: (d.split ?? []).map((s, i) => ({
        ...s,
        when: tc(`adv.${a.id}.split.${i}`, s.when),
        volume: tc(`adv.${a.id}.split.${i}.volume`, s.volume),
      })),
      products: (d.products ?? []).map((p, i) => ({
        ...p,
        name: productName(p.name),
        rate: tc(`adv.${a.id}.product.${i}.rate`, p.rate),
        total: tc(`adv.${a.id}.product.${i}.total`, p.total),
      })),
      why: (d.why ?? []).map((w, i) => ({
        label: tc(`adv.${a.id}.why.${i}.l`, w.label),
        value: tc(`adv.${a.id}.why.${i}.v`, w.value),
      })),
    },
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
    fertigation: plot.fertigation && {
      ...plot.fertigation, product: productName(plot.fertigation.product),
    },
  };
}

/* A fertiliser named by what it is — "Urea (46% N)", "Calcium nitrate
   15.5-0-0" — is the same product on every advice and every plot that calls
   for it, so it is keyed by its text, as tree notes are: one translation
   covers each place it is recommended. */
function productName(name) {
  return tc(`product.${slug(name)}`, name);
}

/* The disease and pest directory. The keys are the ones F15/F16 has always
   used, so a record reads the same words on the photo result as in its own
   entry; the Latin binomial is not translated anywhere. */
export function lDisease(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    name: tc(`disease.${entry.id}.name`, entry.name),
    symptoms: tc(`disease.${entry.id}.symptoms`, entry.symptoms),
    conditions: tc(`disease.${entry.id}.conditions`, entry.conditions),
    action: tc(`disease.${entry.id}.action`, entry.action),
    prevention: tc(`disease.${entry.id}.prevention`, entry.prevention),
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
  if (!entry) return entry;
  return { ...entry, text: entry.line ? logLine(entry.line) : tc(`log.${entry.id}.text`, entry.text) };
}

/* A line the app wrote into the log itself (logActivity() in actions.js). It
   keeps its key, its English and its facts, and is put into words here, so it
   reads in the language of whoever opens the log rather than whoever pressed
   the button. What it names is localised as it is on every other screen — an
   advice and a plot by id, a crop by its English name — and falls back to the
   name it had when the line was written, for a record that has since gone. A
   name somebody typed is printed as typed. */
function logLine({ key, en, vars = {} }) {
  const advice = vars.adviceId && state.db.advice.find((a) => a.id === vars.adviceId);
  const plot = vars.plotId && state.db.plots.find((p) => p.id === vars.plotId);
  return t(key, en, {
    ...vars,
    ...(advice ? { action: tc(`adv.${advice.id}.action`, advice.action) } : {}),
    ...(plot ? { plot: tc(`plot.${plot.id}.name`, plot.name) } : {}),
    ...(vars.crop ? { crop: tc(`crop.${vars.crop}`, vars.crop) } : {}),
    ...(vars.n !== undefined ? { n: num(vars.n) } : {}),
  });
}

/* Tree notes repeat across thousands of trees, so they are keyed by their text
   rather than by tree id — one translation covers every tree that says it. */
function slug(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
}
