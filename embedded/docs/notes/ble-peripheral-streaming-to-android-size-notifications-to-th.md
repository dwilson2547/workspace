---
title: BLE peripheral streaming to Android: size notifications to the MTU and batch them
date: 2026-11-03
tags: ble,nimble,android,mtu,notifications
domains: robotics
source: embedded/dbc-forge/CHANGELOG.md
---

Two silent losses found streaming CAN+IMU text lines from the dbc-forge dongle (ESP32-C6, NimBLE-Arduino 2.5) to a Galaxy S21 (2026-11-03). (1) A notification longer than ATT MTU-3 is cut off with no error on either side; NimBLE's default preferred MTU is ~255, so call NimBLEDevice::setMTU(517) and fill each notification only to the negotiated MTU-3 (onMTUChange / NimBLEConnInfo::getMTU). If lines end in '\\n', a receiver can detect a cut by text after the last newline. (2) ~210 notifications/s of ~100 bytes: the phone silently lost up to 15% of them although every notify() returned true; batching to near-full (~430 B) or 50 ms age (~50/s) gave zero loss. Measure it by counting sent notifications in firmware and received ones in the app over the same window; the Android BT log does not show the drops. Also request CONNECTION_PRIORITY_HIGH (50 ms -> 15 ms interval) and time samples by a device-side counter, not notification arrival (Android delivers notifications in bursts).
