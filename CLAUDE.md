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
- Header stats (route miles / climb / ride days / checkboxes) are pure
  client-side date math off `route.js` `start_date` (2026-07-19; the 18th is
  arrival day). They bump at local midnight, not live.
- KV free tier = 1,000 writes/day; each location report costs 2. One phone at
  a 300s report interval leaves comfortable headroom — don't add chatty
  writers without checking the budget.
- Ride-week operational runbook: `RIDE-GUIDE.md`. Worker details:
  `worker/README.md`.
