---
title: Aprilia scraper live in prod; catalogue has a reCAPTCHA rate-limit gate
date: 2026-10-13
tags: web-scraping,motorcycles,scrape-stack
source: docs/issues/2026_10_13_aprilia-rate-limit-challenge-gate.md
---

Aprilia parts scraper now runs under scrape-job-manager (dev verified, prod live 2026-10-13) writing the shared motorcycle_parts DB via motorcycle_common. The catalogue throttles ~400 requests per 15 min per IP and serves a reCAPTCHA 'Verification Required' page with HTTP 200 instead of a 429; request-auth now paces the domain at 1 req/15s (config in the request-auth DB, not git) and the scraper detects the gate, never caches it, and aborts the run gracefully. See: docs/issues/2026_10_13_aprilia-rate-limit-challenge-gate.md
