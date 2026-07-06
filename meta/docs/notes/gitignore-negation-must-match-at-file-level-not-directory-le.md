---
title: gitignore negation must match at file level not directory level
date: 2026-05-31
tags: git, gitignore, patterns, gotcha
---

To ignore secret.yml everywhere but allow it inside example-secrets/, the negation must be file-level: '**/secret.yml' then '!example-secrets/**/secret.yml'. The directory-level negation '!example-secrets/' does NOT un-ignore files matched by a prior file-level pattern — git only re-includes a file if the negation pattern itself matches the file path. Verified with git check-ignore -v.
