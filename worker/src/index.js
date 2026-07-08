const STRAVA_OAUTH = "https://www.strava.com/oauth";
const STRAVA_API = "https://www.strava.com/api/v3";
const METERS_PER_MILE = 1609.344;

const CHEER_MAX_NAME = 40;
const CHEER_MAX_MESSAGE = 280;
const CHEER_WALL_CAP = 200;

const PHOTOS_TTL_MS = 60 * 60 * 1000;
const PHOTOS_MAX = 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/auth") {
      const params = new URLSearchParams({
        client_id: env.STRAVA_CLIENT_ID,
        redirect_uri: env.REDIRECT_URI,
        response_type: "code",
        scope: "read,activity:read",
        approval_prompt: "auto",
      });
      return Response.redirect(`${STRAVA_OAUTH}/authorize?${params}`, 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenRes = await fetch(`${STRAVA_OAUTH}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });
      const data = await tokenRes.json();
      if (!data.refresh_token) {
        return new Response(`OAuth failed: ${JSON.stringify(data)}`, { status: 500 });
      }
      await env.RAGBRAI_KV.put("refresh_token", data.refresh_token);
      await refreshStats(env);
      return new Response("Connected to Strava. You can close this tab.", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (url.pathname === "/stats") {
      const cached = await env.RAGBRAI_KV.get("stats", "json");
      return new Response(JSON.stringify(cached || { total_miles: 0, updated_at: null }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // Traccar/OsmAnd-style check-ins put coords in the query string (some
    // client versions GET rather than POST), so route on params too.
    if (url.pathname === "/location" && (request.method === "POST" || url.searchParams.has("lat"))) {
      return postLocation(request, url, env, cors);
    }

    if (url.pathname === "/location") {
      const latest = await env.RAGBRAI_KV.get("location:latest", "json");
      const trail = latest
        ? await env.RAGBRAI_KV.get(`track:${chicagoDate(latest.ts)}`, "json")
        : null;
      return new Response(JSON.stringify({ latest: latest || null, trail: trail || [] }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    if (url.pathname === "/photos") {
      return getPhotos(env, cors);
    }

    if (url.pathname === "/cheers" && request.method === "POST") {
      return postCheer(request, env, cors);
    }

    if (url.pathname === "/cheers" && request.method === "DELETE") {
      return deleteCheer(request, url, env, cors);
    }

    if (url.pathname === "/cheers") {
      const cheers = await env.RAGBRAI_KV.get("cheers", "json");
      return new Response(JSON.stringify({ cheers: cheers || [] }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event, env) {
    await refreshStats(env);
  },
};

async function refreshStats(env) {
  const refresh_token = await env.RAGBRAI_KV.get("refresh_token");
  if (!refresh_token) return;

  const tokenRes = await fetch(`${STRAVA_OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token,
    }),
  });
  const tokens = await tokenRes.json();
  if (tokens.refresh_token && tokens.refresh_token !== refresh_token) {
    await env.RAGBRAI_KV.put("refresh_token", tokens.refresh_token);
  }
  if (!tokens.access_token) return;

  const activitiesRes = await fetch(
    `${STRAVA_API}/clubs/${env.STRAVA_CLUB_ID}/activities?per_page=200`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const activities = await activitiesRes.json();
  if (!Array.isArray(activities)) return;

  // Strava's club-activities feed is a ROLLING WINDOW of only the most recent
  // activities — not the club's cumulative history — and its entries carry no
  // activity id or timestamp. Summing the window each run makes the total shrink
  // as older rides age out. So instead we accumulate: keep a persisted running
  // total plus a set of already-counted activity signatures, and only add rides
  // we haven't seen before. Signature = the only distinguishing fields the feed
  // exposes (athlete name + distance + moving time), so a rare exact collision
  // undercounts by one ride — fine for a hype counter.
  const rides = activities.filter(a => a.type === "Ride" || a.sport_type === "Ride");
  const sig = a =>
    `${a.athlete?.firstname || ""} ${a.athlete?.lastname || ""}|${Math.round(a.distance || 0)}|${a.moving_time || 0}`;

  const acc = (await env.RAGBRAI_KV.get("stats_acc", "json"))
    || { meters: 0, count: 0, seen: [], initialized: false };
  const seen = new Set(acc.seen);

  // First run only records what's already in the window (no count) so the live
  // total starts from the baseline below and grows from genuinely new rides —
  // rides already in the window at launch are covered by the baseline.
  const firstRun = !acc.initialized;
  for (const a of rides) {
    const s = sig(a);
    if (seen.has(s)) continue;
    seen.add(s);
    if (!firstRun) { acc.meters += a.distance || 0; acc.count += 1; }
  }
  acc.initialized = true;
  // Cap the signature list so the KV value can't grow unbounded over a long
  // season; newest entries (the only ones that can reappear in the window) win.
  acc.seen = [...seen].slice(-5000);
  await env.RAGBRAI_KV.put("stats_acc", JSON.stringify(acc));

  // Miles/rides that predate this accumulator (Strava can't re-serve aged-out
  // club activities). Set in wrangler.toml; added on top of the live total and
  // adjustable anytime without disturbing the accumulator.
  const baseMiles = Number(env.STATS_BASELINE_MILES) || 0;
  const baseRides = Number(env.STATS_BASELINE_RIDES) || 0;

  await env.RAGBRAI_KV.put(
    "stats",
    JSON.stringify({
      total_miles: Math.round((baseMiles + acc.meters / METERS_PER_MILE) * 10) / 10,
      ride_count: baseRides + acc.count,
      updated_at: new Date().toISOString(),
    }),
  );
}

// Accepts {lat, lng, ts?, acc?}, an Overland batch
// ({locations: [GeoJSON Feature, ...]}), or Traccar/OsmAnd-style query params
// (?lat=&lon=&timestamp=&accuracy=). Auth: Bearer token, ?token=, or — for
// Traccar, which has no custom-header/URL-query support — the device
// identifier it always sends as ?id=.
async function postLocation(request, url, env, cors) {
  if (!env.BEACON_TOKEN) {
    return new Response(JSON.stringify({ error: "beacon not configured" }), {
      status: 503, headers: { "Content-Type": "application/json", ...cors },
    });
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : url.searchParams.get("token") || url.searchParams.get("id");
  if (token !== env.BEACON_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const points = [];
  if (url.searchParams.has("lat") && url.searchParams.has("lon")) {
    // Traccar sends epoch seconds; tolerate millis and missing.
    const n = Number(url.searchParams.get("timestamp"));
    points.push({
      lat: Number(url.searchParams.get("lat")),
      lng: Number(url.searchParams.get("lon")),
      ts: Number.isFinite(n) && n > 0
        ? new Date(n < 1e12 ? n * 1000 : n).toISOString()
        : new Date().toISOString(),
      acc: Number(url.searchParams.get("accuracy")) || undefined,
    });
    return storePoints(points, env, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (Array.isArray(body.locations)) {
    for (const f of body.locations) {
      const c = f?.geometry?.coordinates;
      if (!Array.isArray(c)) continue;
      points.push({
        lat: c[1], lng: c[0],
        ts: f.properties?.timestamp || new Date().toISOString(),
        acc: f.properties?.horizontal_accuracy,
      });
    }
  } else {
    points.push({
      lat: body.lat, lng: body.lng,
      ts: body.ts || new Date().toISOString(),
      acc: body.acc,
    });
  }

  return storePoints(points, env, cors);
}

async function storePoints(points, env, cors) {
  const valid = points.filter(p =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180,
  );
  if (valid.length === 0) {
    return new Response(JSON.stringify({ error: "no valid points" }), {
      status: 400, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const latest = valid[valid.length - 1];
  await env.RAGBRAI_KV.put("location:latest", JSON.stringify(latest));

  // Append to today's breadcrumb trail, thinned to one point per 2 min,
  // capped so a runaway tracker can't grow the value unbounded.
  const trailKey = `track:${chicagoDate(latest.ts)}`;
  const trail = (await env.RAGBRAI_KV.get(trailKey, "json")) || [];
  for (const p of valid) {
    const prev = trail[trail.length - 1];
    if (!prev || Math.abs(new Date(p.ts) - new Date(prev.ts)) >= 120 * 1000) {
      trail.push({ lat: p.lat, lng: p.lng, ts: p.ts });
    }
  }
  await env.RAGBRAI_KV.put(trailKey, JSON.stringify(trail.slice(-600)));

  // Overland expects {"result":"ok"}; harmless for everyone else.
  return new Response(JSON.stringify({ result: "ok" }), {
    headers: { "Content-Type": "application/json", ...cors },
  });
}

// Photo CDN links for the site's thumbnail strip. The Photos Library API
// can't read albums the app didn't create (Google removed the readonly scope
// in March 2025), so we scrape the public share page for lh3 URLs instead and
// cache them for an hour. If Google changes the page markup the scrape yields
// nothing — we keep serving the last good list, and the site hides the strip
// if that's empty too.
async function getPhotos(env, cors) {
  const headers = { "Content-Type": "application/json", ...cors };
  const cached = (await env.RAGBRAI_KV.get("photos", "json")) || { urls: [], fetched_at: 0 };

  if (Date.now() - cached.fetched_at >= PHOTOS_TTL_MS && env.PHOTOS_ALBUM_URL) {
    try {
      const res = await fetch(env.PHOTOS_ALBUM_URL, { redirect: "follow" });
      const html = await res.text();
      const seen = new Set();
      for (const m of html.matchAll(/https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+/g)) {
        seen.add(m[0]);
        if (seen.size >= PHOTOS_MAX) break;
      }
      if (seen.size > 0) {
        cached.urls = [...seen];
        cached.fetched_at = Date.now();
        await env.RAGBRAI_KV.put("photos", JSON.stringify(cached));
      }
    } catch {
      // keep serving the stale list
    }
  }

  return new Response(JSON.stringify({ photos: cached.urls }), { headers });
}

// Slurs only — regular swearing is on-brand for this team, so the bar is
// "hateful", not "salty". Word-exact after leetspeak folding, so no
// Scunthorpe false positives. A determined jerk can still get past this;
// that's what DELETE /cheers is for.
const CHEER_BLOCKLIST = [
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "fags",
  "kike", "kikes", "spic", "spics", "chink", "chinks", "tranny", "trannies",
  "wetback", "wetbacks", "gook", "gooks", "retard", "retards", "rape", "rapist",
];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

function isClean(text) {
  const words = text
    .toLowerCase()
    .replace(/[013457@$]/g, c => LEET[c])
    .split(/[^a-z]+/);
  return !words.some(w => CHEER_BLOCKLIST.includes(w));
}

async function postCheer(request, env, cors) {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status, headers: { "Content-Type": "application/json", ...cors },
    });

  // One cheer per IP per minute (KV's minimum TTL) keeps drive-bys polite.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `cheer-rate:${ip}`;
  if (await env.RAGBRAI_KV.get(rateKey)) {
    return json({ error: "Easy, tiger. One zinger a minute." }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const clean = v => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const name = clean(body.name).slice(0, CHEER_MAX_NAME) || "Mystery fan";
  const message = clean(body.message);
  if (!message) return json({ error: "Say something. Anything." }, 400);
  if (message.length > CHEER_MAX_MESSAGE) {
    return json({ error: `Keep it under ${CHEER_MAX_MESSAGE} characters.` }, 400);
  }
  if (!isClean(name) || !isClean(message)) {
    return json({ error: "That one's not making the wall." }, 400);
  }

  const cheer = { id: crypto.randomUUID(), name, message, ts: new Date().toISOString() };
  const cheers = (await env.RAGBRAI_KV.get("cheers", "json")) || [];
  cheers.unshift(cheer);
  await env.RAGBRAI_KV.put("cheers", JSON.stringify(cheers.slice(0, CHEER_WALL_CAP)));
  await env.RAGBRAI_KV.put(rateKey, "1", { expirationTtl: 60 });

  return json({ ok: true, cheer });
}

// Zap a cheer that slipped past the filter:
// DELETE /cheers?id=<id> with Bearer BEACON_TOKEN (or ?token=).
async function deleteCheer(request, url, env, cors) {
  const headers = { "Content-Type": "application/json", ...cors };
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("token");
  if (!env.BEACON_TOKEN || token !== env.BEACON_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  const id = url.searchParams.get("id");
  const cheers = (await env.RAGBRAI_KV.get("cheers", "json")) || [];
  const remaining = cheers.filter(c => c.id !== id);
  if (remaining.length === cheers.length) {
    return new Response(JSON.stringify({ error: "no cheer with that id" }), { status: 404, headers });
  }
  await env.RAGBRAI_KV.put("cheers", JSON.stringify(remaining));
  return new Response(JSON.stringify({ ok: true, removed: id }), { headers });
}

// Ride-day boundary is local Iowa time, not UTC.
function chicagoDate(ts) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ts ? new Date(ts) : new Date());
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
