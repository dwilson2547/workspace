from pathlib import Path
import numpy as np
import cv2
from sqlalchemy import select
from db.library_db import get_library_session
from db.models_library import MediaItem, Face, ClusteringRun, FaceAssignment

_app = None  # InsightFace FaceAnalysis, lazy-loaded


def _get_app(model_root: str):
    global _app
    if _app is None:
        from insightface.app import FaceAnalysis
        _app = FaceAnalysis(
            name="buffalo_l",
            root=model_root,
            providers=["CPUExecutionProvider"]
        )
        _app.prepare(ctx_id=0, det_size=(640, 640))
    return _app


def run_face_detection_task(
    task_id: int, task_type: str, media_item_id: int, library_name: str, data_root: str
) -> None:
    from db.library_db import init_library_db
    init_library_db(Path(data_root), library_name)
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        item = db.scalar(select(MediaItem).where(MediaItem.id == media_item_id))
        if not item:
            raise ValueError(f"MediaItem {media_item_id} not found")

        model_root = str(Path(data_root) / "models" / "insightface")
        crop_dir = Path(data_root) / library_name / "face_crops"
        crop_dir.mkdir(parents=True, exist_ok=True)

        frames = _get_frames(item)
        fa = _get_app(model_root)

        seen_embeddings = []
        new_face_ids = []
        for frame_img in frames:
            faces_detected = fa.get(frame_img)
            for face in faces_detected:
                emb = face.embedding  # np.ndarray shape (512,)
                if _is_duplicate(emb, seen_embeddings):
                    continue
                seen_embeddings.append(emb)

                h, w = frame_img.shape[:2]
                bbox = face.bbox.astype(int)  # [x1, y1, x2, y2]
                bbox[0] = max(0, min(w, bbox[0]))   # x1
                bbox[1] = max(0, min(h, bbox[1]))   # y1
                bbox[2] = max(0, min(w, bbox[2]))   # x2
                bbox[3] = max(0, min(h, bbox[3]))   # y2
                bb = {
                    "x": float(bbox[0]) / w,
                    "y": float(bbox[1]) / h,
                    "w": float(bbox[2] - bbox[0]) / w,
                    "h": float(bbox[3] - bbox[1]) / h,
                }

                face_record = Face(
                    media_item_id=media_item_id,
                    bounding_box=bb,
                    embedding=emb.astype(np.float32).tobytes(),
                    detection_confidence=float(face.det_score),
                )
                db.add(face_record)
                db.flush()

                crop = frame_img[bbox[1]:bbox[3], bbox[0]:bbox[2]]
                crop_path = crop_dir / f"{face_record.id}.jpg"
                cv2.imwrite(str(crop_path), crop)
                face_record.crop_path = str(crop_path)
                new_face_ids.append(face_record.id)

        db.commit()
        _assign_new_faces_incrementally(new_face_ids, library_name, db)
    finally:
        gen.close()


def _get_frames(item) -> list:
    if item.media_type == "image":
        img = cv2.imread(item.file_path)
        return [img] if img is not None else []

    frames = []
    cap = cv2.VideoCapture(item.file_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_interval = int(fps * 60)  # 1 frame per minute

    sample_positions = sorted(set([0] + list(range(sample_interval, total, sample_interval)) + [max(0, total - 1)]))
    for pos in sample_positions:
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
    cap.release()
    return frames


def _is_duplicate(emb: np.ndarray, seen: list, threshold: float = 0.7) -> bool:
    for other in seen:
        sim = float(np.dot(emb, other) / (np.linalg.norm(emb) * np.linalg.norm(other) + 1e-8))
        if sim > threshold:
            return True
    return False


def _assign_new_faces_incrementally(face_ids: list[int], library_name: str, db) -> None:
    import faiss
    # Get active run
    active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
    if not active_run:
        return

    # Get distinct person_ids in active run
    person_ids_result = db.execute(
        select(FaceAssignment.person_id).where(
            FaceAssignment.clustering_run_id == active_run.id
        ).distinct()
    ).all()
    if not person_ids_result:
        return

    # Build centroid per person
    centroids = []
    centroid_person_ids = []
    for (person_id,) in person_ids_result:
        if person_id is None:
            continue
        face_ids_for_person = db.scalars(
            select(FaceAssignment.face_id).where(
                FaceAssignment.clustering_run_id == active_run.id,
                FaceAssignment.person_id == person_id
            )
        ).all()
        embs = []
        for fid in face_ids_for_person:
            raw_emb = db.scalar(select(Face.embedding).where(Face.id == fid))
            if raw_emb is None:
                continue
            embs.append(np.frombuffer(raw_emb, dtype=np.float32).copy())
        if not embs:
            continue  # skip this person — no valid embeddings
        centroid = np.mean(embs, axis=0)
        centroid /= np.linalg.norm(centroid) + 1e-8
        centroids.append(centroid)
        centroid_person_ids.append(person_id)

    if not centroids:
        return

    index = faiss.IndexFlatIP(512)
    index.add(np.array(centroids, dtype=np.float32))

    THRESHOLD = 0.6
    for face_id in face_ids:
        face_emb = db.scalar(select(Face.embedding).where(Face.id == face_id))
        if not face_emb:
            continue
        emb = np.frombuffer(face_emb, dtype=np.float32).copy()
        emb /= np.linalg.norm(emb) + 1e-8
        sims, indices = index.search(emb.reshape(1, -1), 1)
        sim = float(sims[0][0])
        if sim >= THRESHOLD:
            matched_person_id = centroid_person_ids[int(indices[0][0])]
            existing = db.scalar(
                select(FaceAssignment).where(
                    FaceAssignment.face_id == face_id,
                    FaceAssignment.clustering_run_id == active_run.id,
                )
            )
            if existing is None:
                assignment = FaceAssignment(
                    face_id=face_id,
                    person_id=matched_person_id,
                    clustering_run_id=active_run.id,
                    confidence=sim,
                    is_user_corrected=False,
                )
                db.add(assignment)
    db.commit()
