from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from sqlalchemy import select
from db.library_db import get_library_session
from db.models_library import ClusteringRun, Task

router = APIRouter(prefix="/libraries/{library_name}/clustering", tags=["clustering"])


class ClusteringRunOut(BaseModel):
    id: int
    run_number: int
    created_at: datetime
    parameters: dict
    notes: str | None
    is_active: bool
    face_count: int
    cluster_count: int

    model_config = ConfigDict(from_attributes=True)


class NewRunRequest(BaseModel):
    parameters: dict
    notes: str | None = None


@router.get("/runs", response_model=list[ClusteringRunOut])
def list_runs(library_name: str):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        runs = db.scalars(
            select(ClusteringRun).order_by(ClusteringRun.created_at.desc(), ClusteringRun.id.desc())
        ).all()
        return [ClusteringRunOut.model_validate(r) for r in runs]
    finally:
        gen.close()


@router.post("/runs", status_code=202)
def trigger_run(library_name: str, body: NewRunRequest):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        task = Task(task_type="cluster_run", priority=5, status="pending")
        db.add(task)
        db.commit()
        task_id = task.id
    finally:
        gen.close()
    return {"task_id": task_id}


@router.put("/runs/{run_id}/activate", response_model=ClusteringRunOut)
def activate_run(library_name: str, run_id: int):
    gen = get_library_session(library_name)
    db = next(gen)
    try:
        runs = db.scalars(select(ClusteringRun)).all()
        target = None
        for run in runs:
            run.is_active = run.id == run_id
            if run.id == run_id:
                target = run
        if not target:
            raise HTTPException(status_code=404)
        db.commit()
        return ClusteringRunOut.model_validate(target)
    finally:
        gen.close()
