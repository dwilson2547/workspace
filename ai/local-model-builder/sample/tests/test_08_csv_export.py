from shelf.csvio import export_csv


def test_header_only(conn):
    assert export_csv(conn) == "title,kind,status,rating,notes,tags,created_at\n"


def test_rows_in_id_order(conn, make):
    a = make("Dune", rating=5, tags=["sf", "classic"], notes='says "hi", ok')
    b = make("Heat", kind="film", status="done")
    lines = export_csv(conn).split("\n")
    assert lines[0] == "title,kind,status,rating,notes,tags,created_at"
    assert lines[1] == f'Dune,book,planned,5,"says ""hi"", ok",classic;sf,{a.created_at}'
    assert lines[2] == f"Heat,film,done,,,,{b.created_at}"
    assert lines[3] == ""
