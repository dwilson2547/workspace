---
title: Harley, Yamaha, Suzuki scrapers live in prod; fleet is five OEMs
date: 2026-10-13
tags: web-scraping,motorcycles,scrape-stack
source: docs/issues/2026_10_13_fleet-rollout-harley-yamaha-suzuki.md
---

Harley (ARI PartStream JSONP, endpoints moved under /Parts/), Yamaha (anonymous token + _next/data, API data sparse — empty diagrams skipped), and Suzuki (playwright-stealth Chromium in image for the Cloudflare managed challenge, skip-and-resume on stuck pages) all converted to motorcycle_common and live under scrape-job-manager in prod as of 2026-10-13. All dev jobs suspended; request-auth paces suzuki at 30s and aprilia at 15s. See: docs/issues/2026_10_13_fleet-rollout-harley-yamaha-suzuki.md
