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


async def test_create_and_list_library(client):
    r = await client.post("/libraries/", json={"name": "Vacation 2024"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Vacation 2024"
    assert isinstance(data["id"], int)
    assert "created_at" in data
    assert data["last_accessed_at"] is None

    r = await client.get("/libraries/")
    assert len(r.json()) == 1


async def test_duplicate_name_rejected(client):
    await client.post("/libraries/", json={"name": "Photos"})
    r = await client.post("/libraries/", json={"name": "Photos"})
    assert r.status_code == 409


async def test_delete_library(client):
    r = await client.post("/libraries/", json={"name": "To Delete"})
    lib_id = r.json()["id"]
    r = await client.delete(f"/libraries/{lib_id}")
    assert r.status_code == 204
    r = await client.get("/libraries/")
    assert len(r.json()) == 0


async def test_delete_nonexistent_library(client):
    r = await client.delete("/libraries/999")
    assert r.status_code == 404


async def test_open_library_initializes_db(client, tmp_path, monkeypatch):
    import api.libraries as libraries_module
    from unittest.mock import AsyncMock

    lib_name = f"lib_{tmp_path.name}"

    # Create the library in the global DB first
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201

    # Ensure the library DB is not yet initialized
    from db import library_db
    assert lib_name not in library_db._sessions

    # Clear any leftover active runners and patch run_loop with a coroutine mock
    monkeypatch.setattr(libraries_module, "_active_runners", set())
    mock_run_loop = AsyncMock(return_value=None)
    monkeypatch.setattr(libraries_module.queue_runner, "run_loop", mock_run_loop)

    r = await client.post(f"/libraries/{lib_name}/open")
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    # After opening, the library DB should be initialized
    assert lib_name in library_db._sessions

    # run_loop should have been called once with the correct args
    mock_run_loop.assert_called_once_with(lib_name, str(tmp_path))


async def test_open_library_idempotent(client, tmp_path, monkeypatch):
    import asyncio
    import api.libraries as libraries_module
    from unittest.mock import AsyncMock, patch

    lib_name = f"lib_{tmp_path.name}"

    # Create the library in the global DB first
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201

    # Clear any leftover active runners
    monkeypatch.setattr(libraries_module, "_active_runners", set())

    # Patch _run_and_cleanup with a coroutine that never finishes during the
    # test so that the name stays in _active_runners across both requests,
    # proving the idempotency guard works.
    never_done = asyncio.Event()

    async def _hanging_cleanup(library_name: str, data_root: str) -> None:
        await never_done.wait()

    monkeypatch.setattr(libraries_module, "_run_and_cleanup", _hanging_cleanup)

    # Call the endpoint twice
    r1 = await client.post(f"/libraries/{lib_name}/open")
    r2 = await client.post(f"/libraries/{lib_name}/open")

    assert r1.status_code == 200
    assert r2.status_code == 200

    # The runner name should still be in _active_runners (task has not finished)
    assert lib_name in libraries_module._active_runners

    # Signal the hanging task to finish so the event loop can clean up
    never_done.set()


async def test_open_nonexistent_library_returns_404(client):
    r = await client.post("/libraries/does-not-exist/open")
    assert r.status_code == 404
    assert r.json()["detail"] == "Library not found"
