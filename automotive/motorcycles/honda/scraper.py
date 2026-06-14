#!/usr/bin/env python3
"""
Honda US Owner's Manual Downloader
===================================
Scrapes https://www.hondamotopub.com/AHM to download all owner's manuals
for US-market Honda powersports (motorcycles, scooters, ATVs, side-by-sides).

Safe to re-run: already-downloaded files are skipped.
New models added to the site will be picked up automatically.

Usage:
    python scraper.py
    python scraper.py --output-dir /path/to/manuals
    python scraper.py --output-dir ./manuals --workers 6
"""

import asyncio
import random
import re
import sys
import json
import argparse
from pathlib import Path
from urllib.parse import quote, unquote

import httpx
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://www.hondamotopub.com"
COUNTRY = "AHM"  # United States

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE_URL}/{COUNTRY}",
}

# All displacement ranges to iterate; the server returns the full list for some
# values that don't match, so deduplication by model_code handles overlaps.
DISPLACEMENT_RANGES = [
    "EV(Electric Vehicle)",
    "under 125cc",
    "126-400",
    "401-750",
    "over 751cc",
]

# ---------------------------------------------------------------------------
# Model discovery
# ---------------------------------------------------------------------------


async def fetch_all_models(client: httpx.AsyncClient) -> list[dict]:
    """
    Call the AJAX endpoint for each displacement range and collect unique models
    that have an owner's manual (pdf_type=OM).

    Returns a list of dicts with keys: model_code, model_name, model_year.
    """
    models: dict[str, dict] = {}

    for disp in DISPLACEMENT_RANGES:
        url = (
            f"{BASE_URL}/ajax/get_data_model_code"
            f"/{COUNTRY}/{quote(disp)}///OM"
        )
        try:
            r = await client.get(url)
            r.raise_for_status()
        except httpx.HTTPError as exc:
            print(f"  WARN: Could not fetch models for '{disp}': {exc}", file=sys.stderr)
            continue

        if not r.text.strip():
            continue

        for m in r.json():
            code = m.get("model_code", "").strip()
            if not code or code in models:
                continue
            models[code] = {
                "model_code": code,
                "model_name": m.get("model_name", "").strip(),
                "model_year": m.get("model_year_formatted", m.get("model_year", "")).strip(),
            }

    return list(models.values())


# ---------------------------------------------------------------------------
# PDF URL extraction
# ---------------------------------------------------------------------------


async def get_pdf_urls(
    client: httpx.AsyncClient,
    model_name: str,
    model_year: str,
) -> list[str]:
    """
    Fetch the owner's manual download page for a model/year and extract all
    PDF URLs from the data-href attributes on .dl-btn elements.
    """
    url = f"{BASE_URL}/om/{COUNTRY}/{quote(model_name)}/{quote(model_year)}"
    try:
        r = await client.get(url)
        r.raise_for_status()
    except httpx.HTTPStatusError as exc:
        print(
            f"  WARN: HTTP {exc.response.status_code} — "
            f"{model_name} {model_year} ({url})",
            file=sys.stderr,
        )
        return []
    except httpx.HTTPError as exc:
        print(f"  WARN: {exc} — {model_name} {model_year}", file=sys.stderr)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    return [
        btn["data-href"]
        for btn in soup.select("[data-href]")
        if btn.get("data-href", "").lower().endswith(".pdf")
    ]


# ---------------------------------------------------------------------------
# Downloading
# ---------------------------------------------------------------------------


async def download_pdf(client: httpx.AsyncClient, url: str, dest: Path) -> str:
    """
    Download a single PDF.

    Returns one of: 'downloaded', 'skipped', 'error: <message>'.
    Uses a .tmp file to avoid leaving partial downloads on disk.
    """
    if dest.exists():
        return "skipped"

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp")

    try:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with tmp.open("wb") as fh:
                async for chunk in r.aiter_bytes(65_536):
                    fh.write(chunk)
        tmp.rename(dest)
        return "downloaded"
    except Exception as exc:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        return f"error: {exc}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def safe_dirname(text: str) -> str:
    """Replace filesystem-unsafe characters with underscores."""
    return re.sub(r'[<>:"/\\|?*\s]+', "_", text).strip("_")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main(output_dir: Path, workers: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    limits = httpx.Limits(
        max_connections=workers * 2,
        max_keepalive_connections=workers,
    )
    async with httpx.AsyncClient(
        headers=HEADERS,
        timeout=60,
        limits=limits,
        follow_redirects=True,
    ) as client:

        # ── 1. Discover models ──────────────────────────────────────────────
        print("Fetching model list from hondamotopub.com/AHM …")
        models = await fetch_all_models(client)
        print(f"Found {len(models)} models with owner's manuals.\n")

        # Save a manifest so you can inspect what was found
        (output_dir / "models.json").write_text(
            json.dumps(models, indent=2, ensure_ascii=False)
        )

        # ── 2. Collect PDF URLs ─────────────────────────────────────────────
        print("Resolving PDF download URLs …")
        sem = asyncio.Semaphore(workers)
        download_queue: list[tuple[str, Path]] = []

        async def collect_model(m: dict) -> None:
            async with sem:
                await asyncio.sleep(random.uniform(2, 5))
                pdf_urls = await get_pdf_urls(
                    client, m["model_name"], m["model_year"]
                )
            folder = safe_dirname(f"{m['model_name']}_{m['model_year']}")
            for pdf_url in pdf_urls:
                filename = unquote(pdf_url.rsplit("/", 1)[-1])
                dest = output_dir / folder / filename
                download_queue.append((pdf_url, dest))
            label = f"{len(pdf_urls)} PDF{'s' if len(pdf_urls) != 1 else ''}"
            print(f"  {m['model_name']} {m['model_year']}: {label}")

        await asyncio.gather(*[collect_model(m) for m in models])

        # ── 3. Download ─────────────────────────────────────────────────────
        already = sum(1 for _, dest in download_queue if dest.exists())
        to_fetch = len(download_queue) - already
        print(
            f"\n{len(download_queue)} PDFs total — "
            f"{to_fetch} to download, {already} already present.\n"
        )

        counts: dict[str, int] = {}

        async def do_download(pdf_url: str, dest: Path) -> None:
            async with sem:
                if not dest.exists():
                    await asyncio.sleep(random.uniform(2, 5))
                result = await download_pdf(client, pdf_url, dest)
            key = result.split(":")[0]
            counts[key] = counts.get(key, 0) + 1
            icon = {"downloaded": "✓", "skipped": "–", "error": "✗"}.get(key, "?")
            rel = f"{dest.parent.name}/{dest.name}"
            print(f"  {icon}  {rel}")

        await asyncio.gather(
            *[do_download(url, dest) for url, dest in download_queue]
        )

        # ── 4. Summary ──────────────────────────────────────────────────────
        print(
            f"\nDone. "
            f"Downloaded: {counts.get('downloaded', 0)}, "
            f"Skipped: {counts.get('skipped', 0)}, "
            f"Errors: {counts.get('error', 0)}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download Honda US owner's manuals from hondamotopub.com"
    )
    parser.add_argument(
        "--output-dir",
        default="./manuals",
        type=Path,
        metavar="DIR",
        help="Directory to save PDFs (default: ./manuals)",
    )
    parser.add_argument(
        "--workers",
        default=1,
        type=int,
        metavar="N",
        help="Max concurrent downloads (default: 4)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.output_dir, args.workers))
