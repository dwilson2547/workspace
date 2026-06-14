"""
Kakao Page text-viewer scraper
==============================
Scrapes the visible (free) text content from a Kakao Page webtoon/novel viewer
that renders inside a shadow root using an EPUB-style column layout.

How it works
------------
1.  Launch a Playwright browser and navigate to the viewer URL.
2.  Wait for the React app to load and call
        GET /api/v1/viewer/data?series_id=…&product_id=…
    which returns time-limited signed S3 URLs for every content-chunk JSON.
3.  Use the browser's fetch (same origin, cookies included) to pull
        textviewerContentMeta.json  – spine / navigation metadata
        <chunk>.json                – one JSON per content block, each
                                      containing a flat paragraphList
4.  Recursively flatten each paragraphList into plain text.
5.  Write one output file per episode scraped.

Usage
-----
    python scraper.py [OPTIONS]

Options
    --url       Full viewer URL  (default: the URL in the readme)
    --out-dir   Directory for output files  (default: ./output)
    --headless  Run browser in headless mode  (default: True)

Requirements
    pip install playwright
    playwright install chromium
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright, Page

# ── defaults ──────────────────────────────────────────────────────────────────
DEFAULT_URL = "https://page.kakao.com/content/54302733/viewer/54317056"
DEFAULT_OUT = Path(__file__).parent / "output"

BFF_VIEWER_API = (
    "https://bff-page.kakao.com/api/gateway/api/v1/viewer/data"
    "?series_id={series_id}&product_id={product_id}"
)
ATS_BASE = "https://dn-img-page.kakao.com/sdownload/resource?kid="

# ── helpers ───────────────────────────────────────────────────────────────────

def _extract_ids(url: str) -> tuple[str, str]:
    """Pull series_id and product_id out of the viewer URL."""
    m = re.search(r"/content/(\d+)/viewer/(\d+)", url)
    if not m:
        raise ValueError(f"Cannot parse series/product IDs from URL: {url}")
    return m.group(1), m.group(2)


def _flatten_paragraphs(paragraphs: list, indent: int = 0) -> list[str]:
    """
    Recursively walk a paragraphList and return a flat list of text lines.

    Paragraph types:
        H1/H2/H3  →  markdown heading
        P         →  plain paragraph (children joined inline)
        B / EM    →  inline emphasis (text is included as-is)
        BR        →  empty line
        TEXT      →  raw text leaf
        IMG       →  [Image: <filename>]
        DIV       →  recurse into children
    """
    lines: list[str] = []
    for para in paragraphs:
        ptype = (para.get("type") or "").upper()
        text = para.get("text") or ""
        children = para.get("childParagraphList") or []
        image = para.get("image")

        if ptype == "TEXT":
            lines.append(text)

        elif ptype == "BR":
            lines.append("")

        elif ptype == "IMG":
            if image:
                filename = image.get("imageFilename") or image.get("imageSrcKey", "")
                kid = image.get("imageSrcKey", "")
                img_url = f"https://dn-img-page.kakao.com/download/resource?kid={kid}"
                lines.append(f"[Image: {filename}  {img_url}]")
            else:
                lines.append("[Image]")

        elif ptype in ("H1", "H2", "H3", "H4", "H5", "H6"):
            level = int(ptype[1])
            heading_text = "".join(_flatten_paragraphs(children)) if children else text
            lines.append(f"\n{'#' * level} {heading_text.strip()}\n")

        elif ptype in ("P", "DIV"):
            if children:
                child_lines = _flatten_paragraphs(children)
                combined = "".join(child_lines).strip()
                if combined:
                    lines.append(combined)
                else:
                    lines.append("")
            elif text.strip():
                lines.append(text.strip())
            else:
                lines.append("")

        elif ptype in ("B", "STRONG", "EM", "I", "SPAN", "A"):
            if children:
                lines.extend(_flatten_paragraphs(children))
            elif text:
                lines.append(text)

        else:
            # Fallback: recurse children or emit text
            if children:
                lines.extend(_flatten_paragraphs(children))
            elif text:
                lines.append(text)

    return lines


def _render_content(content_json: dict) -> str:
    """Turn a raw content JSON dict into readable plain text."""
    paragraphs = content_json.get("contentInfo", {}).get("paragraphList", [])
    raw_lines = _flatten_paragraphs(paragraphs)

    output: list[str] = []
    prev_blank = False
    for line in raw_lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue  # collapse consecutive blank lines
        output.append(line)
        prev_blank = is_blank

    return "\n".join(output)


# ── browser fetch helpers ─────────────────────────────────────────────────────

async def _browser_fetch_json(page: Page, url: str) -> dict:
    """Run fetch() in the page context (inherits cookies/session) and return parsed JSON."""
    result = await page.evaluate(
        """
        async (url) => {
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
            return r.json();
        }
        """,
        url,
    )
    return result


# ── core scraper ──────────────────────────────────────────────────────────────

async def scrape_episode(url: str, out_dir: Path, headless: bool = True) -> Path:
    """
    Scrape one episode URL and write a text file into out_dir.
    Returns the path of the written file.
    """
    series_id, product_id = _extract_ids(url)
    out_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            locale="ko-KR",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        print(f"[*] Navigating to {url}")
        await page.goto(url, wait_until="networkidle", timeout=60_000)

        # ── 1. fetch viewer-data (signed URLs for content chunks) ──────────
        api_url = BFF_VIEWER_API.format(series_id=series_id, product_id=product_id)
        print(f"[*] Fetching viewer data …")
        viewer_data = await _browser_fetch_json(page, api_url)

        item = viewer_data.get("item", {})
        title = item.get("title", f"episode_{product_id}")
        slide_type = item.get("slideType", "")

        if slide_type != "EPUB":
            print(f"[!] Unexpected slideType '{slide_type}' – only EPUB text-viewer is supported.")
            await browser.close()
            sys.exit(1)

        vd = viewer_data.get("viewerData", {})
        contents_list = vd.get("contentsList", [])
        meta_secure_url = vd.get("metaSecureUrl", "")

        if not contents_list:
            print("[!] No contentsList found in viewer data.")
            await browser.close()
            sys.exit(1)

        # ── 2. fetch content-meta (optional; used for navigation titles) ──
        meta = {}
        if meta_secure_url:
            meta_url = ATS_BASE + meta_secure_url
            print(f"[*] Fetching content metadata …")
            try:
                meta = await _browser_fetch_json(page, meta_url)
            except Exception as e:
                print(f"[!] Could not fetch metadata: {e}")

        # Build a mapping of (chapterId, contentId) → navigation title
        nav_titles: dict[tuple, str] = {}
        for nav in (
            meta.get("contentMetaInfo", {})
                .get("navigationInfo", {})
                .get("navigations", [])
        ):
            key = (str(nav.get("chapterId")), str(nav.get("contentId")))
            nav_titles[key] = nav.get("title", "")

        # ── 3. fetch and render each content chunk ─────────────────────────
        all_text_parts: list[str] = []
        all_text_parts.append(f"# {title}\n")

        for chunk in contents_list:
            chapter_id = str(chunk.get("chapterId", ""))
            content_id = str(chunk.get("contentId", ""))
            secure_url = chunk.get("secureUrl", "")

            if not secure_url:
                continue

            full_url = ATS_BASE + secure_url
            print(f"[*] Fetching chapter {chapter_id} content {content_id} …")
            try:
                content_json = await _browser_fetch_json(page, full_url)
            except Exception as e:
                print(f"[!] Failed to fetch chunk (ch={chapter_id}, co={content_id}): {e}")
                continue

            rendered = _render_content(content_json)
            if rendered.strip():
                all_text_parts.append(rendered)

        await browser.close()

    # ── 4. write output ────────────────────────────────────────────────────
    safe_title = re.sub(r'[\\/*?:"<>|]', "_", title).strip()
    out_file = out_dir / f"{safe_title}.txt"

    full_text = "\n\n".join(all_text_parts)
    out_file.write_text(full_text, encoding="utf-8")
    print(f"[✓] Saved → {out_file}  ({len(full_text):,} chars)")
    return out_file


# ── CLI ───────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape visible text content from a Kakao Page EPUB viewer."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="Full viewer URL (default: %(default)s)",
    )
    parser.add_argument(
        "--out-dir",
        default=str(DEFAULT_OUT),
        help="Output directory (default: %(default)s)",
    )
    parser.add_argument(
        "--headless",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Run browser headless (default: true)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    asyncio.run(
        scrape_episode(
            url=args.url,
            out_dir=Path(args.out_dir),
            headless=args.headless,
        )
    )
