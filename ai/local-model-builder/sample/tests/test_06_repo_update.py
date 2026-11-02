import time

from shelf.models import ItemUpdate, Status
from shelf.repo import delete_item, get_item, update_item


def test_partial_update(conn, make):
    it = make("Dune", rating=4, notes="n", tags=["sf"])
    time.sleep(1.1)
    up = update_item(conn, it.id, ItemUpdate(status="done", rating=5))
    assert up.status is Status.done and up.rating == 5
    assert up.title == "Dune" and up.notes == "n" and up.tags == ["sf"]
    assert up.created_at == it.created_at and up.updated_at > it.updated_at


def test_update_tags_and_title(conn, make):
    it = make("Dune", tags=["sf"])
    up = update_item(conn, it.id, ItemUpdate(title=" Dune Messiah ", tags=["Sequel", "sf"]))
    assert up.title == "Dune Messiah" and up.tags == ["sequel", "sf"]
    assert get_item(conn, it.id) == up


def test_update_missing(conn):
    assert update_item(conn, 42, ItemUpdate(title="x")) is None


def test_delete(conn, make):
    it = make("Dune", tags=["sf"])
    assert delete_item(conn, it.id) is True
    assert get_item(conn, it.id) is None
    assert conn.execute("SELECT COUNT(*) FROM item_tags").fetchone()[0] == 0
    assert delete_item(conn, it.id) is False
