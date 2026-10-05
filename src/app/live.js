// Live data: Open-Meteo conditions and the Ritidian (Litekyan) status document.
// Live values only set the rain and surf toggles the person has not set by hand (CLAUDE.md),
// and every alert they cause names them in its Cause row.
import { PACK } from "../trip.js";
import { fetchConditions } from "../services/conditions.js";
import { watchRitidian } from "../services/ritidian.js";
import { st, touch } from "./state.js";
import { guamNow } from "./util.js";

export const live = { conditions: { status: "loading" }, ritidian: { status: "loading" }, refreshing: false };
let rerender = () => {};
export function onLive(fn) { rerender = fn; }

function apply(values) {
  let changed = false;
  if (values.ritClosedOn !== undefined) {
    const v = values.ritClosedOn || null;
    if (st.cond.ritClosedLive !== v) { st.cond.ritClosedLive = v; changed = true; }
  }
  for (const k of ["rain", "surf"]) {
    if (values[k] != null && !(st.condManual || {})[k] && (st.cond[k] !== values[k] || !st.cond[k + "FromLive"])) {
      st.cond[k] = values[k]; st.cond[k + "FromLive"] = true; changed = true;
    }
  }
  return changed;
}

export async function refreshConditions(force = false) {
  live.refreshing = true; rerender();
  const c = await fetchConditions(PACK.trip, st.date, guamNow().date, { force });
  live.conditions = c; live.refreshing = false;
  let changed;
  if (c.status !== "unavailable") changed = apply({ rain: c.rain.likely, surf: c.rough });
  else {
    // No forecast for this date: drop toggles the forecast set, so nothing claims a source it no longer has.
    changed = false;
    for (const k of ["rain", "surf"]) if (st.cond[k + "FromLive"] && !(st.condManual || {})[k]) { st.cond[k] = false; st.cond[k + "FromLive"] = false; changed = true; }
  }
  if (changed) touch(); else rerender();
}

export function startLive() {
  refreshConditions();
  setInterval(() => refreshConditions(), 30 * 60 * 1000);
  watchRitidian(r => {
    live.ritidian = r.status === "fresh" && r.parseOk === false ? { status: "unavailable", reason: "parse-failed" } : r;
    // Only today's status is known, so it applies to today's date and nothing else.
    const changed = live.ritidian.status === "fresh" ? apply({ ritClosedOn: r.open === false ? guamNow().date : null }) : false;
    if (changed) touch(); else rerender();
  });
}
