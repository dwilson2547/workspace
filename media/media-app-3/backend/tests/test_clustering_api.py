import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from main import app
from db.library_db import init_library_db, get_library_session
from db.models_library import ClusteringRun


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


def seed_clustering_runs(tmp_path, lib_name, runs):
    """Insert ClusteringRun rows directly into the library DB."""
    gen = get_library_session(lib_name)
    db = next(gen)
    try:
        base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
        for i, r in enumerate(runs):
            run = ClusteringRun(
                created_at=base_time + timedelta(seconds=i),
                **r,
            )
            db.add(run)
        db.commit()
    finally:
        gen.close()


async def test_list_runs_empty(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib")
    r = await client.get(f"/libraries/{lib_name}/clustering/runs")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_runs_returns_all(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib2")
    seed_clustering_runs(tmp_path, lib_name, [
        {"run_number": 1, "parameters": {"min_cluster_size": 5}, "is_active": False},
        {"run_number": 2, "parameters": {"min_cluster_size": 10}, "is_active": True},
    ])
    r = await client.get(f"/libraries/{lib_name}/clustering/runs")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    # Ordered by created_at descending — run_number 2 first
    assert data[0]["run_number"] == 2
    assert data[1]["run_number"] == 1


async def test_trigger_run_returns_202_with_task_id(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib3")
    r = await client.post(
        f"/libraries/{lib_name}/clustering/runs",
        json={"parameters": {"min_cluster_size": 5}},
    )
    assert r.status_code == 202
    data = r.json()
    assert "task_id" in data
    assert isinstance(data["task_id"], int)


async def test_trigger_run_with_notes(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib4")
    r = await client.post(
        f"/libraries/{lib_name}/clustering/runs",
        json={"parameters": {"min_cluster_size": 3}, "notes": "initial run"},
    )
    assert r.status_code == 202
    assert "task_id" in r.json()


async def test_activate_run_deactivates_others(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib5")
    seed_clustering_runs(tmp_path, lib_name, [
        {"run_number": 1, "parameters": {}, "is_active": True},
        {"run_number": 2, "parameters": {}, "is_active": False},
        {"run_number": 3, "parameters": {}, "is_active": False},
    ])

    # Get all runs to find their IDs
    r = await client.get(f"/libraries/{lib_name}/clustering/runs")
    runs = r.json()
    # Ordered desc: run_number 3, 2, 1
    run3_id = runs[0]["id"]
    run2_id = runs[1]["id"]
    run1_id = runs[2]["id"]

    # Activate run 2
    r = await client.put(f"/libraries/{lib_name}/clustering/runs/{run2_id}/activate")
    assert r.status_code == 200
    activated = r.json()
    assert activated["id"] == run2_id
    assert activated["is_active"] is True

    # Verify only run 2 is active
    r = await client.get(f"/libraries/{lib_name}/clustering/runs")
    runs_after = {run["id"]: run for run in r.json()}
    assert runs_after[run1_id]["is_active"] is False
    assert runs_after[run2_id]["is_active"] is True
    assert runs_after[run3_id]["is_active"] is False


async def test_activate_nonexistent_run_returns_404(client, tmp_path):
    lib_name = setup_library(tmp_path, "testlib6")
    r = await client.put(f"/libraries/{lib_name}/clustering/runs/999/activate")
    assert r.status_code == 404
