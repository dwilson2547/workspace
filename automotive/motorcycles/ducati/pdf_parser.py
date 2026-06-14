"""
pdf_parser.py
-------------
Reads every downloaded catalog PDF from ./part_catalogs/, extracts subsystems
and individual parts using pdfplumber, then stores the data in PostgreSQL for
reverse-lookup queries.

Only unprocessed catalogs (parsed_at IS NULL) are handled unless --reparse is
passed on the command line.

Usage:
    python pdf_parser.py            # parse new/unparsed catalogs only
    python pdf_parser.py --reparse  # re-parse everything
"""

import logging
import re
import sys
from pathlib import Path
from typing import Optional

import pdfplumber

from config import CATALOGS_DIR
from db import Catalog, Part, Subsystem, get_session, mark_parsed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Column name patterns (multi-language) ────────────────────────────────────

_RE_REF = re.compile(r"^(ref\.?|pos\.?|#|n[oº°]\.?)$", re.I)
_RE_PART_NO = re.compile(
    r"^(part\s*(no\.?|number|num\.?)|code|codice|p/n|part#)$", re.I
)
_RE_DESC = re.compile(
    r"^(descri?pt?i?o?n?|descrizione|bezeichnung|denomination)$", re.I
)
_RE_QTY = re.compile(r"^(q\.?t?y\.?|pcs\.?|qty\.?|quantity|anzahl)$", re.I)

# Pattern that looks like a Ducati part number: 6–14 alphanumeric chars,
# usually ending in a letter (e.g. 77916051A, 43711211A, 80610211A)
_RE_PART_NUM = re.compile(r"^[0-9A-Z]{6,14}$", re.I)

# Subsystem heading heuristics: short ALL-CAPS lines or known section words
_RE_SUBSYSTEM = re.compile(
    r"^[A-Z][A-Z0-9 /\-]{3,50}$"  # all-caps, 4–51 chars
)
_KNOWN_SUBSYSTEMS = {
    "engine", "frame", "fuel system", "exhaust", "brakes", "suspension",
    "wheels", "electrical", "bodywork", "cooling", "transmission", "clutch",
    "instrumentation", "accessories", "lights", "forks", "swingarm",
    "chassis", "air filter", "starter", "battery", "throttle body",
    "cylinder head", "crankcase", "gearbox", "final drive", "fairings",
}

# ── Column mapping ────────────────────────────────────────────────────────────


def _map_columns(header: list) -> Optional[dict]:
    """Return {ref, part_no, description, qty} -> column-index, or None."""
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
    # We require at minimum a part-number column
    if "part_no" not in col_map:
        return None
    return col_map


def _cell(row: list, idx: Optional[int]) -> Optional[str]:
    if idx is None or idx >= len(row):
        return None
    val = row[idx]
    return val.strip() if isinstance(val, str) else (str(val).strip() if val is not None else None)


def _is_valid_part_number(value: Optional[str]) -> bool:
    return bool(value and _RE_PART_NUM.match(value.replace(" ", "").replace("-", "")))


# ── Subsystem detection ───────────────────────────────────────────────────────


def _detect_subsystem(text: str) -> Optional[str]:
    """
    Return a subsystem name if the page text looks like a section header,
    or None.  We look for the first short all-caps line (not a number, not
    a single word like a page number).
    """
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 4 or len(line) > 60:
            continue
        # Skip pure numbers (page numbers etc.)
        if line.replace(" ", "").isdigit():
            continue
        # All-caps line → likely a heading
        if _RE_SUBSYSTEM.match(line):
            return line.title()
        # Known subsystem keyword in line
        lower = line.lower()
        for kw in _KNOWN_SUBSYSTEMS:
            if kw in lower and len(line) < 50:
                return line.title()
    return None


# ── Per-page parser ───────────────────────────────────────────────────────────


def _parse_page(
    page: "pdfplumber.page.Page",
    page_num: int,
    catalog_id: int,
    current_subsystem_id: Optional[int],
    session,
) -> Optional[int]:
    """
    Parse a single PDF page.  May insert new subsystem and/or parts rows.
    Returns the (possibly updated) current_subsystem_id.
    """
    text = page.extract_text() or ""

    # --- Subsystem detection -------------------------------------------------
    subsystem_name = _detect_subsystem(text)
    if subsystem_name:
        existing = (
            session.query(Subsystem)
            .filter_by(catalog_id=catalog_id, name=subsystem_name)
            .first()
        )
        if existing:
            current_subsystem_id = existing.id
        else:
            sub = Subsystem(
                catalog_id=catalog_id,
                name=subsystem_name,
                page_number=page_num,
            )
            session.add(sub)
            session.flush()  # get assigned id
            current_subsystem_id = sub.id

    # --- Parts table extraction -----------------------------------------------
    tables = page.extract_tables()
    for table in tables:
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
            # Strip non-English suffix if description contains multiple
            # languages separated by '/' or newlines (common in Ducati PDFs)
            if description:
                description = description.split("/")[0].split("\n")[0].strip()

            session.add(
                Part(
                    catalog_id=catalog_id,
                    subsystem_id=current_subsystem_id,
                    ref_number=_cell(row, col_map.get("ref")),
                    part_number=part_number,
                    description=description,
                    quantity=_cell(row, col_map.get("qty")),
                    page_number=page_num,
                )
            )

    return current_subsystem_id


# ── Catalog parser ────────────────────────────────────────────────────────────


def parse_catalog(catalog_id: int, pdf_path: Path):
    """Parse a single catalog PDF and persist parts to the DB."""
    log.info("  Parsing %s …", pdf_path.name)
    try:
        with get_session() as session:
            with pdfplumber.open(pdf_path) as pdf:
                log.info("    %d pages", len(pdf.pages))
                current_subsystem_id: Optional[int] = None

                for page_num, page in enumerate(pdf.pages, 1):
                    try:
                        current_subsystem_id = _parse_page(
                            page, page_num, catalog_id, current_subsystem_id, session
                        )
                    except Exception as exc:
                        log.warning("    Page %d error: %s", page_num, exc)

                session.flush()

            n_parts = session.query(Part).filter_by(catalog_id=catalog_id).count()
            n_sub   = session.query(Subsystem).filter_by(catalog_id=catalog_id).count()

            mark_parsed(session, catalog_id)
            session.commit()
            log.info("  ✓ %s → %d subsystems, %d parts", pdf_path.name, n_sub, n_parts)

    except Exception as exc:
        log.error("  ✗ Failed to parse %s: %s", pdf_path.name, exc)


# ── Main ──────────────────────────────────────────────────────────────────────


def run(reparse: bool = False):
    with get_session() as session:
        query = session.query(Catalog).filter(Catalog.local_path.isnot(None))
        if not reparse:
            query = query.filter(Catalog.parsed_at.is_(None))
        rows = query.all()

    if not rows:
        log.info("No catalogs pending parse.")
        return

    log.info("%d catalog(s) to parse.", len(rows))
    for row in rows:
        pdf_path = Path(row.local_path)
        if not pdf_path.exists():
            log.warning("File not found, skipping: %s", pdf_path)
            continue
        parse_catalog(row.id, pdf_path)

    log.info("Parser finished.")


if __name__ == "__main__":
    reparse_flag = "--reparse" in sys.argv
    run(reparse=reparse_flag)
