> **Provenance:** Desk research from the abandoned `3d-mapping` project (2025). Never validated
> on hardware — treat tool choices and parameters as starting points, not proven procedure.

# Calibration Procedures

Calibration is one of the highest-leverage steps in the pipeline. Errors here propagate through every subsequent stage. Budget a full day for initial calibration and re-run whenever any sensor is physically moved.

---

## Overview

| Calibration | Tools | When |
|---|---|---|
| Camera intrinsics | OpenCV / ROS2 camera_calibration | Once per lens, re-run if lens is changed |
| Camera-to-camera extrinsics | Kalibr | Once per rig assembly |
| LiDAR-to-camera extrinsic | livox_camera_calib | Once per rig assembly |
| LiDAR-to-IMU extrinsic | lidar_imu_calib | Once per rig assembly |
| IMU intrinsics (noise model) | imu_utils or allan_variance_ros | Once per IMU unit |

---

## 1. Camera Intrinsic Calibration

Each camera must be individually calibrated to determine focal length, principal point, and distortion coefficients.

### Calibration Target

Print a **ChArUco board** (recommended over checkerboard — more robust to partial occlusion):
- 8×6 grid, 30mm squares, 20mm ArUco markers
- Print on matte paper at A3 size, laminate or mount on rigid flat surface
- Verify physical square size with calipers after printing — printer scaling errors affect calibration

### Procedure (ROS2 camera_calibration)

```bash
sudo apt install ros-humble-camera-calibration

# FLIR camera
ros2 run camera_calibration cameracalibrator \
  --size 8x6 \
  --square 0.030 \
  --ros-args -r image:=/flir/image_raw

# OV9281 left
ros2 run camera_calibration cameracalibrator \
  --size 8x6 \
  --square 0.030 \
  --ros-args -r image:=/ov9281/left/image_raw

# OV9281 right
ros2 run camera_calibration cameracalibrator \
  --size 8x6 \
  --square 0.030 \
  --ros-args -r image:=/ov9281/right/image_raw
```

Move the calibration board slowly through different positions, angles, and distances — aim for 50+ frames with good coverage across the full image area. Click **Calibrate** when the progress bar fills, then **Save**.

The RealSense D435i RGB and IR cameras are factory-calibrated. Intrinsics are available via the RealSense SDK and are automatically published on the `/camera/color/camera_info` topic.

---

## 2. Camera-to-Camera Extrinsic Calibration

Determines the rigid body transform between each pair of cameras. Uses Kalibr.

### Install Kalibr

```bash
# Kalibr runs best in Docker
docker pull ethzasl/kalibr:latest

# Or build from source:
# https://github.com/ethz-asl/kalibr
```

### Procedure

1. Mount all cameras on the rig in final position — do not move them after this
2. Record a ROS2 bag with all camera topics active, moving the ChArUco board slowly in front of all cameras simultaneously:
```bash
ros2 bag record \
  /flir/image_raw \
  /ov9281/left/image_raw \
  /ov9281/right/image_raw \
  /camera/color/image_raw \
  -o camera_calibration_bag
```
3. Convert bag to Kalibr format and run calibration:
```bash
# See Kalibr documentation for full ROS2 bag conversion procedure
kalibr_calibrate_cameras \
  --bag camera_calibration.bag \
  --topics /flir/image_raw /ov9281/left/image_raw /ov9281/right/image_raw \
  --models pinhole-radtan pinhole-radtan pinhole-radtan \
  --target charuco_board.yaml
```

Output: `camchain.yaml` — contains all camera-to-camera transforms. Store in `config/`.

---

## 3. LiDAR-to-Camera Extrinsic Calibration

Determines the transform between the Livox Horizon and each camera. Uses `livox_camera_calib`.

### Install livox_camera_calib

```bash
cd ~/scanner_ws/src
git clone https://github.com/hku-mars/livox_camera_calib.git
cd ..
colcon build --packages-select livox_camera_calib
```

### Procedure

1. Place an **AprilTag board of known dimensions** in the scene — this provides a common reference both the LiDAR and camera can detect
2. Record a static scene with both LiDAR and camera:
```bash
ros2 bag record /livox/lidar /flir/image_raw -o lidar_camera_calib_bag
```
3. Run calibration:
```bash
ros2 run livox_camera_calib calib \
  --config config/lidar_camera_calib.yaml
```

Edit `config/lidar_camera_calib.yaml` with:
- Image topic name
- LiDAR topic name
- Camera intrinsics (from Step 1)
- Initial guess of extrinsic (measure from physical rig with ruler)

**Tip:** Providing an accurate initial guess (within 5cm translation, 5° rotation) dramatically improves convergence. Measure the physical offset between the Livox mounting face and the FLIR lens center before running calibration.

---

## 4. LiDAR-to-IMU Extrinsic Calibration

For the Witmotion WT901C mounted near the Livox. The D435i's IMU-to-RGB-camera extrinsic is factory calibrated and available via RealSense SDK.

### Install lidar_imu_calib

```bash
cd ~/scanner_ws/src
git clone https://github.com/APRIL-ZJU/lidar_IMU_calib.git
cd ..
colcon build --packages-select lidar_imu_calib
```

### Procedure

1. Record a bag with both LiDAR and IMU topics while moving the rig through varied motions (figure-8 patterns, tilts in all axes):
```bash
ros2 bag record /livox/lidar /imu/witmotion -o lidar_imu_calib_bag
```
2. Run calibration:
```bash
ros2 launch lidar_imu_calib calib_livox.launch.py \
  bag_path:=./lidar_imu_calib_bag
```

Output: translation and rotation from IMU frame to LiDAR frame. Add to `config/extrinsics.yaml` and `fast_lio/config/horizon_lio.yaml`.

---

## 5. IMU Intrinsic Calibration (Noise Model)

Determines the noise density and random walk parameters for the Witmotion IMU. These parameters feed into FAST-LIO2's noise model and significantly affect odometry quality.

### Install allan_variance_ros

```bash
cd ~/scanner_ws/src
git clone https://github.com/ori-drs/allan_variance_ros.git
cd ..
colcon build --packages-select allan_variance_ros
```

### Procedure

1. Place the rig on a stable, vibration-free surface
2. Record IMU data for **at least 2 hours** (longer = better noise estimate):
```bash
ros2 bag record /imu/witmotion -o imu_static_bag
```
3. Compute Allan variance:
```bash
ros2 run allan_variance_ros allan_variance \
  --ros-args -p bag_path:=./imu_static_bag -p imu_topic:=/imu/witmotion
```

Output: `imu_param.yaml` with `gyroscope_noise_density`, `gyroscope_random_walk`, `accelerometer_noise_density`, `accelerometer_random_walk`. Copy these values into the FAST-LIO2 config.

---

## 6. Scale Verification

After completing all calibrations, verify metric scale is correct before any production scanning:

1. Place a ruler or known-dimension object (e.g., a 200mm calibration bar) in the scene
2. Run a short capture and full pipeline
3. Measure the object in the output point cloud using CloudCompare (**Tools → Distance → Point-to-Point**)
4. Scale error should be under 0.5% for indoor work. If scale is off, check the LiDAR-to-IMU extrinsic.

---

## Storing Calibration Results

All calibration outputs should be stored in `config/`:

```
config/
├── flir_intrinsics.yaml
├── ov9281_left_intrinsics.yaml
├── ov9281_right_intrinsics.yaml
├── camchain.yaml              # All camera-to-camera extrinsics (Kalibr output)
├── lidar_to_flir.yaml         # LiDAR-to-FLIR extrinsic
├── lidar_to_imu.yaml          # LiDAR-to-Witmotion extrinsic
├── imu_param.yaml             # Witmotion noise model
└── extrinsics.yaml            # Master file — all transforms in one place
```

Commit calibration files to the repository. If a sensor is moved or replaced, re-run the relevant calibration steps and commit updated files with a note in the commit message describing what changed.