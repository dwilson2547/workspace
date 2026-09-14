#!/usr/bin/env python3
"""tlog_params.py -- extract PARAM_VALUE messages from a Mission Planner .tlog.

Why this exists: a saved .param dump is the GCS's view, not the flight
controller's. To find out what the FC actually WROTE, read the PARAM_VALUE
broadcasts instead. Params sent with param_index=65535 are write-notifications
(a param was just set/saved); params with a real index are part of a bulk
download. So the 65535 rows are a ground-truth log of every param write.

Usage:
    python3 tlog_params.py <file.tlog> [name-prefix]

    python3 tlog_params.py flight.tlog ATC_ANG_PIT   # one param family
    python3 tlog_params.py flight.tlog | grep 65535  # every write, in order

No pymavlink needed: PARAM_VALUE (msgid 22) is a fixed 25-byte payload, and
tlog frames are each prefixed with an 8-byte big-endian microsecond timestamp.
MAVLink2 zero-trims payloads, so short payloads are right-padded. CRCs are not
checked (no crc_extra tables here); false positives are filtered by requiring
param_id to be plausible ASCII.
"""
import struct, sys, datetime

data = open(sys.argv[1], 'rb').read()
want = sys.argv[2] if len(sys.argv) > 2 else ""
out = []
i = 0
n = len(data)
while i < n:
    b = data[i]
    if b == 0xFD and i + 10 <= n:
        ln = data[i+1]; hdr = 10; msgid = data[i+7] | (data[i+8] << 8) | (data[i+9] << 16)
    elif b == 0xFE and i + 6 <= n:
        ln = data[i+1]; hdr = 6; msgid = data[i+5]
    else:
        i += 1; continue
    end = i + hdr + ln + 2
    if msgid != 22 or end > n:
        i += 1; continue
    p = data[i+hdr : i+hdr+ln]
    if len(p) < 25:
        p = p + b'\x00' * (25 - len(p))
    pid = p[8:24].split(b'\x00')[0]
    try:
        pid = pid.decode('ascii')
    except Exception:
        i += 1; continue
    if not pid or not all(c.isalnum() or c == '_' for c in pid):
        i += 1; continue
    val, cnt, idx = struct.unpack('<fHH', p[0:8])
    ts = ""
    if i >= 8:
        us = struct.unpack('>Q', data[i-8:i])[0]
        if 1_600_000_000_000_000 < us < 2_000_000_000_000_000:
            ts = datetime.datetime.fromtimestamp(us/1e6).strftime('%H:%M:%S')
    if want and not pid.startswith(want):
        i += 1; continue
    out.append((ts, pid, val, idx, cnt))
    i = end

seen = set()
for ts, pid, val, idx, cnt in out:
    k = (ts, pid, val)
    if k in seen: continue
    seen.add(k)
    print(f"{ts:>9}  {pid:<20} = {val:<14.7g}  idx={idx}/{cnt}")
print(f"\n-- {len(out)} PARAM_VALUE frames matched '{want}' --")
