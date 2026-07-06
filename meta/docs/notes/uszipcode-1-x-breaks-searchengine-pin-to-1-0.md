---
title: uszipcode 1.x breaks SearchEngine — pin to <1.0
date: 2026-05-31
tags: uszipcode, python, gotcha, dependency
---

uszipcode 1.0+ depends on sqlalchemy_mate 2.0.0.3, which dropped ExtendedBase, causing AttributeError on import. SearchEngine is only usable on uszipcode 0.2.x (last good release: 0.2.6). Pin as uszipcode>=0.2.4,<1.0 in requirements. The package is unmaintained (last release 2021) and uszipcode 0.2.6 emits a MovedIn20Warning deprecation from SQLAlchemy 2.x, but it still works correctly.
