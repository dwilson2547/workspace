---
title: Kakao Page EPUB text-viewer scraping pattern
date: 2026-05-31
tags: playwright, kakao, shadow-root, epub
---

Kakao Page webtoon/novel viewer (slideType=EPUB) renders inside a shadow root. Do NOT scrape the DOM directly. Instead: 1) Call GET https://bff-page.kakao.com/api/gateway/api/v1/viewer/data?series_id=X&product_id=Y (with browser cookies via page.evaluate fetch) to get time-limited signed S3 URLs. 2) viewerData.contentsList contains one entry per content chunk, each with a secureUrl. 3) Fetch each chunk from https://dn-img-page.kakao.com/sdownload/resource?kid=<secureUrl> - returns JSON with contentInfo.paragraphList. 4) Recursively flatten paragraph types (H1/P/B/BR/TEXT/IMG/DIV) to extract plain text. Series/product IDs come from the URL path: /content/{series_id}/viewer/{product_id}. Signed URLs expire so must be fetched within the same Playwright session.
