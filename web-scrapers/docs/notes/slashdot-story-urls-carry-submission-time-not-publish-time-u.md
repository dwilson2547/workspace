---
title: Slashdot story URLs carry submission time, not publish time — use the byline
date: 2026-11-04
tags: scraping,slashdot,timestamps
---

The numeric segment in slashdot.org story URLs (/story/YY/MM/DD/HHMMSS-ish/, variable 6-7 digits) is an ambiguous submission timestamp, NOT the publish time (e.g. /story/26/11/04/207222/ does not parse as HHMMSS and maps to a different instant than the feed). The publish time is the displayed byline (<time datetime="on Wednesday November 04, 2026 @10:30PM">), rendered in the viewer's tz — anonymous default America/New_York. Parsing it as America/New_York and converting to UTC matched the slashdot.xml backslash feed's UTC <time> 15/15 on 2026-11-05. See web-scrapers/slashdot-news-archive/docs/recon-2026-11-05.md.
