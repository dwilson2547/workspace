"""
pipeline.py
-----------
Convenience entry point that runs the full pipeline in sequence:

    1. scraper.py  – discover catalog links, download new/stale PDFs
    2. pdf_parser.py – extract parts from downloaded PDFs into PostgreSQL

Usage:
    python pipeline.py             # scrape + parse new catalogs
    python pipeline.py --reparse   # scrape + re-parse ALL catalogs

Individual scripts can also be run standalone:
    python scraper.py
    python pdf_parser.py [--reparse]
"""

import asyncio
import logging
import sys

from scraper import run as scraper_run
from pdf_parser import run as parser_run

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def main():
    reparse = "--reparse" in sys.argv

    log.info("=== Step 1/2: Catalog scraper ===")
    asyncio.run(scraper_run())

    log.info("=== Step 2/2: PDF parser ===")
    parser_run(reparse=reparse)

    log.info("=== Pipeline complete ===")


if __name__ == "__main__":
    main()
