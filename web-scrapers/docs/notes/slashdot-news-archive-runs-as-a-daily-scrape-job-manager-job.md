---
title: slashdot-news-archive runs as a daily scrape-job-manager job on cluster pgvector
date: 2026-11-05
tags: scraping,slashdot,kubernetes,scrape-job-manager,pgvector
---

The Slashdot archive (web-scrapers/slashdot-news-archive) is deployed as Scraper/ScrapeJob/ScrapePool in infra/cluster-config/slashdot-news (pool every 1d, 06:00-08:00 America/New_York), writing to the slashdot_news DB on postgres-pgvector-0 (init-slashdot-news.sql, secret slashdot-news-db). Image dwilson2547/slashdot-news-archive pinned by digest; rebuild+push then re-pin in scraper.yaml. Semantic search uses pgvector with all-MiniLM-L6-v2 embeddings computed in-pod (model baked in image) — NOT the danwiki embedding service. Run-now is spacing-limited (10m) after the last attempt; off-cluster DB access needs kubectl port-forward to postgres-pgvector-0. Details: web-scrapers/slashdot-news-archive/docs/deployment-2026-11-06.md.
