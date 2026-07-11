# Beacon test runbook (for a cloud agent)

Self-contained instructions to verify the RAGBRAI live-location worker is
healthy. Written so a fresh Claude with only this repo + web/curl access can run
it — no local machine, no wrangler login, no prior conversation needed.

## Context

`ragbrai-stats` is a Cloudflare Worker (the whole backend for the RAGBRAI LIII
follow-along site, https://paulcathey.com/ragbrai26). Live rider location comes
from **Traccar Client on Paul's Pixel 4a**, which POSTs GPS fixes to
`POST /location`; the site reads `GET /location` and draws a dot + trail.

Base URL: **https://ragbrai-stats.pmcathey.workers.dev**

## Hard rules

- **Do NOT deploy** and do NOT run wrangler. This is read/verify only.
- **This repo is PUBLIC. Never commit the beacon token or any secret.** The
  token is not in the repo by design.
- You do **not** need the token for the main check below (see step 3). Only the
  optional auth test needs it, and it must be pasted into the chat by Paul, used
  once, and never written to a file.

## What "healthy" looks like

1. **Public health checks (no auth).** All three should return HTTP 200:
   ```bash
   curl -s -o /dev/null -w "stats:    %{http_code}\n" https://ragbrai-stats.pmcathey.workers.dev/stats
   curl -s -o /dev/null -w "location: %{http_code}\n" https://ragbrai-stats.pmcathey.workers.dev/location
   curl -s -o /dev/null -w "photos:   %{http_code}\n" https://ragbrai-stats.pmcathey.workers.dev/photos
   ```
   - `/stats` → JSON with `total_miles` (Strava training miles).
   - `/location` → JSON `{ "latest": {lat,lng,ts,acc} | null, "trail": [...] }`.
   - `/photos` → JSON (may be `{"photos":[]}`; that's fine).

2. **Check the current stored fix and its age:**
   ```bash
   curl -s https://ragbrai-stats.pmcathey.workers.dev/location | python3 -c '
   import sys,json,datetime
   d=json.load(sys.stdin); l=d.get("latest")
   if not l: print("latest: null (no fix stored yet)"); sys.exit()
   age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(l["ts"].replace("Z","+00:00"))).total_seconds()/60
   print(f"latest: {l[\"ts\"]}  (~{age:.0f} min old)  {l[\"lat\"]},{l[\"lng\"]}  trail={len(d.get(\"trail\") or [])}")'
   ```
   - A fix **< ~15 min old** = the beacon is live and working. Done.
   - `null` or a very old timestamp = no fresh point yet; do step 3.

3. **End-to-end test (the real one, no token needed):** ask Paul to open
   Traccar Client on his phone and tap **"Send Location"** once. Then poll until
   a fresh fix lands:
   ```bash
   for i in $(seq 1 24); do
     out=$(curl -s https://ragbrai-stats.pmcathey.workers.dev/location | python3 -c '
   import sys,json,datetime
   d=json.load(sys.stdin); l=d.get("latest") or {}
   ts=l.get("ts","")
   try:
     age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(ts.replace("Z","+00:00"))).total_seconds()/60
     print(f"{ts}|{age:.0f}|{l.get(\"lat\")},{l.get(\"lng\")}")
   except: print("|999|")')
     age=$(echo "$out" | cut -d"|" -f2)
     if [ "$age" -lt 15 ] 2>/dev/null; then
       echo "LIVE: $(echo "$out" | cut -d"|" -f1) (~${age} min old) at $(echo "$out" | cut -d"|" -f3)"; break
     fi
     sleep 15
   done
   ```
   Report the fresh timestamp + coords to Paul. That confirms the whole chain
   (phone → worker → KV → site) is working.

4. **Optional auth test (needs the token).** If Paul pastes the beacon token
   into the chat, you can confirm auth without writing a fake point to the map
   (a coordless "heartbeat" authenticates but stores nothing):
   ```bash
   # replace <TOKEN>; expect 200
   curl -s -o /dev/null -w "good token: %{http_code}\n" -X POST \
     "https://ragbrai-stats.pmcathey.workers.dev/location" \
     -H "Content-Type: application/x-www-form-urlencoded" --data "id=<TOKEN>&batt=100"
   # wrong token; expect 401
   curl -s -o /dev/null -w "bad token:  %{http_code}\n" -X POST \
     "https://ragbrai-stats.pmcathey.workers.dev/location" \
     -H "Content-Type: application/x-www-form-urlencoded" --data "id=WRONG&batt=100"
   ```

## Known gotchas (context for interpreting results)

- **Cloudflare KV free tier = 1,000 writes/day, resets at 00:00:00 UTC.** If the
  cap is hit, `/location` still returns **200** but silently can't store (the
  site's dot freezes). It self-heals at the next 00:00 UTC. On 2026-07-11 a
  Traccar backlog drain hit the cap; the worker was since hardened (single KV
  key + a 120s write throttle) so normal use stays ~<=720 writes/day.
- **Traccar's 200-or-jam rule:** the worker must always return 200 after auth,
  or Traccar Client retries the same report forever and stalls its queue
  ("dot stuck, then silence"). If you ever see the worker return a non-2xx to a
  valid authenticated report, that's a regression — flag it, don't "fix" by
  making the client retry.
- **Phone side:** location should be "Allow all the time," battery unrestricted,
  and for the ride, Traccar's **offline buffering ON** (safe now that the worker
  can't be jammed). Server URL = base `/location`; device identifier = the token.
- If a fresh fix won't land even after a Send Location and writes aren't capped,
  double-check the Traccar **device identifier is exactly the beacon token**.

## If something's actually broken

Report findings to Paul with the exact HTTP codes / JSON you saw. Do not deploy
or change secrets yourself — surface it and let Paul decide. Worker source and
architecture notes: `worker/src/index.js` and `CLAUDE.md` in this repo.
