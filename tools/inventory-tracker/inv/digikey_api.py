"""DigiKey Product Information API v4 client (two-legged OAuth client-credentials).

Defaults to the production host (`api.digikey.com`); the sandbox never serves
product data (see docs/issues/2026_07_19_digikey_sandbox_product_information_403.md),
so `DK_SANDBOX=1` is only for exercising the OAuth handshake. Every raw response
is cached to disk so re-runs and mapping iteration don't re-spend the free-tier
call budget (~1k/day).
"""
from __future__ import annotations

import json
import os
import re
import time
from urllib.parse import quote

import requests

from . import paths

PROD_HOST = "https://api.digikey.com"
SANDBOX_HOST = "https://sandbox-api.digikey.com"


def _safe_name(product_number: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", product_number)


class DigiKeyError(RuntimeError):
    pass


class DigiKeyClient:
    def __init__(self, sandbox: bool | None = None):
        self.client = os.environ.get("DIGIKEY_CLIENT")
        self.secret = os.environ.get("DIGIKEY_SECRET")
        if sandbox is None:
            sandbox = os.environ.get("DK_SANDBOX", "0") == "1"
        self.base = SANDBOX_HOST if sandbox else PROD_HOST
        self.cache_dir = paths.CACHE_DIR / "digikey"
        self._token: str | None = None
        self._token_exp = 0.0

    # --- auth ---
    def _token_value(self) -> str:
        if self._token and time.time() < self._token_exp - 30:
            return self._token
        if not self.client or not self.secret:
            raise DigiKeyError("DIGIKEY_CLIENT / DIGIKEY_SECRET not set in environment")
        r = requests.post(
            f"{self.base}/v1/oauth2/token",
            data={"grant_type": "client_credentials", "client_id": self.client, "client_secret": self.secret},
            timeout=30,
        )
        if r.status_code != 200:
            raise DigiKeyError(f"token request failed: HTTP {r.status_code} {r.text[:200]}")
        j = r.json()
        self._token = j["access_token"]
        self._token_exp = time.time() + int(j.get("expires_in", 599))
        return self._token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._token_value()}",
            "X-DIGIKEY-Client-Id": self.client,
            "X-DIGIKEY-Locale-Site": "US",
            "X-DIGIKEY-Locale-Language": "en",
            "X-DIGIKEY-Locale-Currency": "USD",
        }

    # --- product lookup ---
    def product_details(self, product_number: str, refresh: bool = False) -> dict | None:
        """Return the `Product` object for a DigiKey or manufacturer part number.

        Cached to disk by part number; `refresh=True` bypasses the cache. Returns
        None for a 404 (unknown part)."""
        cache_file = self.cache_dir / f"{_safe_name(product_number)}.json"
        if not refresh and cache_file.exists():
            data = json.loads(cache_file.read_text())
        else:
            url = f"{self.base}/products/v4/search/{quote(product_number, safe='')}/productdetails"
            r = requests.get(url, headers=self._headers(), timeout=30)
            if r.status_code == 404:
                return None
            if r.status_code != 200:
                raise DigiKeyError(f"productdetails {product_number}: HTTP {r.status_code} {r.text[:200]}")
            data = r.json()
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(data, indent=2))
        return data.get("Product", data)


def leaf_category(product: dict) -> dict | None:
    """Descend the Category breadcrumb (each level has one child) to the leaf."""
    cat = product.get("Category")
    while cat:
        kids = cat.get("ChildCategories") or []
        if not kids:
            return {"id": cat.get("CategoryId"), "name": cat.get("Name")}
        cat = kids[0]
    return None
