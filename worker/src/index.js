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

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
