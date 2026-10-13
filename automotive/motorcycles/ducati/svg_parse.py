"""
Parser for Issuu per-page SVG renders of Ducati parts catalogues.

Every catalogue page — whether the original PDF had embedded text (the
"text standard", e.g. 2011+ catalogues) or was a scan carrying Issuu's own OCR
layer (the "image standard", e.g. pre-2010 catalogues) — renders as an SVG
whose text lives in <textPath> elements laid along positioned <path> baselines:

    <text transform="...">
        <textPath href="#p9___14___0" startOffset="128.15" textLength="18.22">
            for
        </textPath>
    </text>

A word's x = path_x + startOffset, its y = path_y. The two standards differ
only in how words are encoded:

  * text standard — one element per word ("Union", "88713.1010"); elements
    abut (<1px gaps), so element boundaries ARE word boundaries.
  * image standard — one element per glyph; word gaps are ~2-12px, glyph gaps
    smaller, so words are rebuilt by gap joining.

Page kinds:

  * drawing pages — topmost line "DRAWING {code} - {name}" (uppercase DRAWING
    is the page header; mixed-case "Drawing" lines are contents-page entries),
    few other texts (callout numbers), and a rasterized page image embedded
    as a base64 JPEG data URI.
  * table pages — same DRAWING header, then a header row containing
    CODE/DESCRIPTION and one row per part: callout | code | description |
    [validity] | qty. Tables may sit side-by-side in two column groups on one
    page; each group has its own CODE anchor.
"""

import base64
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Optional

SVG_NS = "{http://www.w3.org/2000/svg}"
XLINK_HREF = "{http://www.w3.org/1999/xlink}href"

# Gap (px in the SVG viewBox) above which two glyph-standard elements start a
# new word. Glyphs inside a word are < 2px apart; spaces render ~4-12px.
GLYPH_WORD_GAP_PX = 2.5
# Lines are bucketed by this many px of y.
LINE_BUCKET_PX = 8.0
# A "text standard" page has word-sized elements; a "image standard" page has
# glyph-sized ones. Elements at or below this length count as glyphs.
GLYPH_LEN = 2

# Part codes across eras:
#   88765.1236   8000.70139   677.4.003.1A   (dotted, pre-2016)
#   069191030    5101I231D    75910451A      (9-char alnum, 2016+)
_CODE_RE = re.compile(r"^(?:\d{2,5}(?:\.\d{1,4}){1,4}[A-Za-z]?|\d[A-Za-z0-9]{7,8})$")
_FUSED_CODE_RE = re.compile(r"^(\d{1,3})(\d{3}(?:\.\d{1,4}){1,4}[A-Za-z]?)$")
_REF_RE = re.compile(r"^\d{1,3}$")
_HEADER_RE = re.compile(r"^DRAWING\s*([0-9]{1,3}[A-Za-z]?)\s*[-–]?\s*(.*)$")


# ── SVG text layer extraction ────────────────────────────────────────────────

def _path_coords(root) -> dict[str, tuple[float, float]]:
    coords: dict[str, tuple[float, float]] = {}
    for el in root.iter(f"{SVG_NS}path"):
        pid = el.get("id")
        d = el.get("d", "")
        m = re.search(r"[ML]\s*(-?[\d.]+)[,\s]+(-?[\d.]+)", d)
        if pid and m:
            coords[pid] = (float(m.group(1)), float(m.group(2)))
    return coords


def extract_elements(svg_text: str) -> list[tuple[float, float, str, float]]:
    """Return [(x, y, text, width)] for every text element, in document order.

    x = path_x + startOffset; width from the textLength attribute.
    """
    root = ET.fromstring(svg_text)
    paths = _path_coords(root)

    elements: list[tuple[float, float, str, float]] = []
    for t in root.iter(f"{SVG_NS}text"):
        tp = t.find(f"{SVG_NS}textPath")
        if tp is None:
            continue
        txt = (tp.text or "").strip()
        if not txt:
            continue
        href = (tp.get("href") or tp.get(XLINK_HREF) or "").lstrip("#")
        px, py = paths.get(href, (0.0, 0.0))
        try:
            offset = float(tp.get("startOffset", 0) or 0)
        except ValueError:
            offset = 0.0
        try:
            width = float(tp.get("textLength", 0) or t.get("textLength", 0) or 0)
        except (ValueError, TypeError):
            width = 0.0
        elements.append((px + offset, py, txt, width))
    return elements


def build_words(elements: list[tuple[float, float, str, float]]) -> list[tuple[float, float, str]]:
    """Rebuild (x, y, word) from raw elements, per standard.

    Text standard: each element is a word. Image standard: glyphs are joined
    while the gap to the previous element stays below GLYPH_WORD_GAP_PX.
    """
    lens = sorted(len(txt) for _, _, txt, _ in elements)
    is_glyph_standard = bool(lens) and lens[len(lens) // 2] <= GLYPH_LEN

    by_line: dict[float, list[tuple[float, str, float]]] = defaultdict(list)
    for x, y, txt, width in elements:
        by_line[y].append((x, txt, width))

    words: list[tuple[float, float, str]] = []
    for y, els in by_line.items():
        els.sort(key=lambda e: e[0])
        cur_x = cur_end = None
        cur = ""
        for x, txt, width in els:
            end = x + (width if width else len(txt) * 7)
            new_word = cur_end is None or (
                is_glyph_standard and x - cur_end > GLYPH_WORD_GAP_PX
            ) or (not is_glyph_standard)
            if new_word and cur:
                words.append((cur_x, y, cur))
                cur = ""
            if cur_end is None or new_word:
                cur_x = x
            cur += txt
            cur_end = end
        if cur:
            words.append((cur_x, y, cur))
    return words


def group_lines(words: list[tuple[float, float, str]]) -> list[tuple[float, list[tuple[float, str]]]]:
    """Group words into visual lines: [(y, [(x, word)...])], y-sorted."""
    by_line: dict[float, list[tuple[float, str]]] = defaultdict(list)
    for x, y, txt in words:
        by_line[round(y / LINE_BUCKET_PX) * LINE_BUCKET_PX].append((x, txt))
    return [(y, sorted(ws)) for y, ws in sorted(by_line.items())]


# ── Page-level parsing ────────────────────────────────────────────────────────

# The pre-CODE columns (NOTES / NO.) sit ~110px left of their CODE anchor;
# group boundaries go there rather than at the CODE midpoint, so a group's
# trailing Q.TY column (which can be 500px right of its CODE) stays in-group.
GROUP_PRE_CODE_MARGIN = 115.0

_HEADER_WORD_RE = re.compile(r"^[\d]{1,3}[A-Za-z]?$")
_CODE_OK_RE = re.compile(r"^\d{1,3}[a-z]?$")
_HEADER_FUSED_RE = re.compile(r"^DRAWING\s*([\d]{1,3}[A-Za-z]?)\s*[-–]?\s*(.*)$")


def parse_header(lines: list[tuple[float, list[tuple[float, str]]]]) -> Optional[tuple[str, str]]:
    """Find the page header "DRAWING {code} - {name}".

    Only the topmost lines qualify (contents pages have mixed-case "Drawing"
    entries lower down). Case-sensitive: real headers are uppercase DRAWING.
    The code may be split across elements ("0", "0", "1a") or fused into the
    DRAWING word ("DRAWING001a").
    """
    for _, ws in lines[:4]:
        words = [w for _, w in ws]
        if not words:
            continue
        if not words[0].startswith("DRAWING"):
            continue
        if words[0] == "DRAWING":
            code = ""
            i = 1
            while i < len(words) and _HEADER_WORD_RE.match(words[i]):
                code += words[i]
                i += 1
            name_words = words[i:]
        else:
            m = _HEADER_FUSED_RE.match(words[0])
            if not m:
                continue
            code = m.group(1)
            name_words = words[1:]
        if not _CODE_OK_RE.match(code.lower()):
            continue
        name = " ".join(name_words).strip(" -–")
        name = re.sub(r"\s+", " ", name)
        if len(name) > 120:
            continue
        return code.lower(), name
    return None


def is_contents_page(lines: list[tuple[float, list[tuple[float, str]]]]) -> bool:
    for _, ws in lines[:4]:
        joined = " ".join(w for _, w in ws).upper()
        if "INDEX" in joined or "CONTENTS" in joined:
            return True
    return False


def _find_table_header(
    lines: list[tuple[float, list[tuple[float, str]]]],
) -> Optional[tuple[float, list[tuple[float, str]]]]:
    """The table header line contains CODE and DESCRIPTION (any standard)."""
    for line in lines:
        joined = "".join(w for _, w in line[1]).upper()
        if "CODE" in joined and "DESCRIPTION" in joined:
            return line
    return None


def parse_table_rows(
    lines: list[tuple[float, list[tuple[float, str]]]],
    header_line: tuple[float, list[tuple[float, str]]],
) -> list[dict]:
    """Extract part rows from a table page, splitting side-by-side column
    groups on their CODE anchors.

    Row shape: [notes] callout | code | description... | [validity] | qty
    """
    header_y, header_ws = header_line
    code_anchors = sorted(x for x, w in header_ws if w.upper().startswith("CODE"))
    if not code_anchors:
        return []

    # group boundaries sit just left of each later group's CODE anchor
    boundaries = [c - GROUP_PRE_CODE_MARGIN for c in code_anchors[1:]]

    def group_of(x: float) -> int:
        for i, b in enumerate(boundaries):
            if x < b:
                return i
        return len(boundaries)

    # bucket words below the header into (group, line)
    rows: list[dict] = []
    g_lines: dict[tuple[int, float], list[tuple[float, str]]] = defaultdict(list)
    for y, ws in lines:
        if y <= header_y + LINE_BUCKET_PX:
            continue
        for x, w in ws:
            g_lines[(group_of(x), y)].append((x, w))

    for (_, y), ws in sorted(g_lines.items()):
        ws = sorted(ws)
        row = _parse_row_words([w for _, w in ws])
        if row:
            row["_y"] = y
            rows.append(row)
    return rows


def _parse_row_words(words: list[str]) -> Optional[dict]:
    """Parse one visual line of a table into a part row (or None)."""
    rest = list(words)
    joined_all = "".join(rest).upper()
    if "CATALOGUE" in joined_all or "ISSUED" in joined_all or "DRAWING" in joined_all:
        return None

    code = None
    ref = ""
    code_idx = None
    for i, w in enumerate(rest):
        if _CODE_RE.match(w):
            code, code_idx = w, i
            break
    if code is None:
        # glyph-standard rows can fuse callout+code into one joined word
        for i, w in enumerate(rest):
            m = _FUSED_CODE_RE.match(w)
            if m:
                ref, code, code_idx = m.group(1), m.group(2), i
                break
    if code is None:
        return None

    before = rest[:code_idx]
    after = rest[code_idx + 1:]

    # callout: nearest pure-number word before the code
    if not ref:
        while before and _REF_RE.match(before[-1]):
            ref = before[-1]
            before = before[:-1]
    notes = ""
    if before and re.match(r"^[A-Za-z.]{1,4}$", before[-1]) and not _REF_RE.match(before[-1]):
        notes = before[-1]
        before = before[:-1]

    # qty: single trailing digit; multi-digit trailing tokens are qty+validity
    # fused by the renderer — keep them out of the description, stash in extras
    qty = None
    trailing = ""
    while after and re.match(r"^\d{1,3}$", after[-1]):
        tok = after[-1]
        after = after[:-1]
        if len(tok) == 1 and qty is None:
            qty = int(tok)
        else:
            trailing = tok + trailing

    desc = " ".join(after).strip()
    return {
        "ref": ref,
        "code": code,
        "description": desc,
        "qty": qty,
        "notes": notes,
        "validity": trailing or (before and " ".join(before) or ""),
    }


# ── Image extraction ──────────────────────────────────────────────────────────

_DATA_URI_RE = re.compile(
    r'<image[^>]+?(?:xlink:)?href="data:image/(?:jpeg|png|jpg);charset=utf-8;base64,([^"]+)"'
)


def extract_page_image(svg_text: str) -> Optional[bytes]:
    """Return the page's embedded raster image (base64 data URI), if any."""
    m = _DATA_URI_RE.search(svg_text)
    if not m:
        return None
    try:
        return base64.b64decode(m.group(1))
    except Exception:
        return None


# ── Page summary ──────────────────────────────────────────────────────────────

def parse_page(svg_text: str) -> dict:
    """Parse one catalogue page SVG.

    Returns:
      {
        'header':    (code, name) | None,
        'is_contents': bool,
        'rows':      [part row dicts] (empty unless a table page),
        'image':     bytes | None,
      }
    """
    elements = extract_elements(svg_text)
    words = build_words(elements)
    lines = group_lines(words)

    header = parse_header(lines)
    contents = is_contents_page(lines)

    rows: list[dict] = []
    header_line = None if contents else _find_table_header(lines)
    if header_line:
        rows = parse_table_rows(lines, header_line)

    image = extract_page_image(svg_text)
    return {
        "header": header,
        "is_contents": contents,
        "rows": rows,
        "image": image,
    }
