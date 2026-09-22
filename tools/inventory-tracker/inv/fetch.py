"""Datasheet/manual fetch: download recorded doc URLs into a content-addressed
local cache and record path + sha256 on the item's docs[] entry.

Files are stored as `store/docs/<sha16>.pdf` so identical datasheets shared by
multiple parts are stored once. A URL that fails or doesn't return a PDF (many
vendor "datasheet" links are HTML landing pages) is flagged on the docs entry for
the slice-5 Playwright fallback rather than silently saved.
"""
from __future__ import annotations

import hashlib
import re
import time
from dataclasses import dataclass, field
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests

from . import paths, store

# A real browser UA — several vendor CDNs reject non-browser agents outright.
_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
_PDF_MAGIC = b"%PDF"
_MAX_BYTES = 60 * 1024 * 1024  # 60 MB guard


@dataclass
class FetchResult:
    downloaded: int = 0
    deduped: int = 0
    already: int = 0
    failed: list[tuple[str, str]] = field(default_factory=list)     # (id, reason)
    not_pdf: list[tuple[str, str]] = field(default_factory=list)    # (id, content-type)


def _normalize_url(url: str) -> str:
    if url.startswith("//"):        # protocol-relative (DigiKey returns some like this)
        return "https:" + url
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return url


def _get(url: str, timeout: int = 45) -> requests.Response:
    return requests.get(_normalize_url(url), headers={"User-Agent": _UA, "Accept": "application/pdf,*/*"},
                        timeout=timeout, allow_redirects=True, stream=True)


def _read(resp: requests.Response) -> bytes:
    resp.raise_for_status()
    chunks, total = [], 0
    for chunk in resp.iter_content(64 * 1024):
        chunks.append(chunk)
        total += len(chunk)
        if total > _MAX_BYTES:
            raise ValueError(f"exceeds {_MAX_BYTES} byte guard")
    return b"".join(chunks)


def _alt_pdf_url(orig_url: str, html: str) -> str | None:
    """When a URL returns HTML instead of a PDF, find the real PDF URL:
    TI wraps datasheets in a `?gotoUrl=` interstitial; other pages link the PDF."""
    q = parse_qs(urlparse(_normalize_url(orig_url)).query)
    if q.get("gotoUrl"):
        return unquote(q["gotoUrl"][0])
    m = re.search(r'href=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.I)
    return urljoin(orig_url, m.group(1)) if m else None


def _download(url: str) -> tuple[bytes, str]:
    resp = _get(url)
    content = _read(resp)
    if not content.startswith(_PDF_MAGIC):
        alt = _alt_pdf_url(url, content.decode("latin-1", "ignore")[:200_000])
        if alt:
            resp = _get(alt)
            content = _read(resp)
    return content, resp.headers.get("Content-Type", "")


def fetch_all(refresh: bool = False, limit: int | None = None, delay: float = 0.4) -> FetchResult:
    res = FetchResult()
    n = 0
    for _, item in list(store.iter_items()):
        changed = False
        for doc in item.get("docs") or []:
            if doc.get("kind") != "datasheet" or not doc.get("url"):
                continue
            if doc.get("path") and not refresh:
                res.already += 1
                continue
            if limit is not None and n >= limit:
                break
            n += 1
            try:
                content, ctype = _download(doc["url"])
            except Exception as exc:
                res.failed.append((item["id"], str(exc)[:80]))
                doc["fetch_status"] = "failed"
                changed = True
                continue
            if not content.startswith(_PDF_MAGIC):
                res.not_pdf.append((item["id"], ctype))
                doc["fetch_status"] = "not-pdf"
                changed = True
                continue

            sha = hashlib.sha256(content).hexdigest()
            fname = f"{sha[:16]}.pdf"
            fpath = paths.DOCS_DIR / fname
            if fpath.exists():
                res.deduped += 1
            else:
                paths.DOCS_DIR.mkdir(parents=True, exist_ok=True)
                fpath.write_bytes(content)
                res.downloaded += 1
            doc["path"] = f"store/docs/{fname}"
            doc["sha256"] = sha
            doc["bytes"] = len(content)
            doc.pop("fetch_status", None)
            changed = True
            time.sleep(delay)
        if changed:
            store.save_item(item)
    return res
