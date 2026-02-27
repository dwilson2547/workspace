# backend/tests/test_face_detection.py
import pytest
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from sqlalchemy import select
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem, Task, Face, ClusteringRun, FaceAssignment, Person
from tasks.face_detection import run_face_detection_task, _assign_new_faces_incrementally


def make_portrait(path: Path) -> Path:
    """Create a simple 200x200 image — InsightFace may not detect faces in synthetic images.
    This test verifies the pipeline runs without error and writes to DB."""
    img = Image.new("RGB", (200, 200), (200, 180, 160))
    img.save(path)
    return path


def test_face_detection_runs_without_error(tmp_path):
    img_path = make_portrait(tmp_path / "portrait.jpg")
    init_library_db(tmp_path, "test_lib")
    gen = get_library_session("test_lib")
    db = next(gen)
    try:
        item = MediaItem(file_path=str(img_path), file_name="portrait.jpg", media_type="image",
                         width=200, height=200)
        db.add(item)
        db.flush()
        task = Task(task_type="face_detection", priority=3, media_item_id=item.id)
        db.add(task)
        db.commit()
        task_id, item_id = task.id, item.id
    finally:
        gen.close()

    # Should not raise
    run_face_detection_task(task_id, "face_detection", item_id, "test_lib", str(tmp_path))


def _make_embedding(seed: int = 0) -> np.ndarray:
    """Create a deterministic normalized 512-dim float32 embedding."""
    rng = np.random.default_rng(seed)
    emb = rng.standard_normal(512).astype(np.float32)
    emb /= np.linalg.norm(emb) + 1e-8
    return emb


def test_assign_new_faces_incrementally_matches_person(tmp_path):
    """A new face whose embedding is close to a known person's centroid gets a FaceAssignment."""
    lib = "incr_lib"
    init_library_db(tmp_path, lib)
    gen = get_library_session(lib)
    db = next(gen)
    try:
        # Create a media item
        item = MediaItem(file_path="/fake/img.jpg", file_name="img.jpg", media_type="image",
                         width=100, height=100)
        db.add(item)
        db.flush()

        # Create a Person
        person = Person()
        db.add(person)
        db.flush()

        # Create an active ClusteringRun
        run = ClusteringRun(run_number=1, parameters={}, is_active=True,
                            face_count=1, cluster_count=1)
        db.add(run)
        db.flush()

        # Create an existing face with a known embedding (the "centroid" face)
        centroid_emb = _make_embedding(seed=42)
        existing_face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
            embedding=centroid_emb.tobytes(),
            detection_confidence=0.99,
        )
        db.add(existing_face)
        db.flush()

        # Assign existing face to person in the active run
        existing_assignment = FaceAssignment(
            face_id=existing_face.id,
            person_id=person.id,
            clustering_run_id=run.id,
            confidence=1.0,
            is_user_corrected=False,
        )
        db.add(existing_assignment)
        db.flush()

        # Create a new face with a very similar embedding (same direction, slight noise)
        similar_emb = centroid_emb + _make_embedding(seed=99) * 0.05
        similar_emb = similar_emb.astype(np.float32)
        similar_emb /= np.linalg.norm(similar_emb) + 1e-8
        new_face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.2, "y": 0.2, "w": 0.4, "h": 0.4},
            embedding=similar_emb.tobytes(),
            detection_confidence=0.95,
        )
        db.add(new_face)
        db.flush()
        new_face_id = new_face.id
        person_id = person.id
        run_id = run.id

        db.commit()
    finally:
        gen.close()

    # Run the incremental assignment
    gen2 = get_library_session(lib)
    db2 = next(gen2)
    try:
        _assign_new_faces_incrementally([new_face_id], lib, db2)

        # Verify a FaceAssignment was created for the new face
        assignment = db2.scalar(
            select(FaceAssignment).where(FaceAssignment.face_id == new_face_id)
        )
        assert assignment is not None, "Expected a FaceAssignment for the new face"
        assert assignment.person_id == person_id
        assert assignment.clustering_run_id == run_id
        assert assignment.confidence >= 0.6
        assert assignment.is_user_corrected is False
    finally:
        gen2.close()


def test_assign_new_faces_no_duplicate_on_retry(tmp_path):
    """Calling _assign_new_faces_incrementally twice with the same face_id produces only one FaceAssignment."""
    lib = "dedup_lib"
    init_library_db(tmp_path, lib)
    gen = get_library_session(lib)
    db = next(gen)
    try:
        item = MediaItem(file_path="/fake/dedup.jpg", file_name="dedup.jpg", media_type="image",
                         width=100, height=100)
        db.add(item)
        db.flush()

        person = Person()
        db.add(person)
        db.flush()

        run = ClusteringRun(run_number=1, parameters={}, is_active=True,
                            face_count=1, cluster_count=1)
        db.add(run)
        db.flush()

        # Existing face whose embedding defines the person's centroid
        centroid_emb = _make_embedding(seed=10)
        existing_face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
            embedding=centroid_emb.tobytes(),
            detection_confidence=0.99,
        )
        db.add(existing_face)
        db.flush()

        existing_assignment = FaceAssignment(
            face_id=existing_face.id,
            person_id=person.id,
            clustering_run_id=run.id,
            confidence=1.0,
            is_user_corrected=False,
        )
        db.add(existing_assignment)
        db.flush()

        # New face with a very similar embedding
        similar_emb = centroid_emb + _make_embedding(seed=20) * 0.05
        similar_emb = similar_emb.astype(np.float32)
        similar_emb /= np.linalg.norm(similar_emb) + 1e-8
        new_face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.2, "y": 0.2, "w": 0.4, "h": 0.4},
            embedding=similar_emb.tobytes(),
            detection_confidence=0.95,
        )
        db.add(new_face)
        db.flush()
        new_face_id = new_face.id

        db.commit()
    finally:
        gen.close()

    # First call — should create exactly one FaceAssignment
    gen2 = get_library_session(lib)
    db2 = next(gen2)
    try:
        _assign_new_faces_incrementally([new_face_id], lib, db2)
    finally:
        gen2.close()

    # Second call (simulating a retry) — should NOT create a duplicate
    gen3 = get_library_session(lib)
    db3 = next(gen3)
    try:
        _assign_new_faces_incrementally([new_face_id], lib, db3)

        assignments = db3.scalars(
            select(FaceAssignment).where(FaceAssignment.face_id == new_face_id)
        ).all()
        assert len(assignments) == 1, (
            f"Expected exactly 1 FaceAssignment after retry, got {len(assignments)}"
        )
    finally:
        gen3.close()


def test_assign_new_faces_empty_list(tmp_path):
    """Calling _assign_new_faces_incrementally with an empty list is a no-op."""
    lib = "empty_list_lib"
    init_library_db(tmp_path, lib)
    gen = get_library_session(lib)
    db = next(gen)
    try:
        item = MediaItem(file_path="/fake/empty.jpg", file_name="empty.jpg", media_type="image",
                         width=100, height=100)
        db.add(item)
        db.flush()

        person = Person()
        db.add(person)
        db.flush()

        run = ClusteringRun(run_number=1, parameters={}, is_active=True,
                            face_count=1, cluster_count=1)
        db.add(run)
        db.flush()

        centroid_emb = _make_embedding(seed=5)
        existing_face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
            embedding=centroid_emb.tobytes(),
            detection_confidence=0.99,
        )
        db.add(existing_face)
        db.flush()

        existing_assignment = FaceAssignment(
            face_id=existing_face.id,
            person_id=person.id,
            clustering_run_id=run.id,
            confidence=1.0,
            is_user_corrected=False,
        )
        db.add(existing_assignment)
        db.commit()
        run_id = run.id
    finally:
        gen.close()

    # Call with empty list — should be a no-op, no exception raised
    gen2 = get_library_session(lib)
    db2 = next(gen2)
    try:
        _assign_new_faces_incrementally([], lib, db2)  # should not raise

        # No new FaceAssignment rows should be created beyond the pre-existing one
        all_assignments = db2.scalars(select(FaceAssignment)).all()
        assert len(all_assignments) == 1, (
            f"Expected only the pre-existing FaceAssignment, got {len(all_assignments)}"
        )
    finally:
        gen2.close()


def test_assign_new_faces_incrementally_no_active_run(tmp_path):
    """When there is no active clustering run, no FaceAssignments are created."""
    lib = "norun_lib"
    init_library_db(tmp_path, lib)
    gen = get_library_session(lib)
    db = next(gen)
    try:
        item = MediaItem(file_path="/fake/img2.jpg", file_name="img2.jpg", media_type="image",
                         width=100, height=100)
        db.add(item)
        db.flush()

        emb = _make_embedding(seed=7)
        face = Face(
            media_item_id=item.id,
            bounding_box={"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.5},
            embedding=emb.tobytes(),
            detection_confidence=0.9,
        )
        db.add(face)
        db.flush()
        face_id = face.id
        db.commit()
    finally:
        gen.close()

    # Run with no active clustering run — should be a no-op
    gen2 = get_library_session(lib)
    db2 = next(gen2)
    try:
        _assign_new_faces_incrementally([face_id], lib, db2)

        assignments = db2.scalars(
            select(FaceAssignment).where(FaceAssignment.face_id == face_id)
        ).all()
        assert assignments == [], "Expected no FaceAssignments when there is no active run"
    finally:
        gen2.close()
