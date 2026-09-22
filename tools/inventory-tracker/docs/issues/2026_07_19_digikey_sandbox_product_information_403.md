# DigiKey sandbox issues valid OAuth tokens but rejects all Product Information V4 calls with 403, blocking enrichment

**Date:** 2026-07-19  
**Component:** DigiKey API enrichment (slice 3) — credentials in env `DIGIKEY_CLIENT` / `DIGIKEY_SECRET`; probes `scratchpad/dk_investigate.py`, `scratchpad/dk_diag.py`  
**Severity:** High — blocks the entire enrichment stage of the ingest pipeline; worked around by switching the app to production Product Information V4.

---

## Observed symptom

With a DigiKey **sandbox** app (Product Information V4 enabled and Approved), the
two-legged OAuth token call to `https://sandbox-api.digikey.com/v1/oauth2/token`
succeeds (`HTTP 200`, valid `access_token`, `expires_in=599`, `token_type=Bearer`,
no `scope` field), but **every** Product Information V4 call returns `HTTP 403`:

```
{ "status": 403, "title": "Forbidden",
  "detail": "The supplied client credentials are not authorized to perform this request." }
```

Confirmed across multiple endpoints with the same token, so it is a
product-family authorization failure, not a per-endpoint or per-part problem:

- `GET /products/v4/search/{pn}/productdetails` → 403 (parts `497-1454-5-ND`, `10KADCT-ND`, `296-1775-5-ND`)
- `POST /products/v4/search/keyword` → 403
- The production host `https://api.digikey.com/v1/oauth2/token` rejects the same
  credentials at the token step with `HTTP 401 "Invalid clientId"`.

---

## Root cause

### The DigiKey sandbox does not serve Product Information data

The sandbox environment exists to exercise the OAuth / order handshakes; the
Product Information V4 product does not return catalog data there. A correctly
configured, approved sandbox app still gets 403 on every product call. This is a
known, unresolved condition — a DigiKey TechForum thread reports the exact
symptom (approved sandbox app, working token, 403 on all `/products/v4/search/…`)
with no working fix from DigiKey staff. See references.

### The credentials were sandbox-only, so production also refused them

The app was registered for sandbox only. Production authorization is per-app and
per-environment, so `api.digikey.com` did not recognize the sandbox client ID and
failed at the token step (`401 Invalid clientId`) rather than at authorization.
Result: sandbox authenticates but won't serve data; production won't authenticate
at all — no path to real data until the app is production-enabled.

### Why it looked like it "worked with KiCad"

KiCad / KiCost DigiKey integrations target the **production** host with a
production-enabled app. The prior success was on production, not sandbox — which
is consistent with sandbox never having served product data.

---

## Troubleshooting steps taken

1. **Confirmed env vars reached the shell** — `DIGIKEY_CLIENT`/`DIGIKEY_SECRET`
   are set in `.bashrc` (interactive shells only); the non-interactive tool shell
   saw them empty, so probes were run via `bash -ic` to source `.bashrc`. Ruled
   out "credentials missing" as the cause.

2. **Token call against sandbox** — returned `HTTP 200` with a valid bearer
   token. Ruled out bad credentials and bad OAuth request format.

3. **Product calls against sandbox** — `productdetails` returned `403` for three
   different part numbers. Ruled out a bad/nonexistent part number (that would be
   `404`) and pointed at authorization.

4. **Second product endpoint + token scope inspection** — `keyword` search also
   `403`; token response carried no `scope` field. Ruled out a single-endpoint
   permission gap; established the whole Product Information family is unauthorized.

5. **`categories` path probe** — returned `404 "Invalid resource path"`,
   confirming that path was simply wrong and not part of the 403 pattern.

6. **Token call against production** — `401 "Invalid clientId"`, establishing the
   app was sandbox-only and had no production access.

7. **Documentation / forum check** — DigiKey docs and a matching TechForum thread
   confirmed sandbox Product Information does not serve data and there is no
   sandbox-side fix; production is required.

---

## Fix

### DigiKey developer portal — enable Production Product Information V4

Add the **Production** subscription for **Product Information V4** to the app
(Product Information is typically granted immediately). This makes the existing
`DIGIKEY_CLIENT` / `DIGIKEY_SECRET` valid against the production host
`https://api.digikey.com`, where product data is actually served.

### Enrichment client — default to production, keep a sandbox toggle

The slice-3 client targets `https://api.digikey.com` by default. A `DK_SANDBOX`
env toggle remains for exercising the OAuth/order handshakes, but enrichment must
never rely on sandbox for product data. Every raw API response is cached to disk
so re-runs and mapping iteration do not re-spend the production free-tier
allowance (~1,000 calls/day).

```
BASE = "https://api.digikey.com"                    # default
BASE = "https://sandbox-api.digikey.com"            # only if DK_SANDBOX=1 (handshake testing)
```

---

## Files changed

- `docs/issues/2026_07_19_digikey_sandbox_product_information_403.md` — this write-up (no source changes yet; slice-3 client will encode the production default + response cache)
- `scratchpad/dk_investigate.py`, `scratchpad/dk_diag.py` — throwaway probes used to isolate the 403 (not committed)

## References

- DigiKey TechForum — Sandbox API returns 403: <https://forum.digikey.com/t/sandbox-api-return-403/70311>
- Product Information V4 ProductDetails endpoint: <https://developer.digikey.com/products/product-information-v4/productsearch/productdetails>
- OAuth 2.0 two-legged flow: <https://developer.digikey.com/tutorials-and-resources/oauth-20-2-legged-flow>
