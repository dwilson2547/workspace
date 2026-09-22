"""Filesystem layout for the inventory tracker.

Everything is anchored at the project root (the directory containing `schema/`
and `store/`). Override with the INVENTORY_ROOT env var to point the CLI at a
different data location (useful for tests).
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(os.environ.get("INVENTORY_ROOT", Path(__file__).resolve().parent.parent))

SCHEMA_DIR = ROOT / "schema"
CATEGORIES_DIR = SCHEMA_DIR / "categories"
CORE_FILE = SCHEMA_DIR / "core.yaml"

STORE_DIR = ROOT / "store"
ITEMS_DIR = STORE_DIR / "items"
ORDERS_DIR = STORE_DIR / "orders"
DOCS_DIR = STORE_DIR / "docs"
MANUALS_DIR = STORE_DIR / "manuals"

VIEWS_DIR = ROOT / "views"
INDEX_DB = ROOT / "inventory.db"  # gitignored, rebuildable via `inv reindex`
CACHE_DIR = ROOT / ".cache"       # gitignored raw API responses (re-fetchable)

DIGIKEY_MAP = SCHEMA_DIR / "digikey_map.yaml"  # DigiKey CategoryId/ParameterId -> local schema
