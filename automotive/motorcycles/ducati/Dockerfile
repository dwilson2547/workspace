# Build context: automotive/motorcycles/ (for scrape_contract.py and motorcycle_common/).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY ducati/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY scrape_contract.py ./
COPY motorcycle_common/ ./motorcycle_common/
COPY ducati/*.py ./
# COPY preserves host permission bits; guarantee readability for USER 10001.
RUN chmod -R a+rX /app

USER 10001
CMD ["python", "scraper.py"]
