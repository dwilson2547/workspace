"""
parse_sample.py
---------------
One-off script: parses every PDF found in ./sample/, prints extracted
subsystems and parts to the console, and saves any embedded images to
./sample/images/.

No database writes.  Run from the project root:
    python parse_sample.py
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional

import pdfplumber

SAMPLE_DIR = Path(__file__).parent / "sample"
IMAGE_DIR = SAMPLE_DIR / "images"

# ── Reuse detection helpers from pdf_parser (copied to keep this standalone) ─

_RE_REF = re.compile(r"^(ref\.?|pos\.?|#|n[oº°]\.?)$", re.I)
_RE_PART_NO = re.compile(
    r"^(part\s*(no\.?|number|num\.?)|code|codice|p/n|part#)$", re.I
)
_RE_DESC = re.compile(
    r"^(descri?pt?i?o?n?|descrizione|bezeichnung|denomination)$", re.I
)
_RE_QTY = re.compile(r"^(q\.?t?y\.?|pcs\.?|qty\.?|quantity|anzahl)$", re.I)
_RE_PART_NUM = re.compile(r"^[0-9A-Z]{6,14}$", re.I)
_RE_SUBSYSTEM = re.compile(r"^[A-Z][A-Z0-9 /\-]{3,50}$")
_KNOWN_SUBSYSTEMS = {
    "engine", "frame", "fuel system", "exhaust", "brakes", "suspension",
    "wheels", "electrical", "bodywork", "cooling", "transmission", "clutch",
    "instrumentation", "accessories", "lights", "forks", "swingarm",
    "chassis", "air filter", "starter", "battery", "throttle body",
    "cylinder head", "crankcase", "gearbox", "final drive", "fairings",
}


def _map_columns(header: list) -> Optional[dict]:
    col_map: dict[str, int] = {}
    for i, cell in enumerate(header):
        text = (cell or "").strip()
        if _RE_REF.match(text) and "ref" not in col_map:
            col_map["ref"] = i
        elif _RE_PART_NO.match(text) and "part_no" not in col_map:
            col_map["part_no"] = i
        elif _RE_DESC.match(text) and "description" not in col_map:
            col_map["description"] = i
        elif _RE_QTY.match(text) and "qty" not in col_map:
            col_map["qty"] = i
    return col_map if "part_no" in col_map else None


def _cell(row: list, idx: Optional[int]) -> Optional[str]:
    if idx is None or idx >= len(row):
        return None
    val = row[idx]
    return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else None)


def _is_valid_part_number(value: Optional[str]) -> bool:
    return bool(value and _RE_PART_NUM.match(value.replace(" ", "").replace("-", "")))


def _detect_subsystem(text: str) -> Optional[str]:
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 4 or len(line) > 60:
            continue
        if line.replace(" ", "").isdigit():
            continue
        if _RE_SUBSYSTEM.match(line):
            return line.title()
        lower = line.lower()
        for kw in _KNOWN_SUBSYSTEMS:
            if kw in lower and len(line) < 50:
                return line.title()
    return None


# ── Image extraction ──────────────────────────────────────────────────────────

def _save_images(page, page_num: int, image_dir: Path) -> int:
    """Render the page to a PNG and save it; return 1 on success, 0 on failure."""
    try:
        rendered = page.to_image(resolution=150)
        out = image_dir / f"page_{page_num:04d}.png"
        rendered.save(str(out))
        return 1
    except Exception as exc:
        print(f"    [image] page {page_num} render failed: {exc}")
        return 0


# ── Per-PDF parser ────────────────────────────────────────────────────────────

def parse_pdf(pdf_path: Path):
    print(f"\n{'='*70}")
    print(f"  File : {pdf_path.name}")
    print(f"{'='*70}")

    save_images = IMAGE_DIR.exists() or SAMPLE_DIR.exists()
    if save_images:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    subsystems: list[dict] = []
    parts: list[dict] = []
    current_subsystem: Optional[str] = None
    images_saved = 0

    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"  Pages: {total}\n")

        for page_num, page in enumerate(pdf.pages, 1):
            try:
                text = page.extract_text() or ""

                # ── Subsystem detection ───────────────────────────────────
                subsystem_name = _detect_subsystem(text)
                if subsystem_name and subsystem_name != current_subsystem:
                    current_subsystem = subsystem_name
                    subsystems.append({"name": subsystem_name, "page": page_num})

                # ── Image extraction ──────────────────────────────────────
                if save_images and page.images:
                    images_saved += _save_images(page, page_num, IMAGE_DIR)

                # ── Parts tables ──────────────────────────────────────────
                for table in page.extract_tables():
                    if not table or len(table) < 2:
                        continue
                    col_map = _map_columns(table[0])
                    if col_map is None:
                        continue
                    for row in table[1:]:
                        if not row:
                            continue
                        part_number = _cell(row, col_map.get("part_no"))
                        if not _is_valid_part_number(part_number):
                            continue
                        description = _cell(row, col_map.get("description"))
                        if description:
                            description = description.split("/")[0].split("\n")[0].strip()
                        parts.append({
                            "subsystem": current_subsystem,
                            "ref":       _cell(row, col_map.get("ref")),
                            "part_no":   part_number,
                            "desc":      description,
                            "qty":       _cell(row, col_map.get("qty")),
                            "page":      page_num,
                            "diagram":   f"page_{page_num:04d}.png" if page.images else None,
                        })

            except Exception as exc:
                print(f"  [!] Page {page_num} error: {exc}")

    # ── Print results ─────────────────────────────────────────────────────
    print(f"SUBSYSTEMS DETECTED ({len(subsystems)})")
    print(f"  {'Page':>5}  Name")
    print(f"  {'----':>5}  {'----'}")
    for s in subsystems:
        print(f"  {s['page']:>5}  {s['name']}")

    print(f"\nPARTS EXTRACTED ({len(parts)})")
    if parts:
        col_w = {"subsystem": 22, "ref": 6, "part_no": 14, "qty": 5, "desc": 36}
        header = (
            f"  {'Page':>5}  "
            f"{'Subsystem':<{col_w['subsystem']}}  "
            f"{'Ref':>{col_w['ref']}}  "
            f"{'Part Number':<{col_w['part_no']}}  "
            f"{'Qty':<{col_w['qty']}}  "
            f"Description"
        )
        print(header)
        print("  " + "-" * (len(header) - 2))
        for p in parts:
            sub   = (p["subsystem"] or "")[:col_w["subsystem"]]
            ref   = (p["ref"]       or "")[:col_w["ref"]]
            pno   = (p["part_no"]   or "")[:col_w["part_no"]]
            qty   = (p["qty"]       or "")[:col_w["qty"]]
            desc  = (p["desc"]      or "")[:col_w["desc"]]
            print(
                f"  {p['page']:>5}  "
                f"{sub:<{col_w['subsystem']}}  "
                f"{ref:>{col_w['ref']}}  "
                f"{pno:<{col_w['part_no']}}  "
                f"{qty:<{col_w['qty']}}  "
                f"{desc}"
            )

    if save_images:
        print(f"\nIMAGES: {images_saved} page renders saved to {IMAGE_DIR}")

    # ── JSON output ───────────────────────────────────────────────────────
    output = {
        "file":       pdf_path.name,
        "pages":      total,
        "subsystems": subsystems,
        "parts": [
            {
                "subsystem":   p["subsystem"],
                "ref":         p["ref"],
                "part_number": p["part_no"],
                "description": p["desc"],
                "quantity":    p["qty"],
                "page":        p["page"],
                "diagram":     p["diagram"],
            }
            for p in parts
        ],
    }
    json_path = SAMPLE_DIR / (pdf_path.stem + ".json")
    json_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nJSON:   {json_path}")

    print(f"\nSummary: {len(subsystems)} subsystems, {len(parts)} parts across {total} pages")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    pdfs = sorted(SAMPLE_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {SAMPLE_DIR}")
        sys.exit(1)

    for pdf_path in pdfs:
        parse_pdf(pdf_path)
