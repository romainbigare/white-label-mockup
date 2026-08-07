#!/usr/bin/env python3
"""Extract the text of a PDF without any third-party library.

This environment has no poppler, and pypdf cannot be imported (its cryptography
dependency panics), so this parses the file itself.

The specification is printed from Chromium, which means Skia/PDF: every font is
a subset embedded with Identity-H encoding, so the bytes in the content stream
are two-byte GLYPH INDICES, not characters. They only become text through the
font's /ToUnicode CMap. That is the whole reason this is more than a regex —
without the CMap you get plausible-looking garbage rather than nothing, which
is worse.

So: parse the indirect objects, walk pages in order, resolve each page's font
resources to their CMaps, then decode the text-showing operators against the
font selected by the most recent Tf.

Usage: pdftext.py input.pdf output.txt
"""
import re
import sys
import zlib

# -- object layer -----------------------------------------------------------

OBJ = re.compile(rb'(\d+)\s+(\d+)\s+obj\b')


def load(path):
    """Every indirect object in the file, as {num: (dict_bytes, stream_bytes)}."""
    data = open(path, 'rb').read()
    objs = {}
    for m in OBJ.finditer(data):
        num, start = int(m.group(1)), m.end()
        end = data.find(b'endobj', start)
        body = data[start:end if end > 0 else len(data)]
        sm = re.search(rb'stream\r?\n', body)
        if sm:
            head, raw = body[:sm.start()], body[sm.end():]
            stop = raw.rfind(b'endstream')
            raw = raw[:stop if stop > 0 else len(raw)]
            objs[num] = (head, raw)
        else:
            objs[num] = (body, None)
    return data, objs


def inflate(head, raw):
    if raw is None:
        return None
    if b'FlateDecode' not in head:
        return raw
    try:
        return zlib.decompress(raw)
    except zlib.error:
        try:
            return zlib.decompressobj().decompress(raw)
        except zlib.error:
            return None


def ref(head, key):
    """The object number a /Key R points at, or None."""
    m = re.search(rb'/' + key + rb'\s+(\d+)\s+\d+\s+R', head)
    return int(m.group(1)) if m else None


# -- ToUnicode CMaps --------------------------------------------------------

def cmap_of(stream):
    """{glyph_id: text} from a ToUnicode CMap."""
    out = {}
    if not stream:
        return out
    for block in re.findall(rb'beginbfchar(.*?)endbfchar', stream, re.S):
        for src, dst in re.findall(rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', block):
            out[int(src, 16)] = utf16(dst)
    for block in re.findall(rb'beginbfrange(.*?)endbfrange', stream, re.S):
        # <lo> <hi> <dst>  — a run mapped to consecutive code points
        for lo, hi, dst in re.findall(
                rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', block):
            lo, hi, base = int(lo, 16), int(hi, 16), int(dst, 16)
            for i in range(lo, min(hi, lo + 65535) + 1):
                out[i] = chr(base + i - lo)
        # <lo> <hi> [ <a> <b> ... ] — a run mapped to an explicit list
        for lo, hi, arr in re.findall(
                rb'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]', block, re.S):
            lo = int(lo, 16)
            for i, dst in enumerate(re.findall(rb'<([0-9A-Fa-f]+)>', arr)):
                out[lo + i] = utf16(dst)
    return out


def utf16(hexbytes):
    b = bytes.fromhex(hexbytes.decode())
    if len(b) % 2:
        b += b'\0'
    try:
        return b.decode('utf-16-be')
    except UnicodeDecodeError:
        return ''


# -- content streams --------------------------------------------------------

# One token at a time: name, hex string, literal string, array, number, operator.
# Skia emits a Td before EVERY glyph, so a line cannot be ended on Td alone —
# only when the pen actually moves down. Hence the operand stack.
TOKENS = re.compile(
    rb'/([A-Za-z0-9#]+)'                                     # 1: name
    rb'|<([0-9A-Fa-f\s]*)>'                                  # 2: hex string
    rb'|\(((?:[^()\\]|\\.)*)\)'                              # 3: literal string
    rb'|\[((?:[^\[\]]|\\.)*)\]'                              # 4: array
    rb'|(-?\d*\.?\d+)'                                       # 5: number
    rb'|([A-Za-z\'"*]+)', re.S)                              # 6: operator

STR = re.compile(rb'\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f\s]*)>|(-?\d*\.?\d+)', re.S)


def unescape(raw):
    out, i = bytearray(), 0
    while i < len(raw):
        c = raw[i:i + 1]
        if c == b'\\' and i + 1 < len(raw):
            nxt = raw[i + 1:i + 2]
            simple = {b'n': 10, b'r': 13, b't': 9, b'b': 8, b'f': 12,
                      b'(': 40, b')': 41, b'\\': 92}
            if nxt in simple:
                out.append(simple[nxt]); i += 2; continue
            m = re.match(rb'[0-7]{1,3}', raw[i + 1:i + 4])
            if m:
                out.append(int(m.group(), 8) & 0xFF); i += 1 + len(m.group()); continue
            out += nxt; i += 2; continue
        out += c; i += 1
    return bytes(out)


def glyphs(b, cmap):
    """Identity-H: every two bytes are one glyph id, looked up in the CMap."""
    out = []
    for i in range(0, len(b) - 1, 2):
        out.append(cmap.get((b[i] << 8) | b[i + 1], ''))
    return ''.join(out)


def page_text(content, fonts):
    lines, cur, cmap, stack = [], [], {}, []

    def flush():
        nonlocal cur
        text = ''.join(cur)
        if text.strip():
            lines.append(text.rstrip())
        cur = []

    def draw(raw, is_hex):
        b = bytes.fromhex(re.sub(rb'\s', b'', raw).decode()) if is_hex else unescape(raw)
        cur.append(glyphs(b, cmap))

    for m in TOKENS.finditer(content):
        name, hexs, lit, arr, num, op = m.groups()
        if num is not None:
            stack.append(float(num)); continue
        if name is not None:
            stack.append(('name', name)); continue
        if hexs is not None:
            stack.append(('hex', hexs)); continue
        if lit is not None:
            stack.append(('lit', lit)); continue
        if arr is not None:
            stack.append(('arr', arr)); continue

        o = op
        if o == b'Tf':
            for item in reversed(stack):
                if isinstance(item, tuple) and item[0] == 'name':
                    cmap = fonts.get(item[1].decode('latin-1'), {}); break
        elif o in (b'Tj', b"'", b'"'):
            for item in reversed(stack):
                if isinstance(item, tuple) and item[0] in ('hex', 'lit'):
                    draw(item[1], item[0] == 'hex'); break
            if o != b'Tj':
                flush()
        elif o == b'TJ':
            for item in reversed(stack):
                if isinstance(item, tuple) and item[0] == 'arr':
                    for l, hx, n in STR.findall(item[1]):
                        if hx:
                            draw(hx, True)
                        elif l:
                            draw(l, False)
                        elif n and float(n) < -100:   # kerning wide enough to be a space
                            cur.append(' ')
                    break
        elif o in (b'Td', b'TD'):
            # Only a vertical move is a new line; Skia's per-glyph Td is horizontal.
            if len(stack) >= 2 and isinstance(stack[-1], float) and stack[-1] != 0:
                flush()
        elif o in (b'Tm', b'T*', b'TL', b'ET', b'BT'):
            flush()
        stack = []
    flush()
    return lines


# -- pages ------------------------------------------------------------------

def pages_in_order(objs):
    """Page objects, in document order, following the page tree."""
    root = None
    for num, (head, _) in objs.items():
        if b'/Type' in head and re.search(rb'/Type\s*/Pages\b', head) and b'/Parent' not in head:
            root = num
    order = []

    def walk(num, seen):
        if num in seen or num not in objs:
            return
        seen.add(num)
        head, _ = objs[num]
        if re.search(rb'/Type\s*/Page\b', head) and not re.search(rb'/Type\s*/Pages\b', head):
            order.append(num); return
        kids = re.search(rb'/Kids\s*\[(.*?)\]', head, re.S)
        if kids:
            for k in re.findall(rb'(\d+)\s+\d+\s+R', kids.group(1)):
                walk(int(k), seen)

    if root is not None:
        walk(root, set())
    if not order:                                    # no usable tree: take them as found
        order = [n for n, (h, _) in sorted(objs.items())
                 if re.search(rb'/Type\s*/Page\b', h) and not re.search(rb'/Type\s*/Pages\b', h)]
    return order


def fonts_for(head, objs, cache):
    """{resource name: cmap} for one page."""
    res = head
    r = ref(head, b'Resources')
    if r is not None and r in objs:
        res = objs[r][0]
    block = re.search(rb'/Font\s*<<(.*?)>>', res, re.S)
    if not block:
        fr = ref(res, b'Font')
        if fr is None or fr not in objs:
            return {}
        block = re.search(rb'<<(.*)>>', objs[fr][0], re.S)
        if not block:
            return {}
    out = {}
    for name, num in re.findall(rb'/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R', block.group(1)):
        num = int(num)
        if num not in cache:
            cache[num] = {}
            fh, _ = objs.get(num, (b'', None))
            tu = ref(fh, b'ToUnicode')
            # A composite font hides the real font — and its CMap — one level down.
            if tu is None:
                desc = re.search(rb'/DescendantFonts\s*\[\s*(\d+)\s+\d+\s+R', fh)
                if desc:
                    tu = ref(fh, b'ToUnicode')
            if tu is not None and tu in objs:
                cache[num] = cmap_of(inflate(*objs[tu]))
        out[name.decode('latin-1')] = cache[num]
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    _, objs = load(src)
    cache, out = {}, []
    for i, pnum in enumerate(pages_in_order(objs), 1):
        head, _ = objs[pnum]
        fonts = fonts_for(head, objs, cache)
        content = b''
        cn = ref(head, b'Contents')
        if cn is not None and cn in objs:
            content = inflate(*objs[cn]) or b''
        else:                                        # /Contents [ a R b R ]
            arr = re.search(rb'/Contents\s*\[(.*?)\]', head, re.S)
            if arr:
                for k in re.findall(rb'(\d+)\s+\d+\s+R', arr.group(1)):
                    content += (inflate(*objs[int(k)]) or b'') + b'\n'
        out.append(f'\n=== page {i} ===')
        out += page_text(content, fonts)
    text = '\n'.join(out)
    for a, b in [('ﬁ', 'fi'), ('ﬂ', 'fl'), ('’', "'"), ('‘', "'"),
                 ('“', '"'), ('”', '"'), (' ', ' ')]:
        text = text.replace(a, b)
    open(dst, 'w').write(text)
    print(f'{dst}: {text.count("=== page")} pages, {len(text)} chars')


if __name__ == '__main__':
    main()
