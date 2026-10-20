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

/* THE NUMBER A FARMER IS SHOWN, which is not always the position.

   A reading's `score` is its place on the metric's fixed scale — what the
   map, the legend and the gauge draw. On a two-way metric that IS how good it
   is. On a three-way one it is not: "water stress 90%" meant over-watered, and
   a reader who has learned that 90 is good everywhere else read it as fine.
   v1.7.2's review: "it's still 100% based, but 100% for water stress is
   over-watered".

   So on soil moisture and water stress the number shown is how close the
   reading is to right: 100 at the middle of the good band, falling the same
   way on both sides. The edges of the good band land on 80, which is where
   "good" starts on every other number in the app, so a green word never sits
   beside a number the app calls "monitor". Which SIDE it has fallen to is the
   band's word and colour — "Under-watered", "Waterlogged" — never the number. */
const IDEAL = 55;                     // the middle of the rgb good band
const PER_POINT = 20 / 15;            // 15 points off the middle → 80

export function metricScore(measure, score) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  if (rampKind(measure) !== 'rgb') return score;
  return Math.max(0, Math.round(100 - Math.abs(score - IDEAL) * PER_POINT));
}

/* WATER STRESS IS SIGNED — v1.7.2's third pass: "for water stress can we have
   a score of -100 to +100%". 0 is right; minus is under-watered, down to
   −100 at the dry end of the scale; plus is over-watered, up to +100 at the
   wet end. The sign carries the side, so the number and the legend can no
   longer disagree. (The plot's overall health still reads it as how close
   to right, through metricScore.) */
const SIGNED = new Set(['ndwi']);

export function isSigned(measure) {
  return SIGNED.has(measure);
}

/** The number printed for a reading: signed on water stress, metricScore elsewhere. */
export function shownScore(measure, score) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  if (!SIGNED.has(measure)) return metricScore(measure, score);
  const off = score - IDEAL;
  return Math.round(off < 0 ? (off / IDEAL) * 100 : (off / (100 - IDEAL)) * 100);
}

export function overallHealthScore(plot) {
  const scores = HEALTH_MEASURES.map((key) => metricScore(key, measureScore({ key, ...(plot?.measures?.[key] ?? {}) })))
    .filter((score) => score != null);
  return scores.length ? Math.min(...scores) : null;
}

export function healthStatus(score) {
  return statusFromScore(score);
}

/* IRRIGATION EFFICIENCY IS THE FARM'S, since v1.7.3 — "it belongs to the
   farm, not the plot". It is not a satellite metric, so it has no place on
   the metric scale above, but it is read the same way: five bands, red to
   green, in the colours and inks of a two-way metric. The cuts are its own,
   because an efficiency of 60% is poor where a plant health of 60 is good. */
const EFFICIENCY_CUTS = [55, 65, 75, 85];

export function efficiencyBand(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const index = EFFICIENCY_CUTS.filter((cut) => pct >= cut).length;
  const tone = TONES.rg[index];
  return { index, kind: 'rg', colour: RAMPS.rg[index], ink: INKS.rg[index], tone, status: TONE_STATUS[tone] };
}
