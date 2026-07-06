---
title: OSM geopolys: buffer centerline by track width before area conversion
date: 2026-05-30
tags: geospatial, osm, gis
---

When building geopolygons from OSM ways (e.g. for gis-speed-limit / track work), buffer the way centerline by the nominal track/road width before converting to an area — raw ways are zero-width centerlines and produce degenerate polygons.
