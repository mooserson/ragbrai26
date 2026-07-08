# RAGBRAI Stats Worker

Cloudflare Worker that pulls Strava club ride totals on a 15-minute cron (`GET /stats`), stores live ride location (`POST /location` from the phone, `GET /location` for the site), and runs the cheer-wall (`GET`/`POST`/`DELETE /cheers`).

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

The cron now runs every 15 minutes. Force a refresh by hitting `/auth` again, or just wait.

### How the total is counted (and the baseline)

Strava's club-activities feed returns only a **rolling window of recent activities**, not the club's full history, and the entries have no activity id or timestamp. So the cron **accumulates**: it keeps a running total in KV (`stats_acc`) plus a set of already-counted activity signatures (athlete name + distance + moving time) and only adds rides it hasn't seen before. The number only ever grows — it can't drop as old rides age out of the window.

The **first** cron after deploy just records what's already in the window (without counting it), so the live total starts from the baseline and grows from genuinely new rides. Miles/rides from before that can't be re-fetched from Strava, so seed them once in `wrangler.toml`:

```toml
STATS_BASELINE_MILES = "1234.5"   # today's true club ride miles
STATS_BASELINE_RIDES = "87"       # today's true club ride count
```

These are added on top of the live count and can be adjusted anytime without disturbing the accumulator. To reset the running count entirely, delete the `stats_acc` KV key.

## Live location

Endpoints:

- `POST /location` — body `{lat, lng, ts?, acc?}` or an [Overland](https://overland.p3k.app/) batch (`{locations: [...]}`). Auth: `Authorization: Bearer <BEACON_TOKEN>` header or `?token=<BEACON_TOKEN>` query param. Stores the latest fix plus a per-day breadcrumb trail (thinned to 1 point / 2 min, capped at 600 points, day boundary = America/Chicago).
- `GET|POST /location?lat=&lon=&timestamp=&accuracy=` — Traccar/OsmAnd-style check-in, params in the query string (`timestamp` = epoch seconds or millis, optional). Auth: `?token=` or — since Traccar can't set custom URLs params or headers — the `?id=` device identifier it always sends. Same storage as above.
- `GET /location` (no coord params) — `{latest: {lat, lng, ts, acc}, trail: [{lat, lng, ts}, ...]}` for the latest fix's ride day. Public, no auth.

Setup:

```bash
npx wrangler secret put BEACON_TOKEN   # any long random string; also goes on the phone
npx wrangler deploy
```

Generate a token with e.g. `openssl rand -hex 16`. Senders:

- `beacon.html` on the site — paste the token once (saved in localStorage), then manual or 10-min auto check-ins.
- Overland app (iOS; the Android build is delisted from Google Play) — set Receiver URL to `https://ragbrai-stats.pmcathey.workers.dev/location?token=<BEACON_TOKEN>`.
- [Traccar Client](https://play.google.com/store/apps/details?id=org.traccar.client) (Android) — server URL `https://ragbrai-stats.pmcathey.workers.dev/location`, device identifier = the beacon token.

Test from a laptop:

```bash
curl -X POST "https://ragbrai-stats.pmcathey.workers.dev/location" \
  -H "Authorization: Bearer <BEACON_TOKEN>" -H "Content-Type: application/json" \
  -d '{"lat": 42.0269, "lng": -96.0975}'
curl "https://ragbrai-stats.pmcathey.workers.dev/location"
```

## Cheer wall

Endpoints:

- `GET /cheers` — `{cheers: [{id, name, message, ts}, ...]}` newest-first. Public.
- `POST /cheers` — body `{name?, message}`. Public, but guarded: name capped at
  40 chars (defaults to "Mystery fan"), message capped at 280, control chars
  stripped, slur blocklist (word-exact after leetspeak folding — plain swearing
  passes), and a 1-cheer-per-IP-per-minute rate limit via KV TTL. Returns
  `{ok: true, cheer}` or `{error}` with 400/429.
- `DELETE /cheers?id=<id>` — remove a cheer that slipped past the filter.
  Auth: `Authorization: Bearer <BEACON_TOKEN>` or `?token=`.

Storage: single KV key `cheers` (JSON array, capped at 200 entries).

Moderation from a laptop:

```bash
curl "https://ragbrai-stats.pmcathey.workers.dev/cheers"   # find the id
curl -X DELETE "https://ragbrai-stats.pmcathey.workers.dev/cheers?id=<id>" \
  -H "Authorization: Bearer <BEACON_TOKEN>"
```

## Photos

- `GET /photos` — `{photos: ["https://lh3.googleusercontent.com/pw/...", ...]}`.
  Public. Scrapes the shared Google Photos album (`PHOTOS_ALBUM_URL` in
  `wrangler.toml`) for image CDN links, cached in KV key `photos` for an hour.
  The Photos Library API can't read albums the app didn't create (Google
  removed the readonly scope in March 2025), hence the scrape. If Google
  changes the share-page markup the scrape yields nothing and the endpoint
  keeps serving the last good list; the site hides its thumbnail strip if the
  list is empty. Append an lh3 sizing suffix to render (e.g. `=w320-h320-c`
  for a 320px cropped square).

## Troubleshooting

- **`OAuth failed`** in the callback: usually a Client Secret mismatch or wrong callback domain in Strava settings.
- **`/stats` returns `{"total_miles": 0}`** persistently: hit `/auth` again — KV may not have a refresh token yet.
- **Tail logs:** `npx wrangler tail` shows live request + cron logs.

## Files

- `wrangler.toml` — config (no secrets)
- `src/index.js` — Worker code: `/auth`, `/callback`, `/stats`, `/location`, scheduled handler
- `package.json` — wrangler dev dep only
