const route = window.RAGBRAI_ROUTE;
const meta = window.RAGBRAI_META;

document.getElementById("stat-miles").textContent = meta.total_miles.toLocaleString();
document.getElementById("stat-climb").textContent = meta.total_climb_ft.toLocaleString();

const map = L.map("map", { scrollWheelZoom: false });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
}).addTo(map);

const latlngs = route.map(p => [p.lat, p.lng]);
const polyline = L.polyline(latlngs, { color: "#1f8f3b", weight: 4, opacity: 0.85 }).addTo(map);
map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

const styleByKind = {
  overnight: { color: "#0a3d62", fill: "#3aa1ff", radius: 8 },
  meeting:   { color: "#7a4a00", fill: "#ffb84d", radius: 6 },
  pass:      { color: "#4a4a4a", fill: "#cfcfcf", radius: 4 },
  special:   { color: "#7a0a4a", fill: "#ff5ec4", radius: 7 },
};

route.forEach(p => {
  const s = styleByKind[p.kind] || styleByKind.pass;
  L.circleMarker([p.lat, p.lng], {
    color: s.color, fillColor: s.fill, fillOpacity: 1, weight: 2, radius: s.radius,
  })
    .addTo(map)
    .bindPopup(`<strong>${p.name}</strong><br>Day ${p.day} · ${p.kind}<br>${p.elevation_ft} ft`);
});

const dayList = document.getElementById("day-list");
const overnights = route.filter(p => p.kind === "overnight");
overnights.forEach((p, i) => {
  if (i === 0) return;
  const prev = overnights[i - 1];
  const li = document.createElement("li");
  li.innerHTML = `<strong>Day ${i}</strong> · ${prev.name} → ${p.name}`;
  dayList.appendChild(li);
});

const statsApi = window.RAGBRAI_CONFIG && window.RAGBRAI_CONFIG.STATS_API;
const milesEl = document.getElementById("training-miles");
const metaEl = document.getElementById("training-meta");
if (statsApi) {
  fetch(`${statsApi}/stats`)
    .then(r => r.json())
    .then(s => {
      milesEl.textContent = (s.total_miles ?? 0).toLocaleString();
      metaEl.textContent = "training miles";
      if (s.updated_at) {
        metaEl.title = `${s.ride_count ?? 0} rides · updated ${new Date(s.updated_at).toLocaleString()}`;
      }
    })
    .catch(() => {
      milesEl.textContent = "—";
      metaEl.textContent = "training miles";
      metaEl.title = "Stats unavailable.";
    });
} else {
  milesEl.textContent = "—";
  metaEl.textContent = "training miles";
}

const startDate = new Date(`${meta.start_date}T00:00:00`);
const today = new Date();
today.setHours(0, 0, 0, 0);
const msPerDay = 24 * 60 * 60 * 1000;
const daysToStart = Math.ceil((startDate - today) / msPerDay);
const countdownEl = document.getElementById("countdown-days");
const countdownMetaEl = document.getElementById("countdown-meta");
if (daysToStart > 0) {
  countdownEl.textContent = daysToStart.toLocaleString();
  countdownMetaEl.textContent = "days to Onawa";
} else if (daysToStart === 0) {
  countdownEl.textContent = "0";
  countdownMetaEl.textContent = "today's the day!";
} else {
  const dayOfRide = Math.min(8, 1 - daysToStart);
  countdownEl.textContent = dayOfRide;
  countdownMetaEl.textContent = "day of ride";
}

const ctx = document.getElementById("elevation-chart").getContext("2d");
new Chart(ctx, {
  type: "line",
  data: {
    labels: route.map(p => p.name),
    datasets: [{
      label: "Elevation (ft)",
      data: route.map(p => p.elevation_ft),
      borderColor: "#1f8f3b",
      backgroundColor: "rgba(31, 143, 59, 0.15)",
      fill: true,
      tension: 0.35,
      pointRadius: route.map(p => p.kind === "overnight" ? 5 : 2),
      pointBackgroundColor: route.map(p => p.kind === "overnight" ? "#0a3d62" : "#1f8f3b"),
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 70, minRotation: 60, font: { size: 10 } } },
      y: { title: { display: true, text: "Feet" } },
    },
  },
});
