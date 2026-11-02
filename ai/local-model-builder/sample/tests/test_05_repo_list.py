from shelf.models import Kind, Status
from shelf.repo import list_items


def test_newest_first(conn, make):
    a, b, c = make("a"), make("b"), make("c")
    assert [i.title for i in list_items(conn)] == ["c", "b", "a"]


def test_filters(conn, make):
    make("Dune", kind="book", status="done", tags=["sf"])
    make("Heat", kind="film", status="done", notes="Mann classic")
    make("Halo", kind="game", status="active", tags=["sf", "shooter"])
    assert [i.title for i in list_items(conn, status=Status.done)] == ["Heat", "Dune"]
    assert [i.title for i in list_items(conn, status="active")] == ["Halo"]
    assert [i.title for i in list_items(conn, kind=Kind.film)] == ["Heat"]
    assert [i.title for i in list_items(conn, kind="book", status="done")] == ["Dune"]


def test_search_title_and_notes_case_insensitive(conn, make):
    make("Dune")
    make("Heat", notes="MANN classic")
    make("Dunkirk", kind="film")
    assert [i.title for i in list_items(conn, q="dun")] == ["Dunkirk", "Dune"]
    assert [i.title for i in list_items(conn, q="mann")] == ["Heat"]


def test_tag_filter_normalises(conn, make):
    make("Dune", tags=["Science Fiction"])
    make("Heat", kind="film")
    assert [i.title for i in list_items(conn, tag="science fiction")] == ["Dune"]
    assert list_items(conn, tag="nope") == []
