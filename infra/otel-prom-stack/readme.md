# Local OTel Metrics Stack

A Docker Compose stack for local metrics development: **OTel Collector → Prometheus → Grafana**.

Your app pushes metrics over OTLP to the Collector, which exposes them as a Prometheus scrape endpoint. Prometheus scrapes the Collector, and Grafana visualizes the results.

## Quick Start

```bash
docker compose up -d
```

| Service        | URL                        | Purpose                          |
|----------------|----------------------------|----------------------------------|
| OTel Collector | `localhost:4317` (gRPC)    | OTLP ingest — point your app here |
| OTel Collector | `localhost:4318` (HTTP)    | OTLP ingest (HTTP alternative)  |
| Prometheus     | `http://localhost:9090`    | Query metrics directly          |
| Grafana        | `http://localhost:3000`    | Dashboards (login: admin/admin) |

## Connecting Your FastAPI App

Point the OTLP exporter at the Collector. If your app runs **outside** Compose (i.e. on the host):

```python
OTLPMetricExporter(endpoint="http://localhost:4317", insecure=True)
```

If your app is **inside** the Compose network:

```python
OTLPMetricExporter(endpoint="http://otel-collector:4317", insecure=True)
```

## Files

- `docker-compose.yml` — Collector, Prometheus, and Grafana services.
- `otel-collector-config.yaml` — Collector pipeline: OTLP receiver → batch processor → Prometheus exporter on `:8889`.
- `prometheus.yml` — Scrapes the Collector's Prometheus endpoint every 15s.
- `grafana-datasources.yml` — Auto-provisions Prometheus as the default Grafana datasource.

## Common Tasks

**Restart everything:**
```bash
docker compose down && docker compose up -d
```

**Tail Collector logs** (useful for verifying metrics are arriving):
```bash
docker compose logs -f otel-collector
```

**Check raw metrics on the Collector's scrape endpoint:**
```bash
curl http://localhost:8889/metrics
```

**Wipe all data and start fresh:**
```bash
docker compose down -v && docker compose up -d
```

## Adding Traces or Logs Later

The Collector config only defines a `metrics` pipeline right now. To add traces, add an exporter (e.g. Jaeger or Tempo) and a new pipeline under `service.pipelines.traces` in `otel-collector-config.yaml`. Same pattern for logs with Loki.

## Notes

- Uses the `contrib` Collector image (`otel/opentelemetry-collector-contrib`), which includes the Prometheus exporter. The core image does not.
- OTel metric names get normalized by the Collector's Prometheus exporter (e.g. `http.server.request.duration` → `http_server_request_duration_seconds`), so they'll look familiar in Grafana.
- Grafana anonymous auth is enabled for convenience — don't use this config in production.