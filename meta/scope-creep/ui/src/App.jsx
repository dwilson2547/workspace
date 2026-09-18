import React, { useEffect, useMemo, useState } from "react";
import Tree from "./Tree.jsx";
import Panel from "./Panel.jsx";

export const STATUS_COLOR = {
  accepted: "var(--accepted)", done: "var(--done)", verified: "var(--done)", satisfied: "var(--done)",
  proposed: "var(--open)", open: "var(--open)", rejected: "var(--rejected)", superseded: "var(--superseded)",
  abandoned: "var(--superseded)",
};
const LIVE = new Set(["accepted", "done", "verified", "satisfied"]);
const DEADS = new Set(["rejected", "superseded", "abandoned"]);

export default function App() {
  const [graph, setGraph] = useState(null);
  const [err, setErr] = useState(null);
  const [project, setProject] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null); // null = no search; Map id → score
  const [mode, setMode] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("./api/graph").then((r) => r.json()).then(setGraph).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!q.trim()) { setHits(null); setMode(""); return; }
    const t = setTimeout(() => {
      fetch(`./api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((res) => {
        setHits(new Map(res.hits.map((h) => [h.id, h.score])));
        setMode(res.mode);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const shown = useMemo(() => {
    if (!graph) return null;
    const nodes = project ? graph.nodes.filter((n) => n.project.startsWith(project)) : graph.nodes;
    const ids = new Set(nodes.map((n) => n.id));
    return { ...graph, nodes, edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
  }, [graph, project]);

  const effectiveHits = useMemo(() => {
    if (!hits || !graph) return hits;
    if (filter === "all") return hits;
    const m = new Map();
    for (const n of graph.nodes) {
      if (!hits.has(n.id)) continue;
      if (filter === "accepted" && LIVE.has(n.status)) m.set(n.id, hits.get(n.id));
      if (filter === "rejected" && DEADS.has(n.status)) m.set(n.id, hits.get(n.id));
    }
    return m;
  }, [hits, filter, graph]);

  if (err) return <div className="empty">could not load ./api/graph: {err}</div>;
  if (!graph) return <div className="empty">loading…</div>;
  if (!graph.nodes.length) return <div className="empty">no docs/decisions/*.md found under {graph.root}</div>;

  return (
    <div className={"app" + (selected ? "" : " nopanel")}>
      <div className="toolbar">
        <h1>scope-creep</h1>
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">all projects</option>
          {graph.projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input placeholder="search decisions, requirements, options…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {["all", "accepted", "rejected"].map((f) => (
            <button key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {hits && <span className="mode">{effectiveHits.size} hits · {mode}</span>}
        <div className="legend">
          <span><i style={{ background: "var(--accepted)" }} />accepted</span>
          <span><i style={{ background: "var(--done)" }} />done</span>
          <span><i style={{ background: "var(--open)" }} />open</span>
          <span><i style={{ background: "var(--rejected)" }} />rejected</span>
          <span><i style={{ background: "var(--superseded)" }} />superseded</span>
          <span><i style={{ background: "var(--requirement)", borderRadius: 1 }} />requirement</span>
        </div>
      </div>
      <Tree graph={shown} hits={effectiveHits} selected={selected} onSelect={setSelected} />
      {selected && <Panel id={selected} graph={graph} onSelect={setSelected} onClose={() => setSelected(null)} />}
    </div>
  );
}
