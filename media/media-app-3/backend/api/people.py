from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from db.library_db import get_library_session
from db.models_library import Person, ClusteringRun, FaceAssignment, Face

router = APIRouter(prefix="/libraries/{library_name}/people", tags=["people"])


class PersonOut(BaseModel):
    id: int
    name: str | None
    cover_face_crop_path: str | None
    face_count: int

    model_config = ConfigDict(from_attributes=True)


class RenameRequest(BaseModel):
    name: str


class ReassignRequest(BaseModel):
    face_id: int
    target_person_id: int | None  # None = unassign


@router.get("/", response_model=list[PersonOut])
def list_people(library_name: str):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        if not active_run:
            return []

        people = db.scalars(select(Person)).all()
        result = []
        for p in people:
            count = db.scalar(
                select(func.count()).select_from(FaceAssignment).where(
                    FaceAssignment.clustering_run_id == active_run.id,
                    FaceAssignment.person_id == p.id,
                )
            )
            if count == 0:
                continue
            cover_path = None
            if p.cover_face_id:
                face = db.scalar(select(Face).where(Face.id == p.cover_face_id))
                if face:
                    cover_path = face.crop_path
            result.append(PersonOut(id=p.id, name=p.name, cover_face_crop_path=cover_path, face_count=count))
        return result
    finally:
        gen.close()


@router.put("/{person_id}/rename")
def rename_person(library_name: str, person_id: int, body: RenameRequest):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        person = db.scalar(select(Person).where(Person.id == person_id))
        if not person:
            raise HTTPException(status_code=404)
        person.name = body.name
        db.commit()
    finally:
        gen.close()
    return {"ok": True}


@router.post("/reassign")
def reassign_face(library_name: str, body: ReassignRequest):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        if not active_run:
            raise HTTPException(status_code=400, detail="No active clustering run")

        assignment = db.scalar(
            select(FaceAssignment).where(
                FaceAssignment.face_id == body.face_id,
                FaceAssignment.clustering_run_id == active_run.id,
            )
        )
        if not assignment:
            raise HTTPException(status_code=404)

        assignment.person_id = body.target_person_id
        assignment.is_user_corrected = True
        assignment.corrected_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        gen.close()
    return {"ok": True}


@router.post("/merge")
def merge_people(library_name: str, source_id: int, target_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        if source_id == target_id:
            raise HTTPException(status_code=400, detail="source_id and target_id must differ")

        active_run = db.scalar(select(ClusteringRun).where(ClusteringRun.is_active == True))
        if not active_run:
            raise HTTPException(status_code=400, detail="No active clustering run")

        target = db.scalar(select(Person).where(Person.id == target_id))
        if not target:
            raise HTTPException(status_code=404, detail="Target person not found")

        assignments = db.scalars(
            select(FaceAssignment).where(
                FaceAssignment.clustering_run_id == active_run.id,
                FaceAssignment.person_id == source_id,
            )
        ).all()
        now = datetime.now(timezone.utc)
        for a in assignments:
            a.person_id = target_id
            a.is_user_corrected = True
            a.corrected_at = now
        db.commit()
    finally:
        gen.close()
    return {"ok": True, "merged_count": len(assignments)}
