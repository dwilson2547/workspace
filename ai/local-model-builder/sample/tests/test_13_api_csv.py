def test_export(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "tags": ["sf"]})
    r = client.get("/api/export.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert r.text.startswith("title,kind,status,rating,notes,tags,created_at\nDune,book,planned,,,sf,")


def test_import(client):
    r = client.post("/api/import", content="title,kind\nDune,book\nHeat,film\n", headers={"content-type": "text/csv"})
    assert r.status_code == 200 and r.json() == {"imported": 2}
    assert len(client.get("/api/items").json()) == 2


def test_import_error(client):
    r = client.post("/api/import", content="title,kind\nBad,podcast\n", headers={"content-type": "text/csv"})
    assert r.status_code == 400 and r.json()["detail"].startswith("row 2")
    assert client.get("/api/items").json() == []
