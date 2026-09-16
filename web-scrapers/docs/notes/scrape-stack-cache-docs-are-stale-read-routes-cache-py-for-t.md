---
title: scrape-stack cache docs are stale; read routes/cache.py for the real contract
date: 2026-09-15
tags: imgcache,vidcache,scrape-stack,api-contract,stale-docs
source: web-scrapers/scrape-stack/services/imgcache/app/routes/cache.py
---

imgcache's readme.md and docs/api.md describe an older API than the code implements. Verified against services/imgcache/app/ on 2026-09-15.

Stale in the docs, actual in the code:
- hash is blake3 (routes/cache.py imports blake3), NOT BLAKE2b-256 as readme says
- endpoints are POST /cache and GET /cache/lookup, NOT POST /images
- columns renamed: content_hash->hash, content_type->mime_type, file_size_bytes->size_bytes, original_filename->filename
- lookup_time was dropped; bucket and prefix were added

POST /cache takes a client-computed content_hash form field and 422s if it does not match the uploaded bytes. Returns 201 stored / 200 duplicate. vidcache and filecache follow the same shape.

Any client storing blobs for later push to these caches must hash with blake3 or the blobs land under keys the cache cannot dedup against.
