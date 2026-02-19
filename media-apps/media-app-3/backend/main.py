from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Media Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# NOTE: allow_origins=["*"] is fine for localhost-only desktop use.
# If credentials (cookies/Authorization headers) are needed in future,
# change allow_origins to ["http://localhost:PORT"] and add allow_credentials=True.


@app.get("/health")
def health():
    return {"status": "ok"}
