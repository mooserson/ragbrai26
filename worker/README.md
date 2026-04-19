# RAGBRAI Stats Worker

Cloudflare Worker that pulls Strava club ride totals on a 6-hour cron and exposes a single `GET /stats` endpoint the static site fetches.

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

## Troubleshooting

- **`OAuth failed`** in the callback: usually a Client Secret mismatch or wrong callback domain in Strava settings.
- **`/stats` returns `{"total_miles": 0}`** persistently: hit `/auth` again — KV may not have a refresh token yet.
- **Tail logs:** `npx wrangler tail` shows live request + cron logs.

## Files

- `wrangler.toml` — config (no secrets)
- `src/index.js` — Worker code: `/auth`, `/callback`, `/stats`, scheduled handler
- `package.json` — wrangler dev dep only
