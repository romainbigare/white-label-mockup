/* ---------------------------------------------------------------------------
   health.js — the five metrics, what their numbers mean, and their colours.

   ONE PLACE DECIDES WHAT A READING MEANS. Every map, legend, score card and
   trend in the app reads a metric through this file, so "is 64 good?" has one
   answer and the colour a plot is painted on C1 is the colour its number is
   printed in on B2.

   TWO KINDS OF METRIC, since v1.7.2. "Red for bad, green for good. If there is
   more than good / bad — under watered, good, over watered — then use red,
   green, blue." So:

     'rg'   more is better: plant health, growth and vigour, nutrition status.
            Five bands, red to green.
     'rgb'  the middle is right: soil moisture and water stress. Too little is
            red, about right is green, too much is blue.

   The score is still the place of the reading on the metric's fixed scale,
   0 to 100 (WF5.025: fixed, never per-image), so two plots and two dates can
   be compared. What changed is how a score is READ: on a two-way metric 90 is
   strong, on a three-way one 90 is waterlogged. `bandOf()` is that reading.
   --------------------------------------------------------------------------- */

export const MEASURE_SCALE = {
  ndvi: { min: 0.05, max: 0.90, ramp: 'rg' },
  ndwi: { min: 0.00, max: 0.60, ramp: 'rgb' },
  ndre: { min: 0.05, max: 0.60, ramp: 'rg' },
  evi: { min: 0.05, max: 0.80, ramp: 'rg' },
  // 604 — volumetric water in the root zone, as a fraction. 0.05 is dust and
  // 0.45 is field capacity on the heavier ground this app sells into.
  moisture: { min: 0.05, max: 0.45, ramp: 'rgb' },
};

/* THE ORDER THE FARMER READS THEM IN, everywhere a list of metrics is drawn:
   the picker, the score card, the trend chips. Review v1.7.2 set it. */
export const METRIC_ORDER = ['ndvi', 'moisture', 'evi', 'ndre', 'ndwi'];

/* Five colours per kind, low score to high, one per band. Saturated enough to
   read on a satellite photograph and on white paper. */
export const RAMPS = {
  rg: ['#c62828', '#ef6c00', '#f2b705', '#7cb342', '#2e7d32'],
  rgb: ['#c62828', '#ef8a3a', '#2e9d4a', '#4a9fe0', '#1652b0'],
};

/* The same five, dark enough to print text in on white (WCAG AA): a number
   in its band's colour has to be readable, and the fills above are chosen to
   be seen on a photograph, not read on paper. */
const INKS = {
  rg: ['#b3261e', '#b04a00', '#7d5d00', '#3f6e14', '#1b5e20'],
  rgb: ['#b3261e', '#a34800', '#1b6e33', '#1a62a3', '#123f8c'],
};

/* Where each band starts, on the 0–100 score. A two-way metric is cut evenly.
   A three-way one has a wide middle, because "about right" is a range and
   not a point, and the fixtures' healthy alfalfa should not read as flooded. */
const CUTS = {
  rg: [20, 40, 60, 80],
  rgb: [20, 40, 70, 85],
};

/* What each band means for the farmer: 'bad', 'fair' or 'good' on a two-way
   metric, with 'over' for the blue end of a three-way one. The status words of
   the rest of the app (good / monitor / urgent) are derived from this, so a
   waterlogged plot is not called "Good" because its number is high. */
const TONES = {
  rg: ['bad', 'bad', 'fair', 'good', 'good'],
  rgb: ['bad', 'fair', 'good', 'over', 'over'],
};

const TONE_STATUS = { bad: 'urgent', fair: 'monitor', good: 'good', over: 'monitor' };

export const HEALTH_MEASURES = ['ndvi', 'ndwi', 'ndre'];

export function rampKind(measure) {
  return (MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi).ramp;
}

export function scoreFromValue(measure, value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  return Math.max(0, Math.min(100, Math.round(((Number(value) - scale.min) / (scale.max - scale.min)) * 100)));
}

/**
 * How a score on this metric reads: which of its five bands, the colour of
 * that band (and its darker ink, for text), its tone and the app's status
 * word for it. `null` score → null.
 */
export function bandOf(measure, score) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const kind = measure === 'overall' ? 'rg' : rampKind(measure);
  const index = CUTS[kind].filter((cut) => score >= cut).length;
  const tone = TONES[kind][index];
  return { index, kind, colour: RAMPS[kind][index], ink: INKS[kind][index], tone, status: TONE_STATUS[tone] };
}

export function statusFromScore(score) {
  if (score == null || !Number.isFinite(Number(score))) return 'nodata';
  if (score >= 80) return 'good';
  if (score >= 60) return 'monitor';
  return 'urgent';
}

export function measureScore(measure) {
  if (!measure) return null;
  return measure.score ?? scoreFromValue(measure.key, measure.value);
}

export function overallHealthScore(plot) {
  const scores = HEALTH_MEASURES.map((key) => measureScore({ key, ...(plot?.measures?.[key] ?? {}) }))
    .filter((score) => score != null);
  return scores.length ? Math.min(...scores) : null;
}

export function healthStatus(score) {
  return statusFromScore(score);
}
