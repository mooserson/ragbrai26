# RAGBRAI LIII Tracker

Friends-and-family follow-along site for RAGBRAI LIII (July 18–25, 2026), Onawa → Dubuque, 391.4 mi, 16,027 ft of climb.

## Stack

- Static HTML/JS, no build step
- Leaflet + OpenStreetMap tiles for the map
- Chart.js for the elevation profile
- Deploys anywhere static (Vercel, Netlify, Cloudflare Pages)

## Status

Phase 1 — route + elevation render with placeholder waypoints. Real RAGBRAI GPX drops in to `route.geojson` when published.

## Roadmap

1. Route + elevation render (this commit)
2. Photo gallery embed (Google Photos shared album)
3. Live "last seen" dot — phone POSTs `{lat, lng, ts}` to a Cloudflare Worker every ~10 min
4. Strava Club widget for training miles
5. Donate button + cheer-wall

## Run locally

```
cd ragbrai && python3 -m http.server 8000
```

Open http://localhost:8000.
