"""Category schema loading, `extends` resolution, and item validation.

The schema registry is what keeps the `params` block standardized: allowed keys
are declared per category (not invented per part), and `validate_item` rejects
anything off-schema on write. Category schemas may `extends` an abstract base;
params merge down the chain with the child winning on key conflicts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import yaml

from . import paths


@dataclass
class ResolvedCategory:
    name: str
    abstract: bool
    params: dict[str, dict]          # merged param specs, key -> {type, unit, values, required, ...}
    identifying: list[str]           # params that define part identity (dedup / alternatives)
    chain: list[str]                 # resolution order, base -> leaf
    provisional: bool = False        # auto-generated from DigiKey, awaiting review


def _read_yaml(path) -> dict:
    with open(path) as fh:
        return yaml.safe_load(fh) or {}


@lru_cache(maxsize=1)
def load_core() -> dict:
    return _read_yaml(paths.CORE_FILE)


@lru_cache(maxsize=1)
def _raw_categories() -> dict[str, dict]:
    raw: dict[str, dict] = {}
    for path in sorted(paths.CATEGORIES_DIR.glob("*.yaml")):
        data = _read_yaml(path)
        name = data.get("category") or path.stem
        data.setdefault("category", name)
        raw[name] = data
    return raw


def resolve(name: str, _seen: tuple[str, ...] = ()) -> ResolvedCategory:
    """Resolve a category's full param set by walking its `extends` chain."""
    raw = _raw_categories()
    if name not in raw:
        raise KeyError(f"unknown category: {name!r}")
    if name in _seen:
        raise ValueError(f"circular extends: {' -> '.join([*_seen, name])}")

    node = raw[name]
    parent_name = node.get("extends")
    if parent_name:
        parent = resolve(parent_name, (*_seen, name))
        params = dict(parent.params)
        identifying = list(parent.identifying)
        chain = [*parent.chain]
    else:
        params, identifying, chain = {}, [], []

    params.update(node.get("params") or {})
    # child identifying list, if given, is authoritative for the leaf
    identifying = node.get("identifying", identifying)
    chain = [*chain, name]
    return ResolvedCategory(
        name=name,
        abstract=bool(node.get("abstract", False)),
        params=params,
        identifying=list(identifying),
        chain=chain,
        provisional=bool(node.get("provisional", False)),
    )


def all_categories() -> dict[str, ResolvedCategory]:
    return {name: resolve(name) for name in _raw_categories()}


def reload() -> None:
    """Drop cached schema files (call after generating a new category schema)."""
    _raw_categories.cache_clear()
    load_core.cache_clear()


def provisional_categories() -> list[str]:
    return [name for name, node in _raw_categories().items() if node.get("provisional")]


# --- validation ------------------------------------------------------------

def _type_ok(value: Any, spec: dict) -> bool:
    t = spec.get("type", "string")
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "boolean":
        return isinstance(value, bool)
    if t == "enum":
        return value in (spec.get("values") or [])
    if t in ("map",):
        return isinstance(value, dict)
    if t in ("list",):
        return isinstance(value, list)
    return isinstance(value, str)  # string / default


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def validate_item(item: dict) -> ValidationResult:
    core = load_core()
    res = ValidationResult()

    # --- core fields ---
    core_fields = core.get("core_fields", {})
    for name, spec in core_fields.items():
        if spec.get("required") and item.get(name) in (None, ""):
            res.errors.append(f"missing required core field: {name}")
        if name in item and item[name] is not None and not _type_ok(item[name], spec):
            res.errors.append(f"core field {name!r} has wrong type (want {spec.get('type')})")

    item_type = item.get("type")
    if item_type is not None and item_type not in core.get("item_types", []):
        res.errors.append(f"type {item_type!r} not in {core.get('item_types')}")

    # --- category + params ---
    category = item.get("category")
    if not category:
        return res  # already flagged as missing core field
    try:
        cat = resolve(category)
    except (KeyError, ValueError) as exc:
        res.errors.append(str(exc))
        return res
    if cat.abstract:
        res.errors.append(f"category {category!r} is abstract; use a concrete subtype")
        return res

    params = item.get("params") or {}
    for pname, pspec in cat.params.items():
        if pspec.get("required") and pname not in params:
            res.errors.append(f"missing required param: {pname}")
    for pname, pvalue in params.items():
        if pname not in cat.params:
            # unknown params are quarantined, not silently accepted -> review queue
            res.warnings.append(f"unknown param {pname!r} for category {category!r} (pending review)")
            continue
        if pvalue is not None and not _type_ok(pvalue, cat.params[pname]):
            res.errors.append(
                f"param {pname!r} has wrong type (want {cat.params[pname].get('type')})"
            )

    # --- docs kinds ---
    doc_kinds = core.get("doc_kinds", [])
    for doc in item.get("docs") or []:
        if isinstance(doc, dict) and doc.get("kind") and doc["kind"] not in doc_kinds:
            res.warnings.append(f"doc kind {doc['kind']!r} not in {doc_kinds}")

    return res
