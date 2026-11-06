# slashdot-news-archive scraper image (runs as a scrape-job-manager batch job).
# Build context: web-scrapers/slashdot-news-archive/
#   docker build -t dwilson2547/slashdot-news-archive:latest .
#   docker push dwilson2547/slashdot-news-archive:latest
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HF_HOME=/model \
    TOKENIZERS_PARALLELISM=false
WORKDIR /app

# torch CPU-only wheel keeps the image much smaller than the default CUDA build
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch --extra-index-url https://pypi.org/simple
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# bake the embedding model into the image so job cold-starts don't hit Hugging Face
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY scraper.py scrape_contract.py ./
RUN chmod -R a+rX /app

USER 10001
CMD ["python", "scraper.py"]
