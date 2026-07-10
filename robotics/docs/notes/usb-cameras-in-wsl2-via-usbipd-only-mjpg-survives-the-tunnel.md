---
title: USB cameras in WSL2 via usbipd: only MJPG survives the tunnel
date: 2026-07-06
tags: wsl2,usbipd,uvc,camera,opencv
---

UVC cameras attached to WSL2 through usbipd-win (kernel has uvcvideo + vhci modules built in) silently truncate uncompressed video: YUYV/GREY at any resolution and even MJPG at 1280x800 arrive with only the top rows valid (rest is uniform fill, OpenCV read() still returns ok=True). Largest intact mode measured on an OV9281 UVC module: MJPG 640x480 @ ~94fps. Detect truncation by checking std() of the bottom rows, not the return code. Consequences: (1) always probe modes for full-frame integrity before trusting captures; (2) MJPG compression adds ~0.1-0.2px to subpixel line-centroid noise — acceptable for bench work, not ideal for metrology; (3) high-bandwidth raw capture (e.g. GREY 1280x800@100fps for structured light) needs a native Linux host or non-usbipd transport. Also: OV9281 auto-gain quietly compensates for manual exposure changes — set CAP_PROP_GAIN=0 explicitly or exposure sweeps do nothing; sensor black-level pedestal is ~24/255, so contrast ratios computed against raw background are pessimistic.

Dual-camera addendum (2026-07-07): two cameras CAN stream concurrently through the tunnel (2x MJPG 640x480 @ ~90fps sustained) — but two V4L2 STREAMONs in the same instant knock one device off the virtual bus entirely (it re-enumerates; recover with usbipd detach + attach, the wedged node reports "not a v4l2 node"/"busy" until then). Stagger stream starts by ~1s and it's rock solid. Bonus vendor quirk: Arducam UVC modules expose external-trigger mode as the standard `exposure_dynamic_framerate` V4L2 control (1=trigger mode, 0=free-run; AMCap calls it "low-brightness compensation"); it resets on re-enumeration.
