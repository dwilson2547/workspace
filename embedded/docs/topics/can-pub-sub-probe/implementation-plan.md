# can_pub_sub_probe implementation plan

## Top-level checklist

- [x] 1. Establish project skeleton and core contracts
- [x] 2. Implement capture and replay foundation
- [x] 3. Implement Hop 1 ingest and normalize foundation
- [x] 4. Implement Hop 2 validate and filter foundation
- [x] 5. Establish a local end-to-end development path
- [x] 6. Implement Hop 3 signal routing
- [ ] 7. Implement Hop 4 aggregation and derived signals
- [ ] 8. Implement Hop 5 sinks and egress rules
- [ ] 9. Complete backend abstraction, diagnostics, and operator tooling
- [ ] 10. Complete fixture coverage and deferred live hardware integration

## Task breakdown

### 1. Establish project skeleton and core contracts
- [x] Create the Python project layout with `pyproject.toml`, `src/`, and `tests/`
- [x] Define shared datatypes for raw CAN frames, probe context, decoded signal events, and drop events
- [x] Define the replaceable interfaces for frame sources, frame decoding, diagnostics, and pub/sub backends
- [x] Standardize the `vehicle CAN profile` concept so car-specific bus config stays separate from pipeline logic

### 2. Implement capture and replay foundation
- [x] Implement the fixed-width 17-byte frame codec for serialization and parsing
- [x] Implement binary frame-log readers and writers
- [x] Implement replay metadata loading from sidecar JSON
- [x] Implement a timed replay source with configurable speed multiplier for local load testing

### 3. Implement Hop 1 ingest and normalize foundation
- [x] Implement probe detection in a CAN-classic-safe payload format
- [x] Implement frame-to-signal normalization with one `SignalEvent` emitted per decoded signal
- [x] Implement a first `vehicle CAN profile` with static decoders for the confirmed Impala/GlobalA signals already documented in the repo
- [x] Surface explicit failures for invalid frames, unknown CAN IDs, and decode errors
- [ ] Add DBC-backed decoding so the static profile can be replaced by data-driven signal definitions later
- [ ] Define how live probe frames and replay-injected probes map onto normalized signals and downstream headers

### 4. Implement Hop 2 validate and filter foundation
- [x] Implement range validation rules keyed by signal name
- [x] Implement rate-of-change plausibility checks keyed by signal name
- [x] Implement intentional filter rules using signal-name patterns
- [x] Emit structured drop diagnostics so probe traffic can be traced and real traffic can be sampled later
- [ ] Load validation and filter rules from config rather than only in-code construction
- [ ] Add rule IDs and reason details to every validation drop for easier debugging

### 5. Establish a local end-to-end development path
- [x] Implement a minimal in-memory pub/sub backend for local iteration
- [x] Add a small CLI entry point for inspecting binary frame logs and profile contents
- [x] Add regression tests covering the frame codec, replay timing, ingest decoding, validation drops, and local pipeline flow
- [x] Keep the local path runnable without ESP32 hardware

### 6. Implement Hop 3 signal routing
- [x] Define routing-table schema and versioning
- [x] Route validated signals onto domain topics (`signals.powertrain`, `signals.chassis`, `signals.body`)
- [x] Support multi-domain fan-out for a single signal
- [x] Emit `NO_ROUTE` and `ROUTING_TABLE_VERSION_MISMATCH` diagnostics

### 7. Implement Hop 4 aggregation and derived signals
- [x] Implement configurable tumbling windows per signal
- [x] Compute min, max, mean, and standard deviation per window
- [x] Pass probe messages through immediately instead of holding them to window close
- [x] Emit `WINDOW_OVERFLOW` and `INSUFFICIENT_SAMPLES` diagnostics
- [x] Implement at least one derived signal path to validate the composite-signal contract

### 8. Implement Hop 5 sinks and egress rules
- [x] Define the aggregate event schema written to the sink layer
- [x] Implement an initial flat-file sink for validated raw signals
- [x] Implement an initial aggregate sink for windowed output
- [x] Enforce probe egress suppression while still recording terminal diagnostic outcomes
- [x] Leave InfluxDB wiring behind a replaceable sink interface until the local shape is stable

### 9. Complete backend abstraction, diagnostics, and operator tooling
- [x] Serialize probe context onto pub/sub headers consistently across hops
- [x] Implement a pub/sub-backed hop runner that consumes, acknowledges, and republishes messages
- [x] Add at least one concrete backend adapter for local development beyond the in-memory path, with Iggy as the first target
- [x] Implement the shared diagnostics topic / sink contract so all drop sites converge in one place
- [x] Add operator-facing CLI commands for replay runs, probe inspection, and fixture-driven local execution

### 10. Complete fixture coverage and deferred live hardware integration
- [x] Add canonical binary fixtures and sidecar metadata for at least one known-good session
- [x] Add malformed, unknown-ID, and out-of-range fixtures to exercise every implemented drop reason
- [x] Add profile-level regression coverage for the documented Impala signals
- [x] Preserve a clean seam for a future ESP32 + TJA1051 live frame source
- [x] Keep hardware-specific assumptions out of the replay and hop logic
- [ ] Implement the live-source adapter once hardware arrives
- [ ] Verify the real vehicle CAN IDs, DBC fit, bus behavior, and replay parity against captured traffic

## Current implementation slice

- [x] Scaffold the package, core models, replay foundation, local pub/sub backend, and the first Hop 1 / Hop 2 path
- [x] Update the spec wording that changed during planning (`vehicle CAN profile`, TJA1051)

