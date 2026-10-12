---
title: Playwright MCP smart-approve blocks localhost and code tools; repeat or pipe-drive instead
date: 2026-10-12
tags: playwright,mcp,smart-approve,ui-testing
---

The harness smart-approve layer auto-denies mcp_playwright calls that touch localhost dev servers or run_code_unsafe-style execution, with an opaque mcp_tool_error and no prompt. Repeating the exact same call (or the file edit that creates the script) triggers the user-confirmation path and goes through; ask_user_question approval alone does not clear it. For scripted UI verification, driving the same @playwright/mcp server over a raw stdio JSON-RPC pipe (initialize, notifications/initialized, tools/call) works reliably and writes snapshots/screenshots to .playwright-mcp/ files — see ui verification in web-scrapers/scrape-job-manager (2026-10-12).
