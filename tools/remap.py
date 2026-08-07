#!/usr/bin/env python3
"""Map the requirement identifiers used in the tree onto the new specification.

Identifiers are not stable across specification versions: inserting one
requirement renumbers every one after it in its section. So the mapping has to
be made on the SENTENCE, not the number. For each old identifier still cited in
the code, this finds the new requirement whose text is closest, and reports the
score so a human can check the weak ones rather than trusting all of them.

Usage: remap.py old.txt new.txt used.txt [--json out.json]
"""
import difflib
import json
import re
import sys

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from specdiff import register                                    # noqa: E402

STOP = re.compile(r'\b(the|a|an|is|of|and|to|in|it|on|for|that|as|are|be|by|with)\b')


def norm(t):
    t = t.lower()
    t = re.sub(r'wf\d+\.\d+', ' ', t)
    t = re.sub(r'§[\d.]+', ' ', t)
    t = re.sub(r'[^a-z0-9 ]', ' ', t)
    t = STOP.sub(' ', t)
    return ' '.join(t.split())


def main():
    old_p, new_p, used_p = sys.argv[1], sys.argv[2], sys.argv[3]
    old, new = register(old_p), register(new_p)
    used = [l.strip() for l in open(used_p) if l.strip()]

    keys = list(new)
    normed = {k: norm(new[k][1]) for k in keys}
    out = {}
    for oid in used:
        if oid not in old:
            out[oid] = {'to': None, 'score': 0.0, 'why': 'not in the old specification'}
            continue
        src = norm(old[oid][1])
        if not src:
            out[oid] = {'to': None, 'score': 0.0, 'why': 'old text empty'}
            continue
        best, score = None, 0.0
        for k in keys:
            r = difflib.SequenceMatcher(None, src, normed[k]).ratio()
            if r > score:
                best, score = k, r
        out[oid] = {'to': best, 'score': round(score, 3),
                    'old': old[oid][1][:150], 'new': new[best][1][:150] if best else '',
                    'section': new[best][0] if best else ''}

    strong = {k: v for k, v in out.items() if v['score'] >= 0.62}
    weak = {k: v for k, v in out.items() if v['score'] < 0.62}
    print(f'{len(used)} identifiers in the tree')
    print(f'  matched at >= 0.62: {len(strong)}')
    print(f'  needs a human eye : {len(weak)}')
    dupes = {}
    for k, v in strong.items():
        dupes.setdefault(v['to'], []).append(k)
    collide = {k: v for k, v in dupes.items() if len(v) > 1}
    if collide:
        print(f'  several old ids landing on one new id: {len(collide)}')

    if '--json' in sys.argv:
        p = sys.argv[sys.argv.index('--json') + 1]
        json.dump({'map': out, 'weak': sorted(weak), 'collisions': collide},
                  open(p, 'w'), indent=1, ensure_ascii=False)
        print('wrote', p)


if __name__ == '__main__':
    main()
