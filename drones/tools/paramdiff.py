#!/usr/bin/env python3
"""paramdiff.py -- diff two ArduPilot .param dumps, hiding the volatile noise.

A raw dump-to-dump diff is mostly worthless: boot counters, flight stats, ground
pressure, gyro cal temps, learned hover throttle and FFT hover values all move
every boot and every flight. Measured on the X500 tuning dumps, 54-60% of changed
lines were this kind of noise. This hides them so the real config change is
readable, while leaving the .param files themselves complete and loadable.

Usage:
    paramdiff.py A.param B.param          # meaningful changes only
    paramdiff.py A.param B.param --all    # include the volatile ones
    paramdiff.py git:HEAD~3 B.param       # compare against a git revision

    A git: argument is "git:<rev>" and resolves against the SAME path as the
    other argument, e.g.  paramdiff.py git:HEAD~3 drones/x500/x500.param

Exit status is 1 if there are meaningful differences, else 0, so it works in a
pre-commit check.
"""
import re
import subprocess
import sys

# Changes every boot / flight / calibration. Not config.
VOLATILE = re.compile(r"""^(
      STAT_.*                      # runtime, bootcount, flight count, distance
    | BARO\d*_GND_PRESS            # ground pressure at boot
    | INS_(GYR|ACC)\d*OFFS_[XYZ]   # sensor offsets, re-learned on cal
    | INS_(GYR|ACC)OFFS_[XYZ]
    | INS_ACC\d*SCAL_[XYZ]
    | INS_(GYR|ACC)\d*_CALTEMP     # temperature at last calibration
    | INS_TCAL\d*_.*
    | MOT_THST_HOVER               # learned when MOT_HOVER_LEARN is on
    | FFT_(THR_REF|FREQ_HOVER|BW_HOVER)   # FFT auto-saves these on disarm
    | COMPASS_(DEC|OFS\d*_[XYZ]|DIA\d*_[XYZ]|ODI\d*_[XYZ])
    | AHRS_TRIM_[XYZ]
)$""", re.VERBOSE)


def load(arg, other):
    if arg.startswith("git:"):
        rev = arg[4:]
        path = other[4:] if other.startswith("git:") else other
        try:
            txt = subprocess.run(["git", "show", f"{rev}:{path}"],
                                 capture_output=True, text=True,
                                 check=True).stdout
        except subprocess.CalledProcessError as e:
            sys.exit(f"cannot read {rev}:{path}\n{e.stderr.strip()}")
    else:
        txt = open(arg).read()
    out = {}
    for line in txt.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # MP writes NAME,VALUE; some tools write NAME<tab>VALUE
        parts = line.replace("\t", ",").split(",", 1)
        if len(parts) == 2:
            out[parts[0].strip()] = parts[1].strip()
    return out


def num(s):
    try:
        return float(s)
    except ValueError:
        return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_all = "--all" in sys.argv[1:]
    if len(args) != 2:
        sys.exit(__doc__)
    A, B = load(args[0], args[1]), load(args[1], args[0])

    changed, added, removed, hidden = [], [], [], 0
    for k in sorted(set(A) | set(B)):
        a, b = A.get(k), B.get(k)
        if a == b:
            continue
        na, nb = (num(a) if a else None), (num(b) if b else None)
        if na is not None and nb is not None and na == nb:
            continue  # 0 vs 0.0
        if VOLATILE.match(k) and not show_all:
            hidden += 1
            continue
        if a is None:
            added.append((k, b))
        elif b is None:
            removed.append((k, a))
        else:
            changed.append((k, a, b))

    w = max([len(k) for k, *_ in changed + added + removed] + [4])
    for k, a, b in changed:
        print(f"  {k:<{w}}  {a:>14}  ->  {b}")
    for k, b in added:
        print(f"+ {k:<{w}}  {'':>14}  ->  {b}")
    for k, a in removed:
        print(f"- {k:<{w}}  {a:>14}  ->  (absent)")

    n = len(changed) + len(added) + len(removed)
    if not n:
        print("  no meaningful differences")
    print(f"\n-- {n} meaningful, {hidden} volatile hidden "
          f"({'use --all to show' if hidden else 'none'}) --")
    return 1 if n else 0


if __name__ == "__main__":
    sys.exit(main())
