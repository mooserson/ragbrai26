#!/usr/bin/env python3
"""Pull RAGBRAI LIII day routes from Ride with GPS and write ../route.geojson.

Source: official RAGBRAI org event — ridewithgps.com/events/400784
Route IDs come from the event JSON: curl https://ridewithgps.com/events/400784.json
Re-run whenever RAGBRAI publishes updated tracks:

    python3 tools/fetch_routes.py
"""

import json
import urllib.request
from pathlib import Path

# Day -> Ride with GPS route id, in ride order. Main (paved) routes only —
# gravel variants, Karras Loop, and America 250K (Day 5) excluded on purpose.
# Source: ridewithgps.com/events/400784 (official RAGBRAI LIII event, user_id 5640870).
ROUTE_IDS = {
    1: 52552341,  # Onawa -> Harlan
    2: 52552375,  # Harlan -> Guthrie Center
    3: 52552461,  # Guthrie Center -> Boone
    4: 52552995,  # Boone -> Marshalltown
    5: 54280069,  # Marshalltown -> Independence
    6: 52553404,  # Independence -> Dyersville
    7: 52553679,  # Dyersville -> Dubuque
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
