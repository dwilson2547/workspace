import sqlite3

from shelf.db import connect, init_db


def test_connect_returns_rows_by_name(db_path):
    c = connect(db_path)
    assert c.row_factory is sqlite3.Row
    assert c.execute("SELECT 1 AS one").fetchone()["one"] == 1


def test_foreign_keys_on(db_path):
    assert connect(db_path).execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_init_creates_tables_and_is_idempotent(db_path):
    c = connect(db_path)
    init_db(c)
    init_db(c)
    names = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"items", "item_tags"} <= names
    cols = [r[1] for r in c.execute("PRAGMA table_info(items)")]
    assert cols == ["id", "title", "kind", "status", "rating", "notes", "created_at", "updated_at"]


def test_cascade_delete(db_path):
    c = connect(db_path)
    init_db(c)
    c.execute("INSERT INTO items (title, kind, status, created_at, updated_at) VALUES ('a','book','planned','t','t')")
    c.execute("INSERT INTO item_tags (item_id, tag) VALUES (1, 'x')")
    c.execute("DELETE FROM items WHERE id = 1")
    assert c.execute("SELECT COUNT(*) FROM item_tags").fetchone()[0] == 0
    assert c.execute("SELECT notes FROM items").fetchone() is None
