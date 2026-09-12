#!/usr/bin/env python3
"""
video-trimmer — a local, single-purpose video trim + convert UI.

Scrub, mark in, mark out, pick a format, go. Nothing else.

Backend responsibilities:
  * list source clips
  * probe them (duration / fps / codec / keyframe positions)
  * serve the media with HTTP Range support, so the browser can seek instantly
  * shell out to ffmpeg for the export and report progress

Stdlib only, no dependencies beyond ffmpeg/ffprobe on PATH.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
STATIC = HERE / "static"

VIDEO_EXTS = {".mov", ".mp4", ".mkv", ".avi", ".m4v", ".webm", ".mts", ".m2ts", ".wmv", ".flv"}

# Populated at startup from `ffmpeg -encoders`.
ENCODERS: set[str] = set()

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()


# --------------------------------------------------------------------------
# probing
# --------------------------------------------------------------------------

def _run(cmd: list[str], timeout: int = 120) -> str:
    return subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, check=False
    ).stdout


def probe(path: Path) -> dict:
    """Container + video stream summary. Cheap; no full decode."""
    raw = _run([
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,r_frame_rate,pix_fmt",
        "-show_entries", "format=duration,size,bit_rate",
        "-of", "json", str(path),
    ])
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"ok": False, "error": "ffprobe returned nothing usable"}

    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}

    # r_frame_rate arrives as "60/1"
    fps = 0.0
    rate = stream.get("r_frame_rate", "0/1")
    if "/" in rate:
        num, den = rate.split("/", 1)
        try:
            fps = float(num) / float(den) if float(den) else 0.0
        except ValueError:
            fps = 0.0

    has_audio = bool(_run([
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(path),
    ]).strip())

    return {
        "ok": True,
        "name": path.name,
        "codec": stream.get("codec_name", "?"),
        "width": stream.get("width", 0),
        "height": stream.get("height", 0),
        "pix_fmt": stream.get("pix_fmt", ""),
        "fps": round(fps, 4),
        "duration": float(fmt.get("duration", 0) or 0),
        "size": int(fmt.get("size", 0) or 0),
        "bit_rate": int(fmt.get("bit_rate", 0) or 0),
        "has_audio": has_audio,
    }


@lru_cache(maxsize=64)
def keyframes(path_str: str, mtime: float) -> tuple[float, ...]:
    """
    Keyframe timestamps, read from the container index (no decoding).

    `mtime` is part of the cache key so an edited file re-probes.
    """
    raw = _run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "packet=pts_time,flags",
        "-of", "csv=p=0", path_str,
    ], timeout=300)

    out: list[float] = []
    for line in raw.splitlines():
        parts = line.split(",")
        if len(parts) < 2 or "K" not in parts[1]:
            continue
        try:
            out.append(float(parts[0]))
        except ValueError:
            continue
    return tuple(sorted(out))


# --------------------------------------------------------------------------
# export presets
# --------------------------------------------------------------------------

def build_presets() -> list[dict]:
    """Presets, filtered to what this ffmpeg build can actually do."""
    presets = [{
        "id": "copy",
        "label": "MP4 — lossless (no re-encode)",
        "ext": ".mp4",
        "lossless": True,
        "note": "Instant and bit-perfect. Cuts snap to the nearest keyframe.",
    }]

    if "h264_nvenc" in ENCODERS:
        presets.append({
            "id": "h264_nvenc",
            "label": "MP4 — H.264, frame-exact (GPU)",
            "ext": ".mp4",
            "lossless": False,
            "note": "Frame-exact cuts, re-encoded on the GPU. Fast.",
        })
    presets.append({
        "id": "h264_x264",
        "label": "MP4 — H.264, frame-exact (CPU)",
        "ext": ".mp4",
        "lossless": False,
        "note": "Frame-exact, CPU encode. Slower, slightly better quality per byte.",
    })
    if "hevc_nvenc" in ENCODERS:
        presets.append({
            "id": "hevc_nvenc",
            "label": "MP4 — H.265/HEVC, frame-exact (GPU)",
            "ext": ".mp4",
            "lossless": False,
            "note": "Smaller files, less compatible with older players.",
        })
    presets.append({
        "id": "webm_vp9",
        "label": "WebM — VP9 (CPU, slow)",
        "ext": ".webm",
        "lossless": False,
        "note": "For the web. Noticeably slower to encode.",
    })
    presets.append({
        "id": "gif",
        "label": "GIF — 480p, 15fps",
        "ext": ".gif",
        "lossless": False,
        "note": "Two-pass palette for decent colour. Keep clips short.",
    })
    presets.append({
        "id": "audio",
        "label": "M4A — audio only",
        "ext": ".m4a",
        "lossless": False,
        "note": "Strips the video entirely.",
    })
    return presets


def ffmpeg_cmd(src: Path, dst: Path, start: float, end: float, preset: str,
               quality: int) -> list[str]:
    dur = max(0.001, end - start)

    # -ss before -i is the fast seek. With -c copy it lands on a keyframe; with a
    # re-encode ffmpeg decodes and discards up to the exact frame, so it stays exact.
    base = ["ffmpeg", "-hide_banner", "-nostdin", "-y",
            "-ss", f"{start:.4f}", "-i", str(src), "-t", f"{dur:.4f}"]

    if preset == "copy":
        return base + ["-c", "copy", "-avoid_negative_ts", "make_zero",
                       "-movflags", "+faststart",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "h264_nvenc":
        return base + ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr",
                       "-cq", str(quality), "-b:v", "0",
                       "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "192k",
                       "-movflags", "+faststart",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "hevc_nvenc":
        return base + ["-c:v", "hevc_nvenc", "-preset", "p5", "-rc", "vbr",
                       "-cq", str(quality), "-b:v", "0",
                       "-pix_fmt", "yuv420p", "-tag:v", "hvc1",
                       "-c:a", "aac", "-b:a", "192k",
                       "-movflags", "+faststart",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "h264_x264":
        return base + ["-c:v", "libx264", "-preset", "medium", "-crf", str(quality),
                       "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "192k",
                       "-movflags", "+faststart",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "webm_vp9":
        return base + ["-c:v", "libvpx-vp9", "-crf", str(quality), "-b:v", "0",
                       "-row-mt", "1",
                       "-c:a", "libopus", "-b:a", "128k",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "gif":
        vf = ("fps=15,scale=854:-1:flags=lanczos,"
              "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer")
        return base + ["-vf", vf, "-loop", "0",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    if preset == "audio":
        return base + ["-vn", "-c:a", "aac", "-b:a", "256k",
                       "-progress", "pipe:1", "-nostats", str(dst)]

    raise ValueError(f"unknown preset {preset!r}")


def run_export(job_id: str, cmd: list[str], dst: Path, total: float) -> None:
    with JOBS_LOCK:
        JOBS[job_id].update(state="running", cmd=" ".join(cmd))

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
    )
    with JOBS_LOCK:
        JOBS[job_id]["pid"] = proc.pid

    # ffmpeg's -progress stream is key=value lines; out_time_us drives the bar.
    for line in proc.stdout:
        line = line.strip()
        if line.startswith("out_time_us=") or line.startswith("out_time_ms="):
            val = line.split("=", 1)[1]
            if val.isdigit():
                secs = int(val) / (1_000_000 if "_us=" in line else 1_000)
                pct = min(99.0, (secs / total * 100.0) if total else 0.0)
                with JOBS_LOCK:
                    JOBS[job_id]["progress"] = round(pct, 1)
        elif line.startswith("speed="):
            with JOBS_LOCK:
                JOBS[job_id]["speed"] = line.split("=", 1)[1].strip()

    stderr = proc.stderr.read()
    code = proc.wait()

    with JOBS_LOCK:
        job = JOBS[job_id]
        if code == 0 and dst.exists() and dst.stat().st_size > 0:
            job.update(state="done", progress=100.0,
                       size=dst.stat().st_size, output=str(dst))
        else:
            # Surface the last few ffmpeg lines; the full spew is rarely the useful part.
            tail = "\n".join(stderr.strip().splitlines()[-6:])
            job.update(state="error", error=tail or f"ffmpeg exited {code}")
            if dst.exists() and dst.stat().st_size == 0:
                dst.unlink(missing_ok=True)


# --------------------------------------------------------------------------
# http
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "video-trimmer"
    src_dir: Path
    out_dir: Path

    def log_message(self, fmt, *args):  # quieter console
        if "/api/jobs/" not in self.path:
            super().log_message(fmt, *args)

    # -- helpers ----------------------------------------------------------

    def _json(self, obj, code: int = 200) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _resolve(self, name: str) -> Path | None:
        """Resolve a requested filename inside src_dir, refusing escapes."""
        candidate = (self.src_dir / unquote(name)).resolve()
        if candidate.parent != self.src_dir.resolve() or not candidate.is_file():
            return None
        return candidate

    # -- routes -----------------------------------------------------------

    def do_GET(self) -> None:
        url = urlparse(self.path)
        route, qs = url.path, parse_qs(url.query)

        if route == "/":
            return self._send_static("index.html")
        if route.startswith("/static/"):
            return self._send_static(route[len("/static/"):])
        if route == "/api/config":
            return self._json({
                "src_dir": str(self.src_dir),
                "out_dir": str(self.out_dir),
                "presets": build_presets(),
            })
        if route == "/api/files":
            return self._json(self._list_files())
        if route == "/api/probe":
            name = (qs.get("f") or [""])[0]
            path = self._resolve(name)
            if not path:
                return self._json({"ok": False, "error": "no such file"}, 404)
            info = probe(path)
            info["keyframes"] = list(keyframes(str(path), path.stat().st_mtime))
            return self._json(info)
        if route.startswith("/api/jobs/"):
            job_id = route.rsplit("/", 1)[-1]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                return self._json({"error": "no such job"}, 404)
            return self._json(job)
        if route.startswith("/media/"):
            return self._send_media(route[len("/media/"):])

        self.send_error(404)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/export":
            return self.send_error(404)

        length = int(self.headers.get("Content-Length", 0))
        try:
            req = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json({"error": "bad json"}, 400)

        src = self._resolve(req.get("file", ""))
        if not src:
            return self._json({"error": "no such file"}, 404)

        start = float(req.get("start", 0))
        end = float(req.get("end", 0))
        if end <= start:
            return self._json({"error": "out point must be after in point"}, 400)

        preset_id = req.get("preset", "copy")
        preset = next((p for p in build_presets() if p["id"] == preset_id), None)
        if not preset:
            return self._json({"error": f"unknown preset {preset_id}"}, 400)

        quality = int(req.get("quality", 21))

        stem = re.sub(r"[^\w.\- ]", "_", req.get("name") or "").strip()
        if not stem:
            stem = f"{src.stem}_{_ts(start)}-{_ts(end)}"
        dst = self.out_dir / f"{stem}{preset['ext']}"

        n = 1
        while dst.exists():  # never silently clobber a previous export
            dst = self.out_dir / f"{stem}_{n}{preset['ext']}"
            n += 1

        self.out_dir.mkdir(parents=True, exist_ok=True)
        cmd = ffmpeg_cmd(src, dst, start, end, preset_id, quality)

        job_id = uuid.uuid4().hex[:12]
        with JOBS_LOCK:
            JOBS[job_id] = {
                "id": job_id, "state": "queued", "progress": 0.0,
                "output": str(dst), "source": src.name,
                "started": time.time(),
            }
        threading.Thread(
            target=run_export, args=(job_id, cmd, dst, end - start), daemon=True
        ).start()
        return self._json({"job": job_id, "output": str(dst)})

    # -- static + media ---------------------------------------------------

    def _send_static(self, rel: str) -> None:
        path = (STATIC / rel).resolve()
        if not str(path).startswith(str(STATIC.resolve())) or not path.is_file():
            return self.send_error(404)
        body = path.read_bytes()
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _send_media(self, name: str) -> None:
        """
        Serve with Range support. This is the whole reason scrubbing feels instant:
        without 206 responses the browser refuses to seek.
        """
        path = self._resolve(name)
        if not path:
            return self.send_error(404)

        size = path.stat().st_size
        ctype = mimetypes.guess_type(path.name)[0] or "video/mp4"
        rng = self.headers.get("Range")

        start, end = 0, size - 1
        status = 200
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
            if m:
                g1, g2 = m.group(1), m.group(2)
                if g1:
                    start = int(g1)
                    end = int(g2) if g2 else size - 1
                elif g2:  # suffix range: last N bytes
                    start = max(0, size - int(g2))
                if start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = 206

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()

        remaining = end - start + 1
        with path.open("rb") as fh:
            fh.seek(start)
            while remaining > 0:
                chunk = fh.read(min(256 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return  # browser seeked away mid-stream; normal
                remaining -= len(chunk)

    def _list_files(self) -> list[dict]:
        out = []
        for p in sorted(self.src_dir.iterdir()):
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
                st = p.stat()
                out.append({"name": p.name, "size": st.st_size, "mtime": st.st_mtime})
        return out


def _ts(seconds: float) -> str:
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}{m:02d}{s:02d}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Local video trim + convert UI.")
    ap.add_argument("--src", default=str(Path.home() / "Videos"),
                    help="folder of source clips (default: ~/Videos)")
    ap.add_argument("--out", default=None,
                    help="export folder (default: <src>/trimmed)")
    ap.add_argument("--port", type=int, default=8791)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise SystemExit(f"{tool} not found on PATH — install ffmpeg first.")

    ENCODERS.update(
        re.findall(r"^\s*\S+\s+(\S+)", _run(["ffmpeg", "-hide_banner", "-encoders"]),
                   re.MULTILINE)
    )

    src = Path(args.src).expanduser().resolve()
    if not src.is_dir():
        raise SystemExit(f"source folder does not exist: {src}")
    out = Path(args.out).expanduser().resolve() if args.out else src / "trimmed"
    out.mkdir(parents=True, exist_ok=True)

    Handler.src_dir = src
    Handler.out_dir = out

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"  video-trimmer")
    print(f"  source : {src}")
    print(f"  output : {out}")
    print(f"  gpu    : {'yes (NVENC)' if 'h264_nvenc' in ENCODERS else 'no'}")
    print(f"\n  →  http://{args.host}:{args.port}\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
