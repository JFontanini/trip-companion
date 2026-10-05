// Planner state. Same storage key and shape as the v0 planner so a saved plan carries over;
// fields added for the redesign have defaults and are ignored by v0.
import { guamNow } from "./util.js";

const KEY = "gcc-v1";
const NOW = guamNow();
const EMPTY_TRIP = () => ({ on: false, status: {}, doneAt: {}, extra: {}, last: null, lunchDone: false, dinnerDone: false });
const DEFAULT = {
  tab: "today", profile: "full", dir: "cw", date: NOW.date, start: "08:00", interests: ["history", "nature", "swimming", "seafood"], layers: [],
  overrides: {}, dinner: "marina", mood: "grilled", cond: { rain: false, water: false, surf: false }, condManual: {}, dinnerForced: false,
  trip: EMPTY_TRIP(), packing: {}, selected: "cetti",
  // redesign
  keepPlan: {}, showDone: false, stopsFilter: "all", cloudTripId: null
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      const s = Object.assign(structuredClone(DEFAULT), o, {
        cond: Object.assign({}, DEFAULT.cond, o.cond || {}), trip: Object.assign(EMPTY_TRIP(), o.trip || {})
      });
      if (s.tab === "route") s.tab = "today";
      return s;
    }
  } catch { /* storage is optional */ }
  return structuredClone(DEFAULT);
}

export const st = load();
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } }
export function set(patch) { Object.assign(st, patch); save(); for (const fn of listeners) fn(); }
export function touch() { save(); for (const fn of listeners) fn(); }
export { EMPTY_TRIP };
