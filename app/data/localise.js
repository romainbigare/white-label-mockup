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
import { TREE_PROBLEMS } from '../core/trees.js';

/* A field is named after the farm it belongs to — "Al Kharj North Field 1" —
   so that a field name means something in a list that spans four holdings,
   and so that nobody has to remember which farm field 4 was on. The farm half
   is looked up here rather than stored on the field: renaming a farm has to
   rename its fields, and a copy of the name on 32 records is a copy that goes
   stale.

   The crop is deliberately NOT part of it. A seasonal field grows tomatoes
   this month and onions the next, and a name that has to be rewritten every
   season is not a name. */
function farmNameOf(farmId) {
  const farm = state.db.farms.find((f) => f.id === farmId);
  return farm ? tc(`farm.${farm.id}.name`, farm.name) : '';
}

/* ONE WORD, "FIELD", AND EVERY FIELD IS NUMBERED, TREES INCLUDED (Oct 2026,
   Wafra's final answer to MMC: "plot" is gone from everything the farmer
   reads). A field is "Field 1, 2, 3…" in its number order, crops and trees
   alike, until the farmer renames it — and a name he gave it is the farm's,
   kept by field id in `farm.fieldNames`, the way the server keeps it
   (farms/{id}.fieldNames). A rename is not a new drawing, so it never moves
   the boundary's version.

   A numbered field is translated as a number, with the one key every "Field
   {n}" in the app uses; a name the farmer typed is printed as he typed it. */
export function fieldNameOf(plot) {
  const farm = state.db.farms.find((f) => f.id === plot.farmId);
  return farm?.fieldNames?.[plot.id] ?? t('a9d.counter', 'Field {n}', { n: num(plot.number) });
}

/* WHAT IS UNDER THE NAME: the crop, or for a tree field its species — every
   species in it, "Olive, Orange", and only ever the species. A tree field
   lists `species` (ids), counted by MMC; it is never "Citrus". */
function speciesOf(plot) {
  return (plot.species ?? [])
    .map((id) => state.db.crops.find((c) => c.id === id)?.name ?? id)
    .map((name) => tc(`crop.${name}`, name))
    .join(', ');
}

export function lAdvice(a) {
  if (!a) return a;
  const d = a.detail ?? {};
  return {
    ...a,
    /* The record carries `fieldNames` as the server wrote it, from MMC's
       advice; the farmer reads each field's name as it is NOW, so a field he
       renamed after the advice came in is not called by its old name. Short
       names, because the farm is named beside them on the card. */
    fieldNames: (a.fieldIds ?? []).map((id, i) => {
      const plot = state.db.plots.find((p) => p.id === id);
      return plot ? fieldNameOf(plot) : (a.fieldNames?.[i] ?? id);
    }),
    /* THE CROP IS THE FIELDS', NEVER THE ADVICE'S OWN — v1.7.2. It was a copy
       written into each record, and copies drift: the wheat on Al Kharj South
       Field 1 was advised as another crop, so a farmer arriving from his wheat
       read about something else. Read off the fields, once per crop. */
    cropName: [...new Set((a.fieldIds ?? [])
      .map((id) => state.db.plots.find((p) => p.id === id))
      .filter(Boolean)
      .map((plot) => (plot.kind === 'trees' ? speciesOf(plot) : tc(`crop.${plot.cropName}`, plot.cropName))))].join(', ') || null,
    action: tc(`adv.${a.id}.action`, a.action),
    amount: tc(`adv.${a.id}.amount`, a.amount),
    reason: tc(`adv.${a.id}.reason`, a.reason),
    learnedFrom: tc(`adv.${a.id}.learned`, a.learnedFrom),
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
    soil: tc(`soil.${farm.soil}`, farm.soil),
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
  const shortName = fieldNameOf(plot);
  const farmName = farmNameOf(plot.farmId);
  return {
    ...plot,
    shortName,
    name: farmName ? `${farmName} ${shortName}` : shortName,
    farmName,
    // A tree field's species once it is counted; before that, what it was
    // drawn as.
    cropName: (plot.kind === 'trees' && speciesOf(plot)) || tc(`crop.${plot.cropName}`, plot.cropName),
    secondaryCropName: tc(`crop.${plot.secondaryCropName}`, plot.secondaryCropName),
    statusLine: tc(`plot.${plot.id}.status`, plot.statusLine),
    interpretation: tc(`plot.${plot.id}.interp`, plot.interpretation),
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
    ...(plot ? { plot: fieldNameOf(plot) } : {}),
    ...(vars.crop ? { crop: tc(`crop.${vars.crop}`, vars.crop) } : {}),
    ...(TREE_PROBLEMS[vars.problem] ? { problem: t(`tree.problem.${vars.problem}`, TREE_PROBLEMS[vars.problem]) } : {}),
    ...(vars.n !== undefined ? { n: num(vars.n) } : {}),
  });
}

/* Tree notes repeat across thousands of trees, so they are keyed by their text
   rather than by tree id — one translation covers every tree that says it. */
function slug(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
}
