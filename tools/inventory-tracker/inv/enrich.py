"""Enrichment: DigiKey product data -> reclassified, parametrized inventory items.

For each item, look up the DigiKey leaf category. If it's curated (in
digikey_map.yaml) we map selected ParameterIds onto clean keys and normalize
values numerically. Otherwise we auto-generate a provisional schema and store raw
values losslessly. The datasheet URL is recorded as a docs[] entry; the actual
PDF download is slice 4.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from . import normalize, paths, schema, schema_gen, store
from .digikey_api import DigiKeyClient, leaf_category
from .util import slugify


@dataclass
class EnrichResult:
    enriched: list[str] = field(default_factory=list)
    reclassified: dict[str, str] = field(default_factory=dict)   # id -> category
    provisional_categories: set[str] = field(default_factory=set)
    not_found: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def load_map() -> dict:
    if not paths.DIGIKEY_MAP.exists():
        return {"categories": {}, "params": {}}
    doc = yaml.safe_load(paths.DIGIKEY_MAP.read_text()) or {}
    doc.setdefault("categories", {})
    doc.setdefault("params", {})
    return doc


def _curated_params(product: dict, local_cat: str, dk_map: dict) -> dict:
    resolved = schema.resolve(local_cat)
    pmap = dk_map["params"].get(local_cat, {})
    out: dict = {}
    for p in product.get("Parameters", []):
        key = pmap.get(p.get("ParameterId"))
        if not key:
            continue  # param intentionally not curated for this category
        val = normalize.to_canonical(p.get("ValueText"), resolved.params.get(key, {}), key)
        if val is not None:
            out[key] = val
    return out


def _provisional_params(product: dict) -> dict:
    out: dict = {}
    for p in product.get("Parameters", []):
        key = slugify(p.get("ParameterText", ""))
        val = p.get("ValueText")
        if key and val not in (None, "", "-"):
            out[key] = val
    return out


def enrich_item(item: dict, product: dict, dk_map: dict) -> tuple[str, bool]:
    """Mutate `item` in place with enriched data. Returns (category, provisional)."""
    leaf = leaf_category(product) or {"id": None, "name": "unknown"}
    cid = leaf["id"]
    local_cat = dk_map["categories"].get(cid)
    provisional = local_cat is None

    if provisional:
        local_cat = schema_gen.ensure_provisional_schema(cid, leaf["name"], product.get("Parameters", []))
        params = _provisional_params(product)
    else:
        params = _curated_params(product, local_cat, dk_map)

    item["category"] = local_cat
    mfr = product.get("Manufacturer")
    if isinstance(mfr, dict) and mfr.get("Name"):
        item["manufacturer"] = mfr["Name"]
    desc = product.get("Description") or {}
    if desc.get("ProductDescription"):
        item["description"] = desc["ProductDescription"]
    item["params"] = params

    ds = product.get("DatasheetUrl")
    if ds:
        docs = item.setdefault("docs", [])
        if not any(d.get("kind") == "datasheet" for d in docs):
            docs.append({"kind": "datasheet", "url": ds, "source": "digikey"})

    item["enrichment"] = {
        "source": "digikey",
        "dk_category_id": cid,
        "dk_category": leaf["name"],
        "provisional": provisional,
    }
    return local_cat, provisional


def enrich_all(only_unclassified: bool = True, refresh: bool = False,
               limit: int | None = None) -> EnrichResult:
    client = DigiKeyClient()
    dk_map = load_map()
    res = EnrichResult()
    n = 0
    for old_path, item in list(store.iter_items()):
        if only_unclassified and item.get("category") != "unclassified":
            continue
        if limit is not None and n >= limit:
            break
        dk = (item.get("vendor_pns") or {}).get("digikey")
        if not dk:
            continue
        n += 1
        try:
            product = client.product_details(dk, refresh=refresh)
        except Exception as exc:  # network / API errors — report, keep going
            res.errors.append(f"{item['id']}: {exc}")
            continue
        if not product:
            res.not_found.append(item["id"])
            continue

        cat, provisional = enrich_item(item, product, dk_map)
        new_path = store.save_item(item)
        if new_path != old_path and Path(old_path).exists():
            Path(old_path).unlink()
        res.enriched.append(item["id"])
        res.reclassified[item["id"]] = cat
        if provisional:
            res.provisional_categories.add(cat)
    return res
