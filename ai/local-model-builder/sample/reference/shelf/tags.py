import re
import sqlite3


def normalize_tag(tag: str) -> str:
    return re.sub(r"\s+", "-", tag.strip().lower())


def set_tags(conn: sqlite3.Connection, item_id: int, tags: list[str]) -> None:
    """Replace the item's tags with these (normalised, empty ones dropped, duplicates merged). Does not commit."""
    clean = sorted({t for t in (normalize_tag(x) for x in tags) if t})
    conn.execute("DELETE FROM item_tags WHERE item_id = ?", (item_id,))
    conn.executemany("INSERT INTO item_tags (item_id, tag) VALUES (?, ?)", [(item_id, t) for t in clean])


def get_tags(conn: sqlite3.Connection, item_id: int) -> list[str]:
    return [r[0] for r in conn.execute("SELECT tag FROM item_tags WHERE item_id = ? ORDER BY tag", (item_id,))]


def all_tags(conn: sqlite3.Connection) -> list[tuple[str, int]]:
    """Every tag in use with how many items carry it, most used first, then alphabetically."""
    rows = conn.execute("SELECT tag, COUNT(*) FROM item_tags GROUP BY tag ORDER BY COUNT(*) DESC, tag")
    return [(r[0], r[1]) for r in rows]
