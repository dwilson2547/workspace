from shelf.stats import stats


def test_empty(conn):
    assert stats(conn) == {"total": 0,
                           "by_status": {"planned": 0, "active": 0, "done": 0, "dropped": 0},
                           "by_kind": {"book": 0, "film": 0, "game": 0, "album": 0},
                           "avg_rating": None}


def test_counts_and_average(conn, make):
    make("a", status="done", rating=5)
    make("b", kind="film", status="done", rating=4)
    make("c", kind="film", rating=4)
    make("d", kind="game", status="dropped")
    s = stats(conn)
    assert s["total"] == 4
    assert s["by_status"] == {"planned": 1, "active": 0, "done": 2, "dropped": 1}
    assert s["by_kind"] == {"book": 1, "film": 2, "game": 1, "album": 0}
    assert s["avg_rating"] == 4.33
