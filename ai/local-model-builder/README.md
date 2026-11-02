---
tier: experiment
---

# local-model-builder

Can the local models build a small app if a planner breaks it into tiny, test-backed tasks? A spec and an ordered
list of task cards go in; each task is sent to a gpu-scheduler model on its own, the answer is tested in a sandbox,
failures go back with the test output. Started 2026-11-02 as a feasibility test, not yet a repo: if the pass rate is
good, the next step is sandboxes in the cluster with their own ingress; if not, it's dropped.

**Status: parked 2026-11-02.** Results: [`docs/results.md`](docs/results.md). Conclusion so far: not worth it for
whole apps (the plan and tests are most of the work), worth trying for repetitive template-plus-tests work. Next
direction: [`docs/scraper-scope.md`](docs/scraper-scope.md).

## Layout

- `sample/` — the first sample project, **shelf** (a book/film/game tracker: FastAPI, SQLite, Jinja2).
  - `spec.md` — the contract every task sees (layout, schema, models, API, CSV, forms).
  - `tasks/NN-*.md` — 16 ordered task cards: files the model may write, files it may read, its test.
  - `tests/` — pytest tests, one per task, written before any model ran (59 tests).
  - `skeleton/` — the starting repo (an empty `shelf/` package).
  - `reference/` — a solution that passes every test. Used by `--dry-run` and as the oracle.
- `harness/run.py` — the runner; `harness/Dockerfile` — the test sandbox image.
- `runs/` — one folder per run (gitignored): the built repo, `results.jsonl`, every prompt and reply, `summary.md`.

## Run

```bash
docker build -t local-model-builder-test:latest harness/        # once
uv run --with httpx python harness/run.py --dry-run             # reference answers: checks harness + tests
GPU_SCHEDULER_URL=http://127.0.0.1:55462 GPU_SCHEDULER_TOKEN=... \
  uv run --with httpx python harness/run.py --model qwen35-9b   # the real thing (port-forward the API first)
```

Options: `--tasks 1-5` (others filled from the reference), `--attempts 3`, `--thinking`, `--no-oracle` (keep
failures instead of filling in the reference, so later tasks build on them), `--max-new-tokens 8192`.

Tests run in `docker run --network none --memory 1g`, as a non-root user, with the repo copied in: model-written code
never runs on the host. Each task runs its own test plus every earlier task's, so breaking earlier work fails it.
Jobs go in with a 6 h deadline so interactive work in the queue goes first.
