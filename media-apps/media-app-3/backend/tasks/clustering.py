from typing import Any
import numpy as np
from sqlalchemy import select, func
from db.library_db import get_library_session
from db.models_library import Face, ClusteringRun, FaceAssignment, Person

MAX_RUNS = 10


def run_cluster_run_task(
    task_id: int | None,
    task_type: str,
    media_item_id: int | None,
    library_name: str,
    data_root: str,
    params: dict | None = None,
) -> None:
    import hdbscan

    params = params or {"min_cluster_size": 5, "min_samples": 1, "cluster_selection_epsilon": 0.0}

    gen = get_library_session(library_name)
    db = next(gen)
    try:
        faces = db.scalars(select(Face).where(Face.embedding.isnot(None))).all()
        if not faces:
            return  # gen.close() in finally still runs

        embeddings = np.array([
            np.frombuffer(f.embedding, dtype=np.float32) for f in faces
        ])
        face_ids = [f.id for f in faces]

        # Normalize for cosine similarity
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8
        embeddings_norm = embeddings / norms

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=params.get("min_cluster_size", 5),
            min_samples=params.get("min_samples", 1),
            cluster_selection_epsilon=params.get("cluster_selection_epsilon", 0.0),
            metric="euclidean",
        )
        labels = clusterer.fit_predict(embeddings_norm)

        unique_labels = set(labels) - {-1}
        cluster_count = len(unique_labels)

        # Enforce 10-run limit: delete oldest non-active run
        _enforce_run_limit(db)

        existing_run_count = db.scalar(select(func.count()).select_from(ClusteringRun))
        run = ClusteringRun(
            run_number=existing_run_count + 1,
            parameters=params,
            face_count=len(faces),
            cluster_count=cluster_count,
        )
        db.add(run)
        db.flush()

        # Get user-corrected assignments from the previously active run
        active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        corrections: dict[int, int | None] = {}
        if active_run:
            corrected = db.scalars(
                select(FaceAssignment).where(
                    FaceAssignment.clustering_run_id == active_run.id,
                    FaceAssignment.is_user_corrected == True,
                )
            ).all()
            corrections = {a.face_id: a.person_id for a in corrected}

        # Map cluster label -> Person (match to existing named persons via centroid similarity)
        label_to_person: dict[int, Person] = {}
        existing_people = db.scalars(select(Person)).all()

        for label in unique_labels:
            mask = labels == label
            centroid = embeddings_norm[mask].mean(axis=0)
            matched_person = _match_to_existing_person(
                centroid, existing_people, embeddings_norm, face_ids, db,
                active_run_id=active_run.id if active_run else None,
            )
            if matched_person:
                label_to_person[label] = matched_person
            else:
                person = Person()
                db.add(person)
                db.flush()
                label_to_person[label] = person

        # Write assignments
        for i, face_id in enumerate(face_ids):
            label = int(labels[i])
            person_id = label_to_person[label].id if label != -1 else None

            # User correction overrides HDBSCAN result
            is_corrected = face_id in corrections
            if is_corrected:
                person_id = corrections[face_id]

            assignment = FaceAssignment(
                face_id=face_id,
                person_id=person_id,
                clustering_run_id=run.id,
                confidence=float(clusterer.probabilities_[i]) if label != -1 else None,
                is_user_corrected=is_corrected,
            )
            db.add(assignment)

        # Promote new run to active, deactivate previous active run
        if active_run:
            active_run.is_active = False
        run.is_active = True

        db.commit()
    finally:
        gen.close()


def _enforce_run_limit(db) -> None:
    runs = db.scalars(select(ClusteringRun).order_by(ClusteringRun.created_at)).all()
    if len(runs) >= MAX_RUNS:
        db.delete(runs[0])  # delete oldest regardless of is_active (new run will become active)
        db.flush()


def _match_to_existing_person(
    centroid: np.ndarray,
    people: list,
    all_embeddings: np.ndarray,
    face_ids: list[int],
    db,
    threshold: float = 0.6,
    active_run_id: int | None = None,
) -> Any | None:
    """Find existing named person whose face embeddings are closest to this centroid."""
    if active_run_id is None:
        return None  # No active run, no corrections to match against

    best_person = None
    best_sim = threshold

    for person in people:
        if not person.name:
            continue
        corrected = db.scalars(
            select(FaceAssignment).where(
                FaceAssignment.person_id == person.id,
                FaceAssignment.is_user_corrected == True,
                FaceAssignment.clustering_run_id == active_run_id,
            )
        ).all()
        if not corrected:
            continue
        corrected_face_ids = {a.face_id for a in corrected}
        indices = [i for i, fid in enumerate(face_ids) if fid in corrected_face_ids]
        if not indices:
            continue
        person_centroid = all_embeddings[indices].mean(axis=0)
        sim = float(np.dot(centroid, person_centroid))
        if sim > best_sim:
            best_sim = sim
            best_person = person

    return best_person
