# RAGBRAI LIII Tracker

Friends-and-family follow-along site for RAGBRAI LIII (July 18–25, 2026), Onawa → Dubuque, 391.4 mi, 16,027 ft of climb.

## Stack

- Static HTML/JS, no build step
- Leaflet + OpenStreetMap tiles for the map
- Chart.js for the elevation profile
- Deploys: GitHub Pages on push (site); GitHub Action runs `wrangler deploy`
  on `worker/` changes (needs the `CLOUDFLARE_API_TOKEN` repo secret)

## Status

Everything on the roadmap is live: route + elevation render, a photo strip
pulled from the shared Google Photos album (Worker `/photos` scrapes the
public share page hourly), Strava training miles, live "last seen" tracking,
the Donate button, and the wall of zingers.

The map line comes from `route.geojson` — real road geometry pulled from the
official RAGBRAI Ride with GPS routes for all 7 days. The main paved route is
the primary line; each day's gravel option, plus Day 5's Karras Loop and
America 250 Double Loop, ride along as flip-on overlays ("Show also" in the map
legend). Town waypoints and the elevation chart come from `route.js`. When
RAGBRAI updates a route, swap the id in `tools/fetch_routes.py` and re-run:

```
python3 tools/fetch_routes.py
```

If `route.geojson` is missing the map falls back to straight town-to-town lines.

## Roadmap

1. ~~Route + elevation render~~ ✅
2. ~~Photo gallery (Google Photos shared album link)~~ ✅
3. ~~Live "last seen" dot — phone POSTs `{lat, lng, ts}` to the Worker~~ ✅
4. ~~Strava Club widget for training miles~~ ✅
5. ~~Donate button + cheer-wall~~ ✅

## Live location

The map shows a pulsing red dot plus a breadcrumb trail for the current ride
day, and the sidebar shows "last seen X min ago · ~mile Y, near Town".

Ways to feed it from the road (the ride plan is one Android phone on Traccar;
see `RIDE-GUIDE.md`):

- **[Traccar Client](https://play.google.com/store/apps/details?id=org.traccar.client)**
  (Android, free) — proper background tracking. Server URL
  `https://ragbrai-stats.pmcathey.workers.dev/location`, device identifier =
  the beacon token. The Worker parses its OsmAnd-style reports (query-string
  or form-encoded) natively.
- **`beacon.html`** (this site, not linked from the main page) — zero-install
  backup: open it on a phone, paste the beacon token once, and either tap
  **Check in now** at stops or flip on **Auto check-in** (posts every 10 min
  while the page is open; grabs a screen wake lock, so best on a charger).
- **[Overland](https://overland.p3k.app/)** (iOS only — the Android build is
  delisted) — Receiver URL:
  `https://ragbrai-stats.pmcathey.workers.dev/location?token=<BEACON_TOKEN>`.
  The Worker accepts Overland's batch format natively.

Setup: `npx wrangler secret put BEACON_TOKEN` in `worker/`, then deploy. See
`worker/README.md`.

## Donate + wall of zingers

The "Pay to play" sidebar card's Donate button goes to
[The Recyclery](https://www.therecyclery.org/) (volunteer-run teaching bike
shop in Rogers Park, Chicago) via `DONATE_URL` in `config.js`. If `DONATE_URL`
is ever unset the button falls back to a "coming soon" state.

The wall of zingers is a public cheer-wall: name + message (280 chars max)
POSTed to the Worker, stored in KV, rendered newest-first. Abuse guards: per-IP
rate limit (1/min), slur blocklist (plain swearing is allowed — have you met
this team?), and an authed `DELETE /cheers?id=` for anything that slips
through. See `worker/README.md`.

## Run locally

```
cd ragbrai && python3 -m http.server 8000
```

Open http://localhost:8000.
