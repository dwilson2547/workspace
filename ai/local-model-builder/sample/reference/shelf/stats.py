import sqlite3

from shelf.models import Kind, Status


def stats(conn: sqlite3.Connection) -> dict:
    by_status = {s.value: 0 for s in Status}
    by_kind = {k.value: 0 for k in Kind}
    for s, n in conn.execute("SELECT status, COUNT(*) FROM items GROUP BY status"):
        by_status[s] = n
    for k, n in conn.execute("SELECT kind, COUNT(*) FROM items GROUP BY kind"):
        by_kind[k] = n
    avg = conn.execute("SELECT AVG(rating) FROM items WHERE rating IS NOT NULL").fetchone()[0]
    return {"total": sum(by_status.values()), "by_status": by_status, "by_kind": by_kind,
            "avg_rating": round(avg, 2) if avg is not None else None}
