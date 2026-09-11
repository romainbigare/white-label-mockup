
export const MEASURE_SCALE = {
  ndvi: { min: 0.05, max: 0.90, ramp: 'veg' },
  ndwi: { min: 0.00, max: 0.60, ramp: 'water' },
  ndre: { min: 0.05, max: 0.60, ramp: 'veg' },
  evi: { min: 0.05, max: 0.80, ramp: 'veg' },
};

export const HEALTH_MEASURES = ['ndvi', 'ndwi', 'ndre'];

export function scoreFromValue(measure, value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const scale = MEASURE_SCALE[measure] ?? MEASURE_SCALE.ndvi;
  return Math.max(0, Math.min(100, Math.round(((Number(value) - scale.min) / (scale.max - scale.min)) * 100)));
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
