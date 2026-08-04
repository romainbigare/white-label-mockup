#!/usr/bin/env python3
"""Wrap the authored JSON fixtures as ES modules.

GitHub Pages serves JSON fine, but static `import` of a module works from
file:// too, so a reviewer can open index.html with no server at all. The JSON
files stay the source of truth; run this after editing one.
"""
import json, pathlib, sys

DATA = pathlib.Path(__file__).resolve().parent.parent / 'app' / 'data'

for name in ('farms', 'activity', 'content'):
    src = DATA / f'{name}.json'
    if not src.exists():
        continue
    payload = json.loads(src.read_text())
    out = DATA / f'{name}.data.js'
    out.write_text(
        f'/* GENERATED from {name}.json by tools/json-to-module.py — do not edit. */\n'
        f'export default {json.dumps(payload, ensure_ascii=False, indent=1)};\n'
    )
    print(f'{src.name} -> {out.name} ({out.stat().st_size // 1024} KB)')
