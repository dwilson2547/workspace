# Notes index

- [BLE peripheral streaming to Android: size notifications to the MTU and batch them](ble-peripheral-streaming-to-android-size-notifications-to-th.md) — Two silent losses found streaming CAN+IMU text lines from the dbc-forge dongle (ESP32-C6, NimBLE-Arduino 2.5)… `ble,nimble,android,mtu,notifications`
- [can_pub_sub_probe — replay-first start and probe design gaps](can-pub-sub-probe-replay-first-start-and-probe-design-gaps.md) — For can_pub_sub_probe, start replay-first because in-vehicle CAN connectivity is not available yet; keep live… `can,esp32,telemetry,architecture`
- [ESP32 GPS side experiment for can_pub_sub_probe](esp32-gps-side-experiment-for-can-pub-sub-probe.md) — A small ESP32+GPS side experiment is worthwhile to exercise live publish timing, probe propagation, Iggy beha… `esp32,gps,iggy,telemetry,can-pub-sub-probe`
- [phone-dbc-repo DBCs use 29-bit CAN ids without the 0x80000000 extended flag in BO_ lines](phone-dbc-repo-dbcs-use-29-bit-can-ids-without-the-0x8000000.md) — cantools rejects these (even strict=False) with 'Standard frame id 0x... `dbc,cantools,can`
