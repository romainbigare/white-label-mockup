#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   vendor-leaflet.mjs — copy Leaflet into app/vendor/leaflet/.

   C1's live map (app/ui/livemap.js) runs on Leaflet. It is vendored rather than
   loaded from a CDN for the reason build-icons.mjs gives about icons: the
   mockup is opened from file://, photographed by headless browsers, and kept
   offline on exhibition tablets (sw.js), and a CDN is a way for any of those to
   come back without a map.

   The ES-module build, so livemap.js can import() it on first use: the other
   sixty screens never pay for it. Its source-map comment is dropped, because
   the map file is not copied and a missing one is a 404 in every devtools.
   Leaflet is BSD-2-Clause; the licence travels beside it.

   Run:  npm install && npm run leaflet
   --------------------------------------------------------------------------- */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'node_modules', 'leaflet');
const OUT = join(ROOT, 'app', 'vendor', 'leaflet');

const { version } = JSON.parse(await readFile(join(SRC, 'package.json'), 'utf8'));
await mkdir(OUT, { recursive: true });

const code = (await readFile(join(SRC, 'dist', 'leaflet-src.esm.js'), 'utf8'))
  .replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n');
await writeFile(join(OUT, 'leaflet.js'), code);
await writeFile(join(OUT, 'leaflet.css'), await readFile(join(SRC, 'dist', 'leaflet.css')));
await writeFile(join(OUT, 'LICENSE'), await readFile(join(SRC, 'LICENSE')));
console.log(`vendored Leaflet ${version} into app/vendor/leaflet/`);
