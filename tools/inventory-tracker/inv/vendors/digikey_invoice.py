"""Deterministic parser for DigiKey ``SALESORDER_EMAIL*.pdf`` acknowledgements.

pdfplumber renders each line item as a predictable 4-line block::

    {line} {ordered} {avail} {backordered} PART: {pn} DESC: {desc} {unit} {amount}
    MFG : {manufacturer} / {mpn}
    COO : {coo} ECCN: {eccn} HTSUS: {htsus}
    ROHS... [{date}]
    [Section 301 Tariff {tariff}]     # optional, attaches to the item above

No network, no LLM — the format is regular enough to codify. Parametrics and the
authoritative category come later from the DigiKey API (slice 3); here we emit
the order record plus the core fields of each line item.
"""
from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

from ..util import parse_dk_date

# main line: qty columns, PART:, DESC:, then trailing unit-price (>=3 decimals)
# and amount (exactly 2 decimals). Non-greedy DESC so the two trailing decimals
# are captured even when the description itself contains numbers.
_LINE_RE = re.compile(
    r"^(?P<line>\d+)\s+(?P<ordered>\d+)\s+(?P<avail>\d+)\s+(?P<back>\d+)\s+"
    r"PART:\s*(?P<pn>\S+)\s+DESC:\s*(?P<desc>.+?)\s+"
    r"(?P<unit>\d+\.\d{3,6})\s+(?P<amount>\d+\.\d{2})\s*$"
)
_COO_RE = re.compile(r"^COO\s*:\s*(?P<coo>.+?)\s+ECCN:\s*(?P<eccn>\S+)\s+HTSUS:\s*(?P<htsus>\S+)")
_TARIFF_RE = re.compile(r"^Section 301 Tariff\s+(?P<amt>\d+\.\d+)\s*$")

_PO_RE = re.compile(r"PO Acknowledgement\s*(\d+)")
_ORDER_DATE_RE = re.compile(r"Order Date:\s*(\d{2}-[A-Z]{3}-\d{4})")
_CUSTOMER_RE = re.compile(r"Customer:\s*(\d+)")
_WEB_ORDER_RE = re.compile(r"WEB ORDER ID:\s*(\d+)")
_TOTALS = {
    "sales": re.compile(r"^Sales Amount\s+([\d.]+)"),
    "tariff": re.compile(r"^Estimated Tariff Amount\s+([\d.]+)"),
    "shipping": re.compile(r"^Shipping charges applied\s+([\d.]+)"),
    "tax": re.compile(r"^Sales Tax\s+([\d.]+)"),
    "total": re.compile(r"^Total\s+([\d.]+)\s*$"),  # not "Total Sales and ..."
}


def _clean_manufacturer(name: str) -> str:
    # DigiKey appends " (VA)" (value-add supplier marker) to some names.
    return re.sub(r"\s*\(VA\)\s*$", "", name).strip()


def _all_lines(pdf_path: str | Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines.extend(text.splitlines())
    return lines


def parse_invoice(pdf_path: str | Path) -> dict:
    """Return an order record: header/totals + a list of parsed line items."""
    lines = _all_lines(pdf_path)
    header: dict = {}
    totals: dict = {}
    items: list[dict] = []

    for raw in lines:
        line = raw.strip()

        if "po_number" not in header:
            m = _PO_RE.search(line)
            if m:
                header["po_number"] = m.group(1)
        if "order_date" not in header:
            m = _ORDER_DATE_RE.search(line)
            if m:
                d = parse_dk_date(m.group(1))
                header["order_date"] = d.isoformat() if d else m.group(1)
        if "customer" not in header:
            m = _CUSTOMER_RE.search(line)
            if m:
                header["customer"] = m.group(1)
        if "web_order_id" not in header:
            m = _WEB_ORDER_RE.search(line)
            if m:
                header["web_order_id"] = m.group(1)
        for key, rx in _TOTALS.items():
            if key not in totals:
                m = rx.match(line)
                if m:
                    totals[key] = float(m.group(1))

        m = _LINE_RE.match(line)
        if m:
            items.append(
                {
                    "line": int(m["line"]),
                    "digikey_pn": m["pn"],
                    "description": m["desc"].strip(),
                    "qty_ordered": int(m["ordered"]),
                    "qty_backordered": int(m["back"]),
                    "unit_price": float(m["unit"]),
                    "amount": float(m["amount"]),
                    "manufacturer": None,
                    "mpn": None,
                    "coo": None,
                    "tariff": None,
                }
            )
            continue

        if line.startswith("MFG :") and items and items[-1]["mpn"] is None:
            body = line[len("MFG :"):].strip()
            if " / " in body:
                mfr, mpn = body.rsplit(" / ", 1)
            else:
                mfr, mpn = body, ""
            items[-1]["manufacturer"] = _clean_manufacturer(mfr)
            items[-1]["mpn"] = mpn.strip()
            continue

        m = _COO_RE.match(line)
        if m and items:
            items[-1]["coo"] = m["coo"].strip()
            continue

        m = _TARIFF_RE.match(line)
        if m and items:
            items[-1]["tariff"] = float(m["amt"])
            continue

    return {
        "vendor": "digikey",
        "po_number": header.get("po_number"),
        "web_order_id": header.get("web_order_id"),
        "customer": header.get("customer"),
        "order_date": header.get("order_date"),
        "currency": "USD",
        "totals": totals,
        "source_pdf": Path(pdf_path).name,
        "line_items": items,
    }
