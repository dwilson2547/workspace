"""Run the sample project's tasks, in order, through gpu-scheduler and test each answer in a sandbox.

    GPU_SCHEDULER_URL=... GPU_SCHEDULER_TOKEN=... python harness/run.py [--model qwen35-9b] [--tasks 1-16]
        [--attempts 3] [--thinking] [--no-oracle] [--dry-run]

Each task card (sample/tasks/NN-*.md) names the files the model may write, the files it may read, and its test file.
The model gets the spec, the card, those files and the test, and answers with JSON: a short plan and the full
content of each file it writes (constrained to the card's `writes` by a JSON schema). The harness writes the files
into the run's copy of the repo and runs this task's test plus every earlier task's test in Docker
(`--network none`, non-root, repo copied in), so a task that breaks earlier work fails too. A failure goes back to
the model with the pytest output, up to --attempts in total.

When a task still fails, the harness copies in the reference solution's files for that task (the "oracle") and
carries on, so every task is measured on its own. --no-oracle keeps the model's last attempt instead: the realistic
run, where one failure can sink every later task.

--dry-run answers every task with the reference files, without gpu-scheduler: checks the harness and the tests.

Output: runs/<timestamp>-<model>/ with repo/ (the code as built), results.jsonl (one line per attempt),
prompts/ (every conversation as sent, and the replies) and summary.md.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "sample"
IMAGE = "local-model-builder-test:latest"
FAIL_TAIL = 6000           # characters of pytest output sent back on a retry

SYSTEM = """You are a careful Python developer working on one small task in a larger project. You are given the \
project spec, the task, the current content of the files you may change, other files for reference, and the pytest \
test your work must pass.

Rules:
- Reply with JSON only: {"plan": "<two or three sentences>", "files": [{"path": "...", "content": "..."}]}.
- "content" is the COMPLETE new content of that file, not a diff or a fragment. Keep everything already in the file \
that the task doesn't ask you to change.
- Only write the files the task lists. Never change tests.
- Python 3.13, FastAPI, Jinja2, pydantic v2, sqlite3. No other libraries.
- Follow the spec's names, signatures and formats exactly: the tests check them."""


# -- task cards ---------------------------------------------------------------------------------------------------

def load_tasks() -> list[dict]:
    tasks = []
    for p in sorted((SAMPLE / "tasks").glob("*.md")):
        text = p.read_text()
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        meta, body = m.group(1), m.group(2).strip()
        card = {"id": int(p.name[:2]), "name": p.stem, "body": body}
        for line in meta.splitlines():
            k, v = line.split(":", 1)
            v = v.strip()
            card[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()] if v.startswith("[") else v
        tasks.append(card)
    return tasks


def parse_range(spec: str, ids: list[int]) -> list[int]:
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += [i for i in ids if int(a) <= i <= int(b or a)]
    return out


# -- prompts ------------------------------------------------------------------------------------------------------

def first_messages(task: dict, repo: Path) -> list[dict]:
    def show(path: str) -> str:
        f = repo / path
        body = f.read_text() if f.exists() else "(this file doesn't exist yet)"
        return f"### {path}\n```\n{body}\n```"

    parts = [f"## Project spec\n\n{(SAMPLE / 'spec.md').read_text()}",
             f"## Your task: {task['title']}\n\nFiles you may write: {', '.join(task['writes'])}\n\n{task['body']}"]
    if task["reads"]:
        parts.append("## Files for reference (read-only)\n\n" + "\n\n".join(show(p) for p in task["reads"]))
    parts.append("## Files you may write (current content)\n\n" + "\n\n".join(show(p) for p in task["writes"]))
    parts.append(f"## The test your work must pass ({task['test']})\n\n```python\n{(SAMPLE / task['test']).read_text()}"
                 f"\n```\n\nShared fixtures (tests/conftest.py):\n\n```python\n"
                 f"{(SAMPLE / 'tests' / 'conftest.py').read_text()}\n```")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n\n".join(parts)}]


def schema(task: dict) -> dict:
    return {"type": "object", "required": ["plan", "files"], "additionalProperties": False,
            "properties": {
                "plan": {"type": "string", "maxLength": 600},     # else retries reason in here until the cap
                "files": {"type": "array", "minItems": 1, "items": {
                    "type": "object", "required": ["path", "content"], "additionalProperties": False,
                    "properties": {"path": {"type": "string", "enum": task["writes"]},
                                   "content": {"type": "string"}}}}}}


# -- model backends -----------------------------------------------------------------------------------------------

class Scheduler:
    def __init__(self, model: str, thinking: bool, max_new_tokens: int):
        self.url = os.environ["GPU_SCHEDULER_URL"].rstrip("/")
        self.h = {"Authorization": f"Bearer {os.environ['GPU_SCHEDULER_TOKEN']}"}
        self.model, self.thinking, self.max_new = model, thinking, max_new_tokens

    def ask(self, messages: list[dict], task: dict) -> dict:
        item = {"messages": messages, "json_schema": schema(task), "max_new_tokens": self.max_new}
        if self.thinking:
            item["thinking"] = True
        # A long deadline: this is batch work and should yield to anything interactive in the queue.
        r = httpx.post(self.url + "/v1/jobs", headers=self.h, timeout=60,
                       json={"model": self.model, "inputs": [item], "deadline_seconds": 6 * 3600, "max_attempts": 2})
        r.raise_for_status()
        job_id = r.json()["job_ids"][0]
        while True:
            time.sleep(3)
            try:
                job = httpx.get(f"{self.url}/v1/jobs/{job_id}", headers=self.h, timeout=60).json()
            except httpx.HTTPError:
                continue                                     # a dropped port-forward: keep polling
            if job["status"] in ("done", "failed", "cancelled"):
                res = job.get("result") or {}
                return {"status": job["status"], "text": res.get("text", ""), "json": res.get("json"),
                        "reasoning": res.get("reasoning"), "error": job.get("error"), "job_id": job_id,
                        "ran_model": job.get("ran_model"), "worker": job.get("worker"),
                        "input_tokens": res.get("input_tokens"), "output_tokens": res.get("output_tokens")}


class Oracle:
    """--dry-run: answers with the reference solution, so the harness and tests can be checked without a GPU."""
    model = "reference"

    def ask(self, messages: list[dict], task: dict) -> dict:
        files = [{"path": p, "content": (SAMPLE / "reference" / p).read_text()} for p in task["writes"]]
        js = {"plan": "reference solution", "files": files}
        return {"status": "done", "text": json.dumps(js), "json": js, "input_tokens": None, "output_tokens": None}


# -- sandbox ------------------------------------------------------------------------------------------------------

def run_tests(repo: Path, tests: list[str]) -> tuple[bool, str, str]:
    """Run these test files in a fresh container. Returns (passed, one-line summary, full output)."""
    cmd = ["docker", "run", "--rm", "--network", "none", "--memory", "1g", "--cpus", "2",
           "-v", f"{repo}:/src/app:ro", "-v", f"{SAMPLE / 'tests'}:/src/tests:ro", IMAGE, "sh", "-c",
           "cp -r /src/app/. /work/ && cp -r /src/tests /work/tests && "
           "timeout 120 python -m pytest -q -p no:cacheprovider -W ignore::DeprecationWarning "
           + " ".join(tests)]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        return False, "timed out", "the test run timed out after 240 s"
    out = p.stdout + p.stderr
    last = [ln for ln in out.strip().splitlines() if ln.strip()]
    summary = last[-1].strip("= ") if last else f"exit {p.returncode}"
    return p.returncode == 0, summary, out


def apply_files(repo: Path, task: dict, reply: dict | None) -> str | None:
    """Write the reply's files. Returns an error to send back if the reply can't be used."""
    if not isinstance(reply, dict) or not isinstance(reply.get("files"), list) or not reply["files"]:
        return "Your reply wasn't the JSON object asked for (with a non-empty \"files\" list)."
    for f in reply["files"]:
        path = f.get("path") if isinstance(f, dict) else None
        if path not in task["writes"] or not isinstance(f.get("content"), str):
            return f"You may only write {task['writes']}, each with a string \"content\"; got {path!r}."
    missing = [p for p in task["writes"] if not (repo / p).exists() and p not in {f["path"] for f in reply["files"]}]
    if missing:
        return f"You must write {missing}: they don't exist yet and the task needs them. Send every file you change."
    for f in reply["files"]:
        dest = repo / f["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(f["content"])
    return None


# -- main loop ----------------------------------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--model", default="qwen35-9b")
    ap.add_argument("--tasks", default="1-99")
    ap.add_argument("--attempts", type=int, default=3)
    ap.add_argument("--thinking", action="store_true")
    ap.add_argument("--max-new-tokens", type=int, default=8192)
    ap.add_argument("--no-oracle", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    tasks = load_tasks()
    chosen = set(parse_range(a.tasks, [t["id"] for t in tasks]))
    backend = Oracle() if a.dry_run else Scheduler(a.model, a.thinking, a.max_new_tokens)
    label = "dry-run" if a.dry_run else a.model + ("-thinking" if a.thinking else "")
    run = ROOT / "runs" / f"{datetime.now():%Y%m%d-%H%M%S}-{label}"
    repo = run / "repo"
    shutil.copytree(SAMPLE / "skeleton", repo)
    (run / "prompts").mkdir(parents=True)
    results = (run / "results.jsonl").open("a")
    (run / "args.json").write_text(json.dumps(vars(a), indent=1))
    rows, done_tests = [], []
    print(f"run dir: {run}", flush=True)

    for task in tasks:
        if task["id"] not in chosen:
            # Not attempted this run: the reference stands in, so later tasks still have what they build on.
            for p in task["writes"]:
                (repo / p).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(SAMPLE / "reference" / p, repo / p)
            done_tests.append(task["test"])
            continue
        tests = done_tests + [task["test"]]
        messages = first_messages(task, repo)
        outcome, t0, summary = "failed", time.time(), ""
        for attempt in range(1, a.attempts + 1):
            ts = time.time()
            ans = backend.ask(messages, task)
            secs = round(time.time() - ts, 1)
            (run / "prompts" / f"{task['name']}-{attempt}.json").write_text(
                json.dumps({"messages": messages, "answer": ans}, indent=1, ensure_ascii=False))
            if ans["status"] != "done":
                err, ok, summary = f"job {ans['status']}: {ans.get('error')}", False, "job failed"
            else:
                err = apply_files(repo, task, ans["json"])
                if err:
                    ok, summary = False, "unusable reply"
                else:
                    ok, summary, out = run_tests(repo, tests)
                    if not ok:
                        broke = [t for t in done_tests if f"FAILED {t}" in out or f"ERROR {t}" in out]
                        err = ("Some tests failed" + (f", including tests of EARLIER tasks ({', '.join(broke)}): "
                               "don't break existing behaviour" if broke else "")
                               + f". pytest output (end):\n\n{out[-FAIL_TAIL:]}")
            rec = {"task": task["name"], "attempt": attempt, "ok": ok, "summary": summary, "seconds": secs,
                   "input_tokens": ans.get("input_tokens"), "output_tokens": ans.get("output_tokens"),
                   "ran_model": ans.get("ran_model"), "job_id": ans.get("job_id")}
            results.write(json.dumps(rec) + "\n")
            results.flush()
            print(f"{task['name']:<22} attempt {attempt}: {'PASS' if ok else 'fail'}  {summary}  ({secs}s, "
                  f"{ans.get('output_tokens')} tok)", flush=True)
            if ok:
                outcome = f"pass@{attempt}"
                break
            if attempt < a.attempts:
                messages = messages + [{"role": "assistant", "content": ans.get("text") or ""},
                                       {"role": "user", "content": err + "\n\nReply with the corrected files, "
                                                                         "same JSON format."}]
        if outcome == "failed" and not a.no_oracle:
            for p in task["writes"]:
                shutil.copy(SAMPLE / "reference" / p, repo / p)
            ok, summary, _ = run_tests(repo, tests)
            outcome = "failed (oracle filled in)"
            if not ok:
                # Earlier model work that passed its own tests breaks this one. Reset everything so far to the
                # reference, so later tasks are still measured on their own.
                for t in tasks:
                    if t["id"] <= task["id"]:
                        for p in t["writes"]:
                            shutil.copy(SAMPLE / "reference" / p, repo / p)
                ok, summary, _ = run_tests(repo, tests)
                outcome = "failed (earlier work broke it; all reset to reference)"
            print(f"{task['name']:<22} oracle: {summary}", flush=True)
        rows.append((task["name"], outcome, round(time.time() - t0)))
        done_tests.append(task["test"])

    passed = sum(1 for _, o, _ in rows if o.startswith("pass"))
    lines = [f"# {label}", "", f"{passed}/{len(rows)} tasks passed", "", "| task | outcome | seconds |",
             "|---|---|---|"] + [f"| {n} | {o} | {s} |" for n, o, s in rows]
    _, final, _ = run_tests(repo, [t["test"] for t in tasks])
    lines += ["", f"Full test suite on the result: {final}"]
    (run / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
