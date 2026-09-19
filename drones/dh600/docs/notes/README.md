# DH600 notes

- [DH600 hover noise fundamental is ~56 Hz; the 2nd harmonic at ~116 Hz dominates the roll gyro](dh600-hover-noise-fundamental-is-56hz-second-harmonic-dominates-roll.md) — 2026-09-18 baseline hover; notch must include harmonic 2; hover RCOU 1400–1433 µs so the spin floor stays. Verified same day: D-term RMS −74 %, centre tracks throttle. Autotune logs checked: all axes converged, yaw authority-limited, final-gain hover still owed; RATE/PID* log at 10 Hz outside AutoTune.
