"""Shared models and DB helpers for the motorcycle parts reference scrapers.

All OEM scrapers under automotive/motorcycles/ write to one `motorcycle_parts`
Postgres database through this package, mirroring how the gyopart junkyard
scrapers share junkyard_common + the junkyard_inventory database.
"""

from .db import get_engine, get_session_factory, init_db
from .models import (
    Base,
    Diagram,
    DiagramPart,
    Image,
    Motorcycle,
    Part,
    PartCategory,
    motorcycle_diagrams,
    motorcycle_parts,
)

__all__ = [
    "Base",
    "Diagram",
    "DiagramPart",
    "Image",
    "Motorcycle",
    "Part",
    "PartCategory",
    "get_engine",
    "get_session_factory",
    "init_db",
    "motorcycle_diagrams",
    "motorcycle_parts",
]
