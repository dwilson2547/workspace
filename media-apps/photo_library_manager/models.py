"""
Database models for Face Identifier application.
"""

import json
from datetime import datetime
from typing import Optional

import numpy as np
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class Photo(Base):
    """Represents a photo file in the library."""
    __tablename__ = 'photos'
    
    id = Column(Integer, primary_key=True)
    path = Column(String(1024), unique=True, nullable=False, index=True)
    filename = Column(String(256), nullable=False)
    file_hash = Column(String(64), index=True)
    width = Column(Integer)
    height = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    faces = relationship("Face", back_populates="photo", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Photo {self.id}: {self.filename}>"


class Face(Base):
    """Represents a detected face in a photo."""
    __tablename__ = 'faces'
    
    id = Column(Integer, primary_key=True)
    photo_id = Column(Integer, ForeignKey('photos.id'), nullable=False, index=True)
    
    # Bounding box
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)
    
    # Detection confidence
    confidence = Column(Float, nullable=False)
    
    # Face embedding (stored as binary)
    embedding = Column(LargeBinary)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    photo = relationship("Photo", back_populates="faces")
    assignments = relationship("ClusterAssignment", back_populates="face", cascade="all, delete-orphan")
    
    def set_embedding(self, embedding: np.ndarray):
        """Store numpy embedding as binary."""
        self.embedding = embedding.astype(np.float32).tobytes()
    
    def get_embedding(self) -> np.ndarray:
        """Retrieve embedding as numpy array."""
        if self.embedding is None:
            return None
        return np.frombuffer(self.embedding, dtype=np.float32)
    
    def __repr__(self):
        return f"<Face {self.id} in Photo {self.photo_id}>"


class ClusteringRun(Base):
    """Represents a single clustering run with its parameters."""
    __tablename__ = 'clustering_runs'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    
    # Parameters
    distance_threshold = Column(Float, nullable=False)
    min_samples = Column(Integer, default=1)
    metric = Column(String(64), default='cosine')
    
    # Constraints used (JSON)
    constraints_json = Column(Text)
    
    # Results summary
    total_faces = Column(Integer)
    num_clusters = Column(Integer)
    num_outliers = Column(Integer)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    clusters = relationship("Cluster", back_populates="run", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ClusteringRun {self.id}: {self.name or 'unnamed'}>"


class Cluster(Base):
    """Represents a cluster of faces (a person) in a clustering run."""
    __tablename__ = 'clusters'
    
    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey('clustering_runs.id'), nullable=False, index=True)
    
    cluster_label = Column(Integer, nullable=False)  # -1 for outliers
    name = Column(String(256))  # User-assigned name
    
    face_count = Column(Integer, default=0)
    photo_count = Column(Integer, default=0)
    
    # Relationships
    run = relationship("ClusteringRun", back_populates="clusters")
    assignments = relationship("ClusterAssignment", back_populates="cluster", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Cluster {self.id}: label={self.cluster_label}, name={self.name}>"


class ClusterAssignment(Base):
    """Links faces to clusters."""
    __tablename__ = 'cluster_assignments'
    
    id = Column(Integer, primary_key=True)
    face_id = Column(Integer, ForeignKey('faces.id'), nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey('clusters.id'), nullable=False, index=True)
    
    # Relationships
    face = relationship("Face", back_populates="assignments")
    cluster = relationship("Cluster", back_populates="assignments")
    
    def __repr__(self):
        return f"<ClusterAssignment face={self.face_id} -> cluster={self.cluster_id}>"


class PersonName(Base):
    """Persistent person names that survive re-clustering."""
    __tablename__ = 'person_names'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False, unique=True)
    
    # Representative face for matching across runs
    representative_face_id = Column(Integer, ForeignKey('faces.id'))
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<PersonName {self.id}: {self.name}>"


class Constraint(Base):
    """User-defined constraints for clustering."""
    __tablename__ = 'constraints'
    
    id = Column(Integer, primary_key=True)
    
    # Type: 'must_link', 'cannot_link', 'split'
    constraint_type = Column(String(64), nullable=False)
    
    # For must_link and cannot_link: comma-separated cluster labels
    cluster_labels = Column(String(256))
    
    # For split constraints
    target_cluster_label = Column(Integer)
    split_into = Column(Integer)
    anchor_photos = Column(Text)  # JSON array of photo paths
    
    # Reference to which run this was created from
    reference_run_id = Column(Integer, ForeignKey('clustering_runs.id'))
    
    comment = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Constraint {self.id}: {self.constraint_type}>"


class WatchedFolder(Base):
    """Folders being watched for new photos."""
    __tablename__ = 'watched_folders'
    
    id = Column(Integer, primary_key=True)
    path = Column(String(1024), unique=True, nullable=False)
    recursive = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    last_scanned = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<WatchedFolder {self.id}: {self.path}>"


def init_db(db_path: str):
    """Initialize the database and return engine and session factory."""
    engine = create_engine(f'sqlite:///{db_path}', echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    return engine, SessionLocal