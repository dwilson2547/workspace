"""Auto-generate provisional category schemas from the DigiKey parameter taxonomy.

When enrichment meets a leaf category with no curated mapping, we generate a
schema keyed by slugified DigiKey ParameterText (names come from DigiKey, not us),
typed as string so raw values are captured losslessly. It's stamped
`provisional: true` for later review/tightening via `inv schema pending`.
"""
from __future__ import annotations

import yaml

from . import paths, schema
from .util import slugify


def ensure_provisional_schema(category_id: int, category_name: str, parameters: list[dict]) -> str:
    """Create or extend the provisional schema for a DigiKey leaf category.

    Returns the local category name (slug of the DigiKey category name)."""
    local = slugify(category_name)
    path = paths.CATEGORIES_DIR / f"{local}.yaml"

    if path.exists():
        doc = yaml.safe_load(path.read_text()) or {}
        doc.setdefault("params", {})
    else:
        doc = {
            "category": local,
            "provisional": True,
            "dk_category_id": category_id,
            "label": category_name,
            "identifying": [],
            "params": {},
        }

    changed = not path.exists()
    for p in parameters:
        key = slugify(p.get("ParameterText", ""))
        if not key or key in doc["params"]:
            continue
        doc["params"][key] = {
            "type": "string",
            "dk_param_id": p.get("ParameterId"),
            "label": p.get("ParameterText"),
        }
        changed = True

    if changed:
        path.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True))
        schema.reload()
    return local
