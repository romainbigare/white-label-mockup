#!/usr/bin/env bash
# Parse every app module as ESM and report the first syntax error in each, then
# check every stylesheet balances its braces.
#
# The CSS half exists because a browser SILENTLY recovers from a stray `}`: it
# drops rules until it resynchronises, so a deleted block that leaves its
# closing brace behind produces no error anywhere — not in the console, not in
# the smoke test — just quietly missing styles.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p /tmp/synchk && rm -f /tmp/synchk/*.mjs
fail=0
for f in $(find app tools -name "*.js" | sort); do
  t="/tmp/synchk/$(echo "$f" | tr / _ | sed 's/\.js$/.mjs/')"
  cp "$f" "$t"
  if ! out=$(node --check "$t" 2>&1); then
    echo "=== $f"; echo "$out" | head -6; fail=1
  fi
done

node - "$(find app -name '*.css' | sort | tr '\n' ' ')" <<'JS' || fail=1
const { readFileSync } = require('node:fs');
let bad = 0;
for (const f of process.argv[2].trim().split(/\s+/)) {
  // Strip comments and quoted strings so braces inside them do not count.
  // Comments keep their newlines, so the reported line number stays true.
  const src = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  let depth = 0, line = 1, stray = 0;
  for (const ch of src) {
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) { console.log(`=== ${f}: unmatched } on line ${line}`); depth = 0; stray = 1; }
  }
  if (depth > 0) console.log(`=== ${f}: ${depth} unclosed { at end of file`);
  if (depth > 0 || stray) bad = 1;
}
process.exit(bad);
JS

exit $fail
