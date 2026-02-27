import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from main import app
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem


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


def seed_library(tmp_path, lib_name, count=5):
    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        for i in range(count):
            db.add(MediaItem(file_path=f"/photos/{i}.jpg", file_name=f"{i}.jpg", media_type="image"))
        db.commit()
    finally:
        gen.close()


async def test_pagination(client, tmp_path):
    lib_name = f"lib_{tmp_path.name}"
    seed_library(tmp_path, lib_name, count=5)

    r = await client.get(f"/libraries/{lib_name}/media/?limit=3")
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) == 3
    assert data["next_cursor"] is not None

    r2 = await client.get(f"/libraries/{lib_name}/media/?limit=3&cursor={data['next_cursor']}")
    data2 = r2.json()
    assert len(data2["items"]) == 2
    assert data2["next_cursor"] is None


async def test_get_single_item(client, tmp_path):
    lib_name = f"lib2_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path="/photos/a.jpg", file_name="a.jpg", media_type="image")
        db.add(item)
        db.commit()
        item_id = item.id
    finally:
        gen.close()

    r = await client.get(f"/libraries/{lib_name}/media/{item_id}")
    assert r.status_code == 200
    assert r.json()["file_name"] == "a.jpg"

    r2 = await client.get(f"/libraries/{lib_name}/media/9999")
    assert r2.status_code == 404


async def test_missing_items_excluded(client, tmp_path):
    lib_name = f"lib3_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        db.add(MediaItem(file_path="/a.jpg", file_name="a.jpg", media_type="image", is_missing=False))
        db.add(MediaItem(file_path="/b.jpg", file_name="b.jpg", media_type="image", is_missing=True))
        db.commit()
    finally:
        gen.close()

    r = await client.get(f"/libraries/{lib_name}/media/")
    data = r.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["file_name"] == "a.jpg"


async def test_get_media_faces_nonexistent(client, tmp_path):
    lib_name = f"lib_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    r = await client.get(f"/libraries/{lib_name}/media/9999/faces")
    assert r.status_code == 404


async def test_get_media_faces_empty(client, tmp_path):
    """GET /libraries/{name}/media/{id}/faces returns [] when media item has no faces."""
    lib_name = f"lib_faces_{tmp_path.name}"
    init_library_db(tmp_path, lib_name)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(file_path="/photos/face_test.jpg", file_name="face_test.jpg", media_type="image")
        db.add(item)
        db.commit()
        item_id = item.id
    finally:
        gen.close()

    r = await client.get(f"/libraries/{lib_name}/media/{item_id}/faces")
    assert r.status_code == 200
    assert r.json() == []


async def test_check_missing_file_exists(client, tmp_path):
    """Files that exist on disk → is_missing stays False, updated = 0."""
    lib_name = f"lib_cm1_{tmp_path.name}"
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201
    init_library_db(tmp_path, lib_name)

    # Create a real file on disk
    real_file = tmp_path / "exists.jpg"
    real_file.write_bytes(b"fake image data")

    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(
            file_path=str(real_file),
            file_name="exists.jpg",
            media_type="image",
            is_missing=False,
        )
        db.add(item)
        db.commit()
    finally:
        gen.close()

    r = await client.post(f"/libraries/{lib_name}/check-missing")
    assert r.status_code == 200
    data = r.json()
    assert data["updated"] == 0

    # Verify DB state unchanged
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        items = db.scalars(select(MediaItem)).all()
        assert len(items) == 1
        assert items[0].is_missing is False
    finally:
        gen.close()


async def test_check_missing_file_absent(client, tmp_path):
    """Files that do not exist on disk → is_missing set to True, updated = 1."""
    lib_name = f"lib_cm2_{tmp_path.name}"
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201
    init_library_db(tmp_path, lib_name)

    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(
            file_path="/nonexistent/path/photo.jpg",
            file_name="photo.jpg",
            media_type="image",
            is_missing=False,
        )
        db.add(item)
        db.commit()
    finally:
        gen.close()

    r = await client.post(f"/libraries/{lib_name}/check-missing")
    assert r.status_code == 200
    data = r.json()
    assert data["updated"] == 1

    # Verify DB state updated
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        items = db.scalars(select(MediaItem)).all()
        assert len(items) == 1
        assert items[0].is_missing is True
    finally:
        gen.close()


async def test_check_missing_file_restored(client, tmp_path):
    """After file is restored to disk, calling check-missing resets is_missing to False."""
    lib_name = f"lib_cm3_{tmp_path.name}"
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201
    init_library_db(tmp_path, lib_name)

    real_file = tmp_path / "restored.jpg"
    real_file.write_bytes(b"fake image data")

    # Seed with is_missing=True (as if file was previously flagged missing)
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item = MediaItem(
            file_path=str(real_file),
            file_name="restored.jpg",
            media_type="image",
            is_missing=True,
        )
        db.add(item)
        db.commit()
    finally:
        gen.close()

    r = await client.post(f"/libraries/{lib_name}/check-missing")
    assert r.status_code == 200
    data = r.json()
    assert data["updated"] == 1

    # Verify DB state updated back to not missing
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        items = db.scalars(select(MediaItem)).all()
        assert len(items) == 1
        assert items[0].is_missing is False
    finally:
        gen.close()


async def test_check_missing_mixed(client, tmp_path):
    """Mixed items: only those with changed state count toward updated."""
    lib_name = f"lib_cm4_{tmp_path.name}"
    r = await client.post("/libraries/", json={"name": lib_name})
    assert r.status_code == 201
    init_library_db(tmp_path, lib_name)

    real_file = tmp_path / "present.jpg"
    real_file.write_bytes(b"data")

    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        # File exists, is_missing=False → no change
        db.add(MediaItem(file_path=str(real_file), file_name="present.jpg", media_type="image", is_missing=False))
        # File missing, is_missing=False → will be updated
        db.add(MediaItem(file_path="/gone/a.jpg", file_name="a.jpg", media_type="image", is_missing=False))
        # File missing, is_missing=True → already flagged, no change
        db.add(MediaItem(file_path="/gone/b.jpg", file_name="b.jpg", media_type="image", is_missing=True))
        db.commit()
    finally:
        gen.close()

    r = await client.post(f"/libraries/{lib_name}/check-missing")
    assert r.status_code == 200
    assert r.json()["updated"] == 1


async def test_check_missing_unknown_library(client):
    r = await client.post("/libraries/does_not_exist/check-missing")
    assert r.status_code == 404
