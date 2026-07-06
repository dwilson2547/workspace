# can_pub_sub_probe UDP receiver design plan

## Goal

Show a concrete Kubernetes-ready UDP ingest design inside `can_pub_sub_probe/gps test feed/` so the user can evaluate whether it should live in this repo or move into `cluster_config` or a dedicated service repo later.

## Current prototype status

- Implemented `gps test feed/kreceiver_proto/` with:
  - a Python UDP receiver package
  - payload normalization and topic selection
  - Iggy publish wiring through the existing backend abstraction
  - Kubernetes manifests for the receiver, DNS zone snippet, and an initial Iggy StatefulSet shape
  - a prototype Dockerfile and sample payloads
- Validation completed:
  - repository tests pass, including focused prototype tests
  - prototype CLI help works with `PYTHONPATH='gps test feed' python -m kreceiver_proto.receiver_app --help`
  - Docker image builds and runs successfully with `--help`
  - dry-run receive path successfully processed a sample UDP packet end to end

## Recommended decisions

### Pub/sub backend

- Use **Iggy first** on the cluster.
- Reason: this repo already has a working Python Iggy backend and local stack, so choosing Iggy avoids introducing a second broker and a second client stack while the ingest design is still settling.
- Initial cluster shape should be a **single durable Iggy instance with PVC-backed storage** and a stable internal Service. Broker HA can be revisited later once ingest semantics and topic structure are proven.

### Receiver role

- The UDP receiver should be **thin**:
  - accept UDP datagrams
  - parse/validate the device payload
  - normalize into a common ingest envelope
  - publish to Iggy immediately
  - emit diagnostics for malformed or rejected packets
- Do **not** make the receiver hold data waiting for downstream consumers in the first slice. Durability belongs at the broker boundary.

### Topic strategy

- Start with source-family topics:
  - `telemetry.raw.gps`
  - `telemetry.raw.rtk`
  - `telemetry.raw.can`
  - `telemetry.diagnostics.ingest`
- Put routing metadata in the envelope and headers:
  - `device_id`
  - `source_type`
  - `message_type`
  - `session_id`
  - `captured_at`
  - optional `trip_id` / `deployment_id`
- Let downstream consumers fan out further rather than baking too much routing logic into the devices.

### Kubernetes exposure

- Use a **UDP LoadBalancer Service** with a fixed MetalLB IP.
- Add a dedicated **`robo-services.local` DNS zone** for robotics/device-facing services.
- Put the receiver on an explicit host such as **`kreceiver.robo-services.local`** pointed at the fixed MetalLB IP.
- Do not use Ingress for this service.

### HA / resiliency

- Phase 1: **single receiver replica** plus broker durability.
- Phase 2: add optional raw packet spool or file sink for high-value feeds such as RTK capture sessions.
- Phase 3: revisit multi-replica UDP ingest only if needed; it complicates packet affinity, deduplication, and observability.

## Prototype files to add under gps test feed

### Receiver prototype

- `gps test feed/kreceiver_proto/receiver_app.py`
  - UDP listener entry point
  - payload validation
  - topic selection
  - publish to Iggy
- `gps test feed/kreceiver_proto/models.py`
  - normalized ingest envelope dataclasses
- `gps test feed/kreceiver_proto/config.py`
  - environment-driven settings for bind address, port, Iggy connection string, stream, and default topic mapping
- `gps test feed/kreceiver_proto/sample_payloads.json`
  - representative GPS / RTK / CAN payload examples

### Kubernetes shape preview

- `gps test feed/kreceiver_proto/k8s/namespace.yml`
- `gps test feed/kreceiver_proto/k8s/dns-zone-snippet.yml`
- `gps test feed/kreceiver_proto/k8s/configmap.yml`
- `gps test feed/kreceiver_proto/k8s/deployment.yml`
- `gps test feed/kreceiver_proto/k8s/service.yml`
- `gps test feed/kreceiver_proto/k8s/example-secret.yml`

### Containerization preview

- `gps test feed/kreceiver_proto/Dockerfile`

## Validation plan

- Keep repository tests green.
- Add focused tests for:
  - topic selection by source type
  - payload normalization
  - malformed packet diagnostics
  - Iggy publish invocation through the existing backend abstraction

## Important follow-up decisions after the prototype exists

- Whether cluster Iggy belongs in `cluster_config` or in a self-managed repo/chart
- Whether RTK raw capture requires PVC/object storage on day one
- Whether trip/mobile ingest should be a separate public edge receiver rather than sharing the home-LAN receiver
## Helm chart status

- Added `helm/robo-services/` as a real chart scaffold for the receiver stack.
- The chart renders the `robo-services` namespace, `kreceiver` config map, secret, deployment, and UDP LoadBalancer service.
- The receiver still targets external Iggy at `iggy.pub-sub.svc.cluster.local:8090` so the chart preserves the separation between robo-services and pub-sub.
- Validation completed with `helm lint`, `helm template`, and `kubectl apply --dry-run=client` against the rendered output.

## Future goals / improvements

- Add an **MPU-6050 IMU feed** as a second live source so the receiver and broker can be observed handling simultaneous feeds at different cadences, such as GPS at 1 Hz and IMU at 2-4 Hz.
- Add a small **I2C status display** on the ESP32 side to indicate Wi-Fi connectivity, GPS fix/data activity, and basic publish health without needing the serial console open.
- Build a **Trips** app/service that consumes GPS and IMU bursts from the receiver pipeline, groups them into journeys, and stores route-oriented trip summaries for later browsing or analysis.
- Add a **geofencing / overspeed alerting** system that can watch live client positions and trigger alerts when a device leaves an allowed zone or exceeds configured speed thresholds.
- Extend the topic/envelope model as more sensors join so mixed-rate feeds remain easy to separate by device, source type, and trip/session context.

