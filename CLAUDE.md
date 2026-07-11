# RAGBRAI LIII follow-along site

Friends-and-family site for a two-rider RAGBRAI team ("The Sh1th34dz"),
July 18–25, 2026, Onawa → Dubuque. Live at https://paulcathey.com/ragbrai26
(GitHub Pages, deploys automatically on push to main).

## Architecture

- **Static site, no build step.** `index.html` + `app.js` + `styles.css` at the
  repo root. Leaflet map, Chart.js elevation profile. `route.js` holds town
  waypoints + per-day metadata; `route.geojson` holds official road geometry
  (regenerate with `tools/fetch_routes.py` if routes change).
- **Cloudflare Worker** in `worker/` (`ragbrai-stats` on pmcathey.workers.dev,
  KV binding `RAGBRAI_KV`) is the whole backend. Endpoints:
  - `GET /stats` — Strava club miles (15-min cron feeds it; accumulator +
    baseline pattern, see comments in `worker/src/index.js`)
  - `GET/POST /location` — live GPS beacon. Accepts JSON, Overland batches,
    and Traccar/OsmAnd fields in query string or form-encoded body. Auth:
    `BEACON_TOKEN` secret via Bearer / `?token=` / Traccar's `id` field.
  - `GET/POST/DELETE /cheers` — public cheer wall ("wall of zingers") with
    length caps, per-IP rate limit, slur-only blocklist. DELETE is
    token-authed moderation.
  - `GET /photos` — scrapes the public Google Photos share album for CDN
    links (no API — Google killed the readonly scope), cached 1 hr in KV.
- Site → Worker config lives in `config.js` (`STATS_API`, `DONATE_URL`).

## Deploys

- **Site:** push to main → GitHub Pages. Nothing else.
- **Worker:** push touching `worker/**` → `.github/workflows/deploy-worker.yml`
  runs `wrangler deploy` (needs `CLOUDFLARE_API_TOKEN` repo secret). Manual:
  `cd worker && npx wrangler deploy`.
- Worker secrets (`BEACON_TOKEN`, `STRAVA_CLIENT_SECRET`) are set via
  `wrangler secret put` and are NOT in this repo — never commit them; this
  repo is public. The beacon token lives in the riders' password managers.

## Conventions & gotchas

- Copy/voice: playful team voice everywhere ("wall of zingers"). Site copy
  written by Paul is deliberate — don't rewrite it; propose changes instead.
- Test the Worker with `npx wrangler dev --var "ALLOWED_ORIGIN:*" --var
  "BEACON_TOKEN:testtoken123"` and curl; KV is simulated locally.
- CORS: Worker only allows origin `https://paulcathey.com`, so the cheer wall
  and photo strip show fallback/empty states on localhost previews. Expected.
- Header route miles/climb: official per-day sums by date are the floor;
  during ride days the beacon's projected mile lifts them live and also drives
  the red rider dot on the elevation profile (`renderProgressStats` /
  `riderMarkerPlugin` in `app.js`; gated on ride started + fix < 45 min old).
  Ride-days stat and checkboxes stay date-math off `route.js` `start_date`
  (2026-07-19; the 18th is arrival day).
- KV free tier = 1,000 writes/day. Location reports store `latest` + today's
  trail in a single `beacon` key (1 write/report), throttled to once per 120s
  of wall-clock time in `storePoints`, so even a chatty tracker or a replayed
  offline backlog stays ~<=720 writes/day. `/location` also always returns 200
  after auth (incl. on KV failure) so a non-2xx can't make Traccar retry-jam
  its queue. Don't add chatty writers or remove the throttle without checking
  the budget. (History: a Traccar backlog drain blew the cap on 2026-07-11.)
- Ride-week operational runbook: `RIDE-GUIDE.md`. Worker details:
  `worker/README.md`.
