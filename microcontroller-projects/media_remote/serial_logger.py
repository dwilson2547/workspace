#!/usr/bin/env python3
"""Resilient USB-CDC serial logger for the XIAO ESP32-S3.

The board re-enumerates /dev/ttyACM0 on every reset, so we reopen on error.
Each line is host-timestamped and written to both stdout and serial.log.
"""
import sys
import time
import datetime
import serial

PORT = "/dev/ttyACM0"
BAUD = 115200
LOGFILE = "serial.log"


def ts():
    return datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]


def main():
    log = open(LOGFILE, "a", buffering=1)
    log.write(f"\n===== logger started {ts()} =====\n")
    while True:
        try:
            with serial.Serial(PORT, BAUD, timeout=1) as s:
                line = f"[{ts()}] <<< serial connected >>>"
                print(line, flush=True)
                log.write(line + "\n")
                buf = b""
                while True:
                    chunk = s.read(256)
                    if chunk:
                        buf += chunk
                        while b"\n" in buf:
                            raw, buf = buf.split(b"\n", 1)
                            text = raw.decode("utf-8", "replace").rstrip("\r")
                            out = f"[{ts()}] {text}"
                            print(out, flush=True)
                            log.write(out + "\n")
        except (serial.SerialException, OSError) as e:
            line = f"[{ts()}] <<< port lost: {e} — reopening >>>"
            print(line, flush=True)
            log.write(line + "\n")
            time.sleep(0.5)
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
