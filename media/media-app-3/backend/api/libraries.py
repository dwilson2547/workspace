import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from db.global_db import get_global_db
from db.models_global import Library
from db.library_db import init_library_db, get_library_session
from db.models_library import MediaItem
from tasks import queue_runner

router = APIRouter(prefix="/libraries", tags=["libraries"])



class LibraryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: datetime
    last_accessed_at: datetime | None


class LibraryIn(BaseModel):
    name: str


@router.get("/", response_model=list[LibraryOut])
def list_libraries(db: Session = Depends(get_global_db)):
    return db.scalars(select(Library).order_by(Library.created_at)).all()


@router.post("/", response_model=LibraryOut, status_code=201)
def create_library(body: LibraryIn, db: Session = Depends(get_global_db)):
    if db.scalar(select(Library).where(Library.name == body.name)):
        raise HTTPException(status_code=409, detail="Library name already exists")
    lib = Library(name=body.name)
    db.add(lib)
    db.commit()
    db.refresh(lib)
    return lib


@router.delete("/{library_id}", status_code=204)
def delete_library(library_id: int, db: Session = Depends(get_global_db)):
    lib = db.scalar(select(Library).where(Library.id == library_id))
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    db.delete(lib)
    db.commit()


@router.post("/{library_name}/check-missing")
def check_missing(library_name: str, db: Session = Depends(get_global_db)):
    lib = db.scalar(select(Library).where(Library.name == library_name))
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    gen = get_library_session(library_name)
    db_lib = next(gen)
    try:
        items = db_lib.scalars(select(MediaItem)).all()
        updated = 0
        for item in items:
            missing = not Path(item.file_path).exists()
            if item.is_missing != missing:
                item.is_missing = missing
                updated += 1
        db_lib.commit()
        return {"updated": updated}
    finally:
        gen.close()


@router.post("/{library_name}/open")
async def open_library(library_name: str, db: Session = Depends(get_global_db)):
    lib = db.scalar(select(Library).where(Library.name == library_name))
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    data_root = Path(os.environ.get("MEDIA_APP_DATA_ROOT", Path.home() / ".media-manager"))
    init_library_db(data_root, library_name)
    await queue_runner.ensure_loop_running(library_name, str(data_root))
    return {"ok": True}
