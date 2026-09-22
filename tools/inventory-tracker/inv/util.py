"""Small shared helpers."""
from __future__ import annotations

import re
from datetime import date, datetime


def slugify(text: str) -> str:
    """Lower-case slug: runs of non-alphanumerics collapse to single hyphens."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_dk_date(text: str) -> date | None:
    """DigiKey dates look like '02-DEC-2025'. Python's %b is case-insensitive but
    title-casing keeps it robust across platforms."""
    try:
        return datetime.strptime(text.strip().title(), "%d-%b-%Y").date()
    except ValueError:
        return None
