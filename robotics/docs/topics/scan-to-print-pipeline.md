> **Provenance:** Desk research from the abandoned `3d-mapping` project (2025). Never validated
> on hardware — treat tool choices and parameters as starting points, not proven procedure.

# Software Pipeline

## Overview

The pipeline takes raw sensor data from a ROS2 bag capture and produces a clean mesh ready for CAD import and 3D printing. It is divided into five stages: capture, odometry, reconstruction, mesh processing, and CAD integration.

---

## Stage 1 — Capture

All sensors publish to ROS2 topics simultaneously. Data is recorded to a rosbag for offline processing.

### Key Topics

| Topic | Sensor | Type |
|---|---|---|
| `/livox/lidar` | Livox Horizon | `livox_ros_driver2/msg/CustomMsg` |
| `/livox/imu` | Livox Horizon (internal IMU) | `sensor_msgs/msg/Imu` |
| `/imu/data` | RealSense D435i IMU | `sensor_msgs/msg/Imu` |
| `/imu/witmotion` | Witmotion WT901C | `sensor_msgs/msg/Imu` |
| `/camera/depth/points` | RealSense D435i | `sensor_msgs/msg/PointCloud2` |
| `/camera/color/image_raw` | RealSense D435i RGB | `sensor_msgs/msg/Image` |
| `/flir/image_raw` | FLIR BFS-U3-120S4C | `sensor_msgs/msg/Image` |
| `/ov9281/left/image_raw` | OV9281 left | `sensor_msgs/msg/Image` |
| `/ov9281/right/image_raw` | OV9281 right | `sensor_msgs/msg/Image` |

### Capture Tips

- Move slowly and deliberately — target ~0.2–0.3 m/s scan pace
- Maintain 30–50% frame-to-frame image overlap
- Include a ChArUco calibration board in the first few frames of each session for post-hoc scale verification
- For small objects: use a turntable with the rig stationary, rotate object in 10–15° increments
- For large objects: walk the rig slowly around the subject, maintaining consistent standoff distance
- Avoid sudden direction changes — smooth arcs give better IMU integration

---

## Stage 2 — LiDAR-Inertial Odometry

Produces a 6DOF trajectory and a dense point cloud in a metric coordinate frame.

### Primary Tool: FAST-LIO2

Recommended for handheld use — lightweight, excellent Livox support, robust to aggressive motion.

```bash
ros2 launch fast_lio mapping_livox.launch.py
```

Key config parameters (`config/livox_lio.yaml`):
- `lidar_type: 6` (Livox Horizon)
- `time_offset_lidar_to_imu` — calibrate per [calibration guide](multi-sensor-calibration.md)
- `extrinsic_T` / `extrinsic_R` — LiDAR to IMU extrinsic, calibrate before first use

**Output:** dense `.pcd` point cloud + trajectory file

### Alternative: LIO-SAM

Better for long trajectories and outdoor scenes where loop closure matters. More complex to configure. Use if FAST-LIO2 trajectory drift is unacceptable on larger captures.

---

## Stage 3 — Camera Pose Estimation

COLMAP estimates camera poses from the image sequence, initialized using the FAST-LIO2 trajectory to improve robustness and skip the most expensive SfM steps.

### Option A — COLMAP with LiDAR-Initialized Poses (Recommended)

1. Extract images from rosbag (FLIR primary + OV9281s):
```bash
ros2 run image_transport republish raw --ros-args -r in:=/flir/image_raw -r out:=/flir/image_raw
# use ros2 bag play + image_saver or custom extraction script
```

2. Run COLMAP feature extraction and matching:
```bash
colmap feature_extractor --image_path ./images --database_path ./colmap.db
colmap exhaustive_matcher --database_path ./colmap.db
```

3. Initialize COLMAP poses from FAST-LIO2 trajectory (use provided script):
```bash
python3 scripts/lidar_to_colmap_init.py \
  --trajectory fast_lio_trajectory.txt \
  --database colmap.db \
  --images ./images
```

4. Run COLMAP mapper with fixed poses:
```bash
colmap mapper --database_path ./colmap.db \
  --image_path ./images \
  --output_path ./sparse \
  --Mapper.fix_existing_images 1
```

### Option B — LVI-SAM (Tightly Coupled LiDAR-Visual-Inertial)

Directly fuses camera frames into the SLAM pipeline for joint pose estimation. More setup complexity but tighter coupling. Recommended once the pipeline is stable and you want to improve pose accuracy.

### LiDAR + Camera Point Cloud Fusion

After COLMAP, register the FAST-LIO2 point cloud to the COLMAP sparse cloud using ICP (Open3D):

```python
import open3d as o3d

lidar_cloud = o3d.io.read_point_cloud("fast_lio_output.pcd")
colmap_cloud = o3d.io.read_point_cloud("colmap_sparse.ply")

reg = o3d.pipelines.registration.registration_icp(
    lidar_cloud, colmap_cloud,
    max_correspondence_distance=0.05,
    estimation_method=o3d.pipelines.registration.TransformationEstimationPointToPoint()
)

lidar_cloud_aligned = lidar_cloud.transform(reg.transformation)
o3d.io.write_point_cloud("lidar_aligned.pcd", lidar_cloud_aligned)
```

---

## Stage 4 — 3D Reconstruction

### Primary Tool: nerfstudio (splatfacto — 3D Gaussian Splatting)

nerfstudio ingests COLMAP output directly and supports depth supervision from the LiDAR point cloud via a depth loss term.

```bash
# Install nerfstudio
pip install nerfstudio

# Prepare data (converts COLMAP output to nerfstudio format)
ns-process-data images --data ./images --output-dir ./nerfstudio_data

# Train with depth supervision
ns-train splatfacto \
  --data ./nerfstudio_data \
  --pipeline.model.depth-loss-mult 0.1 \
  --pipeline.model.use-depth-loss True
```

**GPU requirement:** RTX 3080 (10GB) is sufficient for medium scenes. Large scenes may need chunking — see nerfstudio documentation on scene cropping.

### Alternative: DN-Splatter

Depth and normal regularized Gaussian Splatting. Explicitly designed to consume LiDAR depth priors. Produces better geometry on textureless surfaces.

```bash
git clone https://github.com/maturk/dn-splatter
# Follow installation instructions in repo
python train.py --config configs/dn_splatter.yaml \
  --data.lidar_path ./lidar_aligned.pcd
```

### RealSense Depth Integration

The RealSense D435i active IR depth frames provide additional close-range depth supervision (Livox is sparse below ~50cm). Extract depth images from rosbag and convert to point clouds before feeding into nerfstudio.

---

## Stage 5 — Mesh Extraction & Cleanup

3DGS models are volumetric — they need to be converted to an explicit mesh for CAD import.

### Extract Mesh from 3DGS (nerfstudio)

```bash
ns-export gaussian-splat \
  --load-config outputs/.../config.yml \
  --output-dir ./mesh_export \
  --target-num-faces 2000000
```

### Mesh Cleanup (Open3D)

```python
import open3d as o3d

mesh = o3d.io.read_triangle_mesh("raw_mesh.ply")

# Remove small disconnected components
mesh = mesh.remove_unreferenced_vertices()
mesh = mesh.remove_degenerate_triangles()
mesh = mesh.remove_duplicated_triangles()
mesh = mesh.remove_duplicated_vertices()

# Smooth
mesh = mesh.filter_smooth_laplacian(number_of_iterations=5)

# Recompute normals
mesh.compute_vertex_normals()

o3d.io.write_triangle_mesh("cleaned_mesh.ply", mesh)
```

### Mesh Cleanup (Blender — recommended for complex cleanup)

1. Import `.ply` into Blender
2. Use **Remesh** modifier (Voxel mode) to create a manifold mesh at target resolution
3. Use **Decimate** modifier to reduce polygon count for CAD import
4. Inspect for holes — use **3D Print Toolbox** add-on to identify non-manifold edges
5. Export as `.stl` or `.obj` for CAD import

---

## Stage 6 — CAD Integration

### OnShape

OnShape supports importing mesh files as reference geometry. Workflow:

1. Export cleaned mesh as `.stl` from Blender
2. In OnShape: **Insert** → **Import** → select `.stl`
3. Mesh imports as a reference body (not editable as solid)
4. Model new parametric parts around the mesh geometry
5. Use **Mate connectors** referenced to mesh faces for alignment
6. Export new parts as `.stl` for printing

**Note:** OnShape cannot convert meshes to BREP solids. For mesh-to-solid conversion consider:
- **Fusion 360** — Mesh workspace → Convert to BRep (works for simple organic forms, struggles with complex geometry)
- **Plasticity** — purpose-built for mesh-to-solid conversion, strong at organic shapes
- **Geomagic Design X** — professional reverse engineering, expensive but best in class

### Recommended Workflow for Print-Around Parts

1. Scan subject → clean mesh in Blender
2. Import into OnShape as reference
3. Model mounting features, brackets, or enclosures parametrically around the mesh
4. Keep the scan mesh as a reference body only — do not try to directly print the raw scan
5. Boolean subtract the scan mesh from your new part if you need a fitted cavity (OnShape supports this with imported mesh bodies)

---

## Stage 7 — 3D Printing

- Export final parts as `.stl` from OnShape
- Import into slicer (PrusaSlicer, Bambu Studio, OrcaSlicer)
- Recommend **ASA or PETG** for functional parts, PLA for test prints
- Use 0.2mm layer height, 4 wall perimeters, 40% infill for structural parts
- Test fit against scanned object before final print

---

## Utility Scripts

Scripts to be developed in `scripts/`:

| Script | Purpose |
|---|---|
| `extract_images.py` | Extract timestamped images from rosbag by topic |
| `lidar_to_colmap_init.py` | Initialize COLMAP poses from FAST-LIO2 trajectory |
| `depth_to_pointcloud.py` | Convert RealSense depth images to point cloud |
| `fuse_pointclouds.py` | ICP registration of LiDAR and COLMAP clouds |
| `batch_scan.py` | Automated turntable scan capture (stepper + trigger) |