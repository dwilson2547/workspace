FORM = {"content-type": "application/x-www-form-urlencoded"}


def test_edit(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "tags": ["sf"]})
    r = client.post("/items/1/edit", content="title=Dune+Messiah&kind=book&status=done&rating=3&tags=sf%2Csequel&notes=x",
                    headers=FORM, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/items/1"
    it = client.get("/api/items/1").json()
    assert it["title"] == "Dune Messiah" and it["status"] == "done" and it["rating"] == 3 and it["tags"] == ["sequel", "sf"]


def test_edit_clears_rating_and_rejects_bad(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book", "rating": 4})
    client.post("/items/1/edit", content="title=Dune&kind=book&status=planned&rating=&tags=&notes=", headers=FORM)
    assert client.get("/api/items/1").json()["rating"] is None
    r = client.post("/items/1/edit", content="title=Dune&kind=book&rating=9", headers=FORM)
    assert r.status_code == 400 and "rating" in r.text
    assert client.post("/items/7/edit", content="title=x", headers=FORM).status_code == 404


def test_delete(client):
    client.post("/api/items", json={"title": "Dune", "kind": "book"})
    r = client.post("/items/1/delete", headers=FORM, follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/"
    assert client.get("/api/items/1").status_code == 404
    assert client.post("/items/1/delete", headers=FORM).status_code == 404
