// Placeholder waypoints for RAGBRAI LIII (July 18-25, 2026).
// Replace with real GPX from ragbrai.com when published.
// kind: "overnight" | "meeting" | "pass" | "special"
// elevation_ft is approximate town elevation, refined when GPX lands.

window.RAGBRAI_ROUTE = [
  { name: "Onawa",          day: 0, kind: "overnight", lat: 42.0269, lng: -96.0975, elevation_ft: 1060 },
  { name: "Turin",           day: 1, kind: "pass",     lat: 41.9636, lng: -95.9694, elevation_ft: 1140 },
  { name: "Soldier",         day: 1, kind: "pass",     lat: 41.9803, lng: -95.7783, elevation_ft: 1280 },
  { name: "Dunlap",          day: 1, kind: "meeting",  lat: 41.8703, lng: -95.6017, elevation_ft: 1180 },
  { name: "Earling",         day: 1, kind: "pass",     lat: 41.7800, lng: -95.4264, elevation_ft: 1310 },
  { name: "Westphalia",      day: 1, kind: "pass",     lat: 41.7203, lng: -95.4080, elevation_ft: 1320 },
  { name: "Harlan",          day: 1, kind: "overnight", lat: 41.6536, lng: -95.3247, elevation_ft: 1280 },
  { name: "Elk Horn",        day: 2, kind: "pass",     lat: 41.5928, lng: -95.0581, elevation_ft: 1320 },
  { name: "Exira",           day: 2, kind: "meeting",  lat: 41.5867, lng: -94.8836, elevation_ft: 1240 },
  { name: "Guthrie Center",  day: 2, kind: "overnight", lat: 41.6786, lng: -94.5005, elevation_ft: 1100 },
  { name: "Panora",          day: 3, kind: "pass",     lat: 41.6917, lng: -94.3650, elevation_ft: 1030 },
  { name: "Yale",            day: 3, kind: "pass",     lat: 41.7775, lng: -94.3536, elevation_ft: 1080 },
  { name: "Perry",           day: 3, kind: "meeting",  lat: 41.8378, lng: -94.1075, elevation_ft: 1010 },
  { name: "Ogden",           day: 3, kind: "pass",     lat: 42.0386, lng: -94.0292, elevation_ft: 1100 },
  { name: "Boone",           day: 3, kind: "overnight", lat: 42.0594, lng: -93.8803, elevation_ft: 1115 },
  { name: "Gilbert",         day: 4, kind: "pass",     lat: 42.1056, lng: -93.6469, elevation_ft: 1010 },
  { name: "Nevada",          day: 4, kind: "meeting",  lat: 42.0228, lng: -93.4525, elevation_ft: 951 },
  { name: "Colo",            day: 4, kind: "pass",     lat: 42.0264, lng: -93.3133, elevation_ft: 1040 },
  { name: "State Center",    day: 4, kind: "pass",     lat: 42.0136, lng: -93.1647, elevation_ft: 1010 },
  { name: "Marshalltown",    day: 4, kind: "overnight", lat: 42.0494, lng: -92.9080, elevation_ft: 899 },
  { name: "Green Mountain",  day: 5, kind: "pass",     lat: 42.1350, lng: -92.7592, elevation_ft: 990 },
  { name: "Beaman",          day: 5, kind: "pass",     lat: 42.2225, lng: -92.8169, elevation_ft: 1030 },
  { name: "Grundy Center",   day: 5, kind: "meeting",  lat: 42.3636, lng: -92.7686, elevation_ft: 970 },
  { name: "Morrison",        day: 5, kind: "pass",     lat: 42.3661, lng: -92.6664, elevation_ft: 950 },
  { name: "Reinbeck",        day: 5, kind: "pass",     lat: 42.3258, lng: -92.5972, elevation_ft: 935 },
  { name: "Washburn",        day: 5, kind: "pass",     lat: 42.4156, lng: -92.3017, elevation_ft: 870 },
  { name: "Gilbertville",    day: 5, kind: "pass",     lat: 42.4072, lng: -92.2178, elevation_ft: 870 },
  { name: "Jesup",           day: 5, kind: "pass",     lat: 42.4747, lng: -92.0658, elevation_ft: 950 },
  { name: "Independence",    day: 5, kind: "overnight", lat: 42.4708, lng: -91.8910, elevation_ft: 919 },
  { name: "Winthrop",        day: 6, kind: "pass",     lat: 42.4744, lng: -91.7322, elevation_ft: 990 },
  { name: "Manchester",      day: 6, kind: "pass",     lat: 42.4844, lng: -91.4554, elevation_ft: 935 },
  { name: "Earlville",       day: 6, kind: "pass",     lat: 42.4853, lng: -91.2701, elevation_ft: 1020 },
  { name: "Dyersville",      day: 6, kind: "overnight", lat: 42.4844, lng: -91.1232, elevation_ft: 1004 },
  { name: "Field of Dreams", day: 7, kind: "special",  lat: 42.4969, lng: -91.0556, elevation_ft: 1020 },
  { name: "Farley",          day: 7, kind: "pass",     lat: 42.4422, lng: -90.9929, elevation_ft: 1130 },
  { name: "Epworth",         day: 7, kind: "pass",     lat: 42.4456, lng: -90.9277, elevation_ft: 1080 },
  { name: "Centralia",       day: 7, kind: "pass",     lat: 42.5147, lng: -90.7791, elevation_ft: 1100 },
  { name: "Dubuque",         day: 7, kind: "overnight", lat: 42.5006, lng: -90.6646, elevation_ft: 656 },
];

// Official per-day mileage from ragbrai.com/route/day-N/
window.RAGBRAI_META = {
  edition: "LIII",
  start_date: "2026-07-19", // first ride day (Sunday); Saturday 07/18 is arrival in Onawa
  end_date: "2026-07-25",
  total_miles: 391.4,
  total_climb_ft: 16027,
  start: "Onawa",
  end: "Dubuque",
  days: [
    { day: 1, from: "Onawa",          to: "Harlan",         miles: 59.3, climb_ft: 3506 },
    { day: 2, from: "Harlan",         to: "Guthrie Center", miles: 56.3, climb_ft: 3590 },
    { day: 3, from: "Guthrie Center", to: "Boone",          miles: 60.6, climb_ft: 1583 },
    { day: 4, from: "Boone",          to: "Marshalltown",   miles: 67.9, climb_ft: 1819 },
    { day: 5, from: "Marshalltown",   to: "Independence",   miles: 86.2, climb_ft: 2487 },
    { day: 6, from: "Independence",   to: "Dyersville",     miles: 42.5, climb_ft: 1407 },
    { day: 7, from: "Dyersville",     to: "Dubuque",        miles: 34.1, climb_ft: 1699 },
  ],
};
