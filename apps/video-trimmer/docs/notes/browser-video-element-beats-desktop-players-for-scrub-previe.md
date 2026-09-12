---
title: Browser video element beats desktop players for scrub-preview UI
date: 2026-09-12
tags: ffmpeg,video,ui,html5,keyframes
domains: media
---

A paused HTML5 <video> repaints the frame the instant you assign currentTime, which is the exact thing VLC and Resolve fail at when hunting for a cut point. That makes a local web UI the cheapest good answer for any frame-picking tool here, but only if the backend answers Range requests with 206 Partial Content — without that the browser silently refuses to seek at all and the whole approach looks broken. Works natively for H.264/VP8/VP9; HEVC will not decode in Chrome on Linux, so check the codec with ffprobe before assuming this route. Separately: ffmpeg -c copy can only cut on a keyframe, so it snaps the in-point backwards (DJI clips run a 1s GOP); show the user where the cut will really land rather than silently delivering extra footage.
