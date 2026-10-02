---
title: Programmatic .click() hides unclickable UI — verify with real pointer clicks
date: 2026-10-02
tags: playwright,ui,testing,css
source: tools/dxf-converter/.ui_dev_state.md
---

In Playwright browser_evaluate, element.click() dispatches straight to the element and ignores CSS pointer-events, overlays and hit-testing, so a button made unclickable by CSS still 'works' in the test. Hit in dxf-converter v2: an SVG overlay class named .ghost collided with the .ghost button class and its pointer-events:none disabled every secondary button; only a real-pointer click (browser_click with a locator) exposed it. When verifying a UI workflow, make at least the key interactions real clicks (browser_click), and keep CSS class names for SVG/canvas layers distinct from button classes. Related trap from the same work: a CSS 'display:flex' on a class overrides the [hidden] attribute — add '[hidden]{display:none !important}' to the base styles.
