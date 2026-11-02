# local-model-builder backlog

**Parked 2026-11-02** (user: other work first). Where it stands: `docs/results.md` (shelf, 14/16 on the 9B)
and `docs/scraper-scope.md` (the direction if it resumes: scrapers, not whole apps).

## Next

- [x] First real runs: `qwen35-9b`, thinking off, oracle on: 8/16, then 14/16 after fixing a test gap and two
  harness gaps (`docs/results.md`).
- [ ] Split task 14 into single-file tasks; rerun 04 and 14 on Gemma and Bonsai.
- [ ] Sampling on retries (gpu-scheduler llama.cpp adapter is greedy only) and escalation to a second model.
- [ ] Same with `--thinking`, and with `--no-oracle` (the realistic run), if the first is promising.
- [ ] Other models on the same tasks: `qwen35-4b`, `bonsai-27b`, Gemma 4 26B on the Mac (`gemma4-26b-a4b`).
- [x] Decide: for whole new apps, not worth it (planning is most of the work; Claude writes the app faster).
  Worth it for repetitive, template-plus-tests work: scrapers first (`docs/scraper-scope.md`).

## Later, if feasible

- [ ] A planner step: a bigger model writes spec + task cards + tests from a short description (the part done by
  hand for `shelf`).
- [ ] Integration tasks after groups of tasks (glue failures between tasks that each pass their own tests).
- [ ] Sandboxes in the cluster: a namespace per project, no service-account token, egress to package registries
  only, an ingress host behind authentik; delete the namespace to throw it away.
