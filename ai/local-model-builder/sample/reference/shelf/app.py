from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qs

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError

from shelf import csvio, repo
from shelf.db import connect, init_db
from shelf.models import ItemCreate, ItemUpdate, Kind, Status
from shelf.stats import stats
from shelf.tags import all_tags

TEMPLATES = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def _form_to_dict(body: bytes) -> dict:
    form = {k: v[0] for k, v in parse_qs(body.decode(), keep_blank_values=True).items()}
    data = {k: form[k] for k in ("title", "kind", "status", "notes") if k in form}
    if "rating" in form:
        data["rating"] = form["rating"].strip() or None
    if "tags" in form:
        data["tags"] = [t for t in form["tags"].split(",") if t.strip()]
    return data


def create_app(db_path: str) -> FastAPI:
    app = FastAPI(title="shelf")
    with _conn(db_path) as c:
        init_db(c)

    def page(request, name, ctx, status_code=200):
        return TEMPLATES.TemplateResponse(request, name, {"kinds": [k.value for k in Kind],
                                                          "statuses": [s.value for s in Status], **ctx},
                                          status_code=status_code)

    # -- JSON API ---------------------------------------------------------------------------------------------

    @app.post("/api/items", status_code=201)
    def api_create(data: ItemCreate):
        with _conn(db_path) as c:
            return repo.create_item(c, data)

    @app.get("/api/items")
    def api_list(status: Status | None = None, kind: Kind | None = None, q: str | None = None,
                 tag: str | None = None):
        with _conn(db_path) as c:
            return repo.list_items(c, status=status, kind=kind, q=q, tag=tag)

    @app.get("/api/items/{item_id}")
    def api_get(item_id: int):
        with _conn(db_path) as c:
            item = repo.get_item(c, item_id)
        if item is None:
            raise HTTPException(404, "not found")
        return item

    @app.patch("/api/items/{item_id}")
    def api_update(item_id: int, data: ItemUpdate):
        with _conn(db_path) as c:
            item = repo.update_item(c, item_id, data)
        if item is None:
            raise HTTPException(404, "not found")
        return item

    @app.delete("/api/items/{item_id}", status_code=204)
    def api_delete(item_id: int):
        with _conn(db_path) as c:
            if not repo.delete_item(c, item_id):
                raise HTTPException(404, "not found")
        return Response(status_code=204)

    @app.get("/api/tags")
    def api_tags():
        with _conn(db_path) as c:
            return [{"tag": t, "count": n} for t, n in all_tags(c)]

    @app.get("/api/stats")
    def api_stats():
        with _conn(db_path) as c:
            return stats(c)

    @app.get("/api/export.csv")
    def api_export():
        with _conn(db_path) as c:
            return PlainTextResponse(csvio.export_csv(c), media_type="text/csv")

    @app.post("/api/import")
    async def api_import(request: Request):
        text = (await request.body()).decode()
        with _conn(db_path) as c:
            try:
                n = csvio.import_csv(c, text)
            except ValueError as e:
                raise HTTPException(400, str(e))
        return {"imported": n}

    # -- HTML pages -------------------------------------------------------------------------------------------

    @app.get("/")
    def index(request: Request, status: str = "", kind: str = "", q: str = "", tag: str = ""):
        with _conn(db_path) as c:
            items = repo.list_items(c, status=status or None, kind=kind or None, q=q or None, tag=tag or None)
        return page(request, "list.html", {"items": items, "filters": {"status": status, "kind": kind, "q": q,
                                                                       "tag": tag}, "error": None})

    @app.post("/items")
    async def create_form(request: Request):
        try:
            data = ItemCreate(**_form_to_dict(await request.body()))
        except ValidationError as e:
            with _conn(db_path) as c:
                items = repo.list_items(c)
            err = "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors())
            return page(request, "list.html", {"items": items, "filters": {}, "error": err}, status_code=400)
        with _conn(db_path) as c:
            item = repo.create_item(c, data)
        return RedirectResponse(f"/items/{item.id}", status_code=303)

    @app.get("/items/{item_id}")
    def detail(request: Request, item_id: int):
        with _conn(db_path) as c:
            item = repo.get_item(c, item_id)
        if item is None:
            raise HTTPException(404, "not found")
        return page(request, "item.html", {"item": item, "error": None})

    @app.post("/items/{item_id}/edit")
    async def edit_form(request: Request, item_id: int):
        with _conn(db_path) as c:
            if repo.get_item(c, item_id) is None:
                raise HTTPException(404, "not found")
            try:
                data = ItemUpdate(**_form_to_dict(await request.body()))
            except ValidationError as e:
                err = "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors())
                return page(request, "item.html", {"item": repo.get_item(c, item_id), "error": err},
                            status_code=400)
            repo.update_item(c, item_id, data)
        return RedirectResponse(f"/items/{item_id}", status_code=303)

    @app.post("/items/{item_id}/delete")
    def delete_form(item_id: int):
        with _conn(db_path) as c:
            if not repo.delete_item(c, item_id):
                raise HTTPException(404, "not found")
        return RedirectResponse("/", status_code=303)

    return app


@contextmanager
def _conn(db_path: str):
    c = connect(db_path)
    try:
        yield c
    finally:
        c.close()
