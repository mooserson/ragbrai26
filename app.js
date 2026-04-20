const route = window.RAGBRAI_ROUTE;
const meta = window.RAGBRAI_META;

const startDate = new Date(`${meta.start_date}T00:00:00`);
const today = new Date();
today.setHours(0, 0, 0, 0);
const msPerDay = 24 * 60 * 60 * 1000;
const daysToStart = Math.ceil((startDate - today) / msPerDay);
const RIDE_DAYS = 8;
const daysCompleted = daysToStart >= 0 ? 0 : Math.min(RIDE_DAYS, -daysToStart);
const progress = daysCompleted / RIDE_DAYS;

const milesDone = (meta.total_miles * progress).toFixed(1);
const climbDone = Math.round(meta.total_climb_ft * progress);
document.getElementById("stat-miles").textContent =
  `${milesDone}/${meta.total_miles.toLocaleString()}`;
document.getElementById("stat-climb").textContent =
  `${climbDone.toLocaleString()}/${meta.total_climb_ft.toLocaleString()}`;
document.getElementById("stat-days").textContent = `${daysCompleted}/${RIDE_DAYS}`;

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

function haversineMiles(a, b) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const cumulativeMiles = [];
let _running = 0;
route.forEach((p, i) => {
  if (i > 0) _running += haversineMiles(route[i - 1], p);
  cumulativeMiles[i] = _running;
});

const waypointMarkers = [];
route.forEach((p, idx) => {
  const s = styleByKind[p.kind] || styleByKind.pass;
  const m = L.circleMarker([p.lat, p.lng], {
    color: s.color, fillColor: s.fill, fillOpacity: 1, weight: 2, radius: s.radius,
  })
    .addTo(map)
    .bindTooltip(
      `<strong>${p.name}</strong><br>Day ${p.day} · ${p.kind}<br>Mile ${cumulativeMiles[idx].toFixed(1)}`,
      { direction: "top", offset: [0, -6], sticky: false, opacity: 0.95 },
    );
  m.on("mouseover", () => syncFromMap(idx));
  m.on("mouseout", () => clearSync());
  waypointMarkers.push(m);
});

const hoverMarker = L.circleMarker([42, -94], {
  radius: 12, color: "#ffd54a", fillColor: "#ffd54a",
  fillOpacity: 0, opacity: 0, weight: 3, interactive: false,
}).addTo(map);

let lastHoverIdx = null;
function showHoverAt(idx) {
  const p = route[idx];
  if (!p) return;
  hoverMarker.setLatLng([p.lat, p.lng]);
  hoverMarker.setStyle({ opacity: 1, fillOpacity: 0 });
  hoverMarker.bringToFront();
  if (lastHoverIdx !== null && lastHoverIdx !== idx) {
    waypointMarkers[lastHoverIdx]?.closeTooltip();
  }
  waypointMarkers[idx]?.openTooltip();
  lastHoverIdx = idx;
}
function hideHover() {
  hoverMarker.setStyle({ opacity: 0, fillOpacity: 0 });
  if (lastHoverIdx !== null) {
    waypointMarkers[lastHoverIdx]?.closeTooltip();
    lastHoverIdx = null;
  }
}

const dayList = document.getElementById("day-list");
const overnights = route.filter(p => p.kind === "overnight");
function rideDateLabel(dayIndex) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex - 1);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
overnights.forEach((p, i) => {
  if (i === 0) return;
  const prev = overnights[i - 1];
  const li = document.createElement("li");
  const done = i <= daysCompleted;
  if (done) li.classList.add("done");
  li.innerHTML = `<input type="checkbox" disabled${done ? " checked" : ""}> <strong>${rideDateLabel(i)}</strong> · ${prev.name} → ${p.name}`;
  dayList.appendChild(li);
});

const statsApi = window.RAGBRAI_CONFIG && window.RAGBRAI_CONFIG.STATS_API;
const milesEl = document.getElementById("training-miles");
const metaEl = document.getElementById("training-meta");
function rideLabel(n) {
  return n === 1 ? "1 ride" : `${(n ?? 0).toLocaleString()} rides`;
}
function animateCount(el, to, durationMs = 1100) {
  const start = performance.now();
  const dot = el.querySelector(".live-dot");
  function tick(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = to * eased;
    el.firstChild.nodeValue = (Math.round(value * 10) / 10).toLocaleString();
    if (t < 1) requestAnimationFrame(tick);
  }
  if (dot) el.firstChild.nodeValue = "0";
  requestAnimationFrame(tick);
}
if (statsApi) {
  fetch(`${statsApi}/stats`)
    .then(r => r.json())
    .then(s => {
      animateCount(milesEl, s.total_miles ?? 0);
      metaEl.textContent = `training miles | ${rideLabel(s.ride_count)}`;
    })
    .catch(() => {
      milesEl.firstChild.nodeValue = "—";
      metaEl.textContent = "training miles";
    });
} else {
  milesEl.firstChild.nodeValue = "—";
  metaEl.textContent = "training miles";
}

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

const canvas = document.getElementById("elevation-chart");
const ctx = canvas.getContext("2d");
const elevationChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: route.map(p => p.name),
    datasets: [{
      label: "Elevation",
      data: route.map(p => p.elevation_ft),
      borderColor: "#1f8f3b",
      backgroundColor: "rgba(31, 143, 59, 0.15)",
      fill: true,
      tension: 0.35,
      pointRadius: route.map(p => (styleByKind[p.kind] || styleByKind.pass).radius * 0.6),
      pointHoverRadius: 8,
      pointBackgroundColor: route.map(p => (styleByKind[p.kind] || styleByKind.pass).fill),
      pointBorderColor: route.map(p => (styleByKind[p.kind] || styleByKind.pass).color),
      pointBorderWidth: 2,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false, axis: "x" },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => route[items[0].dataIndex].name,
          label: ctx => `${ctx.parsed.y.toLocaleString()} ft · Mile ${cumulativeMiles[ctx.dataIndex].toFixed(1)} · Day ${route[ctx.dataIndex].day}`,
        },
      },
    },
    onHover: (_event, elements) => {
      if (elements.length > 0) {
        showHoverAt(elements[0].index);
      } else {
        hideHover();
      }
    },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 70, minRotation: 60, font: { size: 10 } } },
      y: { title: { display: true, text: "Feet" } },
    },
  },
});
canvas.addEventListener("mouseleave", hideHover);

function syncFromMap(idx) {
  showHoverAt(idx);
  const meta = elevationChart.getDatasetMeta(0);
  const pt = meta.data[idx];
  const pos = pt ? { x: pt.x, y: pt.y } : { x: 0, y: 0 };
  elevationChart.setActiveElements([{ datasetIndex: 0, index: idx }]);
  elevationChart.tooltip.setActiveElements([{ datasetIndex: 0, index: idx }], pos);
  elevationChart.update();
}
function clearSync() {
  hideHover();
  elevationChart.setActiveElements([]);
  elevationChart.tooltip.setActiveElements([], { x: 0, y: 0 });
  elevationChart.update();
}
