/* ---------------------------------------------------------------------------
   icons.js — one 24×24 grid, one stroke weight, one place to add a glyph.

   WF2.014: an icon never travels alone in this app — every call site pairs it
   with a text label. The `icon()` helper therefore always renders
   aria-hidden="true" and leaves the accessible name to the label beside it.
   --------------------------------------------------------------------------- */

import { h } from '../core/dom.js';

/* Stroked paths unless the name ends in -filled. */
const P = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Zm0 0v13m6-10.5v13',
  advice: 'M12 3 4 8v8l8 5 8-5V8l-8-5Zm0 5.5v4m0 3.5h.01',
  tasks: 'M4.5 12.5 9 17l10.5-10.5',
  more: 'M4 7h16M4 12h16M4 17h16',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  chevronDown: 'M6 9.5 12 15.5 18 9.5',
  chevronUp: 'M6 14.5 12 8.5l6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M4.5 12.5 9.5 17.5 20 6.5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8.5 3-1.8-.6a6.9 6.9 0 0 0-.7-1.7l.8-1.7-1.8-1.8-1.7.8a6.9 6.9 0 0 0-1.7-.7L12.5 3.5h-2.5L9.4 5.3a6.9 6.9 0 0 0-1.7.7L6 5.2 4.2 7l.8 1.7a6.9 6.9 0 0 0-.7 1.7l-1.8.6v2.5l1.8.6c.16.6.4 1.16.7 1.7L4.2 17.6 6 19.4l1.7-.8c.54.3 1.1.54 1.7.7l.6 1.8h2.5l.6-1.8c.6-.16 1.16-.4 1.7-.7l1.7.8 1.8-1.8-.8-1.7c.3-.54.54-1.1.7-1.7l1.8-.6V12Z',
  filter: 'M4 6h16l-6 7v5l-4 2v-7L4 6Z',
  sort: 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z',
  lock: 'M7 10V7.5a5 5 0 0 1 10 0V10M5 10h14v10H5V10Zm7 4v2.5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Zm4 8.5a2 2 0 0 0 4 0',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-3 3-3 15 0 18m0-18c3 3 3 15 0 18M3.5 9h17m-17 6h17',
  phone: 'M6 3.5h4l1.5 4.5-2.5 1.5a12 12 0 0 0 5.5 5.5l1.5-2.5 4.5 1.5v4c0 .8-.7 1.5-1.5 1.5C11 19.5 4.5 13 4.5 5 4.5 4.2 5.2 3.5 6 3.5Z',
  mail: 'M3.5 6h17v12h-17V6Zm0 .5 8.5 6.5 8.5-6.5',
  whatsapp: 'M4 20l1.2-3.6A7.6 7.6 0 1 1 8 19l-4 1Zm5.2-9.6c-.2 1 .5 2.3 1.4 3.2s2.2 1.6 3.2 1.4c.5-.1 1-.9 1-.9l-1.6-1-.7.7c-.6-.3-1.5-1.2-1.8-1.8l.7-.7-1-1.6s-.8.5-.9 1Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5',
  login: 'M14 4.5h5.5v15H14M11 12H3.5m0 0 3.5-3.5M3.5 12 7 15.5',
  split: 'M4 6h7l4.5 6L11 18H4m11-6h5m0 0-2.5-2.5M20 12l-2.5 2.5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5 6-5s6 2 6 5m1.5-5.6c2.6.3 4.5 2.1 4.5 4.6',
  trash: 'M5 7h14M9 7V4.5h6V7m-8 0 .8 13h8.4L17 7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm11-15 4 4',
  calendar: 'M4.5 6.5h15v14h-15v-14Zm0 4.5h15M8.5 3.5v4m7-4v4',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7v5.5l3.5 2',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Zm0-13.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  locate: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M3 12h3m12 0h3',
  layers: 'M12 3.5 3 8l9 4.5L21 8l-9-4.5ZM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17',
  compare: 'M12 3.5v17M7.5 8 4 11.5 7.5 15M16.5 8 20 11.5 16.5 15',
  undo: 'M8 8H4V4m0 4a8 8 0 1 1-1 4',
  dots: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  share: 'M12 15V4m0 0-3.5 3.5M12 4l3.5 3.5M5 13v7h14v-7',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  document: 'M6 3.5h8l4 4v13H6v-17Zm8 0v4h4M9 12h6m-6 4h6',
  droplet: 'M12 3.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3.5 12 3.5Z',
  leaf: 'M5 19C5 10 11 5 20 5c0 9-5 14-13 14H5Zm3-3 8-8',
  tree: 'M12 21v-6m0 0a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm-3 6h6',
  sprout: 'M12 21v-7.5m0 0C12 11 9.7 8.8 6.8 8.8c0 2.9 2.3 5.2 5.2 5.2Zm0 0c0-3.4 2.5-6.2 5.7-6.2 0 3.4-2.5 6.2-5.7 6.2Z',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19',
  cloud: 'M7 18h10a3.5 3.5 0 0 0 .3-7A5.5 5.5 0 0 0 6.6 11 3.5 3.5 0 0 0 7 18Z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 17h9',
  rain: 'M7 15h10a3.5 3.5 0 0 0 .3-7A5.5 5.5 0 0 0 6.6 8 3.5 3.5 0 0 0 7 15Zm2 3-1 2.5m4-2.5-1 2.5m4-2.5-1 2.5',
  thermometer: 'M12 3.5a2 2 0 0 1 2 2v8a4 4 0 1 1-4 0v-8a2 2 0 0 1 2-2Z',
  dust: 'M3 7h12m-8 4h14M3 15h11m2 4h5',
  snow: 'M12 3v18M4 7.5 20 16.5M20 7.5 4 16.5',
  chart: 'M4 20V4m0 16h16M8 16v-4m4 4V8m4 8v-6',
  trend: 'M4 16l5-5 3.5 3.5L20 7m0 0h-4.5M20 7v4.5',
  warning: 'M12 4 2.5 20.5h19L12 4Zm0 6v5m0 3h.01',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 11v5.5M12 7.5h.01',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5',
  sync: 'M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M17.5 3v4h-4m-3 14v-4h4',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4m9.9 2.4a10 10 0 0 0-3-2M2 9.5A15 15 0 0 1 7 6.4m10.5.3A15 15 0 0 1 22 9.5M12 20h.01',
  online: 'M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M2 9.5a15 15 0 0 1 20 0M12 20h.01',
  play: 'M7 4.5 19 12 7 19.5v-15Z',
  star: 'm12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8L12 3.5Z',
  logout: 'M15 5H5v14h10M12 12H21m0 0-3.5-3.5M21 12l-3.5 3.5',
  eye: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  eyeOff: 'M3 3l18 18M10 6.3A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 8.5A17 17 0 0 0 2.5 12S6 18 12 18c1 0 1.9-.15 2.7-.4',
  scan: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M4 12h16',
  archive: 'M3.5 4.5h17v4h-17v-4Zm1.5 4v11h14v-11M10 12h4',
  flag: 'M6 21V4h12l-2.5 4L18 12H6',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  list: 'M4 6.5h.01M8 6.5h12M4 12h.01M8 12h12M4 17.5h.01M8 17.5h12',
  ruler: 'M3 9h18v6H3V9Zm3 0v3m3-3v4m3-4v3m3-3v4m3-4v3',
  wrench: 'M14.5 4a5 5 0 0 0-4.4 7.3L4 17.4 6.6 20l6.1-6.1A5 5 0 1 0 14.5 4Z',
  scissors: 'M6 4l12 12M18 4 6 16M6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  basket: 'M3.5 9.5h17l-2 10h-13l-2-10Zm4-5 2 5m7-5-2 5',
  spray: 'M9 8h6v13H9V8Zm0 0V5h6v3M17 4h2m-2 3h2m-2 3h2',
  seed: 'M12 21c-4 0-7-3-7-7s3-11 7-11 7 7 7 11-3 7-7 7Zm0 0V8',
  key: 'M14.5 4a5.5 5.5 0 1 0-4.3 8.9L4 19.1V21h3l1-1v-2h2v-2h2l.2-.2A5.5 5.5 0 0 0 14.5 4Z',
  shield: 'M12 3.5 4.5 6.5v6c0 4.5 3.2 7.4 7.5 8.5 4.3-1.1 7.5-4 7.5-8.5v-6L12 3.5Z',
  help: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-2.2 6a2.3 2.3 0 1 1 3.1 2.2c-.6.3-.9.8-.9 1.5v.4m0 3h.01',
  book: 'M4 4.5h6c1.1 0 2 .9 2 2v13c0-1.1-.9-2-2-2H4v-13Zm16 0h-6c-1.1 0-2 .9-2 2v13c0-1.1.9-2 2-2h6v-13Z',
  card: 'M3.5 6h17v12h-17V6Zm0 4h17M6.5 14.5h3',
  storage: 'M4 5.5h16v5H4v-5Zm0 8h16v5H4v-5ZM7.5 8h.01M7.5 16h.01',
  language: 'M3 6h9M7.5 4v2c0 4-2 7-4.5 8.5M6 10.5c1 2.2 3 4 5 4.8M13 20l4-9 4 9m-6.6-2.5h5.2',
  target: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 4.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 3.5h.01',
};

/* Status glyphs are drawn as filled shapes so they read at small sizes. */
const STATUS_GLYPH = {
  'circle-filled':   { fill: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z' },
  'circle-half':     { stroke: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', fill: 'M12 5v14a7 7 0 0 0 0-14Z' },
  'triangle':        { stroke: 'M12 4.5 3 20h18L12 4.5Z' },
  'triangle-filled': { fill: 'M12 4.5 3 20h18L12 4.5Z' },
  'circle-dashed':   { dashed: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z' },
  cross:             { stroke: 'M6 6l12 12M18 6 6 18' },
};

export function icon(name, size = 20, extraClass = '') {
  const glyph = STATUS_GLYPH[name];
  const attrs = {
    viewBox: '0 0 24 24', width: size, height: size,
    fill: 'none', 'aria-hidden': 'true', focusable: 'false',
    class: `ico ${extraClass}`.trim(),
  };
  if (glyph) {
    return h('svg', attrs,
      glyph.fill && h('path', { d: glyph.fill, fill: 'currentColor' }),
      glyph.stroke && h('path', { d: glyph.stroke, stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
      glyph.dashed && h('path', { d: glyph.dashed, stroke: 'currentColor', 'stroke-width': 2, 'stroke-dasharray': '3 3' }));
  }
  const d = P[name];
  if (!d) return h('svg', attrs);
  return h('svg', attrs, h('path', {
    d, stroke: 'currentColor', 'stroke-width': 1.9,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
}

/** Task-type icons — WF5.105 uses them for icons, filtering and reporting. */
export const TASK_ICON = {
  irrigation: 'droplet', fertiliser: 'sprout', spraying: 'spray',
  planting: 'seed', pruning: 'scissors', harvest: 'basket',
  inspection: 'eye', maintenance: 'wrench', other: 'flag',
};

export const ADVICE_ICON = {
  irrigation: 'droplet', nutrition: 'sprout', protection: 'shield',
  weather: 'cloud', harvest: 'basket',
};
