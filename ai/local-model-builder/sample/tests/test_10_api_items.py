def test_create_and_get(client):
    r = client.post("/api/items", json={"title": " Dune ", "kind": "book", "tags": ["SF"]})
    assert r.status_code == 201
    body = r.json()
    assert body["id"] == 1 and body["title"] == "Dune" and body["status"] == "planned" and body["tags"] == ["sf"]
    r = client.get("/api/items/1")
    assert r.status_code == 200 and r.json() == body


def test_get_missing(client):
    r = client.get("/api/items/9")
    assert r.status_code == 404 and r.json() == {"detail": "not found"}


def test_invalid_body(client):
    assert client.post("/api/items", json={"title": "", "kind": "book"}).status_code == 422
    assert client.post("/api/items", json={"title": "x", "kind": "podcast"}).status_code == 422


def test_list_and_filters(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "status": "done", "tags": ["sf"]})
    client.post("/api/items", json={"title": "Heat", "kind": "film", "notes": "Mann"})
    client.post("/api/items", json={"title": "Halo", "kind": "game", "tags": ["sf"]})
    titles = lambda r: [i["title"] for i in r.json()]
    assert titles(client.get("/api/items")) == ["Halo", "Heat", "Dune"]
    assert titles(client.get("/api/items", params={"status": "done"})) == ["Dune"]
    assert titles(client.get("/api/items", params={"kind": "film"})) == ["Heat"]
    assert titles(client.get("/api/items", params={"q": "mann"})) == ["Heat"]
    assert titles(client.get("/api/items", params={"tag": "SF"})) == ["Halo", "Dune"]
    assert client.get("/api/items", params={"status": "nope"}).status_code == 422


def test_each_request_uses_the_db_file(client, db_path):
    from shelf.db import connect
    client.post("/api/items", json={"title": "Dune", "kind": "book"})
    assert connect(db_path).execute("SELECT COUNT(*) FROM items").fetchone()[0] == 1
