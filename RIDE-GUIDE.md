# 🚲 Ride Week Phone Guide — RAGBRAI LIII

What the Sh1th34dz do on their phones July 18–25 so the folks at home see the
dot move. Print-it-out short. Setup steps at the bottom happen BEFORE Onawa.

## TL;DR daily routine

| When | What | Takes |
|---|---|---|
| Rolling out (morning) | Start the tracker (Overland app or beacon page) | 10 sec |
| First town | Glance at the site — is the dot you? | 20 sec |
| Pie stops | Nothing (Overland) or tap **Check in now** (beacon page) | 0–5 sec |
| End of day | Stop tracker, save the Strava ride | 30 sec |
| In camp | Phone on the battery bank | — |

Training miles update ~15 min after a Strava ride is **saved** — Strava can't
show live location, that's the beacon's whole job.

## The links (bookmark these on both phones)

- **Site (what home sees):** https://paulcathey.com/ragbrai26/
- **Beacon page (manual check-ins):** https://paulcathey.com/ragbrai26/beacon.html
- **Is the worker alive?** https://ragbrai-stats.pmcathey.workers.dev/location ← open in any browser; JSON with your last fix = healthy
- **Strava stats raw:** https://ragbrai-stats.pmcathey.workers.dev/stats
- **Cheer wall raw:** https://ragbrai-stats.pmcathey.workers.dev/cheers
- **Edit the site from your phone:** https://github.com/mooserson/ragbrai26 ← see "Fixing things from Iowa"
- **Worker dashboard:** https://dash.cloudflare.com → Workers & Pages → ragbrai-stats

## Tracking: two ways to feed the dot

**Option A — Overland app (recommended: set-and-forget).** Free, runs in the
background, batches points and retries when cell signal comes back (rural Iowa
reality). One-time setup below. During the ride: open it in the morning,
confirm it's tracking, pocket the phone. Done.

**Option B — beacon.html (zero install, needs screen on).** Open the beacon
page, tap **Check in now** whenever you stop, or flip **Auto check-in** on if
the phone rides on a handlebar mount with a battery bank (auto mode keeps the
screen awake on purpose — iOS kills timers when the screen locks).

Either way the site shows "last seen X min ago" — gaps in coverage just make
X bigger, nothing breaks. Both riders can run trackers; last post wins the dot.

**Battery notes:** don't use airplane mode (no cell = no posts). Low Power
Mode throttles background apps — fine for Option B, may slow Overland.
Carry the battery bank in the jersey, not the camp bag.

## Fixing things from Iowa (no laptop)

The site is static files served by GitHub Pages with **no build step** —
editing a file on GitHub redeploys the live site in ~1 minute. From a phone:

1. Go to https://github.com/mooserson/ragbrai26, sign in.
2. Tap the file → pencil icon → edit → **Commit changes** to `main`.
3. Hard-refresh the site a minute later.

Works for `app.js`, `index.html`, `styles.css`, `config.js`, `route.js` — any
frontend bug. Claude Code on the web (https://claude.ai/code) can also open
the GitHub repo from a phone if the fix is bigger than a typo.

**Worker code is the exception** — `worker/` deploys via wrangler, not Pages.
From a phone, use the Cloudflare dashboard editor (dash.cloudflare.com →
ragbrai-stats → Edit code → Deploy). Clunky on mobile but it works.

### Triage table

| Symptom | Check | Likely fix |
|---|---|---|
| Dot not moving | `/location` URL above — fresh `ts`? | Stale: tracker app died, restart it. Fresh: frontend issue, hard-refresh site |
| Beacon says "Bad token" | Token field on beacon page | Re-paste token (it's in the team notes / password manager) |
| Training miles stuck at old number | `/stats` URL — `updated_at` recent? | Old: open `/auth` URL and re-grant Strava (browser, 30 sec) |
| Cheer wall has a jerk on it | `/cheers` URL — find the `id` | Run the **Delete Cheer** iOS Shortcut (setup below), or ask Claude |
| Whole site down | github.com/mooserson/ragbrai26 → Actions/Pages status | Wait it out or revert last commit on GitHub |

## Before Onawa (one-time, laptop required) ☐

1. ☐ Review + commit + push the pending batch (live location, route, cheers)
2. ☐ Deploy worker: `cd worker && npx wrangler login && npx wrangler secret put BEACON_TOKEN && npx wrangler deploy` (make the token with `openssl rand -hex 16`)
3. ☐ Put the token in both phones' password managers / team notes
4. ☐ Both phones: install Overland → Settings → Receiver Endpoint URL = `https://ragbrai-stats.pmcathey.workers.dev/location?token=<TOKEN>` — or do a beacon.html check-in once so the token is saved
5. ☐ iOS Shortcut "Delete Cheer" (optional): Get Contents of URL → `https://ragbrai-stats.pmcathey.workers.dev/cheers?id=[Ask Each Time]`, Method DELETE, Header `Authorization: Bearer <TOKEN>`
6. ☐ **Dress rehearsal on a June training ride** — full loop: track, see the dot move, save to Strava, watch miles bump. Don't debut this in Onawa.
7. ☐ When official route files drop (watcher will ping): review, commit, push
