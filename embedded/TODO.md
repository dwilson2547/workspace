# TODO

Backlog imported from the retired todo store, 2026-07-06.

## Urgent

- [ ] **Re-examine ESP32 spectrum analyzer, input selector, and output selector projects** — Revisit these ESP32-related projects and reassess their status, design, and next steps.

## Medium

- [ ] **Set up RTK base station and capture a day of data** — Bring up the RTK base station, run a full day of data capture, and send the resulting dataset off for analysis.
- [ ] **Validate sensor-transposition libraries with real nuScenes data** — Use real nuScenes data to verify the accuracy of the sensor_transposition libraries and evaluate whether the current workflow is usable.
- [ ] **Resume can_pub_sub_probe after CAN parts arrive** — When the ESP32/TJA1051 parts are in hand, implement the live frame-source adapter, verify real vehicle CAN IDs and DBC fit against captured traffic, and compare live capture output to replay-path expectations. Current regression harness and fixture coverage are in place already; continue from plan/playbook can-pub-sub-probe/implementation-plan and notes 109.
