# backend/tests/test_clustering.py
import numpy as np
import pytest
from pathlib import Path
from sqlalchemy import select, func
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Face, ClusteringRun, FaceAssignment, Person
from tasks.clustering import run_cluster_run_task


def seed_faces(db, n_clusters=3, faces_per_cluster=5):
    """Create synthetic face embeddings with clear cluster structure."""
    rng = np.random.default_rng(42)
    centroids = rng.normal(size=(n_clusters, 512)).astype(np.float32)
    centroids /= np.linalg.norm(centroids, axis=1, keepdims=True)

    item = MediaItem(file_path="/fake/img.jpg", file_name="img.jpg", media_type="image")
    db.add(item)
    db.flush()

    for c_idx in range(n_clusters):
        for _ in range(faces_per_cluster):
            emb = centroids[c_idx] + rng.normal(scale=0.05, size=512).astype(np.float32)
            emb /= np.linalg.norm(emb)
            face = Face(media_item_id=item.id, bounding_box={"x": 0, "y": 0, "w": 0.1, "h": 0.1},
                        embedding=emb.tobytes(), detection_confidence=0.99)
            db.add(face)
    db.commit()


def test_clustering_creates_run_and_assignments(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    try:
        seed_faces(db, n_clusters=3, faces_per_cluster=5)
    finally:
        gen.close()

    params = {"min_cluster_size": 3, "min_samples": 1, "cluster_selection_epsilon": 0.0}
    run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    try:
        run = db2.scalar(select(ClusteringRun))
        assert run is not None
        assert run.cluster_count >= 2  # HDBSCAN may merge some
        assignments = db2.scalars(select(FaceAssignment)).all()
        assert len(assignments) == 15  # all faces assigned
    finally:
        gen2.close()


def test_max_10_runs_enforced(tmp_path):
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    try:
        seed_faces(db, n_clusters=2, faces_per_cluster=3)
    finally:
        gen.close()

    params = {"min_cluster_size": 2, "min_samples": 1, "cluster_selection_epsilon": 0.0}
    for _ in range(11):
        run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    try:
        count = db2.scalar(select(func.count()).select_from(ClusteringRun))
        assert count == 10
    finally:
        gen2.close()


def test_correction_carryforward(tmp_path):
    """User corrections in the active run are preserved in the next run."""
    from sqlalchemy import select
    from db.models_library import FaceAssignment, ClusteringRun, Person

    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    try:
        seed_faces(db, n_clusters=2, faces_per_cluster=5)
    finally:
        gen.close()

    params = {"min_cluster_size": 3, "min_samples": 1, "cluster_selection_epsilon": 0.0}

    # First run — creates active run
    run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    # Simulate a user correction: mark one assignment as user-corrected in the active run
    gen2 = get_library_session("test_lib")
    db2 = next(gen2)
    try:
        active_run = db2.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        assert active_run is not None
        # Get the first assignment and mark it corrected
        first_assignment = db2.scalar(
            select(FaceAssignment).where(FaceAssignment.clustering_run_id == active_run.id)
        )
        face_id = first_assignment.face_id
        first_assignment.is_user_corrected = True
        # Assign to a named person
        person = db2.scalar(select(Person).where(Person.id == first_assignment.person_id))
        person.name = "Alice"
        db2.commit()
    finally:
        gen2.close()

    # Second run — should carry the correction forward
    run_cluster_run_task(None, "cluster_run", None, "test_lib", str(tmp_path), params=params)

    # Verify the correction was carried forward
    gen3 = get_library_session("test_lib")
    db3 = next(gen3)
    try:
        new_run = db3.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        corrected = db3.scalar(
            select(FaceAssignment).where(
                FaceAssignment.clustering_run_id == new_run.id,
                FaceAssignment.face_id == face_id,
                FaceAssignment.is_user_corrected == True,
            )
        )
        assert corrected is not None, "Correction should be carried forward to new run"
    finally:
        gen3.close()
