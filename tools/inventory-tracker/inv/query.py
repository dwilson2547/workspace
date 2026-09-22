"""Parametric search and "alternatives you already own".

`search` filters items by category and constraint expressions ("resistance>=10000",
"package~TO-220"). `alternatives` uses a category's `identifying` params to rank
other owned items that could substitute for a given part.
"""
from __future__ import annotations

import operator
import re

from . import schema, store

_OPS = {">=": operator.ge, "<=": operator.le, "!=": operator.ne,
        ">": operator.gt, "<": operator.lt, "=": operator.eq}
_CONSTRAINT_RE = re.compile(r"^([\w-]+)\s*(>=|<=|!=|~|=|>|<)\s*(.+)$")


def _as_number(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _field(item: dict, key: str):
    """Look up a key in params first, then a few core fields."""
    params = item.get("params") or {}
    if key in params:
        return params[key]
    if key in ("manufacturer", "mpn", "description", "id"):
        return item.get(key)
    return None


def _satisfies(value, op: str, target: str) -> bool:
    if value is None:
        return False
    if op == "~":
        return target.lower() in str(value).lower()
    vn, tn = _as_number(value), _as_number(target)
    if vn is not None and tn is not None:
        return _OPS[op](vn, tn)
    # string comparison for = / !=
    if op == "=":
        return str(value).lower() == target.lower()
    if op == "!=":
        return str(value).lower() != target.lower()
    return False


def search(category: str | None, constraints: list[str]) -> list[dict]:
    parsed = []
    for c in constraints:
        m = _CONSTRAINT_RE.match(c)
        if not m:
            raise ValueError(f"bad constraint: {c!r} (expected key<op>value, op in >= <= = != > < ~)")
        parsed.append((m.group(1), m.group(2), m.group(3).strip()))

    hits = []
    for _, item in store.iter_items():
        if category and item.get("category") != category:
            continue
        if all(_satisfies(_field(item, k), op, t) for k, op, t in parsed):
            hits.append(item)
    return hits


def _values_match(a, b) -> bool:
    an, bn = _as_number(a), _as_number(b)
    if an is not None and bn is not None:
        if an == bn:
            return True
        scale = max(abs(an), abs(bn), 1e-9)
        return abs(an - bn) / scale <= 0.01     # 1% tolerance for numeric params
    return str(a).lower() == str(b).lower()


def alternatives(item_id: str):
    """Return (item, identifying, ranked) where ranked is a list of
    (matches, total, other_item, differing_keys), best first."""
    found = store.get_item(item_id)
    if not found:
        return None
    _, item = found
    cat = item.get("category")
    identifying = schema.resolve(cat).identifying if cat else []
    base = item.get("params") or {}

    ranked = []
    for _, other in store.iter_items():
        if other.get("id") == item_id or other.get("category") != cat:
            continue
        other_params = other.get("params") or {}
        matches, diffs = 0, []
        for k in identifying:
            if _values_match(base.get(k), other_params.get(k)):
                matches += 1
            else:
                diffs.append(k)
        ranked.append((matches, len(identifying), other, diffs))
    ranked.sort(key=lambda r: -r[0])
    return item, identifying, ranked
