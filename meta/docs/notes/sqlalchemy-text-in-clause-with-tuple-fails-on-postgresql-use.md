---
title: SQLAlchemy text() IN clause with tuple fails on PostgreSQL — use expanding bindparam
date: 2026-05-31
tags: sqlalchemy, postgresql, psycopg2, gotcha
---

When using sqlalchemy.text() with an IN clause, passing a Python tuple as a bound param does NOT expand to IN (1, 2, 3) on psycopg2/PostgreSQL — it raises ProgrammingError. Fix: use bindparam("name", expanding=True) and chain it onto the text() object: text("... IN :ids").bindparams(bindparam("ids", expanding=True)). Pass the value as a tuple in the params dict as normal. Mocked unit tests will not catch this — the mock accepts any value.
