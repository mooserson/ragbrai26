const STRAVA_OAUTH = "https://www.strava.com/oauth";
const STRAVA_API = "https://www.strava.com/api/v3";
const METERS_PER_MILE = 1609.344;

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

    if (url.pathname === "/location" && request.method === "POST") {
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

  const rideMeters = activities
    .filter(a => a.type === "Ride" || a.sport_type === "Ride")
    .reduce((sum, a) => sum + (a.distance || 0), 0);

  await env.RAGBRAI_KV.put(
    "stats",
    JSON.stringify({
      total_miles: Math.round((rideMeters / METERS_PER_MILE) * 10) / 10,
      ride_count: activities.filter(a => a.type === "Ride" || a.sport_type === "Ride").length,
      updated_at: new Date().toISOString(),
    }),
  );
}

// Accepts either {lat, lng, ts?, acc?} or an Overland batch
// ({locations: [GeoJSON Feature, ...]}). Auth: Bearer token or ?token=.
async function postLocation(request, url, env, cors) {
  if (!env.BEACON_TOKEN) {
    return new Response(JSON.stringify({ error: "beacon not configured" }), {
      status: 503, headers: { "Content-Type": "application/json", ...cors },
    });
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("token");
  if (token !== env.BEACON_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const points = [];
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
