def test_detail(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "rating": 4, "tags": ["sf"], "notes": "spice <b>"})
    r = client.get("/items/1")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    assert "<title>Dune - shelf</title>" in r.text
    assert "spice &lt;b&gt;" in r.text and "sf" in r.text
    assert 'action="/items/1/edit"' in r.text and 'action="/items/1/delete"' in r.text


def test_detail_missing(client):
    assert client.get("/items/5").status_code == 404
