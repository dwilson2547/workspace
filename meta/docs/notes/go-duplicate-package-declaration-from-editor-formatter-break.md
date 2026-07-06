---
title: Go: duplicate package declaration from editor formatter breaks build
date: 2026-05-31
tags: go, gotcha, ci, formatter
---

When creating a new .go file, some editors/formatters silently insert a duplicate package declaration (two consecutive package <name> lines). This causes: syntax error: non-declaration statement outside function body at build and lint time. Affects CI immediately. Fix: remove the duplicate package line. Most likely to hit this on freshly created files like version.go.
