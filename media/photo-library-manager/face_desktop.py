#!/usr/bin/env python3
"""
Face Identifier Desktop Application

A PyQt6-based desktop tool for managing face identification with
incremental learning and visual constraint editing.

Requirements:
    pip install PyQt6 insightface onnxruntime-gpu opencv-python numpy scikit-learn pillow sqlalchemy

Usage:
    python face_desktop.py
    python face_desktop.py --db my_faces.db
"""

import hashlib
import json
import logging
import os
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Set, Tuple
from dataclasses import dataclass
from enum import Enum, auto

import cv2
import numpy as np
from PIL import Image, ImageOps

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGridLayout, QScrollArea, QLabel, QPushButton, QLineEdit,
    QProgressBar, QStatusBar, QToolBar, QMenuBar, QMenu, QFileDialog,
    QMessageBox, QInputDialog, QSlider, QSpinBox, QFrame, QSplitter,
    QListWidget, QListWidgetItem, QStackedWidget, QComboBox,
    QDialog, QDialogButtonBox, QFormLayout, QTextEdit, QGroupBox,
    QCheckBox, QTreeWidget, QTreeWidgetItem, QTabWidget, QSizePolicy,
    QAbstractItemView, QRubberBand
)
from PyQt6.QtCore import (
    Qt, QThread, pyqtSignal, QSize, QTimer, QRect, QPoint,
    QMimeData, QByteArray, QPropertyAnimation, QEasingCurve
)
from PyQt6.QtGui import (
    QPixmap, QImage, QIcon, QAction, QDrag, QPainter, QColor,
    QPen, QBrush, QFont, QCursor, QPalette, QDragEnterEvent,
    QDropEvent, QMouseEvent, QKeySequence
)

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from models import (
    Base, Photo, Face, ClusteringRun, Cluster, ClusterAssignment,
    PersonName, Constraint, WatchedFolder, init_db
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}


# =============================================================================
# Style Constants
# =============================================================================

DARK_STYLE = """
QMainWindow, QDialog {
    background-color: #1a1a2e;
}

QWidget {
    color: #eeeeee;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

QMenuBar {
    background-color: #16213e;
    border-bottom: 2px solid #e94560;
    padding: 5px;
}

QMenuBar::item:selected {
    background-color: #e94560;
}

QMenu {
    background-color: #16213e;
    border: 1px solid #333;
}

QMenu::item:selected {
    background-color: #e94560;
}

QToolBar {
    background-color: #16213e;
    border: none;
    spacing: 10px;
    padding: 5px;
}

QPushButton {
    background-color: #e94560;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: bold;
}

QPushButton:hover {
    background-color: #ff6b6b;
}

QPushButton:pressed {
    background-color: #c73e54;
}

QPushButton:disabled {
    background-color: #555;
    color: #888;
}

QPushButton.secondary {
    background-color: #0f3460;
    border: 1px solid #333;
}

QPushButton.secondary:hover {
    background-color: #1a4a7a;
}

QPushButton.success {
    background-color: #4ecca3;
}

QPushButton.success:hover {
    background-color: #6eddbb;
}

QLineEdit, QSpinBox, QComboBox, QTextEdit {
    background-color: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    color: #eee;
}

QLineEdit:focus, QSpinBox:focus, QComboBox:focus {
    border-color: #e94560;
}

QScrollArea {
    border: none;
    background-color: transparent;
}

QScrollBar:vertical {
    background-color: #1a1a2e;
    width: 12px;
    border-radius: 6px;
}

QScrollBar::handle:vertical {
    background-color: #333;
    border-radius: 6px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background-color: #e94560;
}

QProgressBar {
    background-color: #1a1a2e;
    border: 1px solid #333;
    border-radius: 4px;
    text-align: center;
}

QProgressBar::chunk {
    background-color: #e94560;
    border-radius: 3px;
}

QStatusBar {
    background-color: #16213e;
    border-top: 1px solid #333;
}

QListWidget {
    background-color: #0f3460;
    border: 1px solid #333;
    border-radius: 8px;
}

QListWidget::item {
    padding: 10px;
    border-bottom: 1px solid #333;
}

QListWidget::item:selected {
    background-color: #e94560;
}

QListWidget::item:hover {
    background-color: #1a4a7a;
}

QTabWidget::pane {
    border: 1px solid #333;
    background-color: #0f3460;
    border-radius: 8px;
}

QTabBar::tab {
    background-color: #16213e;
    padding: 10px 20px;
    margin-right: 2px;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
}

QTabBar::tab:selected {
    background-color: #e94560;
}

QGroupBox {
    border: 1px solid #333;
    border-radius: 8px;
    margin-top: 10px;
    padding-top: 10px;
}

QGroupBox::title {
    color: #e94560;
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 5px;
}

QSlider::groove:horizontal {
    height: 8px;
    background-color: #333;
    border-radius: 4px;
}

QSlider::handle:horizontal {
    background-color: #e94560;
    width: 18px;
    height: 18px;
    margin: -5px 0;
    border-radius: 9px;
}

QSlider::handle:horizontal:hover {
    background-color: #ff6b6b;
}

QSplitter::handle {
    background-color: #333;
}

QTreeWidget {
    background-color: #0f3460;
    border: 1px solid #333;
    border-radius: 8px;
}

QTreeWidget::item {
    padding: 5px;
}

QTreeWidget::item:selected {
    background-color: #e94560;
}
"""


# =============================================================================
# Worker Threads
# =============================================================================

class ScanWorker(QThread):
    """Background worker for scanning photos and extracting faces."""
    
    progress = pyqtSignal(int, int, str)  # current, total, message
    face_found = pyqtSignal(int, str, int)  # photo_id, path, face_count
    finished = pyqtSignal(int, int)  # photos_scanned, faces_found
    error = pyqtSignal(str)
    
    def __init__(self, db_path: str, folders: List[str], use_gpu: bool = True):
        super().__init__()
        self.db_path = db_path
        self.folders = folders
        self.use_gpu = use_gpu
        self._cancelled = False
        self.face_app = None
    
    def cancel(self):
        self._cancelled = True
    
    def run(self):
        try:
            from insightface.app import FaceAnalysis
            
            # Initialize face analysis
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if self.use_gpu else ['CPUExecutionProvider']
            self.face_app = FaceAnalysis(name='buffalo_l', providers=providers)
            self.face_app.prepare(ctx_id=0 if self.use_gpu else -1, det_size=(640, 640))
            
            engine, SessionLocal = init_db(self.db_path)
            session = SessionLocal()
            
            # Find all images
            all_images = []
            for folder in self.folders:
                folder_path = Path(folder)
                if folder_path.exists():
                    for ext in IMAGE_EXTENSIONS:
                        all_images.extend(folder_path.glob(f'**/*{ext}'))
                        all_images.extend(folder_path.glob(f'**/*{ext.upper()}'))
            
            all_images = sorted(set(all_images))
            
            # Filter out already scanned
            existing = set(r[0] for r in session.execute(
                text("SELECT path FROM photos")
            ).fetchall())
            new_images = [img for img in all_images if str(img) not in existing]
            
            total = len(new_images)
            photos_scanned = 0
            faces_found = 0
            
            for i, image_path in enumerate(new_images):
                if self._cancelled:
                    break
                
                self.progress.emit(i + 1, total, f"Scanning: {image_path.name}")
                
                try:
                    # Load image
                    with Image.open(image_path) as pil_img:
                        pil_img = ImageOps.exif_transpose(pil_img)
                        if pil_img.mode != 'RGB':
                            pil_img = pil_img.convert('RGB')
                        size = pil_img.size
                        img = np.array(pil_img)
                        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                    
                    # Compute hash
                    hasher = hashlib.sha256()
                    with open(image_path, 'rb') as f:
                        for chunk in iter(lambda: f.read(65536), b''):
                            hasher.update(chunk)
                    file_hash = hasher.hexdigest()
                    
                    # Create photo record
                    photo = Photo(
                        path=str(image_path),
                        filename=image_path.name,
                        file_hash=file_hash,
                        width=size[0],
                        height=size[1]
                    )
                    session.add(photo)
                    session.flush()
                    
                    # Extract faces
                    detected = self.face_app.get(img)
                    photo_faces = 0
                    
                    for face in detected:
                        bbox = face.bbox
                        width = bbox[2] - bbox[0]
                        height = bbox[3] - bbox[1]
                        
                        if width < 20 or height < 20:
                            continue
                        
                        face_record = Face(
                            photo_id=photo.id,
                            bbox_x1=float(bbox[0]),
                            bbox_y1=float(bbox[1]),
                            bbox_x2=float(bbox[2]),
                            bbox_y2=float(bbox[3]),
                            confidence=float(face.det_score)
                        )
                        face_record.set_embedding(face.embedding)
                        session.add(face_record)
                        photo_faces += 1
                        faces_found += 1
                    
                    session.commit()
                    photos_scanned += 1
                    
                    if photo_faces > 0:
                        self.face_found.emit(photo.id, str(image_path), photo_faces)
                
                except Exception as e:
                    logger.warning(f"Error processing {image_path}: {e}")
                    session.rollback()
            
            session.close()
            self.finished.emit(photos_scanned, faces_found)
            
        except Exception as e:
            logger.error(f"Scan error: {e}")
            self.error.emit(str(e))


class ClusterWorker(QThread):
    """Background worker for clustering faces."""
    
    progress = pyqtSignal(str)
    finished = pyqtSignal(int)  # run_id
    error = pyqtSignal(str)
    
    def __init__(self, db_path: str, threshold: float = 0.5, 
                 min_samples: int = 1, name: str = None,
                 apply_constraints: bool = True):
        super().__init__()
        self.db_path = db_path
        self.threshold = threshold
        self.min_samples = min_samples
        self.name = name
        self.apply_constraints = apply_constraints
    
    def run(self):
        try:
            from sklearn.cluster import DBSCAN, KMeans
            
            engine, SessionLocal = init_db(self.db_path)
            session = SessionLocal()
            
            self.progress.emit("Loading face embeddings...")
            
            faces = session.query(Face).all()
            if not faces:
                self.error.emit("No faces in database")
                return
            
            face_ids = [f.id for f in faces]
            embeddings = np.array([f.get_embedding() for f in faces])
            
            # Normalize embeddings
            self.progress.emit("Normalizing embeddings...")
            norm_embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
            
            # Cluster
            self.progress.emit(f"Clustering {len(faces)} faces...")
            clusterer = DBSCAN(
                eps=self.threshold,
                min_samples=self.min_samples,
                metric='euclidean',
                n_jobs=-1
            )
            labels = clusterer.fit_predict(norm_embeddings)
            
            # Load and apply constraints if requested
            constraints_json = None
            if self.apply_constraints:
                constraints = session.query(Constraint).filter(
                    Constraint.is_active == True
                ).all()
                
                if constraints:
                    self.progress.emit("Applying constraints...")
                    constraints_dict = self._build_constraints_dict(constraints)
                    constraints_json = json.dumps(constraints_dict)
                    
                    # Apply splits first
                    if 'split' in constraints_dict:
                        labels = self._apply_splits(
                            labels, norm_embeddings, face_ids,
                            constraints_dict['split'], session
                        )
                    
                    # Apply must-links
                    if 'must_link' in constraints_dict:
                        labels = self._apply_must_link(
                            labels, constraints_dict['must_link']
                        )
            
            # Create clustering run
            self.progress.emit("Saving results...")
            
            run = ClusteringRun(
                name=self.name or f"Run {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                distance_threshold=self.threshold,
                min_samples=self.min_samples,
                metric='cosine',
                constraints_json=constraints_json,
                total_faces=len(face_ids),
                num_clusters=len(set(l for l in labels if l >= 0)),
                num_outliers=int(np.sum(labels == -1))
            )
            session.add(run)
            session.flush()
            
            # Create clusters
            cluster_faces = defaultdict(list)
            for face_id, label in zip(face_ids, labels):
                cluster_faces[int(label)].append(face_id)
            
            for label, fids in cluster_faces.items():
                photo_count = session.query(func.count(func.distinct(Face.photo_id)))\
                    .filter(Face.id.in_(fids)).scalar()
                
                # Try to find existing name for this cluster
                cluster_name = None
                if label >= 0:
                    # Check if any face in this cluster has a named person
                    for fid in fids[:5]:  # Check first few
                        person = session.query(PersonName).filter(
                            PersonName.representative_face_id == fid
                        ).first()
                        if person:
                            cluster_name = person.name
                            break
                
                cluster = Cluster(
                    run_id=run.id,
                    cluster_label=label,
                    name=cluster_name,
                    face_count=len(fids),
                    photo_count=photo_count
                )
                session.add(cluster)
                session.flush()
                
                for fid in fids:
                    assignment = ClusterAssignment(face_id=fid, cluster_id=cluster.id)
                    session.add(assignment)
            
            session.commit()
            run_id = run.id  # Save ID before closing session
            session.close()
            
            self.finished.emit(run_id)
            
        except Exception as e:
            logger.error(f"Clustering error: {e}")
            self.error.emit(str(e))
    
    def _build_constraints_dict(self, constraints: List[Constraint]) -> dict:
        result = {'must_link': [], 'split': [], 'cannot_link': []}
        
        for c in constraints:
            if c.constraint_type == 'must_link' and c.cluster_labels:
                labels = [int(x) for x in c.cluster_labels.split(',')]
                result['must_link'].append({'person_ids': labels})
            
            elif c.constraint_type == 'split':
                entry = {
                    'person_id': c.target_cluster_label,
                    'into': c.split_into or 2
                }
                if c.anchor_photos:
                    entry['anchors'] = json.loads(c.anchor_photos)
                result['split'].append(entry)
            
            elif c.constraint_type == 'cannot_link' and c.cluster_labels:
                labels = [int(x) for x in c.cluster_labels.split(',')]
                result['cannot_link'].append({'person_ids': labels})
        
        return {k: v for k, v in result.items() if v}
    
    def _apply_must_link(self, labels: np.ndarray, must_link: list) -> np.ndarray:
        parent = {l: l for l in set(labels) if l >= 0}
        
        def find(x):
            if x not in parent:
                return x
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        for group in must_link:
            ids = group.get('person_ids', [])
            for i in range(len(ids) - 1):
                if ids[i] in parent and ids[i+1] in parent:
                    union(ids[i], ids[i+1])
        
        new_labels = labels.copy()
        for i, l in enumerate(labels):
            if l >= 0:
                new_labels[i] = find(l)
        
        unique = sorted(set(l for l in new_labels if l >= 0))
        mapping = {old: new for new, old in enumerate(unique)}
        mapping[-1] = -1
        
        return np.array([mapping.get(l, l) for l in new_labels])
    
    def _apply_splits(self, labels, embeddings, face_ids, splits, session):
        from sklearn.cluster import KMeans
        
        new_labels = labels.copy()
        next_label = max(labels) + 1
        id_to_idx = {fid: idx for idx, fid in enumerate(face_ids)}
        
        for split in splits:
            person_id = split.get('person_id')
            if person_id is None:
                continue
            
            cluster_mask = new_labels == person_id
            cluster_indices = np.where(cluster_mask)[0]
            
            if len(cluster_indices) <= 1:
                continue
            
            cluster_embeddings = embeddings[cluster_indices]
            n_clusters = split.get('into', 2)
            
            km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
            sub_labels = km.fit_predict(cluster_embeddings)
            
            for idx, sub_label in zip(cluster_indices, sub_labels):
                if sub_label > 0:
                    new_labels[idx] = next_label + sub_label - 1
            
            next_label += len(set(sub_labels)) - 1
        
        return new_labels


# =============================================================================
# Custom Widgets
# =============================================================================

class FaceThumbnail(QLabel):
    """A clickable, draggable face thumbnail widget."""
    
    clicked = pyqtSignal(int, bool)  # face_id, is_selected
    double_clicked = pyqtSignal(int)  # face_id
    drag_started = pyqtSignal(int)  # face_id
    
    def __init__(self, face_id: int, photo_path: str, bbox: tuple,
                 confidence: float, cluster_id: int, parent=None):
        super().__init__(parent)
        self.face_id = face_id
        self.photo_path = photo_path
        self.bbox = bbox
        self.confidence = confidence
        self.cluster_id = cluster_id
        self.selected = False
        self.drag_start_pos = None
        
        self.setFixedSize(120, 120)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setAcceptDrops(False)
        
        self._load_thumbnail()
        self._update_style()
    
    def _load_thumbnail(self):
        """Load and display face thumbnail."""
        try:
            img = cv2.imread(self.photo_path)
            if img is None:
                self.setText("?")
                return
            
            x1, y1, x2, y2 = [int(v) for v in self.bbox]
            h, w = img.shape[:2]
            pad = int((x2 - x1) * 0.2)
            x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
            x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
            
            crop = img[y1:y2, x1:x2]
            crop = cv2.resize(crop, (112, 112))
            crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            
            h, w, ch = crop.shape
            qimg = QImage(crop.data, w, h, ch * w, QImage.Format.Format_RGB888)
            pixmap = QPixmap.fromImage(qimg)
            self.setPixmap(pixmap)
            
        except Exception as e:
            logger.warning(f"Failed to load thumbnail: {e}")
            self.setText("?")
    
    def _update_style(self):
        if self.selected:
            self.setStyleSheet("""
                QLabel {
                    border: 3px solid #e94560;
                    border-radius: 8px;
                    background-color: #2a2a4e;
                }
            """)
        else:
            self.setStyleSheet("""
                QLabel {
                    border: 3px solid transparent;
                    border-radius: 8px;
                    background-color: #16213e;
                }
                QLabel:hover {
                    border-color: #4ecca3;
                }
            """)
    
    def setSelected(self, selected: bool):
        self.selected = selected
        self._update_style()
    
    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_start_pos = event.pos()
    
    def mouseMoveEvent(self, event: QMouseEvent):
        if not (event.buttons() & Qt.MouseButton.LeftButton):
            return
        if self.drag_start_pos is None:
            return
        
        # Check if we've moved enough to start a drag
        if (event.pos() - self.drag_start_pos).manhattanLength() < 20:
            return
        
        # Start drag
        drag = QDrag(self)
        mime_data = QMimeData()
        mime_data.setText(str(self.face_id))
        drag.setMimeData(mime_data)
        
        # Create drag pixmap
        pixmap = self.grab()
        drag.setPixmap(pixmap.scaled(80, 80, Qt.AspectRatioMode.KeepAspectRatio))
        drag.setHotSpot(QPoint(40, 40))
        
        self.drag_started.emit(self.face_id)
        drag.exec(Qt.DropAction.MoveAction)
    
    def mouseReleaseEvent(self, event: QMouseEvent):
        if event.button() == Qt.MouseButton.LeftButton:
            if self.drag_start_pos and \
               (event.pos() - self.drag_start_pos).manhattanLength() < 20:
                # This was a click, not a drag
                modifiers = QApplication.keyboardModifiers()
                ctrl = modifiers & Qt.KeyboardModifier.ControlModifier
                self.selected = not self.selected if ctrl else True
                self._update_style()
                self.clicked.emit(self.face_id, self.selected)
        self.drag_start_pos = None
    
    def mouseDoubleClickEvent(self, event: QMouseEvent):
        self.double_clicked.emit(self.face_id)


class PersonCard(QFrame):
    """A card displaying a person/cluster with their face thumbnails."""
    
    face_selected = pyqtSignal(int, int, bool)  # face_id, cluster_id, selected
    face_dropped = pyqtSignal(int, int, int)  # face_id, from_cluster, to_cluster
    name_changed = pyqtSignal(int, str)  # cluster_id, new_name
    split_requested = pyqtSignal(int)  # cluster_id
    
    def __init__(self, cluster_id: int, cluster_label: int, name: str,
                 face_count: int, photo_count: int, parent=None):
        super().__init__(parent)
        self.cluster_id = cluster_id
        self.cluster_label = cluster_label
        self.face_thumbnails: List[FaceThumbnail] = []
        
        self.setAcceptDrops(True)
        self.setMinimumHeight(200)
        self.setStyleSheet("""
            PersonCard {
                background-color: #16213e;
                border-radius: 12px;
                border: 1px solid #333;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(15, 15, 15, 15)
        
        # Header
        header = QHBoxLayout()
        
        # Editable name
        self.name_edit = QLineEdit(name or f"Person {cluster_label}")
        self.name_edit.setStyleSheet("""
            QLineEdit {
                background: transparent;
                border: none;
                border-bottom: 1px dashed #666;
                font-size: 16px;
                font-weight: bold;
                padding: 5px;
            }
            QLineEdit:focus {
                border-bottom: 1px solid #e94560;
            }
        """)
        self.name_edit.editingFinished.connect(self._on_name_changed)
        header.addWidget(self.name_edit)
        
        # Stats badges
        face_badge = QLabel(f"👤 {face_count}")
        face_badge.setStyleSheet("color: #aaa; padding: 5px;")
        header.addWidget(face_badge)
        
        photo_badge = QLabel(f"📷 {photo_count}")
        photo_badge.setStyleSheet("color: #aaa; padding: 5px;")
        header.addWidget(photo_badge)
        
        # Split button
        if cluster_label >= 0:
            split_btn = QPushButton("Split")
            split_btn.setProperty("class", "secondary")
            split_btn.setFixedWidth(60)
            split_btn.clicked.connect(lambda: self.split_requested.emit(self.cluster_id))
            header.addWidget(split_btn)
        
        layout.addLayout(header)
        
        # Face grid (scrollable)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        
        self.face_container = QWidget()
        self.face_layout = QGridLayout(self.face_container)
        self.face_layout.setSpacing(10)
        scroll.setWidget(self.face_container)
        
        layout.addWidget(scroll)
    
    def add_face(self, face_id: int, photo_path: str, bbox: tuple, confidence: float):
        """Add a face thumbnail to this card."""
        thumb = FaceThumbnail(face_id, photo_path, bbox, confidence, self.cluster_id)
        thumb.clicked.connect(lambda fid, sel: self.face_selected.emit(fid, self.cluster_id, sel))
        
        row = len(self.face_thumbnails) // 5
        col = len(self.face_thumbnails) % 5
        self.face_layout.addWidget(thumb, row, col)
        self.face_thumbnails.append(thumb)
    
    def remove_face(self, face_id: int):
        """Remove a face thumbnail from this card."""
        for thumb in self.face_thumbnails:
            if thumb.face_id == face_id:
                self.face_layout.removeWidget(thumb)
                thumb.deleteLater()
                self.face_thumbnails.remove(thumb)
                break
    
    def get_selected_faces(self) -> List[int]:
        """Get list of selected face IDs."""
        return [t.face_id for t in self.face_thumbnails if t.selected]
    
    def clear_selection(self):
        """Deselect all faces."""
        for thumb in self.face_thumbnails:
            thumb.setSelected(False)
    
    def _on_name_changed(self):
        new_name = self.name_edit.text().strip()
        if new_name:
            self.name_changed.emit(self.cluster_id, new_name)
    
    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasText():
            event.acceptProposedAction()
            self.setStyleSheet("""
                PersonCard {
                    background-color: #1a4a7a;
                    border-radius: 12px;
                    border: 2px solid #4ecca3;
                }
            """)
    
    def dragLeaveEvent(self, event):
        self.setStyleSheet("""
            PersonCard {
                background-color: #16213e;
                border-radius: 12px;
                border: 1px solid #333;
            }
        """)
    
    def dropEvent(self, event: QDropEvent):
        face_id = int(event.mimeData().text())
        
        # Find source cluster
        source_thumb = None
        for card in self.parent().findChildren(PersonCard):
            for thumb in card.face_thumbnails:
                if thumb.face_id == face_id:
                    source_thumb = thumb
                    source_cluster = card.cluster_id
                    break
            if source_thumb:
                break
        
        if source_thumb and source_cluster != self.cluster_id:
            self.face_dropped.emit(face_id, source_cluster, self.cluster_id)
        
        self.setStyleSheet("""
            PersonCard {
                background-color: #16213e;
                border-radius: 12px;
                border: 1px solid #333;
            }
        """)
        event.acceptProposedAction()


class WatchedFolderItem(QWidget):
    """Widget for a watched folder in the sidebar."""
    
    removed = pyqtSignal(int)  # folder_id
    scan_requested = pyqtSignal(int)  # folder_id
    
    def __init__(self, folder_id: int, path: str, is_active: bool, parent=None):
        super().__init__(parent)
        self.folder_id = folder_id
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Folder icon and name
        icon = QLabel("📁")
        layout.addWidget(icon)
        
        name = QLabel(Path(path).name)
        name.setToolTip(path)
        name.setStyleSheet("color: #eee;")
        layout.addWidget(name, 1)
        
        # Scan button
        scan_btn = QPushButton("🔄")
        scan_btn.setFixedSize(30, 30)
        scan_btn.setToolTip("Scan this folder")
        scan_btn.clicked.connect(lambda: self.scan_requested.emit(self.folder_id))
        layout.addWidget(scan_btn)
        
        # Remove button
        remove_btn = QPushButton("✕")
        remove_btn.setFixedSize(30, 30)
        remove_btn.setStyleSheet("QPushButton { background: #c73e54; }")
        remove_btn.clicked.connect(lambda: self.removed.emit(self.folder_id))
        layout.addWidget(remove_btn)


# =============================================================================
# Dialogs
# =============================================================================

class ClusterSettingsDialog(QDialog):
    """Dialog for clustering settings."""
    
    def __init__(self, current_threshold: float = 0.5, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Clustering Settings")
        self.setMinimumWidth(400)
        
        layout = QVBoxLayout(self)
        
        # Threshold
        threshold_group = QGroupBox("Distance Threshold")
        threshold_layout = QVBoxLayout(threshold_group)
        
        self.threshold_slider = QSlider(Qt.Orientation.Horizontal)
        self.threshold_slider.setMinimum(20)
        self.threshold_slider.setMaximum(80)
        self.threshold_slider.setValue(int(current_threshold * 100))
        self.threshold_slider.valueChanged.connect(self._update_threshold_label)
        threshold_layout.addWidget(self.threshold_slider)
        
        self.threshold_label = QLabel(f"{current_threshold:.2f}")
        self.threshold_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        threshold_layout.addWidget(self.threshold_label)
        
        hint = QLabel("Lower = stricter matching (more clusters)\nHigher = looser matching (fewer clusters)")
        hint.setStyleSheet("color: #888; font-size: 12px;")
        threshold_layout.addWidget(hint)
        
        layout.addWidget(threshold_group)
        
        # Run name
        name_group = QGroupBox("Run Settings")
        name_layout = QFormLayout(name_group)
        
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("Optional name for this run")
        name_layout.addRow("Name:", self.name_edit)
        
        self.apply_constraints = QCheckBox("Apply existing constraints")
        self.apply_constraints.setChecked(True)
        name_layout.addRow(self.apply_constraints)
        
        layout.addWidget(name_group)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _update_threshold_label(self, value):
        self.threshold_label.setText(f"{value / 100:.2f}")
    
    def get_settings(self) -> dict:
        return {
            'threshold': self.threshold_slider.value() / 100,
            'name': self.name_edit.text().strip() or None,
            'apply_constraints': self.apply_constraints.isChecked()
        }


class SplitDialog(QDialog):
    """Dialog for splitting a cluster."""
    
    def __init__(self, cluster_name: str, face_count: int, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Split: {cluster_name}")
        self.setMinimumWidth(350)
        
        layout = QVBoxLayout(self)
        
        info = QLabel(f"Split {face_count} faces into multiple people")
        info.setStyleSheet("color: #aaa;")
        layout.addWidget(info)
        
        form = QFormLayout()
        
        self.split_count = QSpinBox()
        self.split_count.setMinimum(2)
        self.split_count.setMaximum(min(10, face_count))
        self.split_count.setValue(2)
        form.addRow("Split into:", self.split_count)
        
        self.comment = QLineEdit()
        self.comment.setPlaceholderText("e.g., Two different people")
        form.addRow("Comment:", self.comment)
        
        layout.addLayout(form)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def get_settings(self) -> dict:
        return {
            'split_into': self.split_count.value(),
            'comment': self.comment.text().strip() or None
        }


# =============================================================================
# Main Window
# =============================================================================

class FaceIdentifierApp(QMainWindow):
    """Main application window."""
    
    def __init__(self, db_path: str = "faces.db"):
        super().__init__()
        self.db_path = db_path
        self.engine, self.SessionLocal = init_db(db_path)
        
        self.current_run_id: Optional[int] = None
        self.selected_faces: Set[int] = set()
        self.person_cards: Dict[int, PersonCard] = {}
        
        self.scan_worker: Optional[ScanWorker] = None
        self.cluster_worker: Optional[ClusterWorker] = None
        
        self._setup_ui()
        self._load_data()
    
    def _setup_ui(self):
        self.setWindowTitle("Face Identifier")
        self.setMinimumSize(1200, 800)
        
        # Menu bar
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("File")
        
        add_folder_action = QAction("Add Folder...", self)
        add_folder_action.setShortcut(QKeySequence("Ctrl+O"))
        add_folder_action.triggered.connect(self._add_folder)
        file_menu.addAction(add_folder_action)
        
        file_menu.addSeparator()
        
        export_action = QAction("Export Constraints...", self)
        export_action.triggered.connect(self._export_constraints)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        quit_action = QAction("Quit", self)
        quit_action.setShortcut(QKeySequence("Ctrl+Q"))
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)
        
        edit_menu = menubar.addMenu("Edit")
        
        merge_action = QAction("Merge Selected", self)
        merge_action.setShortcut(QKeySequence("Ctrl+M"))
        merge_action.triggered.connect(self._merge_selected)
        edit_menu.addAction(merge_action)
        
        clear_selection_action = QAction("Clear Selection", self)
        clear_selection_action.setShortcut(QKeySequence("Escape"))
        clear_selection_action.triggered.connect(self._clear_selection)
        edit_menu.addAction(clear_selection_action)
        
        view_menu = menubar.addMenu("View")
        
        # Toolbar
        toolbar = QToolBar()
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(24, 24))
        self.addToolBar(toolbar)
        
        scan_btn = QPushButton("🔍 Scan")
        scan_btn.clicked.connect(self._start_scan)
        toolbar.addWidget(scan_btn)
        
        cluster_btn = QPushButton("🧩 Cluster")
        cluster_btn.clicked.connect(self._start_clustering)
        toolbar.addWidget(cluster_btn)
        
        toolbar.addSeparator()
        
        # Run selector
        toolbar.addWidget(QLabel("  Run: "))
        self.run_combo = QComboBox()
        self.run_combo.setMinimumWidth(200)
        self.run_combo.currentIndexChanged.connect(self._on_run_changed)
        toolbar.addWidget(self.run_combo)
        
        toolbar.addSeparator()
        
        self.merge_btn = QPushButton("🔗 Merge Selected")
        self.merge_btn.setEnabled(False)
        self.merge_btn.clicked.connect(self._merge_selected)
        toolbar.addWidget(self.merge_btn)
        
        # Main splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)
        self.setCentralWidget(splitter)
        
        # Left sidebar - Folders
        sidebar = QWidget()
        sidebar.setMaximumWidth(300)
        sidebar.setMinimumWidth(200)
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(10, 10, 10, 10)
        
        sidebar_header = QHBoxLayout()
        sidebar_header.addWidget(QLabel("Watched Folders"))
        add_btn = QPushButton("+")
        add_btn.setFixedSize(30, 30)
        add_btn.clicked.connect(self._add_folder)
        sidebar_header.addWidget(add_btn)
        sidebar_layout.addLayout(sidebar_header)
        
        self.folder_list = QListWidget()
        sidebar_layout.addWidget(self.folder_list)
        
        # Stats
        stats_group = QGroupBox("Statistics")
        stats_layout = QGridLayout(stats_group)
        
        self.photos_label = QLabel("0")
        self.photos_label.setStyleSheet("font-size: 24px; font-weight: bold; color: #e94560;")
        stats_layout.addWidget(QLabel("Photos:"), 0, 0)
        stats_layout.addWidget(self.photos_label, 0, 1)
        
        self.faces_label = QLabel("0")
        self.faces_label.setStyleSheet("font-size: 24px; font-weight: bold; color: #e94560;")
        stats_layout.addWidget(QLabel("Faces:"), 1, 0)
        stats_layout.addWidget(self.faces_label, 1, 1)
        
        self.people_label = QLabel("0")
        self.people_label.setStyleSheet("font-size: 24px; font-weight: bold; color: #e94560;")
        stats_layout.addWidget(QLabel("People:"), 2, 0)
        stats_layout.addWidget(self.people_label, 2, 1)
        
        sidebar_layout.addWidget(stats_group)
        
        splitter.addWidget(sidebar)
        
        # Main content area
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(10, 10, 10, 10)
        
        # Progress bar (hidden by default)
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        content_layout.addWidget(self.progress_bar)
        
        self.progress_label = QLabel()
        self.progress_label.setVisible(False)
        self.progress_label.setStyleSheet("color: #aaa;")
        content_layout.addWidget(self.progress_label)
        
        # Person cards scroll area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        
        self.cards_container = QWidget()
        self.cards_layout = QVBoxLayout(self.cards_container)
        self.cards_layout.setSpacing(15)
        self.cards_layout.addStretch()
        
        scroll.setWidget(self.cards_container)
        content_layout.addWidget(scroll)
        
        splitter.addWidget(content)
        splitter.setSizes([250, 950])
        
        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")
    
    def _get_session(self) -> Session:
        return self.SessionLocal()
    
    def _load_data(self):
        """Load initial data from database."""
        session = self._get_session()
        try:
            # Load stats
            photo_count = session.query(func.count(Photo.id)).scalar() or 0
            face_count = session.query(func.count(Face.id)).scalar() or 0
            
            self.photos_label.setText(str(photo_count))
            self.faces_label.setText(str(face_count))
            
            # Load watched folders
            self._refresh_folder_list()
            
            # Load clustering runs
            self._refresh_run_list()
            
        finally:
            session.close()
    
    def _refresh_folder_list(self):
        """Refresh the watched folders list."""
        self.folder_list.clear()
        
        session = self._get_session()
        try:
            folders = session.query(WatchedFolder).filter(
                WatchedFolder.is_active == True
            ).all()
            
            for folder in folders:
                item = QListWidgetItem()
                widget = WatchedFolderItem(folder.id, folder.path, folder.is_active)
                widget.removed.connect(self._remove_folder)
                widget.scan_requested.connect(self._scan_folder)
                
                item.setSizeHint(widget.sizeHint())
                self.folder_list.addItem(item)
                self.folder_list.setItemWidget(item, widget)
        finally:
            session.close()
    
    def _refresh_run_list(self):
        """Refresh the clustering runs dropdown."""
        self.run_combo.blockSignals(True)
        self.run_combo.clear()
        
        session = self._get_session()
        try:
            runs = session.query(ClusteringRun).order_by(
                ClusteringRun.created_at.desc()
            ).all()
            
            if not runs:
                self.run_combo.addItem("No clustering runs", None)
            else:
                for run in runs:
                    name = run.name or f"Run #{run.id}"
                    label = f"{name} ({run.num_clusters} people)"
                    self.run_combo.addItem(label, run.id)
                
                # Select most recent
                self.current_run_id = runs[0].id
                self.run_combo.setCurrentIndex(0)
                self._load_run(runs[0].id)
        finally:
            session.close()
            self.run_combo.blockSignals(False)
    
    def _on_run_changed(self, index):
        """Handle run selection change."""
        run_id = self.run_combo.currentData()
        if run_id:
            self.current_run_id = run_id
            self._load_run(run_id)
    
    def _load_run(self, run_id: int):
        """Load and display a clustering run."""
        # Clear existing cards
        for card in self.person_cards.values():
            card.deleteLater()
        self.person_cards.clear()
        self.selected_faces.clear()
        
        session = self._get_session()
        try:
            run = session.query(ClusteringRun).get(run_id)
            if not run:
                return
            
            self.people_label.setText(str(run.num_clusters))
            
            # Load clusters
            clusters = session.query(Cluster).filter(
                Cluster.run_id == run_id
            ).order_by(Cluster.face_count.desc()).all()
            
            for cluster in clusters:
                card = PersonCard(
                    cluster.id,
                    cluster.cluster_label,
                    cluster.name,
                    cluster.face_count,
                    cluster.photo_count
                )
                card.face_selected.connect(self._on_face_selected)
                card.face_dropped.connect(self._on_face_dropped)
                card.name_changed.connect(self._on_name_changed)
                card.split_requested.connect(self._on_split_requested)
                
                # Load faces for this cluster
                assignments = session.query(ClusterAssignment, Face, Photo)\
                    .join(Face, ClusterAssignment.face_id == Face.id)\
                    .join(Photo, Face.photo_id == Photo.id)\
                    .filter(ClusterAssignment.cluster_id == cluster.id)\
                    .order_by(Face.confidence.desc())\
                    .limit(50).all()
                
                for _, face, photo in assignments:
                    bbox = (face.bbox_x1, face.bbox_y1, face.bbox_x2, face.bbox_y2)
                    card.add_face(face.id, photo.path, bbox, face.confidence)
                
                # Insert before the stretch
                self.cards_layout.insertWidget(
                    self.cards_layout.count() - 1, card
                )
                self.person_cards[cluster.id] = card
            
            self.status_bar.showMessage(
                f"Loaded run #{run_id}: {run.num_clusters} people, {run.total_faces} faces"
            )
            
        finally:
            session.close()
    
    def _add_folder(self):
        """Add a new watched folder."""
        folder = QFileDialog.getExistingDirectory(
            self, "Select Folder to Watch"
        )
        if folder:
            session = self._get_session()
            try:
                # Check if already exists
                existing = session.query(WatchedFolder).filter(
                    WatchedFolder.path == folder
                ).first()
                
                if existing:
                    if not existing.is_active:
                        existing.is_active = True
                        session.commit()
                    else:
                        QMessageBox.information(
                            self, "Info", "This folder is already being watched."
                        )
                        return
                else:
                    watched = WatchedFolder(path=folder, recursive=True)
                    session.add(watched)
                    session.commit()
                
                self._refresh_folder_list()
                self.status_bar.showMessage(f"Added folder: {folder}")
                
            finally:
                session.close()
    
    def _remove_folder(self, folder_id: int):
        """Remove a watched folder."""
        session = self._get_session()
        try:
            folder = session.query(WatchedFolder).get(folder_id)
            if folder:
                folder.is_active = False
                session.commit()
            self._refresh_folder_list()
        finally:
            session.close()
    
    def _scan_folder(self, folder_id: int):
        """Scan a specific folder."""
        session = self._get_session()
        try:
            folder = session.query(WatchedFolder).get(folder_id)
            if folder:
                self._start_scan([folder.path])
        finally:
            session.close()
    
    def _start_scan(self, folders: List[str] = None):
        """Start scanning for faces."""
        if self.scan_worker and self.scan_worker.isRunning():
            QMessageBox.warning(self, "Busy", "A scan is already in progress.")
            return
        
        if folders is None:
            # Get all active watched folders
            session = self._get_session()
            try:
                watched = session.query(WatchedFolder).filter(
                    WatchedFolder.is_active == True
                ).all()
                folders = [w.path for w in watched]
            finally:
                session.close()
        
        if not folders:
            QMessageBox.information(
                self, "No Folders",
                "Add some folders to watch first."
            )
            return
        
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.progress_label.setVisible(True)
        self.progress_label.setText("Initializing face detection...")
        
        self.scan_worker = ScanWorker(self.db_path, folders)
        self.scan_worker.progress.connect(self._on_scan_progress)
        self.scan_worker.finished.connect(self._on_scan_finished)
        self.scan_worker.error.connect(self._on_scan_error)
        self.scan_worker.start()
    
    def _on_scan_progress(self, current: int, total: int, message: str):
        self.progress_bar.setMaximum(total)
        self.progress_bar.setValue(current)
        self.progress_label.setText(message)
    
    def _on_scan_finished(self, photos: int, faces: int):
        self.progress_bar.setVisible(False)
        self.progress_label.setVisible(False)
        self._load_data()
        
        QMessageBox.information(
            self, "Scan Complete",
            f"Scanned {photos} new photos and found {faces} faces."
        )
    
    def _on_scan_error(self, error: str):
        self.progress_bar.setVisible(False)
        self.progress_label.setVisible(False)
        QMessageBox.critical(self, "Scan Error", error)
    
    def _start_clustering(self):
        """Start clustering faces."""
        if self.cluster_worker and self.cluster_worker.isRunning():
            QMessageBox.warning(self, "Busy", "Clustering is already in progress.")
            return
        
        dialog = ClusterSettingsDialog(parent=self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return
        
        settings = dialog.get_settings()
        
        self.progress_bar.setVisible(True)
        self.progress_bar.setMaximum(0)  # Indeterminate
        self.progress_label.setVisible(True)
        
        self.cluster_worker = ClusterWorker(
            self.db_path,
            threshold=settings['threshold'],
            name=settings['name'],
            apply_constraints=settings['apply_constraints']
        )
        self.cluster_worker.progress.connect(self._on_cluster_progress)
        self.cluster_worker.finished.connect(self._on_cluster_finished)
        self.cluster_worker.error.connect(self._on_cluster_error)
        self.cluster_worker.start()
    
    def _on_cluster_progress(self, message: str):
        self.progress_label.setText(message)
    
    def _on_cluster_finished(self, run_id: int):
        self.progress_bar.setVisible(False)
        self.progress_label.setVisible(False)
        
        self._refresh_run_list()
        
        # Select the new run
        for i in range(self.run_combo.count()):
            if self.run_combo.itemData(i) == run_id:
                self.run_combo.setCurrentIndex(i)
                break
        
        self.status_bar.showMessage(f"Clustering complete! Created run #{run_id}")
    
    def _on_cluster_error(self, error: str):
        self.progress_bar.setVisible(False)
        self.progress_label.setVisible(False)
        QMessageBox.critical(self, "Clustering Error", error)
    
    def _on_face_selected(self, face_id: int, cluster_id: int, selected: bool):
        """Handle face selection."""
        if selected:
            self.selected_faces.add(face_id)
        else:
            self.selected_faces.discard(face_id)
        
        # Update merge button
        selected_clusters = set()
        for card in self.person_cards.values():
            if card.get_selected_faces():
                selected_clusters.add(card.cluster_id)
        
        self.merge_btn.setEnabled(len(selected_clusters) >= 2)
        
        self.status_bar.showMessage(
            f"{len(self.selected_faces)} faces selected from {len(selected_clusters)} clusters"
        )
    
    def _on_face_dropped(self, face_id: int, from_cluster: int, to_cluster: int):
        """Handle drag-and-drop of a face between clusters."""
        session = self._get_session()
        try:
            # Get cluster labels
            from_cl = session.query(Cluster).get(from_cluster)
            to_cl = session.query(Cluster).get(to_cluster)
            
            if not from_cl or not to_cl:
                return
            
            # Create must-link constraint
            constraint = Constraint(
                constraint_type='must_link',
                cluster_labels=f"{from_cl.cluster_label},{to_cl.cluster_label}",
                reference_run_id=self.current_run_id,
                comment=f"Merged via drag-drop"
            )
            session.add(constraint)
            session.commit()
            
            self.status_bar.showMessage(
                f"Created merge constraint: {from_cl.name or from_cl.cluster_label} → "
                f"{to_cl.name or to_cl.cluster_label}. Re-cluster to apply."
            )
            
        finally:
            session.close()
    
    def _on_name_changed(self, cluster_id: int, new_name: str):
        """Handle cluster name change."""
        session = self._get_session()
        try:
            cluster = session.query(Cluster).get(cluster_id)
            if cluster:
                cluster.name = new_name
                session.commit()
                
                # Also create/update PersonName for persistence
                # Get a representative face
                assignment = session.query(ClusterAssignment).filter(
                    ClusterAssignment.cluster_id == cluster_id
                ).first()
                
                if assignment:
                    person = session.query(PersonName).filter(
                        PersonName.name == new_name
                    ).first()
                    
                    if not person:
                        person = PersonName(
                            name=new_name,
                            representative_face_id=assignment.face_id
                        )
                        session.add(person)
                        session.commit()
                
            self.status_bar.showMessage(f"Renamed to: {new_name}")
        finally:
            session.close()
    
    def _on_split_requested(self, cluster_id: int):
        """Handle split request for a cluster."""
        card = self.person_cards.get(cluster_id)
        if not card:
            return
        
        session = self._get_session()
        try:
            cluster = session.query(Cluster).get(cluster_id)
            if not cluster:
                return
            
            dialog = SplitDialog(
                cluster.name or f"Person {cluster.cluster_label}",
                cluster.face_count,
                parent=self
            )
            
            if dialog.exec() == QDialog.DialogCode.Accepted:
                settings = dialog.get_settings()
                
                constraint = Constraint(
                    constraint_type='split',
                    target_cluster_label=cluster.cluster_label,
                    split_into=settings['split_into'],
                    reference_run_id=self.current_run_id,
                    comment=settings['comment']
                )
                session.add(constraint)
                session.commit()
                
                self.status_bar.showMessage(
                    f"Created split constraint for {cluster.name or cluster.cluster_label}. "
                    "Re-cluster to apply."
                )
        finally:
            session.close()
    
    def _merge_selected(self):
        """Merge selected clusters."""
        selected_clusters = set()
        for card in self.person_cards.values():
            if card.get_selected_faces():
                selected_clusters.add(card.cluster_id)
        
        if len(selected_clusters) < 2:
            QMessageBox.information(
                self, "Select More",
                "Select faces from at least 2 different clusters to merge."
            )
            return
        
        session = self._get_session()
        try:
            # Get cluster labels
            cluster_labels = []
            cluster_names = []
            for cid in selected_clusters:
                cluster = session.query(Cluster).get(cid)
                if cluster:
                    cluster_labels.append(str(cluster.cluster_label))
                    cluster_names.append(cluster.name or f"Person {cluster.cluster_label}")
            
            # Confirm
            reply = QMessageBox.question(
                self, "Confirm Merge",
                f"Merge these clusters?\n\n" + "\n".join(f"• {n}" for n in cluster_names),
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply != QMessageBox.StandardButton.Yes:
                return
            
            # Create constraint
            constraint = Constraint(
                constraint_type='must_link',
                cluster_labels=','.join(cluster_labels),
                reference_run_id=self.current_run_id,
                comment="Manual merge"
            )
            session.add(constraint)
            session.commit()
            
            self._clear_selection()
            
            self.status_bar.showMessage(
                f"Created merge constraint for {len(cluster_labels)} clusters. "
                "Re-cluster to apply."
            )
            
        finally:
            session.close()
    
    def _clear_selection(self):
        """Clear all selections."""
        for card in self.person_cards.values():
            card.clear_selection()
        self.selected_faces.clear()
        self.merge_btn.setEnabled(False)
        self.status_bar.showMessage("Selection cleared")
    
    def _export_constraints(self):
        """Export constraints to JSON file."""
        filename, _ = QFileDialog.getSaveFileName(
            self, "Export Constraints", "constraints.json",
            "JSON Files (*.json)"
        )
        
        if not filename:
            return
        
        session = self._get_session()
        try:
            constraints = session.query(Constraint).filter(
                Constraint.is_active == True
            ).all()
            
            export = {'must_link': [], 'split': [], 'cannot_link': [], 'names': {}}
            
            for c in constraints:
                if c.constraint_type == 'must_link' and c.cluster_labels:
                    labels = [int(x) for x in c.cluster_labels.split(',')]
                    entry = {'person_ids': labels}
                    if c.comment:
                        entry['comment'] = c.comment
                    export['must_link'].append(entry)
                
                elif c.constraint_type == 'split':
                    entry = {
                        'person_id': c.target_cluster_label,
                        'into': c.split_into or 2
                    }
                    if c.anchor_photos:
                        entry['anchors'] = json.loads(c.anchor_photos)
                    if c.comment:
                        entry['comment'] = c.comment
                    export['split'].append(entry)
                
                elif c.constraint_type == 'cannot_link' and c.cluster_labels:
                    labels = [int(x) for x in c.cluster_labels.split(',')]
                    entry = {'person_ids': labels}
                    if c.comment:
                        entry['comment'] = c.comment
                    export['cannot_link'].append(entry)
            
            # Clean up empty arrays
            export = {k: v for k, v in export.items() if v}
            
            with open(filename, 'w') as f:
                json.dump(export, f, indent=2)
            
            self.status_bar.showMessage(f"Exported constraints to {filename}")
            
        finally:
            session.close()
    
    def closeEvent(self, event):
        """Handle window close."""
        if self.scan_worker and self.scan_worker.isRunning():
            reply = QMessageBox.question(
                self, "Scan in Progress",
                "A scan is still running. Stop and exit?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.No:
                event.ignore()
                return
            self.scan_worker.cancel()
            self.scan_worker.wait()
        
        event.accept()


# =============================================================================
# Entry Point
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Face Identifier Desktop App')
    parser.add_argument('--db', type=str, default='faces.db',
                        help='Database file path')
    args = parser.parse_args()
    
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    app.setStyleSheet(DARK_STYLE)
    
    # Set application metadata
    app.setApplicationName("Face Identifier")
    app.setOrganizationName("FaceID")
    
    window = FaceIdentifierApp(db_path=args.db)
    window.show()
    
    sys.exit(app.exec())


if __name__ == '__main__':
    main()