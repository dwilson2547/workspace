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


async def test_import_creates_media_items_and_tasks(client, tmp_path):
    img = tmp_path / "photo.jpg"
    img.touch()

    r = await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    assert r.status_code == 200
    data = r.json()
    assert data["accepted"] == 1
    assert data["skipped"] == 0
    assert data["task_count"] == 4  # thumbnail, exif, face_detection, blip


async def test_import_skips_duplicate_paths(client, tmp_path):
    img = tmp_path / "photo.jpg"
    img.touch()

    await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    r = await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    data = r.json()
    assert data["skipped"] == 1
    assert data["accepted"] == 0


async def test_import_mixed_files(client, tmp_path):
    (tmp_path / "photo.jpg").touch()
    (tmp_path / "video.mp4").touch()
    (tmp_path / "document.pdf").touch()  # should be excluded

    r = await client.post("/libraries/test_lib/import/", json={"paths": [str(tmp_path)]})
    data = r.json()
    assert data["accepted"] == 2  # jpg + mp4 only
    assert data["task_count"] == 8  # 4 tasks per item
