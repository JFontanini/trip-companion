// One-time extraction of the v0 planner's content into the trip content pack.
// From here on, trips/guam/*.json is canonical; the v0 page is a frozen reference build.
import fs from "node:fs";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.split("// ==LOGIC==")[1].split("// ==END LOGIC==")[0];
const pack = new Function(code + "; return {S, STOPS, RESTAURANTS, NODES, SHORT, L, HOME, PROFILES, MOODS, FED_HOLIDAYS:[...FED_HOLIDAYS], CATS};")();
const out = new URL("../trips/guam/", import.meta.url);
const w = (name, data) => fs.writeFileSync(new URL(name, out), JSON.stringify(data, null, 2) + "\n");
w("sources.json", Object.fromEntries(Object.entries(pack.S).map(([k, v]) => [k, { title: v.t, publisher: v.p, url: v.u, claimType: v.c, accessedAt: "2026-10-05" }])));
w("stops.json", pack.STOPS.map(s => ({ ...s, imageUrls: [], imageAttributions: [] })));
w("restaurants.json", pack.RESTAURANTS);
w("road-model.json", { loopMinutes: pack.L, home: pack.HOME, nodes: pack.NODES, chords: [pack.SHORT],
  note: "Planning estimates in minutes around the island loop, clockwise from Asan, plus the Route 4 cross-island chord. Not live traffic." });
w("profiles.json", { profiles: pack.PROFILES, dinnerMoods: pack.MOODS });
w("calendar.json", { federalHolidays: pack.FED_HOLIDAYS, note: "Dates the Guam National Wildlife Refuge is closed in addition to Mondays and Tuesdays." });
w("categories.json", pack.CATS);
console.log("stops", pack.STOPS.length, "restaurants", pack.RESTAURANTS.length, "sources", Object.keys(pack.S).length);
