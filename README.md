# RAGBRAI LIII Tracker

Friends-and-family follow-along site for RAGBRAI LIII (July 18–25, 2026), Onawa → Dubuque, 391.4 mi, 16,027 ft of climb.

## Stack

- Static HTML/JS, no build step
- Leaflet + OpenStreetMap tiles for the map
- Chart.js for the elevation profile
- Deploys anywhere static (Vercel, Netlify, Cloudflare Pages)

## Status

Route + elevation render with placeholder waypoints (real RAGBRAI GPX drops into `route.geojson` when published), Google Photos album link, Strava training miles, and live "last seen" tracking.

## Roadmap

1. ~~Route + elevation render~~ ✅
2. ~~Photo gallery (Google Photos shared album link)~~ ✅
3. ~~Live "last seen" dot — phone POSTs `{lat, lng, ts}` to the Worker~~ ✅
4. ~~Strava Club widget for training miles~~ ✅
5. Donate button + cheer-wall

## Live location

The map shows a pulsing red dot plus a breadcrumb trail for the current ride
day, and the sidebar shows "last seen X min ago · ~mile Y, near Town".

Two ways to feed it from the road:

- **`beacon.html`** (this site, not linked from the main page) — open it on a
  phone, paste the beacon token once, and either tap **Check in now** at stops
  or flip on **Auto check-in** (posts every 10 min while the page is open;
  grabs a screen wake lock, so best with the phone on a charger).
- **[Overland](https://overland.p3k.app/)** (iOS/Android, free) — proper
  background tracking. Receiver URL:
  `https://ragbrai-stats.pmcathey.workers.dev/location?token=<BEACON_TOKEN>`.
  The Worker accepts Overland's batch format natively.

Setup: `npx wrangler secret put BEACON_TOKEN` in `worker/`, then deploy. See
`worker/README.md`.

## Run locally

```
cd ragbrai && python3 -m http.server 8000
```

Open http://localhost:8000.
