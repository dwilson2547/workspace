import pytest

from shelf.csvio import export_csv, import_csv
from shelf.repo import list_items


def test_import_minimal_and_full(conn):
    text = ("title,kind,status,rating,notes,tags,created_at\n"
            "Dune,book,done,5,spice,SF;classic,2001-01-01T00:00:00+00:00\n"
            "\n"
            "Heat,film,,,,,\n")
    assert import_csv(conn, text) == 2
    items = {i.title: i for i in list_items(conn)}
    assert items["Dune"].status.value == "done" and items["Dune"].rating == 5 and items["Dune"].tags == ["classic", "sf"]
    assert items["Dune"].created_at != "2001-01-01T00:00:00+00:00"
    assert items["Heat"].status.value == "planned" and items["Heat"].rating is None


def test_missing_optional_columns(conn):
    assert import_csv(conn, "title,kind\nA,album\n") == 1


def test_bad_row_imports_nothing(conn):
    text = "title,kind\nGood,book\nBad,podcast\n"
    with pytest.raises(ValueError, match=r"^row 3"):
        import_csv(conn, text)
    assert list_items(conn) == []


def test_round_trip(conn, make):
    make("Dune", rating=5, tags=["sf"], notes="a, b")
    make("Heat", kind="film")
    text = export_csv(conn)
    conn.execute("DELETE FROM items")
    conn.commit()
    assert import_csv(conn, text) == 2
    assert sorted((i.title, i.rating, i.notes, tuple(i.tags)) for i in list_items(conn)) == \
        [("Dune", 5, "a, b", ("sf",)), ("Heat", None, "", ())]
