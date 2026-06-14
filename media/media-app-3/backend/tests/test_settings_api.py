import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setenv("MEDIA_APP_DATA_ROOT", str(tmp_path))
    from db import global_db
    global_db._engine = None
    global_db._SessionLocal = None
    from db.global_db import init_global_db
    init_global_db(tmp_path)
    yield
    from db import global_db as gdb
    if gdb._engine:
        gdb._engine.dispose()
    gdb._engine = None
    gdb._SessionLocal = None


@pytest.fixture
async def client(use_tmp_data):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_set_and_get_setting(client):
    r = await client.put("/settings/data_root", json={"value": "/some/path"})
    assert r.status_code == 200
    r = await client.get("/settings/data_root")
    assert r.json()["value"] == "/some/path"


async def test_missing_setting_returns_404(client):
    r = await client.get("/settings/nonexistent")
    assert r.status_code == 404
