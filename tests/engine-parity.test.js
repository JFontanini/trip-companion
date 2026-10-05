// The restyle must not change how the planner works. This runs the frozen v0 engine
// (v0.html, ==LOGIC== block, with its inline data) and the module engine (trip content pack)
// over a grid of states and compares every timing decision.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPack } from "./helpers.js";
import { createEngine } from "../src/engine/loop-drive.js";

const html = fs.readFileSync(new URL("../v0.html", import.meta.url), "utf8");
const code = html.split("// ==LOGIC==")[1].split("// ==END LOGIC==")[0];
const v0 = new Function(code + "; return { buildPlan, rankDinner };")();
const engine = createEngine(loadPack("guam"));

const base = { profile: "full", dir: "cw", date: "2026-10-10", start: "08:00", overrides: {}, dinner: "marina", mood: "grilled",
  cond: { rain: false, water: false, surf: false }, dinnerForced: false,
  trip: { on: false, status: {}, doneAt: {}, extra: {}, last: null, lunchDone: false, dinnerDone: false } };

function summary(p) {
  const item = i => ({ id: i.s.id, meal: !!i.s._meal, arrive: Math.round(i.arrive), depart: Math.round(i.depart), dwell: i.dwell, leg: i.leg.min, legType: i.leg.type,
    flags: (i.flags || []).map(f => f.lvl) });
  return {
    items: p.items.map(item), dinner: p.dinnerItem ? { ...item(p.dinnerItem), spare: p.dinnerItem.spare } : null,
    dinnerId: p.dinnerId, homeT: Math.round(p.homeT), drive: p.drive, t0: p.t0, lunch: p.lunch && p.lunch.id,
    rit: p.rit.open, alerts: p.alerts.map(a => `${a.id}:${a.lvl}`), lateTL: p.lateTL
  };
}

const cases = [];
for (const profile of ["express", "full", "explorer"])
  for (const dir of ["cw", "ccw"])
    for (const date of ["2026-10-10", "2026-10-12", "2026-10-13", "2026-10-14"])
      for (const start of ["06:30", "08:00", "10:30"])
        cases.push({ ...base, profile, dir, date, start });
cases.push({ ...base, cond: { rain: true, water: true, surf: true } });
cases.push({ ...base, cond: { rain: true, rainFromLive: true, water: false, surf: true, surfFromLive: true } });
cases.push({ ...base, overrides: { "two-lovers": false, ritidian: false, "talofofo-falls": true, fisheye: true } });
cases.push({ ...base, dinnerForced: true, dinner: "crab" });
cases.push({ ...base, dinnerForced: true, dinner: "none" });
cases.push({ ...base, dinnerForced: true, dinner: "marina", dir: "ccw" });
cases.push({ ...base, cond: { rain: false, water: false, surf: false, ritClosedLive: "2026-10-10" } });

test("module engine matches v0 on every plan in the grid", () => {
  for (const st of cases) {
    const a = summary(v0.buildPlan(structuredClone(st), null));
    const b = summary(engine.buildPlan(structuredClone(st), null));
    assert.deepEqual(b, a, JSON.stringify({ profile: st.profile, dir: st.dir, date: st.date, start: st.start }));
  }
});

test("module engine matches v0 in day-of mode", () => {
  const trips = [
    { on: true, status: { "two-lovers": "done" }, doneAt: { "two-lovers": 520 }, extra: {}, last: "two-lovers", lunchDone: false, dinnerDone: false },
    { on: true, status: { "two-lovers": "done", ritidian: "done", "inalahan-village": "done" }, doneAt: {}, extra: { "inalahan-pools": 15 }, last: "inalahan-village", lunchDone: true, dinnerDone: false },
    { on: true, status: {}, doneAt: {}, extra: {}, last: null, lunchDone: false, dinnerDone: false }
  ];
  for (const trip of trips) for (const now of [480, 780, 900, 1000]) {
    const st = { ...base, trip };
    assert.deepEqual(summary(engine.buildPlan(structuredClone(st), now)), summary(v0.buildPlan(structuredClone(st), now)));
  }
});

test("dinner ranking matches v0 for every mood", () => {
  for (const mood of ["grilled", "casual", "boil", "refined", "spicy", "quick"]) {
    const st = { ...base, mood };
    const a = v0.rankDinner(st, v0.buildPlan(structuredClone(st), null)).map(x => [x.r.id, x.toR, x.toHome, x.extra]);
    const b = engine.rankDinner(st, engine.buildPlan(structuredClone(st), null)).map(x => [x.r.id, x.toR, x.toHome, x.extra]);
    assert.deepEqual(b, a, mood);
  }
});
