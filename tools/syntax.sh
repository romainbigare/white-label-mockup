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

# Task management is gone, and this is what stops it growing back. There is one
# unit of work in the app — an advice — and exactly one module may change who is
# holding it. A "send to the supervisor" button appearing on a fourth screen is
# how the concept of a task came back last time, one convenience at a time.
allowed="app/screens/advice.js"
found=$(grep -rl "sendAdvice(" app --include='*.js' | grep -v '^app/data/actions.js$' | sort | tr '\n' ' ')
if [ "$(echo $found)" != "$(echo $allowed)" ]; then
  echo "=== sending advice escaped the advice screen"
  echo "    expected: $allowed"
  echo "    found:    $found"
  fail=1
fi

# And no LIVE code may speak of a task again. Comments may — half of them exist
# to say what was deleted and why — so the check strips comments and strings
# first rather than trying to spot them with a regex, which is how the previous
# version of this flagged every continuation line of a block comment.
node - "$(find app -name '*.js' | sort | tr '\n' ' ')" <<'JS' || fail=1
const { readFileSync } = require('node:fs');
let bad = 0;
for (const f of process.argv[2].trim().split(/\s+/)) {
  const code = readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  code.split('\n').forEach((line, i) => {
    if (/\btasks?\b/i.test(line)) {
      console.log(`=== ${f}:${i + 1}: the word "task" is back in live code — ${line.trim()}`);
      bad = 1;
    }
  });
}
process.exit(bad);
JS

exit $fail
