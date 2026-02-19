# Face Identifier Desktop Application

A PyQt6-based desktop tool for managing face identification with incremental learning and visual constraint editing.

![Screenshot placeholder](screenshot.png)

## Features

- **Visual Face Management**: See all detected faces organized by person in a modern dark-themed UI
- **Drag-and-Drop Merging**: Drag a face from one person to another to create merge constraints
- **Click-to-Select**: Click faces to select them, then merge multiple clusters at once
- **Split Clusters**: When two people are incorrectly merged, split them apart
- **Inline Naming**: Click on any person's name to edit it directly
- **Watched Folders**: Add folders to watch and scan for new photos incrementally
- **Constraint System**: All corrections are saved as constraints that persist across re-clustering
- **Adjustable Sensitivity**: Tune the clustering threshold to balance precision vs. grouping

## Installation

### Prerequisites

- Python 3.10 or later
- CUDA-capable GPU (recommended) or CPU

### Setup

```bash
# Clone or download the repository
cd face_app

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# For CPU-only (no NVIDIA GPU):
pip install onnxruntime
# Instead of onnxruntime-gpu
```

## Usage

### Quick Start

```bash
# Launch the application
python face_desktop.py

# Or specify a different database file
python face_desktop.py --db my_photos.db
```

### Workflow

1. **Add Folders**: Click the `+` button in the sidebar to add folders containing photos
2. **Scan**: Click "🔍 Scan" to detect faces in all watched folders
3. **Cluster**: Click "🧩 Cluster" to group faces into people
4. **Review & Correct**:
   - **Merge**: Drag a face to another person's card, or select faces from multiple clusters and click "Merge"
   - **Split**: Click "Split" on a person card if two different people are grouped together
   - **Rename**: Click on "Person X" to give them a real name
5. **Re-cluster**: After making corrections, click "Cluster" again to apply your constraints

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Add folder |
| `Ctrl+M` | Merge selected clusters |
| `Escape` | Clear selection |
| `Ctrl+Q` | Quit |

### Tips

- **Lower threshold** (e.g., 0.35) = stricter matching, more separate clusters, fewer mistakes
- **Higher threshold** (e.g., 0.55) = looser matching, more grouping, may merge different people
- Start with a lower threshold and merge as needed—it's easier than splitting
- Name the people you recognize early—names persist across re-clustering runs

## Architecture

```
face_app/
├── face_desktop.py    # Main PyQt application
├── models.py          # SQLAlchemy database models
├── requirements.txt   # Python dependencies
└── README.md          # This file
```

### Database Schema

- **photos**: Scanned image files
- **faces**: Detected faces with embeddings
- **clustering_runs**: History of clustering attempts
- **clusters**: Groups of faces (people) per run
- **cluster_assignments**: Links faces to clusters
- **constraints**: User corrections (must-link, split, cannot-link)
- **watched_folders**: Folders being monitored
- **person_names**: Persistent names across runs

## Integration with CLI Tool

This desktop app uses the same database format as the CLI `face_identifier.py`. You can:

```bash
# Scan with CLI, review in desktop
python face_identifier.py scan /photos --db faces.db
python face_desktop.py --db faces.db

# Export constraints for CLI use
# (Use File → Export Constraints in the app)
python face_identifier.py cluster --db faces.db --constraints constraints.json
```

## Troubleshooting

### "No module named 'insightface'"
```bash
pip install insightface
```

### "CUDA not available"
The app will fall back to CPU. For GPU support:
```bash
pip install onnxruntime-gpu
```

### Faces not detected
- Ensure images are not corrupted
- Very small faces (< 20px) are skipped
- Try increasing `det_size` in the code for higher resolution detection

### Clustering seems wrong
- Try a different threshold (lower = stricter)
- The model works best with clear, front-facing photos
- Very different lighting/angles of the same person may not cluster together

## License

MIT License - Feel free to modify and distribute.

## Credits

- Face detection: [InsightFace](https://github.com/deepinsight/insightface)
- GUI Framework: [PyQt6](https://www.riverbankcomputing.com/software/pyqt/)
- Clustering: [scikit-learn](https://scikit-learn.org/)