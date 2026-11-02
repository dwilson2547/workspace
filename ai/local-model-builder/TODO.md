# local-model-builder backlog

## Next

- [ ] First real run: `qwen35-9b`, thinking off, oracle on. Record pass@1 / pass@3 / failed per task.
- [ ] Same with `--thinking`, and with `--no-oracle` (the realistic run), if the first is promising.
- [ ] Other models on the same tasks: `qwen35-4b`, `bonsai-27b`, Gemma 4 26B on the Mac (`gemma4-26b-a4b`).
- [ ] Decide: feasible (go on to cluster sandboxes + ingress) or not (write down why and stop).

## Later, if feasible

- [ ] A planner step: a bigger model writes spec + task cards + tests from a short description (the part done by
  hand for `shelf`).
- [ ] Integration tasks after groups of tasks (glue failures between tasks that each pass their own tests).
- [ ] Sandboxes in the cluster: a namespace per project, no service-account token, egress to package registries
  only, an ingress host behind authentik; delete the namespace to throw it away.
