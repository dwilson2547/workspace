import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { STATUS_COLOR } from "./App.jsx";

const ROW = 46, COL = 170, GAP = 250, PROJECT_GAP = 70, LEFT = 180, TOP = 60;
const LOD_FAR = 0.6, LOD_NEAR = 1.8;

function layout(graph, width) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const dates = graph.nodes.map((n) => (n.date ? new Date(n.date) : null)).filter((d) => d && !isNaN(d));
  const [d0, d1] = dates.length ? d3.extent(dates) : [new Date(), new Date()];
  const span = Math.max(1, d1 - d0);
  const days = span / 86400000;
  const x = d3.scaleTime().domain([new Date(d0 - span * 0.03), new Date(+d1 + span * 0.08)])
    .range([LEFT, LEFT + Math.max(width - LEFT - 60, days * 14)]);

  const positioned = [], links = [], bands = [];
  let yOff = TOP;
  const projects = d3.group(graph.nodes, (n) => n.project);
  for (const [project, nodes] of projects) {
    const ids = new Set(nodes.map((n) => n.id));
    const children = new Map();
    const roots = [];
    for (const n of nodes) {
      const p = n.parent && ids.has(n.parent) ? n.parent : null;
      if (p) children.set(p, [...(children.get(p) || []), n]); else roots.push(n);
    }
    const order = (a, b) => (a.date || "").localeCompare(b.date || "") || a.num.localeCompare(b.num);
    const h = d3.hierarchy({ id: "__root__" + project, children: roots.sort(order) },
      (d) => (d.id.startsWith("__root__") ? d.children : (children.get(d.id) || []).sort(order)));
    d3.tree().nodeSize([ROW, COL])(h);
    const xs = h.descendants().filter((d) => d.depth).map((d) => d.x);
    const minX = xs.length ? Math.min(...xs) : 0, maxX = xs.length ? Math.max(...xs) : 0;
    // 1. x from the node's own date. 2. A parent recorded after its children (a requirement
    // written down late) is pulled left of them. 3. A child too close to its parent is pushed
    // right so labels never collide. The panel shows the true date either way.
    h.each((d) => {
      if (!d.depth) return;
      const dt = d.data.date ? new Date(d.data.date) : null;
      d.px = dt && !isNaN(dt) ? x(dt) : LEFT + d.depth * COL;
    });
    h.eachAfter((d) => {
      if (!d.depth || !d.children) return;
      d.px = Math.min(d.px, Math.min(...d.children.map((c) => c.px)) - GAP);
    });
    h.eachBefore((d) => {
      if (d.depth > 1) d.px = Math.max(d.px, d.parent.px + GAP);
    });
    const place = new Map();
    h.each((d) => {
      if (!d.depth) return;
      const n = d.data;
      const px = d.px, py = yOff + (d.x - minX);
      place.set(n.id, { px, py });
      positioned.push({ ...n, px, py });
      if (d.parent && d.parent.depth) {
        const p = place.get(d.parent.data.id);
        links.push({ type: "tree", from: p, to: { px, py }, dead: n.dead, id: n.id, pid: d.parent.data.id });
      }
    });
    for (const n of nodes) {
      if (n.supersedes && place.has(n.supersedes)) {
        links.push({ type: "supersedes", from: place.get(n.supersedes), to: place.get(n.id), id: n.id, pid: n.supersedes });
      }
    }
    const height = Math.max(ROW, maxX - minX + ROW);
    bands.push({ project, y: yOff, height });
    yOff += height + PROJECT_GAP;
  }
  return { positioned, links, bands, x, byId, height: yOff };
}

function Glyph({ n, r }) {
  const fill = STATUS_COLOR[n.status] || "var(--open)";
  if (n.kind === "requirement" || n.kind === "constraint") {
    const s = r * 1.25;
    return <rect className="glyph" x={-s} y={-s} width={2 * s} height={2 * s} rx={2} transform="rotate(45)"
      fill={n.status === "open" ? "var(--bg2)" : fill} stroke="var(--requirement)" strokeWidth={2} />;
  }
  if (n.kind === "outcome") return <rect className="glyph" x={-r} y={-r} width={2 * r} height={2 * r} rx={3} fill={fill} stroke="var(--bg)" strokeWidth={1.5} />;
  return <circle className="glyph" r={r} fill={fill} stroke="var(--bg)" strokeWidth={1.5} />;
}

export default function Tree({ graph, hits, selected, onSelect }) {
  const svgRef = useRef(null), gRef = useRef(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [t, setT] = useState(d3.zoomIdentity);

  useEffect(() => {
    const el = svgRef.current.parentElement;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = useMemo(() => layout(graph, size.w), [graph, size.w]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.15, 6]).on("zoom", (e) => setT(e.transform));
    svg.call(zoom).on("dblclick.zoom", null);
    return () => svg.on(".zoom", null);
  }, []);

  const k = t.k;
  const far = k < LOD_FAR, near = k > LOD_NEAR;
  const isReq = (n) => n.kind === "requirement" || n.kind === "constraint";
  const axis = useMemo(() => {
    const ticks = L.x.ticks(Math.max(3, Math.floor((size.w / k) / 160)));
    const spanDays = (L.x.domain()[1] - L.x.domain()[0]) / 86400000;
    const fmt = d3.timeFormat(spanDays > 400 ? "%b %Y" : spanDays > 3 ? "%d %b" : "%d %b %H:%M");
    return ticks.map((d) => ({ d, px: L.x(d), label: fmt(d) }));
  }, [L, size.w, k]);

  return (
    <div className="stage">
      <svg ref={svgRef} width={size.w} height={size.h}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>
        <g ref={gRef} transform={t.toString()}>
          <g className="axis" transform={`translate(0,${TOP - 34})`}>
            <line x1={L.x.range()[0]} x2={L.x.range()[1]} y1={0} y2={0} />
            {axis.map((a) => (
              <g key={+a.d} transform={`translate(${a.px},0)`}>
                <line y1={0} y2={L.height} stroke="var(--line)" strokeDasharray="2 6" opacity={0.5} />
                <text y={-6} textAnchor="middle">{a.label}</text>
              </g>
            ))}
          </g>
          {L.bands.map((b) => (
            <text key={b.project} className="project-label" x={12} y={b.y + 4}>{b.project}</text>
          ))}
          {L.links.map((l, i) => {
            if (far && !(l.type === "tree" && isReq(L.byId.get(l.pid)) && isReq(L.byId.get(l.id)))) return null;
            const dim = hits && !(hits.has(l.id) && hits.has(l.pid));
            if (l.type === "supersedes") {
              const mx = (l.from.px + l.to.px) / 2;
              return <path key={i} className={"link supersedes" + (dim ? " dim" : "")} markerEnd="url(#arrow)"
                d={`M${l.from.px},${l.from.py} C${mx},${l.from.py} ${mx},${l.to.py} ${l.to.px - 12},${l.to.py}`} />;
            }
            return <path key={i} className={"link" + (l.dead ? " dead" : "") + (dim ? " dim" : "")}
              d={d3.linkHorizontal()({ source: [l.from.px, l.from.py], target: [l.to.px, l.to.py] })} />;
          })}
          {L.positioned.map((n) => {
            if (far && !isReq(n)) return null;
            const r = isReq(n) ? 9 : 7;
            const cls = ["node", n.dead ? "dead" : "", hits ? (hits.has(n.id) ? "hit" : "dim") : "", selected === n.id ? "selected" : ""].join(" ");
            return (
              <g key={n.id} className={cls} transform={`translate(${n.px},${n.py})`} onClick={() => onSelect(n.id)}>
                <Glyph n={n} r={far ? r * 1.6 : r} />
                <text x={r + 8} y={-2}>{n.num} {n.title.length > 38 && !near ? n.title.slice(0, 36) + "…" : n.title}</text>
                <text className="kind" x={r + 8} y={11}>{n.kind} · {n.status}{n.dead_reason ? " · " + n.dead_reason : ""}</text>
                {far && n.rollup && (
                  <text className="rollup" x={r + 8} y={26}>{n.rollup.live} live · {n.rollup.dead} dead{n.closed_by?.length ? " · closed" : ""}</text>
                )}
                {near && n.excerpt && (
                  <foreignObject x={r + 8} y={16} width={300} height={70}>
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.3 }}>{n.excerpt}</div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="hint">scroll to zoom · drag to pan · zoom {k.toFixed(2)} · {far ? "requirements only" : near ? "detail" : "decisions"}</div>
    </div>
  );
}
