from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, LargeBinary, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime, timezone


class LibraryBase(DeclarativeBase):
    pass


class MediaItem(LibraryBase):
    __tablename__ = "media_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    file_path = Column(String, nullable=False)        # absolute path, not unique
    file_name = Column(String, nullable=False)
    file_hash = Column(String, nullable=True)
    media_type = Column(String, nullable=False)       # 'image' | 'video'
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)           # seconds, videos only
    captured_at = Column(DateTime(timezone=True), nullable=True)
    imported_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    exif_data = Column(JSON, nullable=True)
    blip_description = Column(Text, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    is_missing = Column(Boolean, nullable=False, default=False)

    tasks = relationship("Task", back_populates="media_item", cascade="all, delete-orphan")
    faces = relationship("Face", back_populates="media_item", cascade="all, delete-orphan")


class Task(LibraryBase):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_type = Column(String, nullable=False)
    # types: thumbnail, exif, face_detection, blip, cluster_run
    status = Column(String, nullable=False, default="pending")
    # statuses: pending, processing, completed, failed
    priority = Column(Integer, nullable=False, default=5)
    retry_count = Column(Integer, nullable=False, default=0)
    media_item_id = Column(Integer, ForeignKey("media_items.id", ondelete="CASCADE"), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    media_item = relationship("MediaItem", back_populates="tasks")


class Face(LibraryBase):
    __tablename__ = "faces"
    id = Column(Integer, primary_key=True, autoincrement=True)
    media_item_id = Column(Integer, ForeignKey("media_items.id", ondelete="CASCADE"), nullable=False)
    bounding_box = Column(JSON, nullable=False)       # {x, y, w, h} as fractions of image size
    embedding = Column(LargeBinary, nullable=True)    # 512-dim float32 numpy array
    detection_confidence = Column(Float, nullable=True)
    crop_path = Column(String, nullable=True)

    media_item = relationship("MediaItem", back_populates="faces")
    assignments = relationship("FaceAssignment", back_populates="face", cascade="all, delete-orphan")


class Person(LibraryBase):
    __tablename__ = "people"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=True)
    cover_face_id = Column(Integer, ForeignKey("faces.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    assignments = relationship("FaceAssignment", back_populates="person")


class ClusteringRun(LibraryBase):
    __tablename__ = "clustering_runs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    parameters = Column(JSON, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=False)
    face_count = Column(Integer, nullable=False, default=0)
    cluster_count = Column(Integer, nullable=False, default=0)

    assignments = relationship("FaceAssignment", back_populates="run", cascade="all, delete-orphan")


class FaceAssignment(LibraryBase):
    __tablename__ = "face_assignments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    face_id = Column(Integer, ForeignKey("faces.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    clustering_run_id = Column(Integer, ForeignKey("clustering_runs.id", ondelete="CASCADE"), nullable=False)
    confidence = Column(Float, nullable=True)
    is_user_corrected = Column(Boolean, nullable=False, default=False)
    corrected_at = Column(DateTime(timezone=True), nullable=True)

    face = relationship("Face", back_populates="assignments")
    person = relationship("Person", back_populates="assignments")
    run = relationship("ClusteringRun", back_populates="assignments")
