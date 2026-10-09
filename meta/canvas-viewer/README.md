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
- Editing: click selects a node or edge (highlighted, not exported); double-click a node/edge to edit its
  text/label (Ctrl+Enter or click away commits, Esc cancels); double-click empty space or `+ Text` / `+ Group`
  adds a node; drag the corner handle to resize; shift-click another node while one is selected to link them;
  `Delete` removes the selection; the colour dropdown recolours it. `Save .canvas` writes the result.
- Drag nodes to rearrange (groups carry the nodes inside them); edges follow.
- Renders text (basic markdown), file, link and group nodes, node colours (preset 1-6 or hex), edge labels,
  arrows and sides.
- Export PNG (high-res, scale selectable, whole diagram regardless of the view), PDF (page sized to the
  diagram, image embedded at the chosen scale), and the edited `.canvas` JSON.

Edge curves are an approximation of Obsidian's (its renderer is closed source), defined once in `edgeGeom()`.

Limits: PDF is a raster page, not vector. Canvas size is capped by the browser (~16k px per side;
the exporter reduces the scale automatically). Embedded file nodes show their path only.
