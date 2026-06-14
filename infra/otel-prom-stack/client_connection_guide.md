# Client Connection Guide

## Required Packages

```bash
pip install opentelemetry-sdk \
            opentelemetry-exporter-otlp-proto-grpc \
            opentelemetry-instrumentation-fastapi
```

## SDK Setup

```python
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(
        endpoint="http://localhost:4317",  # Collector gRPC endpoint
        insecure=True,                     # No TLS for local dev
    ),
    export_interval_millis=5000,           # How often to push (default 60000)
)

provider = MeterProvider(
    resource=Resource.create({
        "service.name": "my-fastapi-app",  # Shows up as a label in Grafana
    }),
    metric_readers=[reader],
)

metrics.set_meter_provider(provider)
FastAPIInstrumentor.instrument_app(app)
```

## Environment Variable Alternative

Instead of setting properties in code, the OTel SDK respects these env vars:

| Variable                            | Value                       |
|-------------------------------------|-----------------------------|
| `OTEL_SERVICE_NAME`                 | `my-fastapi-app`            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`      | `http://localhost:4317`     |
| `OTEL_EXPORTER_OTLP_PROTOCOL`      | `grpc`                      |
| `OTEL_EXPORTER_OTLP_INSECURE`      | `true`                      |
| `OTEL_METRICS_EXPORTER`            | `otlp`                      |
| `OTEL_METRIC_EXPORT_INTERVAL`      | `5000`                      |

With env vars set, the SDK auto-configures and the code reduces to:

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
FastAPIInstrumentor.instrument_app(app)
```

## If Your App Is Inside Docker Compose

Replace `localhost` with the Collector's service name:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```