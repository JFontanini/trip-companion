// Plan derivation for the views: the engine's plan plus numbering, planned-versus-now times,
// alert severity words and Cause rows, and the single-stop trim suggestion (change list 7 to 9).
import { ENGINE, PACK, ACCESSED } from "../trip.js";
import { fmt, fmtS, dur, parseHM } from "../engine/loop-drive.js";
import { st } from "./state.js";
import { guamNow, num2, age } from "./util.js";
import { live } from "./live.js";

export const { STOPS, RESTAURANTS, HOME } = ENGINE;
export const byId = id => id === "home" ? HOME : (STOPS.find(s => s.id === id) || RESTAURANTS.find(r => r.id === id));
export const nameOf = s => s.short_name || s.name;

export const CAT = {
  viewpoint: { label: "Viewpoint", short: "view", tok: "view", shape: "c" },
  nature: { label: "Nature", short: "nature", tok: "nature", shape: "c" },
  swimming: { label: "Swimming", short: "swim", tok: "swim", shape: "c" },
  "chamoru-history": { label: "Ancient CHamoru", short: "ancient CHamoru", tok: "ancient", shape: "s" },
  "spanish-history": { label: "Spanish era", short: "Spanish era", tok: "spanish", shape: "s" },
  "wwii-history": { label: "WWII", short: "WWII", tok: "wwii", shape: "s" },
  seafood: { label: "Food", short: "food", tok: "food", shape: "d" }
};
export const HISTORY_CATS = ["chamoru-history", "spanish-history", "wwii-history"];
export const primaryCat = s => (s.cats || ["nature"])[0];
export const catOf = s => s.kind === "meal" || s._meal ? CAT.seafood : (CAT[primaryCat(s)] || CAT.nature);
export const catVar = s => `var(--gcc-cat-${catOf(s).tok})`;
export const shapeHtml = (s, extra = "") => `<span class="shape shape-${catOf(s).shape} ${extra}" style="--c:${catVar(s)}" aria-hidden="true"></span>`;

export let PLAN = null;
export let PLANNED = null;     // same state with day-of off: what the plan said before the day started
export const stopNumber = {};

function nowArg() { return st.trip.on ? (st.date === guamNow().date ? guamNow().min : parseHM(st.start)) : null; }

export function computePlan() {
  PLAN = ENGINE.buildPlan(st, nowArg());
  PLANNED = st.trip.on ? ENGINE.buildPlan({ ...st, trip: { on: false, status: {}, doneAt: {}, extra: {} } }, null) : PLAN;
  for (const k of Object.keys(stopNumber)) delete stopNumber[k];
  // Numbers follow the whole day's order, so a stop keeps its number after earlier ones are done.
  let n = 0;
  for (const it of PLANNED.items) if (!it.s._meal) stopNumber[it.s.id] = ++n;
  for (const id of doneIds()) if (!stopNumber[id]) stopNumber[id] = ++n;
  for (const it of PLAN.items) if (!it.s._meal && !stopNumber[it.s.id]) stopNumber[it.s.id] = ++n;
  return PLAN;
}

export const numOf = id => stopNumber[id] ? num2(stopNumber[id]) : "";
export function doneIds() { return Object.keys(st.trip.status || {}).filter(k => st.trip.status[k] === "done"); }
export function plannedArrival(id) { const it = PLANNED.items.find(i => i.s.id === id); return it ? it.arrive : null; }
export const stopCount = () => PLAN.items.filter(i => !i.s._meal).length + (st.trip.on ? doneIds().length : 0);

// Severity as a word (change 8). Plan changed = the engine removed, trimmed or moved something.
const PLAN_CHANGED = new Set(["rit-closed", "dinner-moved", "water"]);
export function severity(a) {
  if (PLAN_CHANGED.has(a.id)) return { word: "Plan changed", cls: "changed" };
  if (a.lvl === "warn" || a.lvl === "crit") return { word: "Advisory", cls: "advisory" };
  return { word: "Note", cls: "note" };
}

function liveAge() { const c = live.conditions; return c && c.fetchedAt ? age(Math.max(0, Math.round((Date.now() - c.fetchedAt) / 6e4))) : ""; }
const ft = m => `${Math.round(m * 3.28084)} ft`;

// Cause row: what set this alert off, where that came from, and how old it is (change 7)
export function causeOf(a) {
  const c = live.conditions || {}, cond = st.cond;
  switch (a.id) {
    case "rain":
      if (cond.rainFromLive) return { what: c.rain && c.rain.afternoonMaxPct != null ? `Rain ${c.rain.afternoonMaxPct}% this afternoon` : "Rain in the forecast", src: "Open-Meteo forecast", age: liveAge() };
      return { what: "you turned on Rain" };
    case "surf": {
      if (cond.surfFromLive) { const w = (c.waves || []).filter(x => x.maxM != null).sort((x, y) => y.maxM - x.maxM)[0]; return { what: w ? `Waves to ${ft(w.maxM)} at ${w.label}` : "Rough surf in the forecast", src: "Open-Meteo marine forecast", age: liveAge() }; }
      return { what: "you turned on High surf" };
    }
    case "water": return { what: "you turned on Water advisory", src: "check the Guam EPA beach report" };
    case "rit-closed": {
      const r = PLAN.rit;
      if (r.code === "holiday") return { what: "Federal holiday", src: `USFWS refuge hours, checked ${ACCESSED}` };
      if (r.code === "weekday") return { what: "Closed Mondays and Tuesdays", src: `USFWS refuge hours, checked ${ACCESSED}` };
      if (r.code === "surf") return cond.surfFromLive ? { what: "Rough surf in the forecast", src: "Open-Meteo marine forecast", age: liveAge() } : { what: "you turned on High surf" };
      if (r.code === "fws") { const rt = live.ritidian || {}; return { what: "Refuge listed as closed", src: "USFWS status page", age: rt.fetchedAt ? age(Math.round((Date.now() - toMs(rt.fetchedAt)) / 6e4)) : "" }; }
      return null;
    }
    case "rit-late": { const it = PLAN.items.find(i => i.s.id === "ritidian"); return it ? { what: `Arrival ${fmt(it.arrive)}, gate closes 4:00 p.m.`, src: `USFWS refuge hours, checked ${ACCESSED}` } : null; }
    case "dark": return { what: `Sunset ${fmt(PLAN.sun.sunset)}`, src: c.sunset ? "Open-Meteo forecast" : "calculated for Guam" };
    case "long": return { what: `Projected return ${fmt(PLAN.homeT)}`, src: "this plan" };
    case "dinner-moved": case "same-place": { const it = PLAN.items.find(i => i.s._meal); return it ? { what: `Lunch lands at ${it.s.name} at ${fmt(it.arrive)}`, src: "this plan" } : null; }
    case "wed": return { what: "Wednesday market night", src: "The Guam Guide" };
    default: return null;
  }
}
const toMs = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (typeof v === "number" ? v : Date.parse(v));

// Change 9: name the one stop whose trim brings the late daylight stops back before sunset.
let trimMemo = { plan: null, value: null };
export function trimSuggestion() {
  if (trimMemo.plan === PLAN) return trimMemo.value;
  trimMemo = { plan: PLAN, value: computeTrim() };
  return trimMemo.value;
}
function computeTrim() {
  const dark = PLAN.alerts.find(a => a.id === "dark");
  if (!dark) return null;
  const lateIds = () => PLAN.items.filter(i => !i.s._meal && i.arrive > PLAN.sun.sunset - 10 && i.s.cats.some(c => c === "viewpoint" || c === "swimming")).map(i => i.s.id);
  const late = lateIds();
  const rank = { optional: 0, recommended: 1, essential: 2 };
  const cands = PLAN.items.filter(i => !i.s._meal && i.s.priority !== "essential" && !late.includes(i.s.id))
    .sort((a, b) => rank[a.s.priority] - rank[b.s.priority] || a.dwell - b.dwell);
  for (const c of cands) {
    const trial = ENGINE.buildPlan({ ...st, overrides: { ...st.overrides, [c.s.id]: false } }, nowArg());
    if (!trial.alerts.some(a => a.id === "dark")) {
      const fixed = trial.items.find(i => i.s.id === late[late.length - 1]);
      return { stop: c.s, num: numOf(c.s.id), fixed: fixed && fixed.s, fixedAt: fixed && fixed.arrive, dinnerAt: trial.dinnerItem && trial.dinnerItem.arrive, single: true };
    }
  }
  const all = PLAN.items.filter(i => !i.s._meal && i.s.priority !== "essential");
  return all.length ? { stops: all.map(i => i.s), single: false } : null;
}

// Litekyan (Ritidian) state for a date, worded so a forecast never reads as an official closure.
export function litekyanState() {
  const r = PLAN.rit;
  if (r.open) return { closed: false };
  if (r.code === "surf" && st.cond.surfFromLive) return { closed: true, forecast: true, label: "Off the plan: rough surf in the forecast", short: "Likely closed (forecast)" };
  if (r.code === "surf") return { closed: true, manual: true, label: "Off the plan: you turned on High surf", short: "Off for high surf" };
  if (r.code === "fws") return { closed: true, label: "Closed today, per USFWS", short: "Closed today" };
  return { closed: true, label: "Closed on this date", short: "Closed this date" };
}

// Display names lead with CHamoru place names (change 6); the data keeps its original areas.
const AREA = { Agat: "Hågat", Hagåtña: "Hagåtña", Tumon: "Tumon" };
export const areaName = a => AREA[a] || a;

export function behindBy() {
  if (!st.trip.on) return 0;
  const next = PLAN.items[0]; if (!next) return 0;
  const p = plannedArrival(next.s.id);
  return p == null ? 0 : Math.round(next.arrive - p);
}

export { fmt, fmtS, dur, parseHM };
export const SOURCES = PACK.sources;
