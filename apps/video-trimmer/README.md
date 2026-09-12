---
tier: project
domains: media
---

# video-trimmer

Scrub, mark in, mark out, pick a format, go. A local web UI over ffmpeg for the
one job that shouldn't need a nonlinear editor: cutting a clip out of a longer
recording and getting it out as an mp4.

Built because DaVinci Resolve refuses to import media on this hardware, and VLC
won't repaint the frame until you hit play — which makes finding a cut point by
scrubbing effectively impossible.

## Run it

```bash
./start.sh                       # serves ~/Videos on http://127.0.0.1:8791
./start.sh --src ~/footage       # somewhere else
./start.sh --out /mnt/exports    # default is <src>/trimmed
./kill.sh
```

No dependencies beyond Python 3 and `ffmpeg`/`ffprobe` on PATH. Binds to
localhost only.

## Keys

| | |
|---|---|
| `space` | play / pause |
| `←` `→` | step one frame |
| `shift` + `←` `→` | step one second |
| `I` / `O` | mark in / mark out |
| `[` / `]` | jump to in / out |
| `P` | play just the selection |
| `enter` | export |
| `esc` | clear marks |

## The one thing worth understanding: lossless vs. frame-exact

**Lossless** (`-c copy`) doesn't re-encode. It's near-instant and bit-perfect,
but a cut can only start on a keyframe — so the in-point snaps *backwards* to
the nearest one and you get slightly more footage than you marked.

The UI shows this rather than hiding it: keyframes are drawn as faint ticks on
the timeline, and when your in-point isn't on one, a dashed amber line marks
where the cut will really land, with the drift in the hint line.

DJI clips carry a keyframe every 1.0s, so worst case is about a second of extra
head. If that matters, pick a frame-exact preset — it re-encodes, which is
slower and technically lossy, but lands on the exact frame.

| Preset | Speed | Cut accuracy |
|---|---|---|
| MP4 lossless | instant | nearest keyframe |
| MP4 H.264 GPU (NVENC) | ~3x realtime | exact |
| MP4 H.264 CPU (x264) | slower | exact |
| MP4 H.265 GPU | ~3x realtime | exact |
| WebM VP9 | slow | exact |
| GIF / M4A | varies | exact |

GPU presets appear only when the local ffmpeg reports the matching NVENC
encoder, so this degrades gracefully on a machine without an nvidia card.

## Layout

```
server.py           stdlib HTTP: file list, ffprobe, Range-served media, ffmpeg jobs
static/index.html   markup
static/style.css    dark theme
static/app.js       scrubbing, marking, keyframe snapping, export polling
```

Range support in `server.py` is load-bearing — without `206 Partial Content`
the browser won't seek at all, and the whole premise collapses.

## Not built

Multiple selections per clip, a render queue, audio waveforms, batch export
across clips. All reasonable; none needed yet.
