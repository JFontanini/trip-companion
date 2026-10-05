// Guam Coastal Circuit, Reef Atlas build. Renders the six tabs from the trip pack and engine,
// owns the event handlers, and keeps day-of mode, live data and the journal in step.
import "./styles/app.css";
import { st, set, save, touch, onChange, EMPTY_TRIP } from "./app/state.js";
import { $, esc, guamNow } from "./app/util.js";
import { computePlan, PLAN, byId, nameOf } from "./app/plan.js";
import { startLive, onLive, refreshConditions } from "./app/live.js";
import { viewToday, nextBar } from "./app/today.js";
import { viewMap, bindMap, zoom, dragMoved } from "./app/map.js";
import { viewStops, viewEat, viewSafety, detailHtml, layersHtml } from "./app/screens.js";
import { viewJournal, logSheetHtml, openDraft, draft } from "./app/journal-view.js";
import { loadJournal, onJournal, journal, addPhoto, removePhoto, saveEntry, retry, signIn, signOut, startShared, invite, inviteLink, pendingUploads } from "./app/journal-store.js";
import { ENGINE } from "./trip.js";

const TABS = [["today", "Today"], ["map", "Map"], ["stops", "Stops"], ["eat", "Eat"], ["journal", "Journal"], ["safety", "Safety"]];
const VIEWS = { today: viewToday, map: viewMap, stops: viewStops, eat: viewEat, journal: viewJournal, safety: viewSafety };
let sheet = null; // {kind, arg}

function tabsHtml(cls) {
  return TABS.map(([k, l]) => `<li><button type="button" data-act="tab" data-arg="${k}" ${st.tab === k ? 'aria-current="page"' : ""}>${l}</button></li>`).join("");
}

// Re-rendering replaces the markup, so remember what had focus and put it back.
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.dataset && el.dataset.act) return `[data-act="${el.dataset.act}"]${el.dataset.arg ? `[data-arg="${CSS.escape(el.dataset.arg)}"]` : ""}`;
  if (el.dataset && el.dataset.sel) return `[data-sel="${CSS.escape(el.dataset.sel)}"]`;
  return null;
}
function restoreFocus(key, scope = document) {
  if (!key) return;
  const el = scope.querySelector(key);
  if (el && el !== document.activeElement) el.focus({ preventScroll: true });
}

function render({ keepScroll = true } = {}) {
  const y = window.scrollY;
  const key = sheet ? null : focusKey(document.activeElement);
  computePlan();
  const dayof = st.trip.on;
  document.documentElement.toggleAttribute("data-mode", dayof);
  if (dayof) document.documentElement.setAttribute("data-mode", "dayof");
  document.documentElement.classList.toggle("dayof", dayof);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--gcc-tabbar").trim());
  $("#topnav").innerHTML = `<span class="wordmark">Guam, the loop</span><ul>${tabsHtml()}</ul><div class="btns" style="grid-auto-columns:auto"><button class="btn btn-outline topnav-ghost" data-act="layers">Layers</button>${dayof ? `<button class="btn btn-outline topnav-ghost" data-act="endTrip">End day</button>` : `<button class="btn btn-lagoon" data-act="startTrip">Start today</button>`}</div>`;
  $("#tabs").innerHTML = tabsHtml();
  const view = VIEWS[st.tab] || viewToday;
  $("#main").innerHTML = view();
  $("#nextbar").innerHTML = st.tab === "today" ? nextBar() : "";
  document.body.classList.toggle("has-nextbar", !!$("#nextbar").innerHTML);
  if (st.tab === "map") bindMap();
  renderSheet();
  if (keepScroll) window.scrollTo(0, y);
  restoreFocus(key);
}

function renderSheet() {
  const el = $("#sheet");
  if (!sheet) { el.hidden = true; el.innerHTML = ""; return; }
  let html = "";
  if (sheet.kind === "detail") html = detailHtml(byId(sheet.arg));
  else if (sheet.kind === "layers") html = layersHtml();
  else if (sheet.kind === "log") html = logSheetHtml();
  const box = el.querySelector(".box");
  const scroll = box ? box.scrollTop : 0;
  const focusId = document.activeElement && el.contains(document.activeElement) ? focusKey(document.activeElement) : null;
  el.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" tabindex="-1">${html}</div>`;
  el.hidden = false;
  el.querySelector(".box").scrollTop = scroll;
  if (focusId) { const f = el.querySelector(focusId); if (f) { f.focus({ preventScroll: true }); if (f.setSelectionRange && f.value && f.tagName === "TEXTAREA") f.setSelectionRange(f.value.length, f.value.length); } }
}
let lastFocus = null;
let busy = false; // a save or photo is in flight: the sheet stays open until it finishes
function openSheet(kind, arg) { if (!sheet) lastFocus = document.activeElement; sheet = { kind, arg }; renderSheet(); const b = $("#sheet [data-act=close]"); (b || $("#sheet .box")).focus(); }
async function closeSheet() {
  if (busy) return;
  if (sheet && sheet.kind === "log") {
    const keep = new Set(draft.entryId ? (journal.entries.find(e => e.id === draft.entryId) || { photoIds: [] }).photoIds : []);
    for (const id of draft.photoIds) if (!keep.has(id)) await removePhoto(id);
  }
  sheet = null; renderSheet();
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
}

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }

function doneArg(arg) {
  const n = guamNow().min;
  if (arg.startsWith("lunch:")) { st.trip.lunchDone = true; st.trip.last = arg.slice(6); }
  else if (arg.startsWith("dinner:")) { st.trip.dinnerDone = true; st.trip.last = arg.slice(7); }
  else { st.trip.status[arg] = "done"; st.trip.doneAt = st.trip.doneAt || {}; st.trip.doneAt[arg] = n; st.trip.last = arg; }
}

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act],[data-sel]");
  if (!el) { if (e.target.id === "sheet") closeSheet(); return; }
  if (el.dataset.sel && !el.dataset.act) { if (dragMoved) return; st.selected = el.dataset.sel; save(); render(); const g = document.querySelector(`[data-sel="${st.selected}"]`); g && g.focus({ preventScroll: true }); return; }
  const a = el.dataset.act, arg = el.dataset.arg;
  switch (a) {
    case "tab": st.tab = arg; save(); sheet = null; render({ keepScroll: false }); window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); break;
    case "profile": set({ profile: arg }); break;
    case "setDir": set({ dir: arg }); toast(arg === "cw" ? "Clockwise: north first" : "South first"); break;
    case "cond": { const v = !st.cond[arg]; st.cond[arg] = v; st.cond[arg + "FromLive"] = false; st.condManual = { ...st.condManual, [arg]: true }; touch(); break; }
    case "interest": { const s = new Set(st.interests); s.has(arg) ? s.delete(arg) : s.add(arg); set({ interests: [...s] }); break; }
    case "layer": { const s = new Set(st.layers); s.has(arg) ? s.delete(arg) : s.add(arg); set({ layers: [...s] }); break; }
    case "layerclear": set({ layers: [] }); break;
    case "stopsFilter": set({ stopsFilter: arg }); break;
    case "detail": st.selected = arg; save(); openSheet("detail", arg); break;
    case "layers": openSheet("layers"); break;
    case "close": closeSheet(); break;
    case "skip": { st.overrides[arg] = false; save(); if (sheet && sheet.kind === "detail") sheet = null; render(); toast(`Skipped ${nameOf(byId(arg))}. Restore it under Not on today's plan.`); break; }
    case "add": { st.overrides[arg] = true; if (st.trip.on) delete st.trip.status[arg]; save(); if (sheet && sheet.kind === "detail") sheet = null; render(); toast("Added to your day"); break; }
    case "trim": { for (const it of PLAN.items) if (!it.s._meal && it.s.priority !== "essential") st.overrides[it.s.id] = false; touch(); toast("Trimmed to essential stops"); break; }
    case "keep": { st.keepPlan = { ...st.keepPlan, [arg + ":" + st.date]: true }; touch(); break; }
    case "mood": set({ mood: arg }); break;
    case "dinner": set({ dinner: arg, dinnerForced: true }); toast("Dinner set"); break;
    case "dinnerOn": set({ dinner: ENGINE.dinnerId({ ...st, dinnerForced: false }), dinnerForced: true }); break;
    case "dinnerOff": set({ dinner: "none", dinnerForced: true }); toast("Dinner removed"); break;
    case "startTrip": { const n = guamNow(); st.trip = { ...EMPTY_TRIP(), on: true }; st.showDone = false; if (st.date !== n.date) { st.date = n.date; toast("Plan moved to today"); refreshConditions(); } st.tab = "today"; save(); render({ keepScroll: false }); window.scrollTo(0, 0); wake(); break; }
    case "endTrip": st.trip = EMPTY_TRIP(); save(); render({ keepScroll: false }); window.scrollTo(0, 0); break;
    case "done": doneArg(arg); save(); render(); toast("Marked done. Times updated."); break;
    case "undo": { delete st.trip.status[arg]; if (st.trip.last === arg) st.trip.last = null; touch(); break; }
    case "showDone": set({ showDone: !st.showDone }); break;
    case "refresh": refreshConditions(true); break;
    case "zoom": zoom(arg); break;
    case "log": openDraft(arg, el.dataset.entry); openSheet("log", arg); break;
    case "rate": draft.rating = draft.rating === Number(arg) ? null : Number(arg); renderSheet(); break;
    case "removePhoto": { draft.photoIds = draft.photoIds.filter(x => x !== arg); if (!draft.photoIds.length) draft.useAsStopPhoto = false; const owned = draft.entryId && journal.entries.find(x => x.id === draft.entryId)?.photoIds.includes(arg); if (!owned) await removePhoto(arg); renderSheet(); break; }
    case "retryPhoto": retry(arg); break;
    case "saveEntry": {
      if (busy) break;
      busy = true;
      const pending = pendingUploads(draft.photoIds);
      const s = byId(draft.stopId);
      try { await saveEntry({ id: draft.entryId, stopId: draft.stopId, note: draft.note, rating: draft.rating, photoIds: draft.photoIds, useAsStopPhoto: draft.useAsStopPhoto, loggedAt: draft.loggedAt, loggedMin: draft.loggedMin }); }
      catch { busy = false; toast("The entry didn't save. Try again."); break; }
      busy = false; sheet = null; render(); toast(pending ? `Saved ${nameOf(s)}. Photos keep uploading.` : `Saved ${nameOf(s)}`); break;
    }
    case "signIn": signIn(); break;
    case "signOut": signOut(); break;
    case "startShared": startShared(); break;
    case "copyInvite": { const link = inviteLink(); try { await navigator.clipboard.writeText(link); toast("Invite link copied"); } catch { toast(link); } break; }
  }
});

document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "tripDate" && t.value) { set({ date: t.value }); refreshConditions(); }
  if (t.id === "tripStart" && t.value) set({ start: t.value });
  if (t.dataset.pack !== undefined) { st.packing[t.dataset.pack] = t.checked; save(); }
  if (t.matches("[data-photo-input]") && t.files && t.files.length) {
    const files = [...t.files].slice(0, 10 - draft.photoIds.length);
    busy = true;
    for (const f of files) { try { const id = await addPhoto(f); draft.photoIds.push(id); renderSheet(); } catch { toast("That photo couldn't be read"); } }
    busy = false;
  }
  if (t.dataset.draft === "useAsStopPhoto") { draft.useAsStopPhoto = t.checked; }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.draft === "note") { draft.note = t.value.slice(0, 280); const c = $("[data-count]"); if (c) c.textContent = `${draft.note.length} / 280`; }
});
document.addEventListener("submit", e => {
  if (e.target.dataset.form === "invite") { e.preventDefault(); const v = e.target.querySelector("input").value; if (v) invite(v).then(() => toast(`Invited ${v}`)); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && sheet) closeSheet();
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("g.mk")) { e.preventDefault(); st.selected = e.target.dataset.sel; save(); render(); const g = document.querySelector(`g.mk[data-sel="${st.selected}"]`); g && g.focus(); }
  if (e.key === "Tab" && sheet) { // keep focus inside the open sheet
    const f = [...$("#sheet").querySelectorAll("button:not([disabled]),a[href],input:not([disabled]),textarea,[tabindex='0']")];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

function wake() { try { navigator.wakeLock && st.trip.on && navigator.wakeLock.request("screen").catch(() => {}); } catch { /* optional */ } }

onChange(() => render());
onLive(() => { if (!sheet || sheet.kind !== "log") render(); });
onJournal(() => { if (sheet && sheet.kind === "log") renderSheet(); else render(); });
// Day-of projections move with the clock.
setInterval(() => { if (st.trip.on && !sheet) render(); }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && st.trip.on) { render(); wake(); } });

render({ keepScroll: false });
startLive();
loadJournal();
wake();
