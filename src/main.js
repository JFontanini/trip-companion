// Module layer on top of the v0 planner: live conditions now; journal and the redesigned
// views arrive after Claude Design's handoff. Everything here degrades to the v0 behavior.
import "./live.css";
import trip from "../trips/guam/trip.json";
import { fetchConditions, minutesAgo, metersToFeet } from "./services/conditions.js";
import { watchRitidian } from "./services/ritidian.js";

const root = document.getElementById("live-conditions-root");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let conditions = { status: "loading" }, ritidian = { status: "unavailable", reason: "not-configured" };

function guamToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: trip.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function fmtTime(iso) {
  if (!iso) return "";
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "p.m." : "a.m."}`;
}

function render() {
  root.hidden = false;
  const c = conditions;
  const parts = [];
  if (c.status === "loading") parts.push(`<span>Checking live conditions</span>`);
  else if (c.status === "unavailable") {
    const why = c.reason === "too-far-ahead" ? "Live forecasts start 15 days out." : c.reason === "past-date" ? "This date has passed." : "Live conditions are unavailable right now.";
    parts.push(`<span>${why} Check <a href="https://www.weather.gov/gum/" target="_blank" rel="noopener">NWS Guam</a> and the <a href="https://epa.guam.gov/monitoring-and-analytical/" target="_blank" rel="noopener">Guam EPA beach report</a>.</span>`);
  } else {
    const ago = minutesAgo(c.fetchedAt);
    parts.push(`<span>${c.status === "stale" ? "Offline, last updated" : "Updated"} <b>${ago < 1 ? "just now" : ago + " min ago"}</b></span>`);
    if (c.rain.afternoonMaxPct != null) parts.push(`<span>Afternoon rain <b>${c.rain.afternoonMaxPct}%</b></span>`);
    if (c.wind.maxMph != null) parts.push(`<span>Wind <b>${Math.round(c.wind.maxMph)} mph</b></span>`);
    for (const w of c.waves) if (w.maxM != null) parts.push(`<span>Waves at ${esc(w.label)} <b>${metersToFeet(w.maxM).toFixed(0)} ft</b></span>`);
    if (c.sunset) parts.push(`<span>Sunset <b>${fmtTime(c.sunset)}</b></span>`);
  }
  if (ritidian.status === "fresh") parts.push(`<span class="live-flag">Ritidian: ${ritidian.open ? "open" : "closed"}</span>`);
  root.innerHTML = `<div class="live"><div class="live-card" data-state="${c.status}" role="status" aria-live="polite"><span class="live-dot" aria-hidden="true"></span>${parts.join("")}</div></div>`;
}

async function refresh(force = false) {
  const s = window.GCC?.getState?.(); if (!s) return;
  conditions = await fetchConditions(trip, s.date, guamToday(), { force });
  render();
  if (conditions.status !== "unavailable") window.GCC.applyLive({ rain: conditions.rain.likely, surf: conditions.rough });
}

render();
refresh();
watchRitidian(r => {
  ritidian = r; render();
  // Only today's status is known; the planner applies it to today's date and nothing else.
  if (r.status === "fresh") window.GCC?.applyLive({ rain: null, surf: null, ritClosedOn: r.open === false ? guamToday() : null });
});
document.addEventListener("change", e => { if (e.target.id === "tripDate") setTimeout(() => refresh(), 0); });
setInterval(() => refresh(), 30 * 60 * 1000);
