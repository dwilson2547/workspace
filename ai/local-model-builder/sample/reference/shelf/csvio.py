import csv
import io
import sqlite3

from pydantic import ValidationError

from shelf.models import ItemCreate
from shelf.repo import create_item

COLUMNS = ["title", "kind", "status", "rating", "notes", "tags", "created_at"]


def export_csv(conn: sqlite3.Connection) -> str:
    from shelf.tags import get_tags
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(COLUMNS)
    for r in conn.execute("SELECT * FROM items ORDER BY id"):
        w.writerow([r["title"], r["kind"], r["status"], "" if r["rating"] is None else r["rating"], r["notes"],
                    ";".join(get_tags(conn, r["id"])), r["created_at"]])
    return out.getvalue()


def import_csv(conn: sqlite3.Connection, text: str) -> int:
    rows = []
    for n, rec in enumerate(csv.DictReader(io.StringIO(text)), start=2):
        if not any((v or "").strip() for v in rec.values()):
            continue
        data = {"title": rec.get("title") or "", "kind": rec.get("kind") or ""}
        if (rec.get("status") or "").strip():
            data["status"] = rec["status"].strip()
        if (rec.get("rating") or "").strip():
            data["rating"] = rec["rating"].strip()
        data["notes"] = rec.get("notes") or ""
        data["tags"] = [t for t in (rec.get("tags") or "").split(";") if t.strip()]
        try:
            rows.append(ItemCreate(**data))
        except ValidationError as e:
            raise ValueError(f"row {n}: {e.errors()[0]['msg']}") from None
    for item in rows:
        create_item(conn, item)
    return len(rows)
