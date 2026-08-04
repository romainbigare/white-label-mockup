/* ---------------------------------------------------------------------------
   charts.js — inline SVG only, no chart library.

   WF10.003 requires chart axis direction to mirror under RTL, so every chart here
   takes its direction from isRtl() rather than assuming left-to-right.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';
import { isRtl } from '../core/i18n.js';
import { num } from '../core/format.js';

const W = 320;

function scaler(points, height, pad) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  return {
    x: (i) => {
      const frac = points.length === 1 ? 0.5 : i / (points.length - 1);
      return pad + (isRtl() ? 1 - frac : frac) * (W - pad * 2);
    },
    y: (v) => height - pad - ((v - lo) / span) * (height - pad * 2),
    lo, hi,
  };
}

/** Trend line with an area fill — the B4 "Trend" block. */
export function trendChart(points, opts = {}) {
  const height = opts.height ?? 130;
  const pad = 16;
  if (!points.length) return h('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart' });
  const s = scaler(points, height, pad);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${s.x(i).toFixed(1)} ${s.y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${s.x(points.length - 1).toFixed(1)} ${height - pad} L${s.x(0).toFixed(1)} ${height - pad} Z`;
  const last = points[points.length - 1];

  return h('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart', preserveAspectRatio: 'none', 'aria-label': opts.label ?? 'Trend' },
    h('defs', h('linearGradient', { id: 'trendfill', x1: 0, y1: 0, x2: 0, y2: 1 },
      h('stop', { offset: 0, 'stop-color': opts.colour ?? 'var(--brand-500)', 'stop-opacity': .32 }),
      h('stop', { offset: 1, 'stop-color': opts.colour ?? 'var(--brand-500)', 'stop-opacity': 0 }))),
    [0.25, 0.5, 0.75].map((f) => h('line', {
      x1: pad, x2: W - pad, y1: pad + f * (height - pad * 2), y2: pad + f * (height - pad * 2),
      stroke: 'var(--ink-100)', 'stroke-width': 1,
    })),
    h('path', { d: area, fill: 'url(#trendfill)' }),
    h('path', { d: line, fill: 'none', stroke: opts.colour ?? 'var(--brand-600)', 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    h('circle', { cx: s.x(points.length - 1), cy: s.y(last.value), r: 4.5, fill: opts.colour ?? 'var(--brand-700)', stroke: '#fff', 'stroke-width': 2 }),
    opts.markers?.map((m) => h('line', {
      x1: s.x(m.index), x2: s.x(m.index), y1: pad, y2: height - pad,
      stroke: m.colour ?? 'var(--st-action)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3',
    })));
}

export function axisLabels(labels) {
  const items = isRtl() ? [...labels].reverse() : labels;
  return h('div.chart__axisrow', {
    style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-micro)', color: 'var(--ink-500)', padding: '0 14px' },
  }, items.map((l) => h('span', l)));
}

/** Sparkline for list rows. */
export function sparkline(points, opts = {}) {
  const width = opts.width ?? 62;
  const height = opts.height ?? 22;
  if (points.length < 2) return h('svg', { width, height });
  const values = points.map((p) => (typeof p === 'number' ? p : p.value));
  const lo = Math.min(...values); const hi = Math.max(...values);
  const span = hi - lo || 1;
  const d = values.map((v, i) => {
    const frac = i / (values.length - 1);
    const x = (isRtl() ? 1 - frac : frac) * width;
    const y = height - ((v - lo) / span) * height;
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
    h('path', { d, fill: 'none', stroke: opts.colour ?? 'var(--ink-400)', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
}

/** Grouped bars — advised vs applied (WF5.101, WF5.131). */
export function pairedBars(rows, opts = {}) {
  const height = opts.height ?? 150;
  const pad = 18;
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 1);
  const slot = (W - pad * 2) / rows.length;
  return h('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart', 'aria-label': opts.label ?? 'Comparison' },
    rows.map((r, i) => {
      const frac = i / rows.length;
      const x = pad + (isRtl() ? 1 - frac - 1 / rows.length : frac) * (W - pad * 2);
      const bw = slot * 0.34;
      const ha = ((r.a / max) * (height - pad * 2));
      const hb = ((r.b / max) * (height - pad * 2));
      return h('g', {},
        h('rect', { x: x + slot * 0.1, y: height - pad - ha, width: bw, height: Math.max(1, ha), rx: 2, fill: 'var(--ink-300)' }),
        h('rect', { x: x + slot * 0.1 + bw + 3, y: height - pad - hb, width: bw, height: Math.max(1, hb), rx: 2, fill: r.b === 0 ? 'var(--st-urgent)' : 'var(--brand-600)' }),
        h('text', { x: x + slot * 0.35, y: height - 5, 'font-size': 10, fill: 'var(--ink-500)', 'text-anchor': 'middle' }, r.label));
    }),
    h('line', { x1: pad, x2: W - pad, y1: height - pad, y2: height - pad, stroke: 'var(--ink-200)' }));
}

/** Multi-series line — compare with previous years (WF5.027). */
export function multiLine(series, opts = {}) {
  const height = opts.height ?? 160;
  const pad = 18;
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  const lo = Math.min(...all); const hi = Math.max(...all);
  const span = hi - lo || 1;
  const n = series[0]?.points.length ?? 1;
  const px = (i) => {
    const frac = i / (n - 1 || 1);
    return pad + (isRtl() ? 1 - frac : frac) * (W - pad * 2);
  };
  const py = (v) => height - pad - ((v - lo) / span) * (height - pad * 2);
  return h('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart', 'aria-label': opts.label ?? 'Years compared' },
    series.map((s, si) => h('path', {
      d: s.points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.value).toFixed(1)}`).join(' '),
      fill: 'none',
      stroke: si === 0 ? 'var(--brand-700)' : 'var(--ink-300)',
      'stroke-width': si === 0 ? 2.6 : 1.5,
      opacity: si === 0 ? 1 : 0.85,
    })));
}

/** Stacked proportion bar — the ripeness distribution of WF5.048. */
export function proportionBar(segments, opts = {}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return h('div', { style: { display: 'flex', height: opts.height ?? '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--ink-100)' } },
    segments.map((s) => h('span', {
      style: { width: `${(s.value / total) * 100}%`, background: s.colour },
      title: `${s.label} ${Math.round((s.value / total) * 100)}%`,
    })));
}

/** Donut for tree status distribution. */
export function donut(segments, size = 108) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' },
    h('g', { transform: `rotate(-90 ${size / 2} ${size / 2})` },
      segments.map((s) => {
        const len = (s.value / total) * c;
        const el = h('circle', {
          cx: size / 2, cy: size / 2, r, fill: 'none',
          stroke: s.colour, 'stroke-width': 15,
          'stroke-dasharray': `${len} ${c - len}`, 'stroke-dashoffset': -offset,
        });
        offset += len;
        return el;
      })));
}

export function weekBars(values, opts = {}) {
  const height = opts.height ?? 44;
  const max = Math.max(...values, 1);
  return h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: `${height}px` } },
    values.map((v) => h('span', {
      style: {
        flex: '1 1 0', height: `${Math.max(3, (v / max) * height)}px`,
        background: opts.colour ?? 'var(--brand-400)', borderRadius: '2px',
      },
    })));
}

export function fmtAxis(v) {
  return num(v, 2);
}
