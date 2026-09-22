"""`inv` — command-line interface for the inventory tracker.

Working commands are the foundation slice (schema + validation + file store +
index/export). Pipeline commands (ingest/enrich/fetch) and query commands
(search/alt) are registered but stubbed; they land in later slices.
"""
from __future__ import annotations

import argparse
import sys

import yaml

from . import enrich, fetch, ingest, query, schema, store


def _print_stub(name: str, slice_note: str) -> int:
    print(f"[not implemented yet] `inv {name}` — planned for {slice_note}.")
    return 2


# --- schema ---------------------------------------------------------------

def cmd_schema_list(args) -> int:
    for name, cat in sorted(schema.all_categories().items()):
        tag = "  (abstract)" if cat.abstract else ""
        print(f"{name}{tag}")
    return 0


def cmd_schema_pending(args) -> int:
    counts: dict[str, int] = {}
    for _, item in store.iter_items():
        c = item.get("category")
        counts[c] = counts.get(c, 0) + 1
    prov = schema.provisional_categories()
    if not prov:
        print("no provisional schemas — nothing pending review")
        return 0
    print("provisional schemas (auto-generated from DigiKey, awaiting review):")
    for name in sorted(prov):
        cat = schema.resolve(name)
        print(f"  {name:38} {counts.get(name, 0):>2} item(s), {len(cat.params)} params")
    print("\nreview a schema with `inv schema show <name>`; curate it in schema/categories/<name>.yaml")
    return 0


def cmd_schema_show(args) -> int:
    try:
        cat = schema.resolve(args.category)
    except (KeyError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"category:    {cat.name}")
    print(f"chain:       {' -> '.join(cat.chain)}")
    print(f"abstract:    {cat.abstract}")
    print(f"identifying: {cat.identifying}")
    print("params:")
    for pname, spec in cat.params.items():
        bits = [f"type={spec.get('type', 'string')}"]
        if spec.get("unit"):
            bits.append(f"unit={spec['unit']}")
        if spec.get("values"):
            bits.append(f"values={spec['values']}")
        if spec.get("required"):
            bits.append("required")
        print(f"  {pname}: {', '.join(bits)}")
    return 0


# --- items ----------------------------------------------------------------

def _load_yaml_arg(path: str) -> dict:
    with open(path) as fh:
        return yaml.safe_load(fh)


def _report(result: schema.ValidationResult, label: str) -> None:
    for w in result.warnings:
        print(f"  warning: {w}")
    for e in result.errors:
        print(f"  error:   {e}")
    print(f"{label}: {'OK' if result.ok else 'INVALID'}")


def cmd_validate(args) -> int:
    item = _load_yaml_arg(args.file)
    result = schema.validate_item(item)
    _report(result, f"validate {item.get('id', args.file)}")
    return 0 if result.ok else 1


def cmd_add(args) -> int:
    item = _load_yaml_arg(args.file)
    result = schema.validate_item(item)
    if not result.ok:
        _report(result, f"add {item.get('id', args.file)}")
        return 1
    path = store.save_item(item)
    for w in result.warnings:
        print(f"  warning: {w}")
    print(f"saved {item['id']} -> {path.relative_to(store.paths.ROOT)}")
    return 0


def cmd_show(args) -> int:
    found = store.get_item(args.id)
    if not found:
        print(f"not found: {args.id}", file=sys.stderr)
        return 1
    _, item = found
    print(yaml.safe_dump(item, sort_keys=False, allow_unicode=True), end="")
    return 0


def cmd_find(args) -> int:
    hits = store.find(args.query)
    for i in hits:
        print(f"{i.get('id',''):40}  {i.get('category',''):16}  {i.get('description','')}")
    print(f"\n{len(hits)} match(es)")
    return 0


def cmd_reindex(args) -> int:
    n = store.reindex()
    print(f"indexed {n} item(s) -> {store.paths.INDEX_DB.relative_to(store.paths.ROOT)}")
    return 0


def cmd_ingest(args) -> int:
    order, result = ingest.ingest_invoice(args.pdf, dry_run=args.dry_run)
    tag = " (dry-run, nothing written)" if args.dry_run else ""
    print(f"order {result.order_id}: {len(order['line_items'])} line item(s){tag}")
    print(f"  order date : {order.get('order_date')}")
    print(f"  totals     : {order.get('totals')}")
    print(f"  created    : {len(result.created)}  {result.created}")
    print(f"  updated    : {len(result.updated)}  {result.updated}")
    print(f"  unchanged  : {len(result.unchanged)}  {result.unchanged}")
    if not args.dry_run:
        print(f"  order file : {result.order_path.relative_to(store.paths.ROOT)}")
        print("next: `inv reindex` to refresh the index, then enrich (slice 3).")
    return 0


def cmd_enrich(args) -> int:
    res = enrich.enrich_all(
        only_unclassified=not args.all, refresh=args.refresh, limit=args.limit
    )
    print(f"enriched {len(res.enriched)} item(s)")
    if res.provisional_categories:
        print(f"  auto-created {len(res.provisional_categories)} provisional categor(ies): "
              f"{sorted(res.provisional_categories)}")
    # summarize reclassification by target category
    by_cat: dict[str, int] = {}
    for cat in res.reclassified.values():
        by_cat[cat] = by_cat.get(cat, 0) + 1
    for cat, n in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"    {n:>2}  {cat}")
    if res.not_found:
        print(f"  not found on DigiKey: {res.not_found}")
    if res.errors:
        print(f"  errors: {res.errors}")
    if res.enriched:
        print("next: `inv reindex && inv export md`; review provisional schemas with `inv schema pending`.")
    return 0


def cmd_fetch(args) -> int:
    res = fetch.fetch_all(refresh=args.refresh, limit=args.limit)
    print(f"downloaded {res.downloaded}, deduped {res.deduped}, already had {res.already}")
    if res.not_pdf:
        print(f"  not a PDF (landing page → slice-5 fallback): {[i for i, _ in res.not_pdf]}")
    if res.failed:
        print(f"  failed: {res.failed}")
    print("flagged docs carry fetch_status for the Playwright fallback (slice 5).")
    return 0


def cmd_search(args) -> int:
    try:
        hits = query.search(args.category, args.constraint)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    keys = [query._CONSTRAINT_RE.match(c).group(1) for c in args.constraint
            if query._CONSTRAINT_RE.match(c)]
    for i in hits:
        params = i.get("params") or {}
        shown = {k: params[k] for k in keys if k in params}
        print(f"{i.get('id',''):26} {i.get('category',''):16} {shown}")
    print(f"\n{len(hits)} match(es)")
    return 0


def cmd_alt(args) -> int:
    out = query.alternatives(args.id)
    if out is None:
        print(f"not found: {args.id}", file=sys.stderr)
        return 1
    item, identifying, ranked = out
    print(f"{item['id']} ({item.get('category')}) — identifying: {identifying or '(none; provisional category)'}")
    if not ranked:
        print("  no other items in this category")
        return 0
    print("  alternatives you own (best match first):")
    for matches, total, other, diffs in ranked[:10]:
        note = "exact" if total and matches == total else (f"differs on {diffs}" if diffs else "same category")
        print(f"    {other['id']:26} qty={other.get('qty','?'):<4} [{matches}/{total}] {note}")
    return 0


def cmd_export(args) -> int:
    if args.format == "md":
        out = store.export_markdown()
        print(f"wrote {out.relative_to(store.paths.ROOT)}")
        return 0
    return _print_stub(f"export {args.format}", "a later slice (csv/json views)")


# --- parser ---------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="inv", description="Component / purchase inventory tracker")
    sub = p.add_subparsers(dest="cmd", required=True)

    sc = sub.add_parser("schema", help="inspect category schemas")
    scs = sc.add_subparsers(dest="schema_cmd", required=True)
    scs.add_parser("list", help="list categories").set_defaults(func=cmd_schema_list)
    show = scs.add_parser("show", help="show a resolved category schema")
    show.add_argument("category")
    show.set_defaults(func=cmd_schema_show)
    scs.add_parser("pending", help="list provisional schemas awaiting review").set_defaults(func=cmd_schema_pending)

    v = sub.add_parser("validate", help="validate an item YAML file without saving")
    v.add_argument("file")
    v.set_defaults(func=cmd_validate)

    a = sub.add_parser("add", help="validate and save an item YAML file")
    a.add_argument("file")
    a.set_defaults(func=cmd_add)

    s = sub.add_parser("show", help="print a stored item by id")
    s.add_argument("id")
    s.set_defaults(func=cmd_show)

    f = sub.add_parser("find", help="substring search across stored items")
    f.add_argument("query")
    f.set_defaults(func=cmd_find)

    sub.add_parser("reindex", help="rebuild the SQLite index from files").set_defaults(func=cmd_reindex)

    e = sub.add_parser("export", help="generate views (md)")
    e.add_argument("format", choices=["md", "csv", "json"])
    e.set_defaults(func=cmd_export)

    # --- stubs for later slices ---
    ing = sub.add_parser("ingest", help="parse a DigiKey invoice PDF into orders + item stubs")
    ing.add_argument("pdf")
    ing.add_argument("--dry-run", action="store_true", help="parse and report without writing")
    ing.set_defaults(func=cmd_ingest)

    enr = sub.add_parser("enrich", help="enrich parts via the DigiKey API (parametrics, category, datasheet URL)")
    enr.add_argument("--all", action="store_true", help="re-enrich all items, not just unclassified")
    enr.add_argument("--refresh", action="store_true", help="bypass the on-disk response cache")
    enr.add_argument("--limit", type=int, default=None, help="cap the number of items processed")
    enr.set_defaults(func=cmd_enrich)

    fe = sub.add_parser("fetch", help="download recorded datasheet/manual URLs into store/docs/")
    fe.add_argument("--refresh", action="store_true", help="re-download even if a path is already recorded")
    fe.add_argument("--limit", type=int, default=None, help="cap the number of downloads")
    fe.set_defaults(func=cmd_fetch)

    se = sub.add_parser("search", help="parametric search, e.g. search --category resistor 'resistance>=10000'")
    se.add_argument("--category", help="restrict to a category")
    se.add_argument("constraint", nargs="*", help="key<op>value; op in >= <= = != > < ~")
    se.set_defaults(func=cmd_search)

    al = sub.add_parser("alt", help="alternatives you already own for an item")
    al.add_argument("id")
    al.set_defaults(func=cmd_alt)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)
