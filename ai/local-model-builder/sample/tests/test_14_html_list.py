def test_empty_page(client):
    r = client.get("/")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    assert "<title>shelf</title>" in r.text and 'action="/items"' in r.text and 'method="post"' in r.text


def test_lists_items_with_links_and_filters(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "status": "done"})
    client.post("/api/items", json={"title": "Heat <3", "kind": "film"})
    r = client.get("/")
    assert 'href="/items/1"' in r.text and "Dune" in r.text
    assert "Heat &lt;3" in r.text and "Heat <3" not in r.text
    r = client.get("/", params={"status": "done"})
    assert "Dune" in r.text and "Heat" not in r.text
    r = client.get("/", params={"q": "heat"})
    assert "Heat" in r.text and "Dune" not in r.text


def test_create_form(client):
    r = client.post("/items", content="title=Dune&kind=book&status=done&rating=5&tags=SF%2C+classic&notes=hi",
                    headers={"content-type": "application/x-www-form-urlencoded"}, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/items/1"
    it = client.get("/api/items/1").json()
    assert it["title"] == "Dune" and it["rating"] == 5 and it["tags"] == ["classic", "sf"] and it["notes"] == "hi"


def test_create_form_blank_rating_and_error(client):
    r = client.post("/items", content="title=Heat&kind=film&status=planned&rating=&tags=&notes=",
                    headers={"content-type": "application/x-www-form-urlencoded"}, follow_redirects=False)
    assert r.status_code == 303 and client.get("/api/items/1").json()["rating"] is None
    r = client.post("/items", content="title=+&kind=film", headers={"content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 400 and "title" in r.text and len(client.get("/api/items").json()) == 1
