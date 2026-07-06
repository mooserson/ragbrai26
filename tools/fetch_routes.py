#!/usr/bin/env python3
"""Pull RAGBRAI LIII day routes from Ride with GPS and write ../route.geojson.

Source: the official RAGBRAI routes published on ragbrai.com/route/day-N/
(each day page links its Ride with GPS routes). Every day has a paved main
"Bike Route" and a "Bike Route w/Gravel"; Day 5 additionally has the Karras
Loop and the America 250 Double Loop.

The main route is the primary line on the map; gravel and the Day-5 specials
render as flip-on overlays (see app.js). Each feature is tagged with a
`variant` property so app.js can tell them apart.

Re-run whenever RAGBRAI updates a route (swap the id below and run):

    python3 tools/fetch_routes.py
"""

import json
import urllib.request
from pathlib import Path

# Day -> {variant: Ride with GPS route id}, in ride order.
#   main       : official paved "Bike Route" (the primary green line)
#   gravel     : official "Bike Route w/Gravel"
#   karras     : Day 5 Karras Loop (century option)
#   america250 : Day 5 America 250 Double Loop (250 km)
ROUTES = {
    1: {"main": 52552341, "gravel": 54177776},
    2: {"main": 52552375, "gravel": 54177810},
    3: {"main": 52552461, "gravel": 54177890},
    4: {"main": 52552995, "gravel": 54177916},
    5: {"main": 54280069, "gravel": 54177936,
        "karras": 52955653, "america250": 52955775},
    6: {"main": 52553404, "gravel": 54177948},
    7: {"main": 52553679, "gravel": 54177956},
}

# Legend / tooltip labels per variant.
VARIANT_LABEL = {
    "main": "Bike Route",
    "gravel": "Gravel option",
    "karras": "Karras Loop",
    "america250": "America 250 Double Loop",
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
    main_total = 0.0
    for day, variants in ROUTES.items():
        for variant, route_id in variants.items():
            route = fetch_route(route_id)
            pts = route["track_points"]
            coords = []
            for p in pts:
                c = [round(p["x"], 5), round(p["y"], 5)]
                if not coords or coords[-1] != c:
                    coords.append(c)
            miles = pts[-1]["d"] / METERS_PER_MILE
            if variant == "main":
                main_total += miles
            features.append({
                "type": "Feature",
                "properties": {
                    "day": day,
                    "variant": variant,
                    "label": VARIANT_LABEL.get(variant, variant),
                    "rwgps_id": route_id,
                    "name": route["name"],
                    "miles": round(miles, 1),
                },
                "geometry": {"type": "LineString", "coordinates": coords},
            })
            print(f"day {day} {variant:11s}: {miles:6.1f} mi, {len(coords):5d} pts  "
                  f"({route['name'][:48]})")

    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"main total: {main_total:.1f} mi -> {OUT.name} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
