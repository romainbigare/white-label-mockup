#!/usr/bin/env python3
"""Compare two extracted specification texts requirement by requirement.

Requirements are printed as an identifier alone on a line followed by the
sentence. Page furniture (the running footer, the page number, the extractor's
own page markers) has to come out first or it lands inside whichever
requirement happens to straddle a page break.

Usage: specdiff.py old.txt new.txt [--json out.json]
"""
import difflib
import json
import re
import sys

ID = re.compile(r'^(WF\d+\.\d+)\s*$')
INLINE = re.compile(r'^(WF\d+\.\d+)\s+—\s*(.*)$')
NOISE = re.compile(
    r'^(=== page \d+ ===|White Label Farm App — Build Specification v[\d.]+'
    r'|Wafra Greentech Limited · \d+ \w+ \d{4}|\d{1,3})$')


def register(path):
    """{id: (section_heading, text)} in document order."""
    out, cur, buf, section = {}, None, [], ''
    for raw in open(path):
        line = raw.rstrip('\n').strip()
        if NOISE.match(line):
            continue
        if re.match(r'^\d+(\.\d+)*\s+\S', line) and len(line) < 80:
            section = line
        m = ID.match(line) or INLINE.match(line)
        if m:
            if cur:
                out[cur] = (out[cur][0], ' '.join(buf).strip())
            cur = m.group(1)
            buf = [m.group(2)] if m.lastindex == 2 else []
            out[cur] = (section, '')
        elif cur is not None:
            buf.append(line)
    if cur:
        out[cur] = (out[cur][0], ' '.join(buf).strip())
    return {k: (s, clean(t)) for k, (s, t) in out.items()}


def clean(t):
    t = re.sub(r'^\s*—\s*', '', t)
    t = re.sub(r'\s+', ' ', t)
    # Everything after the identifier's own sentence block; drop trailing art.
    return t.split('┌')[0].split('╔')[0].strip()


def main():
    old_p, new_p = sys.argv[1], sys.argv[2]
    old, new = register(old_p), register(new_p)
    removed = sorted(set(old) - set(new))
    added = sorted(set(new) - set(old))
    changed, same = [], []
    for k in sorted(set(old) & set(new)):
        a, b = old[k][1], new[k][1]
        r = difflib.SequenceMatcher(None, a, b).ratio()
        (same if r > 0.97 else changed).append((k, round(r, 3)))

    print(f'old {len(old)} requirements, new {len(new)}')
    print(f'removed {len(removed)} · added {len(added)} · reworded {len(changed)} · identical {len(same)}')

    if '--json' in sys.argv:
        out = sys.argv[sys.argv.index('--json') + 1]
        json.dump({
            'removed': {k: {'section': old[k][0], 'text': old[k][1]} for k in removed},
            'added': {k: {'section': new[k][0], 'text': new[k][1]} for k in added},
            'changed': {k: {'section': new[k][0], 'ratio': r,
                            'old': old[k][1], 'new': new[k][1]} for k, r in changed},
            'unchanged': [k for k, _ in same],
        }, open(out, 'w'), indent=1, ensure_ascii=False)
        print('wrote', out)


if __name__ == '__main__':
    main()
