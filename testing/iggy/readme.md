# Iggy Test Server

Local [Apache Iggy](https://iggy.apache.org/) message streaming server for development and integration testing.
Clients connect using the **iggy TCP binary protocol** (not HTTP).

## Files

| File | Description |
|---|---|
| `docker-compose.yml` | Iggy server container on TCP port 8090 |
| `producer.py` | Creates the stream/topic and sends 5 × 10 test messages |
| `consumer.py` | Polls and prints all messages from the stream |
| `requirements.txt` | Python dependencies |

## Prerequisites

- Docker
- Python 3.10+

## Setup

**1. Start the server**
```bash
docker compose up -d
```

**2. Install Python dependencies**
```bash
pip install -r requirements.txt
```

## Running the test scripts

Send messages:
```bash
python producer.py
```

Consume messages (separate terminal, or after the producer finishes):
```bash
python consumer.py
```

## Connection details

| Setting | Value |
|---|---|
| Protocol | iggy TCP (binary) |
| Address | `localhost:8090` |
| Username | `iggy` |
| Password | `iggy` |
| Connection string | `iggy://iggy:iggy@localhost:8090` |

## Notes

- Data is persisted in the `iggy-data` Docker volume. To reset, run `docker compose down -v`.
- Credentials are only set on the **first** startup. If you change them, remove the volume first.
- The `SYS_NICE` capability and `seccomp:unconfined` are required for `io_uring` to work correctly inside the container.
