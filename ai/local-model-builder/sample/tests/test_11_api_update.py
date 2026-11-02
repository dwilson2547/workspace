def _new(client, **kw):
    return client.post("/api/items", json={"title": "Dune", "kind": "book", **kw}).json()


def test_patch(client):
    it = _new(client, tags=["sf"])
    r = client.patch(f"/api/items/{it['id']}", json={"status": "done", "rating": 5})
    assert r.status_code == 200
    assert r.json()["status"] == "done" and r.json()["rating"] == 5 and r.json()["tags"] == ["sf"]
    assert client.get(f"/api/items/{it['id']}").json()["rating"] == 5


def test_patch_invalid_and_missing(client):
    it = _new(client)
    assert client.patch(f"/api/items/{it['id']}", json={"rating": 7}).status_code == 422
    r = client.patch("/api/items/99", json={"title": "x"})
    assert r.status_code == 404 and r.json() == {"detail": "not found"}


def test_delete(client):
    it = _new(client)
    r = client.delete(f"/api/items/{it['id']}")
    assert r.status_code == 204 and r.content == b""
    assert client.get(f"/api/items/{it['id']}").status_code == 404
    assert client.delete(f"/api/items/{it['id']}").status_code == 404
