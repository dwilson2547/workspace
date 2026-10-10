---
tier: tool
domain: apps
---

# web-tools

A collection of small single-file browser utilities (JSON/CSV/YAML conversion, JWT decoding, OAuth token
fetching, hashes/UUIDs, regex extraction, text diff, timestamps, world clock, GeoJSON editor, ...),
served as one static nginx site. Each tool has no backend; any settings are kept in the browser's
`localStorage`.

Originals came from `C:\Users\dwils\Documents\DriveVault\apps`. This folder is now the source of truth.

## Layout

- `site/index.html` — landing page listing every tool (edit by hand when adding one).
- `site/<slug>/index.html` — one tool per folder, served at `/<slug>/`.
- `site/vendor/` — vendored copies of the former CDN dependencies (js-yaml 4.1.0, leaflet 1.9.4,
  leaflet.draw 1.0.4). Google Fonts are still loaded remotely.
- `nginx.conf` — CSP: scripts/styles inline or same-origin, fonts from Google, map tiles from OSM,
  `connect-src *` (oauth-token calls arbitrary token endpoints). A new CDN script or remote image source
  must be vendored or added to the CSP, or the browser blocks it.

## Adding a tool

Put it at `site/<kebab-slug>/index.html`, vendor any CDN scripts into `site/vendor/`, add a link to
`site/index.html`, then release.

## Deployment

Public at https://tools.danwils.com (no auth: everything is client-side). There is deliberately no
`.local` HTTP host: the tools use `navigator.clipboard` and `crypto.subtle`, which browsers only expose
on HTTPS origins. Manifests are in `infra/cluster-config/web-tools/`. To release:

```bash
docker build -t dwilson2547/web-tools:<ver> -t dwilson2547/web-tools:latest .
docker push dwilson2547/web-tools:<ver> && docker push dwilson2547/web-tools:latest
```

then bump the tag in `infra/cluster-config/web-tools/deployment.yml` and push cluster-config.

Local test: `docker run --rm -p 8080:8080 dwilson2547/web-tools:latest` → http://localhost:8080
(localhost counts as a secure context).
