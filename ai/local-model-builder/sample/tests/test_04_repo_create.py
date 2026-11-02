import re

from shelf.models import Item, ItemCreate, Kind, Status
from shelf.repo import create_item, get_item

ISO = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$")


def test_create_returns_item(conn):
    it = create_item(conn, ItemCreate(title=" Dune ", kind="book", rating=5, notes="spice", tags=["SF", "classic"]))
    assert isinstance(it, Item)
    assert it.id == 1 and it.title == "Dune" and it.kind is Kind.book and it.status is Status.planned
    assert it.rating == 5 and it.notes == "spice" and it.tags == ["classic", "sf"]
    assert ISO.match(it.created_at) and it.updated_at == it.created_at


def test_get(conn):
    it = create_item(conn, ItemCreate(title="Heat", kind="film", status="done"))
    assert get_item(conn, it.id) == it
    assert get_item(conn, 999) is None


def test_create_commits_item_and_tags(conn, db_path):
    from shelf.db import connect
    it = create_item(conn, ItemCreate(title="a", kind="album", tags=["x", "y"]))
    other = connect(db_path)                       # the web app opens a new connection per request
    assert other.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 1
    assert get_item(other, it.id).tags == ["x", "y"]
