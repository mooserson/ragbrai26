# RAGBRAI Stats Worker

Cloudflare Worker that pulls Strava club ride totals on a 15-minute cron (`GET /stats`) and stores live ride location (`POST /location` from the phone, `GET /location` for the site).

## What you need before starting

- Free **Cloudflare account** — https://dash.cloudflare.com/sign-up
- Strava app credentials — go to https://www.strava.com/settings/api, create an app:
  - **Application Name:** RAGBRAI Tracker (anything works)
  - **Category:** Other
  - **Authorization Callback Domain:** `paulcathey.com` *and* (for first deploy) the `workers.dev` domain Cloudflare gives you. Strava only allows one — use `workers.dev` until you wire a custom domain.
  - Copy the **Client ID** and **Client Secret**
- Node.js installed locally (any recent version)

## One-time setup

```bash
cd ragbrai/worker
npm install
npx wrangler login                              # opens browser, signs into Cloudflare
npx wrangler kv:namespace create RAGBRAI_KV     # prints an id — paste into wrangler.toml
```

Open `wrangler.toml` and fill in:
- `STRAVA_CLIENT_ID` — from Strava
- `id` under `[[kv_namespaces]]` — from the previous command
- Leave `REDIRECT_URI` as `REPLACE_AFTER_FIRST_DEPLOY` for now

Set the secret (never goes in the file):

```bash
npx wrangler secret put STRAVA_CLIENT_SECRET    # paste the secret when prompted
```

## First deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like `https://ragbrai-stats.<your-subdomain>.workers.dev`. Copy it.

Now finish wiring:

1. Edit `wrangler.toml` → set `REDIRECT_URI = "https://ragbrai-stats.<your-subdomain>.workers.dev/callback"`
2. Re-deploy: `npx wrangler deploy`
3. Edit `../config.js` → set `STATS_API: "https://ragbrai-stats.<your-subdomain>.workers.dev"`
4. Push the static-site changes to your GH Pages repo
5. Update your Strava app's **Authorization Callback Domain** to `<your-subdomain>.workers.dev` (Strava setting at https://www.strava.com/settings/api)

## One-time OAuth grant

Open `https://ragbrai-stats.<your-subdomain>.workers.dev/auth` in your browser. Sign in to Strava if needed, click Authorize. You'll be redirected to `/callback` and see "Connected to Strava." That stores a refresh token in KV and triggers the first stats fetch.

Visit `https://ragbrai-stats.<your-subdomain>.workers.dev/stats` to confirm — should return JSON with `total_miles`.

The cron now runs every 6 hours. Force a refresh by hitting `/auth` again, or just wait.

## Live location

Endpoints:

- `POST /location` — body `{lat, lng, ts?, acc?}` or an [Overland](https://overland.p3k.app/) batch (`{locations: [...]}`). Auth: `Authorization: Bearer <BEACON_TOKEN>` header or `?token=<BEACON_TOKEN>` query param. Stores the latest fix plus a per-day breadcrumb trail (thinned to 1 point / 2 min, capped at 600 points, day boundary = America/Chicago).
- `GET /location` — `{latest: {lat, lng, ts, acc}, trail: [{lat, lng, ts}, ...]}` for the latest fix's ride day. Public, no auth.

Setup:

```bash
npx wrangler secret put BEACON_TOKEN   # any long random string; also goes on the phone
npx wrangler deploy
```

Generate a token with e.g. `openssl rand -hex 16`. Senders:

- `beacon.html` on the site — paste the token once (saved in localStorage), then manual or 10-min auto check-ins.
- Overland app — set Receiver URL to `https://ragbrai-stats.pmcathey.workers.dev/location?token=<BEACON_TOKEN>`.

Test from a laptop:

```bash
curl -X POST "https://ragbrai-stats.pmcathey.workers.dev/location" \
  -H "Authorization: Bearer <BEACON_TOKEN>" -H "Content-Type: application/json" \
  -d '{"lat": 42.0269, "lng": -96.0975}'
curl "https://ragbrai-stats.pmcathey.workers.dev/location"
```

## Troubleshooting

- **`OAuth failed`** in the callback: usually a Client Secret mismatch or wrong callback domain in Strava settings.
- **`/stats` returns `{"total_miles": 0}`** persistently: hit `/auth` again — KV may not have a refresh token yet.
- **Tail logs:** `npx wrangler tail` shows live request + cron logs.

## Files

- `wrangler.toml` — config (no secrets)
- `src/index.js` — Worker code: `/auth`, `/callback`, `/stats`, `/location`, scheduled handler
- `package.json` — wrangler dev dep only
