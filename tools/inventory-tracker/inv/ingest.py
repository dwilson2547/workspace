"""Ingest orchestration: invoice PDF -> order record + upserted item stubs.

Stubs land in the ``unclassified`` category with an empty ``params`` block; the
authoritative category and parametrics are filled by enrichment (slice 3), so we
never guess a category we'd only have to correct. Re-ingesting the same order is
idempotent: an already-recorded purchase is skipped, so quantities don't
double-count.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from . import store
from .util import slugify
from .vendors import digikey_invoice


@dataclass
class IngestResult:
    order_id: str
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    order_path: Path | None = None


def _stub_from_line(item: dict, order_id: str, order_date: str | None) -> dict:
    purchase = {
        "order": order_id,
        "date": order_date,
        "qty": item["qty_ordered"],
        "unit_price": item["unit_price"],
    }
    return {
        "id": slugify(item["mpn"] or item["digikey_pn"]),
        "type": "component",
        "category": "unclassified",
        "description": item["description"],
        "manufacturer": item["manufacturer"],
        "mpn": item["mpn"],
        "vendor_pns": {"digikey": item["digikey_pn"]},
        "qty": item["qty_ordered"],
        "purchases": [purchase],
    }


def _merge_purchase(existing: dict, purchase: dict) -> bool:
    """Append a purchase idempotently; bump on-hand qty only for a new one."""
    purchases = existing.setdefault("purchases", [])
    if any(p.get("order") == purchase.get("order") for p in purchases):
        return False
    purchases.append(purchase)
    existing["qty"] = (existing.get("qty") or 0) + (purchase.get("qty") or 0)
    return True


def ingest_invoice(pdf_path: str | Path, dry_run: bool = False) -> tuple[dict, IngestResult]:
    order = digikey_invoice.parse_invoice(pdf_path)
    order_id = f"{order['vendor']}-{order['po_number']}"
    order["id"] = order_id
    result = IngestResult(order_id=order_id)

    for line in order["line_items"]:
        stub = _stub_from_line(line, order_id, order["order_date"])
        found = store.find_item_by_part(line["mpn"], line["digikey_pn"])
        if found is None:
            result.created.append(stub["id"])
            if not dry_run:
                store.save_item(stub)
        else:
            path, existing = found
            changed = _merge_purchase(existing, stub["purchases"][0])
            if changed:
                result.updated.append(existing["id"])
                if not dry_run:
                    store.save_item(existing)
            else:
                result.unchanged.append(existing["id"])

    if not dry_run:
        result.order_path = store.save_order(order)
    return order, result
