#!/usr/bin/env bash
# Parse every app module as ESM and report the first syntax error in each.
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
exit $fail
