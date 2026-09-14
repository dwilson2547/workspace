#!/usr/bin/env python3
"""tlog_servo.py -- per-motor output stats from a Mission Planner .tlog.

Answers "did any motor saturate?" without pulling the .bin dataflash log.
Reads SERVO_OUTPUT_RAW (msgid 36) and reports min/max/mean per motor over a
time window, a count of samples at the rails, and the CW-vs-CCW pair split
(the yaw trim the FC is holding continuously).

Usage:
    python3 tlog_servo.py <file.tlog> <HH:MM:SS start> <HH:MM:SS end>

Reading the output:
  - The ceiling is MOT_PWM_MIN + MOT_SPIN_MAX * (MOT_PWM_MAX - MOT_PWM_MIN),
    NOT MOT_PWM_MAX. On a 1000/2000 + 0.95 setup that is 1950us.
  - Samples where ALL FOUR motors sit at MOT_PWM_MIN together are disarmed
    periods, not clipping. Only a subset at the rail means real saturation.
  - An autotune whose peak stays well under the ceiling is not authority
    limited, so its gains are valid rather than provisional.

Motor map for ArduPilot QUAD/X: M1 front-right and M2 rear-left are CCW;
M3 front-left and M4 rear-right are CW. A positive CW-CCW split means the FC
is countering a net CW reaction torque, i.e. a CCW motor is dragging.

Same no-pymavlink approach as tlog_params.py: fixed-layout payload, 8-byte
big-endian microsecond timestamp per frame, CRCs unchecked with implausible
values filtered out.
"""
import struct, sys, datetime
data = open(sys.argv[1],'rb').read()
t0, t1 = sys.argv[2], sys.argv[3]
rows=[]; i=0; n=len(data)
while i < n:
    b=data[i]
    if b==0xFD and i+10<=n: ln=data[i+1]; hdr=10; mid=data[i+7]|(data[i+8]<<8)|(data[i+9]<<16)
    elif b==0xFE and i+6<=n: ln=data[i+1]; hdr=6; mid=data[i+5]
    else: i+=1; continue
    end=i+hdr+ln+2
    if mid!=36 or end>n: i+=1; continue
    p=data[i+hdr:i+hdr+ln]
    if len(p)<21: p=p+b'\x00'*(21-len(p))
    s=struct.unpack('<8H', p[4:20])
    ts=""
    if i>=8:
        us=struct.unpack('>Q',data[i-8:i])[0]
        if 1_600_000_000_000_000<us<2_000_000_000_000_000:
            ts=datetime.datetime.fromtimestamp(us/1e6).strftime('%H:%M:%S')
    if ts and t0<=ts<=t1 and all(800<v<2200 for v in s[:4]):
        rows.append((ts,s[:4]))
    i=end
if not rows:
    print("no SERVO_OUTPUT_RAW in window"); sys.exit()
print(f"samples: {len(rows)}   window {rows[0][0]} .. {rows[-1][0]}")
for m in range(4):
    v=[r[1][m] for r in rows]
    print(f"  M{m+1}: min {min(v)}  max {max(v)}  mean {sum(v)/len(v):7.1f}")
HI, LO = 1940, 1070
print(f"\nsaturation check (hi>={HI}, lo<={LO}):")
for m in range(4):
    v=[r[1][m] for r in rows]
    print(f"  M{m+1}: {sum(1 for x in v if x>=HI)} hi, {sum(1 for x in v if x<=LO)} lo")
ccw=[(r[1][0]+r[1][1])/2 for r in rows]; cw=[(r[1][2]+r[1][3])/2 for r in rows]
print(f"\nyaw split (CW pair - CCW pair): mean {sum(cw)/len(cw)-sum(ccw)/len(ccw):+.1f}us")
