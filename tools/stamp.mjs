/* Stamp a deploy with its build id. Run by .github/workflows/pages.yml, on the
   runner's copy only — never commit what it writes.

   Three files learn the build:
     version.json     fetched with no-store; the server's answer to "which build
                      is live" (app/core/freshness.js)
     app/version.js   the same answer as the code on screen knows it
     sw.js            its BUILD and its FILES. Changing the worker's bytes is
                      what tells every visitor's browser that there is a new
                      build to download, and FILES is everything it downloads.

   Usage:  node tools/stamp.mjs <build-id>
*/
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, relative, extname, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const build = process.argv[2];
if (!build || !/^[\w.-]+$/.test(build)) {
  console.error('usage: node tools/stamp.mjs <build-id>');
  process.exit(1);
}
const builtAt = new Date().toISOString().slice(0, 16) + 'Z';

/* What the app loads at run time. Not the JSON under app/ — those are the
   sources the .data.js modules are made from, and the translators' parts —
   and not the notes beside the pictures. */
const SERVED = new Set(['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.avif', '.webp', '.svg', '.woff2']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (SERVED.has(extname(entry.name))) out.push(relative(ROOT, path).split('\\').join('/'));
  }
  return out;
}

const files = ['index.html', 'expo/index.html', ...(await walk(resolve(ROOT, 'app')))].sort();

await writeFile(resolve(ROOT, 'version.json'), `${JSON.stringify({ build, builtAt })}\n`);
await writeFile(resolve(ROOT, 'app/version.js'),
  '/* Generated at deploy time by tools/stamp.mjs.\n'
  + '   Locally this reads "dev" and no freshness check runs. */\n'
  + `export const BUILD = '${build}';\n`
  + `export const BUILT_AT = '${builtAt}';\n`);

let worker = await readFile(resolve(ROOT, 'sw.js'), 'utf8');
for (const [name, value] of [['BUILD', `'${build}'`], ['FILES', JSON.stringify(files, null, 1)]]) {
  // [^;]* rather than .*: a stamped FILES spans many lines, and stamping twice
  // must find it again.
  const line = new RegExp(`^const ${name} = [^;]*;$`, 'm');
  if (!line.test(worker)) throw new Error(`sw.js: no "const ${name} = …;" line to stamp`);
  worker = worker.replace(line, `const ${name} = ${value};`);
}
await writeFile(resolve(ROOT, 'sw.js'), worker);

console.log(`stamped ${build} (${builtAt}): ${files.length} files for the offline cache`);
