# 2026-10-29 — Plex "Not available outside your network" with the port open: plex.direct cert chain ends at ISRG Root YR

**Status:** Fixed (certificate reissued, 2026-10-29)
**Host:** Tower (192.168.0.15), Plex container, PMS 1.43.5.11079

## Symptom

After the Plex port forward (32400 → 192.168.0.15) was put back on the router, Settings → Remote Access stayed red
("Not available outside your network") for 20+ minutes of Retry. Private and public `ip:port` on that page were correct,
with "Manually specify public port" set to 32400.

## What it was not

- **Port forward / double NAT / firewall:** an external port check and external HTTP *and* HTTPS `GET /identity` from
  several regions all returned 200 (verified, 2026-10-29). The server log showed those requests as `(WAN)`.
- **DNS rebinding:** it affects only local `plex.direct` connections, never the Remote Access check. For reference:
  prod CoreDNS (192.168.0.61) does not filter rebinding; the EdgeRouter resolver (192.168.0.1) does: it answers
  `NOERROR` with an empty answer for `*.plex.direct` (verified with `dig`, 2026-10-29).

## Root cause

plex.tv's reachability probe reached the server and rejected its certificate:

```
CERT: incomplete TLS handshake from [::ffff:34.239.73.157]:34432: tlsv1 alert unknown ca
```

The `plex.direct` certificate issued on 2026-10-20 (after the post-compromise container rebuild) chained
leaf → Let's Encrypt `YR2` → **ISRG Root YR**, with no cross-sign to ISRG Root X1. Common trust stores, including
plex.tv's checker and PMS's own bundle (its self-test failed with `unable to get local issuer certificate`), hold only
X1/X2. The page then reports "Not Reachable", within ~80 ms. Other users have reported the same problem on the Plex forums since
Aug 2026; Plex has not posted a fix (⚠ unverified beyond forum reports).

## Diagnosis in one step

```
echo | openssl s_client -connect 192.168.0.15:32400 -servername x.plex.direct -showcerts | grep -E "s:|i:|Verify return"
```

A chain ending `YR2` → `Root YR` with `Verify return code: 20` is this issue. In the PMS log, grep `unknown ca`.

## Fix

Stop the container, rename the `.p12` certificate under the Plex appdata (rename rather than delete so it can be
restored), start the container, then Retry. The reissued certificate (2026-10-30 UTC) includes the cross-sign
`Root YR` → `ISRG Root X1`, `Verify return code: 0`, and Remote Access went green (user).

If it recurs on a future renewal, repeat the rename. Untested alternatives from the forum threads: untick
Settings → Network → "Strict TLS configuration", or force an ECDSA certificate.
