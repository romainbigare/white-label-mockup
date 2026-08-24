#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   build-icons.mjs — vendor the icons the app uses out of Lucide.

   The v1.5.4 review asked for a real icon package rather than the hand-drawn
   path data the mockup carried, and offered a CDN if one was needed. A CDN is
   not needed and would cost more than it gives: this file is opened from
   file:// by reviewers, photographed by two headless-Chrome tools, and printed
   into a deck, and a network round trip is a way for any of those to come back
   with a page of empty boxes.

   So the icons are vendored. This reads the ~90 glyphs named in MAP out of the
   `lucide-static` package and writes them to app/ui/icons.data.js as the inner
   markup of each 24×24 symbol. Everything else — the size, the stroke weight,
   aria-hidden — stays in icons.js, which is the only place that draws one.

   Lucide is ISC-licensed; the licence travels in the generated header.

   Run:  npm run icons        # after adding a name to MAP below
   --------------------------------------------------------------------------- */

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'node_modules', 'lucide-static', 'icons');
const OUT = join(ROOT, 'app', 'ui', 'icons.data.js');

/* The app's name on the left, Lucide's on the right. The left-hand names are
   what every screen says — `icon('droplet')` — and they are deliberately about
   MEANING rather than shape, so a better glyph for "advice" can be swapped in
   here without touching a screen. */
const MAP = {
  /* navigation and chrome */
  home: 'house',
  map: 'map',
  advice: 'lightbulb',
  more: 'menu',
  back: 'chevron-left',
  forward: 'chevron-right',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  plus: 'plus',
  minus: 'minus',
  close: 'x',
  check: 'check',
  search: 'search',
  settings: 'settings',
  filter: 'funnel',
  sort: 'arrow-up-down',
  dots: 'ellipsis-vertical',
  login: 'log-in',
  logout: 'log-out',
  target: 'target',

  /* people and contact */
  user: 'user',
  users: 'users',
  phone: 'phone',
  mail: 'mail',
  whatsapp: 'message-circle',
  send: 'send',
  language: 'languages',

  /* capture and media */
  camera: 'camera',
  qr: 'qr-code',
  share: 'share-2',
  download: 'download',
  document: 'file-text',
  book: 'book-open',
  play: 'play',
  star: 'star',
  eye: 'eye',
  eyeOff: 'eye-off',

  /* the land */
  droplet: 'droplet',
  irrigation: 'droplets',
  leaf: 'leaf',
  tree: 'tree-palm',
  sprout: 'sprout',
  seed: 'wheat',
  grid: 'layout-grid',
  list: 'list',
  ruler: 'ruler',
  basket: 'shopping-basket',
  spray: 'spray-can',
  scissors: 'scissors',
  wrench: 'wrench',
  flag: 'flag',
  archive: 'archive',

  /* the sky */
  sun: 'sun',
  cloud: 'cloud',
  weather: 'cloud-sun',
  wind: 'wind',
  rain: 'cloud-rain',
  thermometer: 'thermometer',
  dust: 'haze',
  snow: 'snowflake',

  /* the map */
  pin: 'map-pin',
  locate: 'locate-fixed',
  layers: 'layers',
  compare: 'columns-2',
  scan: 'expand',
  split: 'split',
  edit: 'pencil',
  undo: 'undo-2',
  trash: 'trash-2',

  /* readings and state */
  chart: 'chart-column',
  trend: 'trending-up',
  warning: 'triangle-alert',
  info: 'info',
  help: 'circle-question-mark',
  refresh: 'refresh-cw',
  sync: 'refresh-ccw',
  offline: 'wifi-off',
  online: 'wifi',
  clock: 'clock',
  calendar: 'calendar',
  lock: 'lock',
  key: 'key',
  shield: 'shield',
  bell: 'bell',
  globe: 'globe',
  card: 'credit-card',
  storage: 'hard-drive',

  /* WF2.008's four-state scale, plus the two states the tree list keeps apart.
     These are the one set where the SHAPE carries the meaning — filled against
     half against triangle — so they are picked for that and not for prettiness.
     `-filled` is applied by icons.js, which is why circle and triangle appear
     here once each. */
  'circle-filled': 'circle',
  'circle-half': 'contrast',
  triangle: 'triangle',
  'triangle-filled': 'triangle',
  'circle-dashed': 'circle-dashed',
  cross: 'circle-x',
};

/* Everything between the opening <svg …> and </svg>, whitespace collapsed.
   Lucide puts stroke, width and linecap on the ROOT, which icons.js supplies —
   so what is kept is only the geometry. */
function innerOf(svg, name) {
  const open = svg.indexOf('>', svg.indexOf('<svg'));
  const close = svg.lastIndexOf('</svg>');
  if (open === -1 || close === -1) throw new Error(`${name}: not an svg`);
  const inner = svg.slice(open + 1, close).replace(/\s+/g, ' ').trim();
  if (!inner) throw new Error(`${name}: empty`);
  if (inner.includes('"')) return inner;          // attributes are double-quoted
  throw new Error(`${name}: no attributes found`);
}

/* One glyph needs a hand, and it is the one where the meaning is the fill.
   Lucide's `contrast` is a circle plus the path that covers half of it, and it
   ships both as outlines — which at the 15 px the status scale is drawn at
   reads as a circle with a line through it rather than as half-full. Filling
   the second element is an ELEMENT-level fill, so it wins over the root's
   fill:none without disturbing the ring around it. */
const TWEAK = {
  'circle-half': (inner) => inner.replace(/<path /, '<path fill="currentColor" '),
};

const entries = [];
for (const [ours, theirs] of Object.entries(MAP)) {
  const svg = await readFile(join(SRC, `${theirs}.svg`), 'utf8').catch(() => {
    throw new Error(`Lucide has no icon "${theirs}" (wanted for "${ours}")`);
  });
  const inner = innerOf(svg, theirs);
  entries.push([ours, theirs, TWEAK[ours] ? TWEAK[ours](inner) : inner]);
}

const version = JSON.parse(await readFile(join(ROOT, 'node_modules', 'lucide-static', 'package.json'), 'utf8')).version;

const body = entries
  .map(([ours, theirs, inner]) => `  ${/^[a-zA-Z][\w]*$/.test(ours) ? ours : JSON.stringify(ours)}: ${JSON.stringify(inner)},   // lucide ${theirs}`)
  .join('\n');

await writeFile(OUT, `/* GENERATED by tools/build-icons.mjs — do not edit.

   ${entries.length} glyphs from Lucide v${version} (ISC licence,
   https://lucide.dev), keyed by the name the app calls them. The stroke weight,
   size and accessibility attributes are applied by icons.js; what is stored
   here is geometry only.

   Add a name to MAP in the generator and run \`npm run icons\`. */
export default {
${body}
};
`);

console.log(`${entries.length} icons from lucide-static v${version} -> app/ui/icons.data.js`);
