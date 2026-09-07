---
title: Sensor datasheets live in robotics/docs/topics/sensors/
date: 2026-07-06
tags: sensors,datasheets,ov9281,livox,wt901c
updated: 2026-08-02
---

Vendor datasheets, manuals, and example code for owned sensors are checked into robotics/docs/topics/sensors/ — currently ov9281-arducam-b0332 (datasheet + STEP) and livox-horizon (user manual). Check there before searching vendor sites. Salvaged multi-sensor calibration procedures and a scan-to-print pipeline reference (unvalidated desk research from the deleted 3d-mapping repo) are siblings in robotics/docs/topics/.

**2026-08-02 — WT901C dropped.** The wt901c datasheets were removed. The external Witmotion IMU lost to the Livox Horizon's built-in BMI088 (in the Livox time domain, no sync needed; the WT901C had poor sync and no advantage) — see robotics/livox_handheld_scanner/docs/ARCHITECTURE.md. Don't re-salvage them. The two desk-research topics above still contain WT901C-based procedure, now banner-marked as superseded.

The 3d-mapping repo was re-cloned after its first deletion — a stale .git/modules/robotics/3d-mapping entry with no .gitmodules registration let a submodule update resurrect it. Deleted again along with the module dir. It lives at github.com/dwilson2547/3d_mapping if anything is ever needed from it.
