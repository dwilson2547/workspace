import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from db.library_db import init_library_db, get_library_session
from db.models_library import (
    ClusteringRun, Person, Face, FaceAssignment, MediaItem
)


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


def setup_library(tmp_path, lib_name):
    """Initialize a library DB and return its name."""
    init_library_db(tmp_path, lib_name)
    return lib_name


def seed_people_data(tmp_path, lib_name, *, active=True):
    """
    Seed a library with:
      - 2 media items
      - 3 faces (face1, face2 on item1; face3 on item2)
      - 2 people (alice, bob)
      - 1 clustering run (optionally active)
      - face1 -> alice, face2 -> alice, face3 -> bob

    Returns dict with ids for use in assertions.
    """
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        item1 = MediaItem(
            file_path="/photos/a.jpg",
            file_name="a.jpg",
            media_type="image",
        )
        item2 = MediaItem(
            file_path="/photos/b.jpg",
            file_name="b.jpg",
            media_type="image",
        )
        db.add_all([item1, item2])
        db.flush()

        face1 = Face(
            media_item_id=item1.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2},
            crop_path="/crops/face1.jpg",
        )
        face2 = Face(
            media_item_id=item1.id,
            bounding_box={"x": 0.5, "y": 0.1, "w": 0.2, "h": 0.2},
            crop_path="/crops/face2.jpg",
        )
        face3 = Face(
            media_item_id=item2.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2},
            crop_path="/crops/face3.jpg",
        )
        db.add_all([face1, face2, face3])
        db.flush()

        alice = Person(name="Alice", cover_face_id=face1.id)
        bob = Person(name="Bob", cover_face_id=face3.id)
        db.add_all([alice, bob])
        db.flush()

        run = ClusteringRun(
            run_number=1,
            parameters={"min_cluster_size": 5},
            is_active=active,
            face_count=3,
            cluster_count=2,
        )
        db.add(run)
        db.flush()

        a1 = FaceAssignment(face_id=face1.id, person_id=alice.id, clustering_run_id=run.id)
        a2 = FaceAssignment(face_id=face2.id, person_id=alice.id, clustering_run_id=run.id)
        a3 = FaceAssignment(face_id=face3.id, person_id=bob.id, clustering_run_id=run.id)
        db.add_all([a1, a2, a3])
        db.commit()

        return {
            "run_id": run.id,
            "alice_id": alice.id,
            "bob_id": bob.id,
            "face1_id": face1.id,
            "face2_id": face2.id,
            "face3_id": face3.id,
            "assign1_id": a1.id,
            "assign2_id": a2.id,
            "assign3_id": a3.id,
        }
    finally:
        gen.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_list_people_no_active_run(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    seed_people_data(tmp_path, lib_name, active=False)
    r = await client.get(f"/libraries/{lib_name}/people/")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_people_with_active_run(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    r = await client.get(f"/libraries/{lib_name}/people/")
    assert r.status_code == 200
    data = r.json()

    # Both alice and bob should be returned
    assert len(data) == 2

    # Build a lookup by id
    by_id = {p["id"]: p for p in data}

    alice = by_id[ids["alice_id"]]
    assert alice["name"] == "Alice"
    assert alice["face_count"] == 2
    assert alice["cover_face_crop_path"] == "/crops/face1.jpg"

    bob = by_id[ids["bob_id"]]
    assert bob["name"] == "Bob"
    assert bob["face_count"] == 1
    assert bob["cover_face_crop_path"] == "/crops/face3.jpg"


async def test_list_people_excludes_empty_people(client, tmp_path):
    """People with no assignments in the active run are excluded."""
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    # Add a person with no assignments
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        orphan = Person(name="Nobody")
        db.add(orphan)
        db.commit()
    finally:
        gen.close()

    r = await client.get(f"/libraries/{lib_name}/people/")
    assert r.status_code == 200
    data = r.json()
    names = [p["name"] for p in data]
    assert "Nobody" not in names
    assert len(data) == 2


async def test_rename_person(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    r = await client.put(
        f"/libraries/{lib_name}/people/{ids['alice_id']}/rename",
        json={"name": "Alice Smith"},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    # Verify via DB
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        from sqlalchemy import select as sa_select
        from db.models_library import Person as P
        person = db.scalar(sa_select(P).where(P.id == ids["alice_id"]))
        assert person.name == "Alice Smith"
    finally:
        gen.close()


async def test_rename_person_not_found(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")

    r = await client.put(
        f"/libraries/{lib_name}/people/9999/rename",
        json={"name": "Ghost"},
    )
    assert r.status_code == 404


async def test_reassign_face(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    # Reassign face3 (currently bob) to alice
    r = await client.post(
        f"/libraries/{lib_name}/people/reassign",
        json={"face_id": ids["face3_id"], "target_person_id": ids["alice_id"]},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    # Verify in DB
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        from sqlalchemy import select as sa_select
        from db.models_library import FaceAssignment as FA
        assignment = db.scalar(sa_select(FA).where(FA.id == ids["assign3_id"]))
        assert assignment.person_id == ids["alice_id"]
        assert assignment.is_user_corrected is True
        assert assignment.corrected_at is not None
    finally:
        gen.close()


async def test_reassign_face_unassign(client, tmp_path):
    """target_person_id=None unassigns the face."""
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    r = await client.post(
        f"/libraries/{lib_name}/people/reassign",
        json={"face_id": ids["face1_id"], "target_person_id": None},
    )
    assert r.status_code == 200

    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        from sqlalchemy import select as sa_select
        from db.models_library import FaceAssignment as FA
        assignment = db.scalar(sa_select(FA).where(FA.id == ids["assign1_id"]))
        assert assignment.person_id is None
        assert assignment.is_user_corrected is True
    finally:
        gen.close()


async def test_reassign_no_active_run(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    seed_people_data(tmp_path, lib_name, active=False)

    r = await client.post(
        f"/libraries/{lib_name}/people/reassign",
        json={"face_id": 1, "target_person_id": 1},
    )
    assert r.status_code == 400
    assert "No active clustering run" in r.json()["detail"]


async def test_reassign_face_not_found(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    seed_people_data(tmp_path, lib_name, active=True)

    r = await client.post(
        f"/libraries/{lib_name}/people/reassign",
        json={"face_id": 9999, "target_person_id": 1},
    )
    assert r.status_code == 404


async def test_merge_people(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    # Merge alice into bob (all alice's assignments -> bob)
    r = await client.post(
        f"/libraries/{lib_name}/people/merge",
        params={"source_id": ids["alice_id"], "target_id": ids["bob_id"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["merged_count"] == 2  # alice had 2 assignments

    # Verify in DB: alice's assignments now point to bob
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        from sqlalchemy import select as sa_select
        from db.models_library import FaceAssignment as FA
        a1 = db.scalar(sa_select(FA).where(FA.id == ids["assign1_id"]))
        a2 = db.scalar(sa_select(FA).where(FA.id == ids["assign2_id"]))
        assert a1.person_id == ids["bob_id"]
        assert a1.is_user_corrected is True
        assert a2.person_id == ids["bob_id"]
        assert a2.is_user_corrected is True
        # Bob's original assignment unchanged
        a3 = db.scalar(sa_select(FA).where(FA.id == ids["assign3_id"]))
        assert a3.person_id == ids["bob_id"]
    finally:
        gen.close()


async def test_merge_people_no_active_run(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    seed_people_data(tmp_path, lib_name, active=False)

    r = await client.post(
        f"/libraries/{lib_name}/people/merge",
        params={"source_id": 1, "target_id": 2},
    )
    assert r.status_code == 400
    assert "No active clustering run" in r.json()["detail"]


async def test_merge_people_empty_source(client, tmp_path):
    """Merging a source with no assignments returns merged_count=0."""
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    # Add a person with no assignments
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        orphan = Person(name="Nobody")
        db.add(orphan)
        db.commit()
        orphan_id = orphan.id
    finally:
        gen.close()

    r = await client.post(
        f"/libraries/{lib_name}/people/merge",
        params={"source_id": orphan_id, "target_id": ids["alice_id"]},
    )
    assert r.status_code == 200
    assert r.json()["merged_count"] == 0


async def test_merge_self(client, tmp_path):
    """Merging a person into themselves returns 400."""
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    r = await client.post(
        f"/libraries/{lib_name}/people/merge",
        params={"source_id": ids["alice_id"], "target_id": ids["alice_id"]},
    )
    assert r.status_code == 400
    assert "source_id and target_id must differ" in r.json()["detail"]


async def test_merge_target_not_found(client, tmp_path):
    """Merging into a non-existent target person returns 404."""
    lib_name = setup_library(tmp_path, "testlib")
    ids = seed_people_data(tmp_path, lib_name, active=True)

    r = await client.post(
        f"/libraries/{lib_name}/people/merge",
        params={"source_id": ids["alice_id"], "target_id": 9999},
    )
    assert r.status_code == 404
    assert "Target person not found" in r.json()["detail"]
