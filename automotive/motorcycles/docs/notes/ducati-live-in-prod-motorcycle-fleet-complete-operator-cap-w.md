---
title: Ducati live in prod, motorcycle fleet complete; operator cap was the 'stall'
date: 2026-10-13
tags: web-scraping,motorcycles,scrape-stack
source: docs/issues/2026_10_13_fleet-completion-ducati-and-operator-cap.md
---

Ducati went live 2026-10-13 via the Issuu per-page SVG text layer (no PDFs, no OCR — covers born-digital catalogues and scans alike), completing the six-OEM motorcycle fleet. The suspected operator stall was actually maxConcurrentRuns=6 pinned by the expanded fleet — bumped to 10. A queued suzuki dev run-now fired after prod started and raced on diagram inserts; suzuki inserts are now IntegrityError-safe. See: docs/issues/2026_10_13_fleet-completion-ducati-and-operator-cap.md
