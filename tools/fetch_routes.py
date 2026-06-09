#!/usr/bin/env python3
"""Pull RAGBRAI LIII day routes from Ride with GPS and write ../route.geojson.

Source: community-maintained draft event (ridewithgps.com/events/455076,
"98% accurate", updated as RAGBRAI releases info). When the official RAGBRAI
org (ridewithgps.com/organizations/10298-ragbrai) publishes LIII routes,
swap the IDs below and re-run:

    python3 tools/fetch_routes.py
"""

import json
import urllib.request
from pathlib import Path

# Day -> Ride with GPS route id, in ride order. Main routes only
# (Karras Loop / America 250K Day 5 variants left out on purpose).
ROUTE_IDS = {
    1: 53825182,  # Onawa -> Harlan
    2: 53825289,  # Harlan -> Guthrie Center
    3: 53825299,  # Guthrie Center -> Boone
    4: 53825305,  # Boone -> Marshalltown
    5: 53825311,  # Marshalltown -> Independence
    6: 53825317,  # Independence -> Dyersville
    7: 53825325,  # Dyersville -> Dubuque
}

OUT = Path(__file__).resolve().parent.parent / "route.geojson"
METERS_PER_MILE = 1609.344


def fetch_route(route_id):
    req = urllib.request.Request(
        f"https://ridewithgps.com/routes/{route_id}.json",
        headers={"User-Agent": "ragbrai26-follow-along (pmcathey@gmail.com)"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.load(res)
        return data.get("route", data)


def main():
    features = []
    total_miles = 0.0
    for day, route_id in ROUTE_IDS.items():
        route = fetch_route(route_id)
        pts = route["track_points"]
        coords = []
        for p in pts:
            c = [round(p["x"], 5), round(p["y"], 5)]
            if not coords or coords[-1] != c:
                coords.append(c)
        miles = pts[-1]["d"] / METERS_PER_MILE
        total_miles += miles
        features.append({
            "type": "Feature",
            "properties": {
                "day": day,
                "rwgps_id": route_id,
                "name": route["name"],
                "miles": round(miles, 1),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
        print(f"day {day}: {miles:6.1f} mi, {len(coords):5d} pts  ({route['name'][:60]})")

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"total: {total_miles:.1f} mi -> {OUT.name} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
