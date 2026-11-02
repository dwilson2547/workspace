def test_tags(client):
    assert client.get("/api/tags").json() == []
    client.post("/api/items", json={"title": "a", "kind": "book", "tags": ["x", "y"]})
    client.post("/api/items", json={"title": "b", "kind": "book", "tags": ["y"]})
    assert client.get("/api/tags").json() == [{"tag": "y", "count": 2}, {"tag": "x", "count": 1}]


def test_stats(client):
    client.post("/api/items", json={"title": "a", "kind": "film", "rating": 3})
    s = client.get("/api/stats").json()
    assert s["total"] == 1 and s["by_kind"]["film"] == 1 and s["by_status"]["planned"] == 1 and s["avg_rating"] == 3
