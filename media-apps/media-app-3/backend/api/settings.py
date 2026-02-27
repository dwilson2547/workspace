from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from db.global_db import get_global_db
from db.models_global import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    value: str | None


class SettingIn(BaseModel):
    value: str


@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_global_db)):
    row = db.query(Setting).filter_by(key=key).first()
    if not row:
        return SettingOut(key=key, value=None)
    return SettingOut(key=row.key, value=row.value)


@router.put("/{key}", response_model=SettingOut)
def set_setting(key: str, body: SettingIn, db: Session = Depends(get_global_db)):
    row = db.query(Setting).filter_by(key=key).first()
    if row:
        row.value = body.value
    else:
        row = Setting(key=key, value=body.value)
        db.add(row)
    db.commit()
    return SettingOut(key=row.key, value=row.value)
