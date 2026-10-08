---
tier: tool
domain: meta
---

# canvas-viewer

Single-file, zero-dependency viewer for [JSON Canvas](https://jsoncanvas.org) (`.canvas`) files,
for sharing with a team that does not use Obsidian.

Open `index.html` in a browser (no server or build needed), then open a `.canvas` file or drop it on
the page. Optionally `index.html?src=path/to/x.canvas` when served over http.

- Pan (drag background / scroll), zoom (ctrl+wheel or pinch, `+`/`-`), `F` fits the whole diagram.
- Drag nodes to rearrange (groups carry the nodes inside them); edges follow.
- Renders text (basic markdown), file, link and group nodes, node colours (preset 1-6 or hex), edge labels,
  arrows and sides.
- Export PNG (high-res, scale selectable, whole diagram regardless of the view), PDF (page sized to the
  diagram, image embedded at the chosen scale), and the edited `.canvas` JSON.

Limits: PDF is a raster page, not vector. Canvas size is capped by the browser (~16k px per side;
the exporter reduces the scale automatically). Embedded file nodes show their path only.
