import sqlite3
from datetime import datetime, timezone

from shelf.models import Item, ItemCreate, ItemUpdate
from shelf.tags import get_tags, normalize_tag, set_tags


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_item(conn: sqlite3.Connection, row) -> Item:
    return Item(id=row["id"], title=row["title"], kind=row["kind"], status=row["status"], rating=row["rating"],
                notes=row["notes"], tags=get_tags(conn, row["id"]), created_at=row["created_at"],
                updated_at=row["updated_at"])


def create_item(conn: sqlite3.Connection, data: ItemCreate) -> Item:
    now = _now()
    cur = conn.execute(
        "INSERT INTO items (title, kind, status, rating, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (data.title, data.kind.value, data.status.value, data.rating, data.notes, now, now))
    set_tags(conn, cur.lastrowid, data.tags)
    conn.commit()
    return get_item(conn, cur.lastrowid)


def get_item(conn: sqlite3.Connection, item_id: int) -> Item | None:
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return _row_to_item(conn, row) if row else None


def list_items(conn: sqlite3.Connection, status=None, kind=None, q: str | None = None,
               tag: str | None = None) -> list[Item]:
    sql, args = "SELECT * FROM items WHERE 1=1", []
    if status is not None:
        sql += " AND status = ?"
        args.append(getattr(status, "value", status))
    if kind is not None:
        sql += " AND kind = ?"
        args.append(getattr(kind, "value", kind))
    if q:
        sql += " AND (lower(title) LIKE ? OR lower(notes) LIKE ?)"
        args += [f"%{q.lower()}%"] * 2
    if tag:
        sql += " AND id IN (SELECT item_id FROM item_tags WHERE tag = ?)"
        args.append(normalize_tag(tag))
    sql += " ORDER BY created_at DESC, id DESC"
    return [_row_to_item(conn, r) for r in conn.execute(sql, args)]


def update_item(conn: sqlite3.Connection, item_id: int, data: ItemUpdate) -> Item | None:
    if get_item(conn, item_id) is None:
        return None
    fields = data.model_dump(exclude_unset=True)
    tags = fields.pop("tags", None)
    cols, args = [], []
    for k, v in fields.items():
        cols.append(f"{k} = ?")
        args.append(getattr(v, "value", v))
    cols.append("updated_at = ?")
    args.append(_now())
    conn.execute(f"UPDATE items SET {', '.join(cols)} WHERE id = ?", (*args, item_id))
    if tags is not None:
        set_tags(conn, item_id, tags)
    conn.commit()
    return get_item(conn, item_id)


def delete_item(conn: sqlite3.Connection, item_id: int) -> bool:
    cur = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    return cur.rowcount > 0
