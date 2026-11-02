from shelf.tags import all_tags, get_tags, normalize_tag, set_tags


def _item(conn):
    conn.execute("INSERT INTO items (title, kind, status, created_at, updated_at) VALUES ('a','book','planned','t','t')")
    return conn.execute("SELECT max(id) FROM items").fetchone()[0]


def test_normalize():
    assert normalize_tag("  Science   Fiction ") == "science-fiction"
    assert normalize_tag("SF") == "sf"
    assert normalize_tag("   ") == ""


def test_set_and_get_sorted_unique(conn):
    i = _item(conn)
    set_tags(conn, i, ["Zeta", "alpha", "ALPHA", " ", "two words"])
    assert get_tags(conn, i) == ["alpha", "two-words", "zeta"]


def test_set_replaces(conn):
    i = _item(conn)
    set_tags(conn, i, ["a", "b"])
    set_tags(conn, i, ["c"])
    assert get_tags(conn, i) == ["c"]
    set_tags(conn, i, [])
    assert get_tags(conn, i) == []


def test_all_tags_counts(conn):
    a, b, c = _item(conn), _item(conn), _item(conn)
    set_tags(conn, a, ["x", "y"])
    set_tags(conn, b, ["y", "z"])
    set_tags(conn, c, ["y", "x"])
    assert all_tags(conn) == [("y", 3), ("x", 2), ("z", 1)]
