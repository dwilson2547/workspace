# Param files — one tracked file per airframe

How ArduPilot `.param` dumps are stored in this repo. The short version: **each airframe has exactly
one tracked `.param` file holding its current board state, and git holds the history.** Extra files
are for configurations that *coexist*, never for configurations that *superseded* each other.

Related: [Mission Planner on Linux](mission-planner-linux.md) · `../../tools/paramdiff.py` ·
`../../tools/tlog_params.py`

Adopted **2026-09-14**, after the X500 accumulated five dumps during one tuning campaign.

---

## 1. Layout

```
drones/<craft>/<craft>.param        current board state, complete and loadable
drones/<craft>/<craft>-<variant>.param   only if the variant coexists (payload vs bare)
```

The file is a **complete** dump, not a trimmed one, so it loads straight into Mission Planner as a
restore image. Nothing is stripped from the file itself — noise is handled at diff time (§3).

## 2. Workflow

1. Change params on the aircraft.
2. **Verify the dump against the board before committing it.** A `.param` file is the GCS's view,
   not the flight controller's, and the two genuinely disagree — see §5.
3. Overwrite `<craft>.param` with the new dump.
4. Commit, putting the *why* in the message. The commit message is the documentation; that is the
   whole reason this beats a folder of files with a README.

History operations replace everything a filename convention would have given you:

```bash
git log -p --follow -- drones/x500/x500.param          # what changed, when, and why
git log --oneline -- drones/x500/x500.param            # the index, self-maintaining
git show <rev>:drones/x500/x500.param > /tmp/r.param   # restore any past config
```

## 3. Diffing — use `paramdiff.py`, not `diff`

A raw dump-to-dump diff is mostly noise. Measured on the X500 tuning dumps, **54–60% of changed
lines** were boot counters, flight stats, ground pressure, gyro cal temps, learned hover throttle,
and the `FFT_*_HOVER` values the FFT auto-saves on disarm.

```bash
python3 drones/tools/paramdiff.py A.param B.param        # meaningful only
python3 drones/tools/paramdiff.py A.param B.param --all  # include volatile
python3 drones/tools/paramdiff.py git:HEAD~3 drones/x500/x500.param
```

On the X500 this turned 35 changed lines into 16 real ones, and 15 into 6.

## 4. Why not a folder of dumps with a README

It was tried here implicitly and failed. Of the five X500 files, `x500_params_autotuned.param` held
a roll tune that was **deliberately discarded** for D-term noise — the name said "autotuned", the
contents were a rejected tune — and `pitch_autotuned.param` disagreed with the board on two params.
So two of five actively misrepresented the aircraft, and the README's job would have been explaining
which files lie. A filename cannot carry "superseded because the D-term noise was too high"; a
commit message can, and it is attached to the change instead of drifting in a separate file.

## 5. The dump is not the board

Do not trust a `.param` file as evidence of what the flight controller holds. On 2026-09-14 an
autotune reported success, printed its results, and saved only the rate PID — leaving
`ATC_ANG_PIT_P` and `ATC_ACC_P_MAX` at stock defaults in both the FC and the dump.

To see what the FC **actually wrote**, read `PARAM_VALUE` out of the tlog:

```bash
python3 drones/tools/tlog_params.py flight.tlog | grep 65535
```

Writes are broadcast with `param_index=65535`; bulk downloads carry a real index. This is the only
way to tell "the FC never saved it" from "the GCS dump is stale", which look identical in a file.
Full account: [[ardupilot-autotune-can-report-success-and-save-only-the-rate]].

## 6. Migrating an airframe

Everything already committed stays in history, so consolidation loses nothing:

```bash
git mv <newest-dump>.param <craft>.param
git rm <every older dump>.param
```

Confirm first that each file being removed has at least one commit
(`git log --oneline -- <path>`), then commit the consolidation in one go.
