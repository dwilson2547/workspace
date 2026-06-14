from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from sqlalchemy import select
from db.library_db import get_library_session, LibraryNotInitializedError
from db.models_library import MediaItem

router = APIRouter(prefix="/libraries/{library_name}/media", tags=["media"])


class MediaItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_path: str
    file_name: str
    media_type: str
    width: int | None
    height: int | None
    captured_at: datetime | None
    imported_at: datetime
    thumbnail_path: str | None
    blip_description: str | None
    is_missing: bool
    exif_data: dict | None


class MediaPage(BaseModel):
    items: list[MediaItemOut]
    next_cursor: int | None


@router.get("/", response_model=MediaPage)
def list_media(
    library_name: str,
    cursor: int | None = Query(None),
    limit: int = Query(100, le=500),
    sort_by: str = Query("imported_at"),
    person_id: int | None = Query(None),
):
    try:
        gen = get_library_session(library_name)
        db = next(gen)
    except LibraryNotInitializedError:
        return MediaPage(items=[], next_cursor=None)
    try:
        stmt = select(MediaItem).where(MediaItem.is_missing == False)  # noqa: E712

        if person_id is not None:
            from db.models_library import Face, FaceAssignment, ClusteringRun
            active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))  # noqa: E712
            if active_run:
                face_media_ids = db.scalars(
                    select(Face.media_item_id)
                    .join(FaceAssignment, FaceAssignment.face_id == Face.id)
                    .where(
                        FaceAssignment.person_id == person_id,
                        FaceAssignment.clustering_run_id == active_run.id,
                    )
                    .distinct()
                ).all()
                stmt = stmt.where(MediaItem.id.in_(face_media_ids))
            else:
                # No active clustering run — person filter cannot be resolved, return empty
                stmt = stmt.where(False)

        # NOTE: cursor pagination (WHERE id > cursor) is only correct when the sort
        # column is monotonically correlated with `id`.  Columns like `captured_at`
        # or `file_name` can cause items to be skipped or repeated across pages
        # because their ordering is independent of `id`.  Until a compound cursor is
        # implemented, only columns that are safe for this pattern are allowed.
        SORT_COLUMNS = {"imported_at", "id"}
        sort_col = getattr(MediaItem, sort_by if sort_by in SORT_COLUMNS else "imported_at")

        if cursor:
            stmt = stmt.where(MediaItem.id > cursor)

        stmt = stmt.order_by(sort_col, MediaItem.id).limit(limit + 1)
        rows = list(db.scalars(stmt).all())
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = rows[-1].id if has_more and rows else None
        items = [MediaItemOut.model_validate(r) for r in rows]
    finally:
        gen.close()

    return MediaPage(items=items, next_cursor=next_cursor)


@router.get("/{media_id}", response_model=MediaItemOut)
def get_media_item(library_name: str, media_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        item = db.scalar(select(MediaItem).where(MediaItem.id == media_id))
        if not item:
            raise HTTPException(status_code=404)
        out = MediaItemOut.model_validate(item)
    finally:
        gen.close()
    return out


@router.get("/{media_id}/faces")
def get_media_faces(library_name: str, media_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        from db.models_library import Face, FaceAssignment, ClusteringRun, Person

        item = db.scalar(select(MediaItem).where(MediaItem.id == media_id))
        if not item:
            raise HTTPException(status_code=404)

        active_run = db.scalar(
            select(ClusteringRun).where(ClusteringRun.is_active == True)  # noqa: E712
        )
        faces = db.scalars(
            select(Face).where(Face.media_item_id == media_id)
        ).all()

        face_ids = [f.id for f in faces]

        assignments: dict[int, FaceAssignment] = {}
        if active_run and face_ids:
            assignments = {
                a.face_id: a
                for a in db.scalars(
                    select(FaceAssignment).where(
                        FaceAssignment.face_id.in_(face_ids),
                        FaceAssignment.clustering_run_id == active_run.id,
                    )
                ).all()
            }

        person_ids = {a.person_id for a in assignments.values() if a.person_id}
        people: dict[int, Person] = {}
        if person_ids:
            people = {
                p.id: p
                for p in db.scalars(select(Person).where(Person.id.in_(person_ids))).all()
            }

        result = []
        for face in faces:
            person = None
            assignment = assignments.get(face.id)
            if assignment and assignment.person_id:
                p = people.get(assignment.person_id)
                person = {"id": p.id, "name": p.name} if p else None
            result.append({
                "id": face.id,
                "bounding_box": face.bounding_box,
                "crop_path": face.crop_path,
                "person": person,
            })
        return result
    finally:
        gen.close()
