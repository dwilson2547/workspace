# Build context: automotive/motorcycles/ (for scrape_contract.py and motorcycle_common/).
# Heavier than the browser-free scrapers: ships Chromium for the Cloudflare
# managed challenge on suzukipartshouse.com (plain headless Chromium is blocked;
# playwright-stealth passes it).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY suzuki/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY scrape_contract.py ./
COPY motorcycle_common/ ./motorcycle_common/
COPY suzuki/*.py ./
# COPY preserves host permission bits; guarantee readability for USER 10001.
RUN chmod -R a+rX /app /ms-playwright

USER 10001
CMD ["python", "scraper.py"]
