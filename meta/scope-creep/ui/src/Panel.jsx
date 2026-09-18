import React, { useEffect, useState } from "react";
import { marked } from "marked";
import { STATUS_COLOR } from "./App.jsx";

export default function Panel({ id, graph, onSelect, onClose }) {
  const [node, setNode] = useState(null);
  const summary = graph.nodes.find((n) => n.id === id);
  useEffect(() => {
    setNode(null);
    fetch(`./api/node?id=${encodeURIComponent(id)}`).then((r) => r.json()).then(setNode);
  }, [id]);
  if (!summary) return null;
  const n = { ...summary, ...(node || {}) };
  const Ref = ({ rid }) => graph.nodes.some((m) => m.id === rid)
    ? <a onClick={() => onSelect(rid)}>{rid}</a> : <span title="not found">{rid} ⚠</span>;
  const list = (label, ids) => ids && ids.length ? (
    <li>{label}: {ids.map((r, i) => <span key={r}>{i ? ", " : ""}<Ref rid={r} /></span>)}</li>
  ) : null;
  const html = node ? marked.parse(node.body || "") : "";
  return (
    <div className="panel">
      <button className="close" onClick={onClose} title="close">×</button>
      <h2>{n.num} — {n.title}</h2>
      <div className="meta">
        <span className="status" style={{ background: STATUS_COLOR[n.status] || "var(--open)" }}>{n.status}</span>
        {" "}<b>{n.kind}</b> · {n.date || "no date"}{n.date_derived ? " (from git)" : ""}
        <br />{n.path}{n.source ? <> · source <b>{n.source}</b></> : null}
        {n.dead_reason ? <><br />dead: {n.dead_reason}</> : null}
      </div>
      <ul className="links">
        {n.supersedes && <li>supersedes: <Ref rid={n.supersedes} /></li>}
        {n.superseded_by && <li>superseded by: <Ref rid={n.superseded_by} /></li>}
        {list("satisfies", n.satisfies)}
        {list("depends on", n.depends_on)}
        {n.resolves && <li>resolves: <Ref rid={n.resolves} /></li>}
        {list("closed by", n.closed_by)}
        {n.rollup && <li>{n.rollup.live} live, {n.rollup.dead} dead of {n.rollup.total} serving this</li>}
      </ul>
      {n.history && n.history.length > 0 && (
        <div>
          <b>status history</b>
          <ul className="hist">
            {n.history.map((h) => <li key={h.commit} title={h.subject}>{h.date.slice(0, 10)} · {h.status} · {h.commit}</li>)}
          </ul>
        </div>
      )}
      <div className="body" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => {
        // relative links between entries (`[0002](0002-foo.md)`) open the node, not the raw file
        const a = e.target.closest("a");
        if (!a) return;
        const href = a.getAttribute("href") || "";
        const m = href.match(/(?:^|\/)(\d{4})-[^/]*\.md(?:#.*)?$/);
        if (!m) return;
        e.preventDefault();
        const dir = n.path.slice(0, n.path.lastIndexOf("/"));
        const hit = graph.nodes.find((x) => x.path.startsWith(dir + "/") && x.num === m[1]);
        if (hit) onSelect(hit.id);
      }} />
    </div>
  );
}
