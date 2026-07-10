# 🚲 Ride Week Phone Guide — RAGBRAI LIII

What the Sh1th34dz do on their phones July 18–25 so the folks at home see the
dot move. Print-it-out short. Setup steps at the bottom happen BEFORE Onawa.

## TL;DR daily routine

| When | What | Takes |
|---|---|---|
| Rolling out (morning) | Toggle Traccar tracking ON (Paul's phone) | 10 sec |
| First town | Glance at the site — is the dot you? | 20 sec |
| Pie stops | Nothing — the heartbeat keeps the dot fresh | 0 sec |
| End of day | Toggle Traccar OFF, save the Strava ride | 30 sec |
| In camp | Phone on the battery bank (tracker stays OFF overnight) | — |

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

## Tracking: one phone, two ways to feed the dot

**The plan — Traccar Client on Paul's Android (set-and-forget).** Free, runs
in the background, buffers points and retries when cell signal comes back
(rural Iowa reality). Already configured and verified: server URL + token as
device identifier, 300s interval, 300s heartbeat so the dot stays fresh even
mid-pie. During the ride: toggle tracking ON in the morning, pocket the phone.
Done. (Why not Overland? Its Android app got delisted from Google Play.)

**The backup — beacon.html (zero install, needs screen on).** Open the beacon
page, paste the token once, tap **Check in now** whenever you stop. This is
the iPhone's job if Paul's phone dies — or flip **Auto check-in** on if the
phone rides on a handlebar mount with a battery bank (auto mode keeps the
screen awake on purpose — iOS kills timers when the screen locks).

Either way the site shows "last seen X min ago" — gaps in coverage just make
X bigger, nothing breaks. One tracker at a time; if both post, last one wins
the dot.

**Battery notes:** don't use airplane mode (no cell = no posts). Exempt
Traccar from battery optimization (Settings → Apps → Traccar Client →
Battery → Unrestricted) or Android will quietly kill it an hour in. Carry
the battery bank in the jersey, not the camp bag.

## Fixing things from Iowa (no laptop)

The site is static files served by GitHub Pages with **no build step** —
editing a file on GitHub redeploys the live site in ~1 minute. From a phone:

1. Go to https://github.com/mooserson/ragbrai26, sign in.
2. Tap the file → pencil icon → edit → **Commit changes** to `main`.
3. Hard-refresh the site a minute later.

Works for `app.js`, `index.html`, `styles.css`, `config.js`, `route.js` — any
frontend bug. Claude Code on the web (https://claude.ai/code) can also open
the GitHub repo from a phone if the fix is bigger than a typo — the repo's
`CLAUDE.md` briefs it on the whole setup.

**Worker code deploys itself too** — any commit touching `worker/` kicks off
a GitHub Action that runs `wrangler deploy` (~1 min; green check in the
Actions tab). Break-glass fallback: the Cloudflare dashboard editor
(dash.cloudflare.com → ragbrai-stats → Edit code → Deploy).

### Triage table

| Symptom | Check | Likely fix |
|---|---|---|
| Dot not moving | `/location` URL above — fresh `ts`? | Stale: tracker app died, restart it. Fresh: frontend issue, hard-refresh site |
| Beacon says "Bad token" | Token field on beacon page | Re-paste token (it's in the team notes / password manager) |
| Training miles stuck at old number | `/stats` URL — `updated_at` recent? | Old: open `/auth` URL and re-grant Strava (browser, 30 sec) |
| Cheer wall has a jerk on it | `/cheers` URL — find the `id` | Run the **Delete Cheer** iOS Shortcut (setup below), or ask Claude |
| Whole site down | github.com/mooserson/ragbrai26 → Actions/Pages status | Wait it out or revert last commit on GitHub |

## Before Onawa (one-time, laptop required) ☐

1. ✅ ~~Review + commit + push the pending batch~~ (live June 9: site, live location, route line, cheer wall)
2. ✅ ~~Deploy worker + set BEACON_TOKEN~~ (live July 8; cheer wall + donate live same day)
3. ☐ Put the token in both phones' password managers / team notes
4. ✅ ~~Tracker on Paul's phone~~ (Traccar Client, configured + dot verified July 9–10; one-phone plan — the iPhone's backup is beacon.html, not Overland, whose Android app is delisted)
5. ☐ iOS Shortcut "Delete Cheer" (optional): Get Contents of URL → `https://ragbrai-stats.pmcathey.workers.dev/cheers?id=[Ask Each Time]`, Method DELETE, Header `Authorization: Bearer <TOKEN>`
6. ☐ **Dress rehearsal on a training ride THIS WEEK** — full loop: track for a few hours, see the dot move + trail draw, save to Strava, watch miles bump. Also proves Android doesn't kill Traccar in the pocket. Don't debut this in Onawa.
7. ✅ ~~Pick the charity → wire the Donate button~~ (The Recyclery, Rogers Park — live July 8)
8. ✅ ~~Official route files~~ (imported; every town dot audited + snapped onto the line July 10)
9. ✅ ~~Laptop-free everything~~ (GitHub Action auto-deploys `worker/` commits; `CLAUDE.md` briefs cloud Claude sessions — July 10)
10. ☐ Someday-maybe: upgrade wrangler v3 → v4 in `worker/` (deprecation warning, nothing broken); real elevation profile from track points instead of town dots
