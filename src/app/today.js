// Today tab: hero, live conditions strip, Shape the day, alerts with Cause, the route timeline,
// cut list and packing. In day-of mode: the navy screen with the next stop and the Next Stop bar.
import { st } from "./state.js";
import { esc, num2, dateLabel, numberWord, guamNow, age, navLinks, ARROW } from "./util.js";
import { live } from "./live.js";
import { photo } from "./photos.js";
import { ENGINE, ACCESSED, PACK } from "../trip.js";
const ACCESSED_SHORT = ACCESSED.replace(/, \d{4}$/, "");
import { PLAN, PLANNED, STOPS, HOME, byId, nameOf, numOf, catOf, shapeHtml, HISTORY_CATS, doneIds, plannedArrival, stopCount,
  severity, causeOf, trimSuggestion, behindBy, litekyanState, areaName, fmt, fmtS, dur, parseHM } from "./plan.js";
import { entryFor } from "./journal-store.js";

const S = PACK.sources;
const PROFILES = ENGINE.PROFILES;
const NWS = S.nws.url, EPA = S.epa.url, FWS = S.fws.url;

// ---------- conditions strip ----------
export function conditionsStrip() {
  const c = live.conditions, rt = live.ritidian;
  const linkTiles = `<div class="linktiles"><a class="linktile" href="${NWS}" target="_blank" rel="noopener"><span>NWS Guam<small>Forecast and surf</small></span>${ARROW}</a><a class="linktile" href="${EPA}" target="_blank" rel="noopener"><span>Guam EPA beaches<small>Water quality</small></span>${ARROW}</a></div>`;
  if (c.status === "loading") {
    return `<section class="cond-strip ruled" aria-busy="true" aria-label="Live conditions loading"><div class="cond-head"><span class="label">Right now</span><span class="cond-status">Checking live conditions</span></div>
      <div class="cond-grid">${[0, 1, 2, 3].map(() => `<div class="cond-cell"><span class="skel" style="height:26px;width:60%"></span><span class="skel" style="height:10px;width:80%;margin-top:8px"></span></div>`).join("")}</div></section>`;
  }
  if (c.status === "unavailable") {
    const why = c.reason === "too-far-ahead" ? `Live forecasts start 15 days before the trip. ${dateLabel(st.date)} is ${c.daysAhead} days out.`
      : c.reason === "past-date" ? "This date has passed, so there is no live forecast for it."
      : "The forecast service didn't answer.";
    return `<section class="cond-strip cond-none ruled" aria-label="Live conditions"><div class="cond-head"><span class="label">Right now</span><span class="cond-status"><span class="dot none" aria-hidden="true"></span>No data</span></div>
      <h3>Live conditions aren't available right now.</h3><p class="body-2" style="margin-top:4px">${esc(why)} The plan is using your toggles only. Check these before you swim or drive north.</p>${linkTiles}</section>`;
  }
  const stale = c.status === "stale";
  const ago = Math.max(0, Math.round((Date.now() - c.fetchedAt) / 6e4));
  const wave = (c.waves || []).filter(w => w.maxM != null).sort((a, b) => b.maxM - a.maxM)[0];
  const sunset = c.sunset ? fmtIso(c.sunset) : null;
  const ritCell = ritidianCell(rt);
  const src = stale ? s => `${s} · ${age(ago).replace(" ago", "")} old` : s => s;
  return `<section class="cond-strip ruled ${stale ? "stale" : ""}" aria-label="Live conditions">
    <div class="cond-head"><span class="label">Right now</span>
      ${stale ? `<span class="cond-status stale"><span class="dot stale" aria-hidden="true"></span>Updated ${age(ago)}</span><button class="btn btn-outline" data-act="refresh" ${live.refreshing ? "disabled" : ""}>${live.refreshing ? "Refreshing" : "Refresh"}</button>`
        : `<span class="cond-status"><span class="dot" aria-hidden="true"></span>Updated ${age(ago)}${live.refreshing ? " · refreshing" : ""}</span>`}
    </div>
    <div class="cond-grid">
      <div class="cond-cell"><div class="cond-v">${c.rain.afternoonMaxPct != null ? c.rain.afternoonMaxPct + "%" : "No data"}</div><div class="cond-l">Rain this afternoon</div><div class="cond-s">${src("Open-Meteo forecast")}</div></div>
      <div class="cond-cell"><div class="cond-v">${wave ? Math.round(wave.maxM * 3.28084) + " ft" : "No data"}</div><div class="cond-l">${wave ? `Surf, ${esc(wave.label)}` : "Surf"}${c.wind.maxMph != null ? ` · wind ${Math.round(c.wind.maxMph)} mph` : ""}</div><div class="cond-s">${src("Open-Meteo marine")}</div></div>
      <div class="cond-cell"><div class="cond-v">${sunset ? sunset.replace(/ [ap]\.m\./, "") : fmtS(PLAN.sun.sunset)}</div><div class="cond-l">Sunset, p.m.</div><div class="cond-s">${sunset ? src("Open-Meteo forecast") : "calculated for Guam"}</div></div>
      ${ritCell}
    </div>
    ${stale ? `<p class="meta" style="padding-bottom:8px">Alerts still use these values until you refresh.</p>` : ""}
  </section>`;
}
function ritidianCell(rt) {
  const sched = ENGINE.ritidianStatus(st.date, { surf: false });
  if (rt && rt.status === "fresh" && st.date === guamNow().date) {
    const ago = rt.fetchedAt && rt.fetchedAt.toMillis ? age(Math.round((Date.now() - rt.fetchedAt.toMillis()) / 6e4)) : "";
    return `<div class="cond-cell"><div class="cond-v ${rt.open ? "open" : "closed"}">${rt.open ? "Open" : "Closed"}</div><div class="cond-l">Litekyan${rt.open ? ", until 4 p.m." : ""}</div><div class="cond-s">USFWS status${ago ? " · " + ago : ""}</div></div>`;
  }
  const feedDown = rt && rt.status === "unavailable" && rt.reason !== "not-configured";
  return `<div class="cond-cell"><div class="cond-v ${sched.open ? "" : "closed"}">${sched.open ? "Open" : "Closed"}</div><div class="cond-l">Litekyan, by schedule${sched.open ? ", 7:30 to 4" : ""}</div><div class="cond-s">${feedDown ? "Status feed unavailable. " : ""}Hours checked ${ACCESSED_SHORT}. <a href="${FWS}" target="_blank" rel="noopener">USFWS status</a></div></div>`;
}
function fmtIso(iso) { const [h, m] = iso.slice(11, 16).split(":").map(Number); return fmt(h * 60 + m); }

// ---------- alerts ----------
export function alertHtml(a, { dayof = false } = {}) {
  if (st.keepPlan[a.id + ":" + st.date]) return "";
  const sev = severity(a), cause = causeOf(a);
  let title = a.title, text = a.text, acts = "";
  if (a.id === "dark") {
    const t = trimSuggestion();
    if (t && t.single) {
      text = `Trimming ${t.num} ${nameOf(t.stop)} puts ${nameOf(t.fixed)} back at ${fmt(t.fixedAt)}${t.dinnerAt ? ` and dinner at ${fmt(t.dinnerAt)}` : ""}`;
      acts = `<button class="btn ${dayof ? "btn-sunset-dark" : "btn-primary"}" data-act="skip" data-arg="${t.stop.id}">Trim ${esc(nameOf(t.stop))}</button><button class="btn btn-outline" data-act="keep" data-arg="dark">Keep plan</button>`;
    } else if (t) {
      acts = `<button class="btn ${dayof ? "btn-sunset-dark" : "btn-primary"}" data-act="trim">Trim to essentials</button><button class="btn btn-outline" data-act="keep" data-arg="dark">Keep plan</button>`;
    }
  } else if (a.action) acts = `<button class="btn btn-primary" data-act="${a.action.fn}" data-arg="${a.action.arg || ""}">${esc(a.action.label)}</button>`;
  if (a.id === "rit-closed" && PLAN.rit.code === "surf") acts += `<button class="btn btn-outline" data-act="cond" data-arg="surf">Turn off High surf</button>`;
  let cls = sev.cls, word = sev.word;
  if (dayof && a.id === "dark") { const b = behindBy(); if (b > 5) { cls = "changed"; word = `Running ${dur(b)} behind`; } }
  return `<div class="alert ${cls}"><div class="sev">${esc(word)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
    ${cause ? `<div class="cause"><b>Cause</b> · ${esc(cause.what)}${cause.src ? " · " + esc(cause.src) : ""}${cause.age ? " · " + esc(cause.age) : ""}</div>` : ""}
    ${acts ? `<div class="acts">${acts}</div>` : ""}</div>`;
}

// ---------- timeline ----------
function metaFor(s, it) {
  const cats = (s.cats || []).slice(0, 2).map(c => (catOf({ cats: [c] }).short)).join(", ");
  const alt = s.alt && s.alt[0] && s.id !== "inalahan-village" ? s.alt[0] : s.village;
  return [alt, cats, it ? dur(it.dwell) : null].filter(Boolean).join(" · ");
}
function flagsHtml(flags) {
  return flags && flags.length ? `<div class="tl-flags">${flags.map(f => `<span class="tl-flag ${f.lvl === "warn" || f.lvl === "crit" ? "warn" : ""}">${esc(f.t)}</span>`).join("")}</div>` : "";
}
function legHtml(leg) {
  if (!leg || !leg.min) return "";
  return `<div class="tl-leg">${dur(leg.min)} drive${leg.short ? " · Route 4 cross-island" : ""}</div>`;
}
function stopRow(it, { next = false } = {}) {
  const s = it.s;
  if (s._meal) return mealRow(it, "Lunch");
  return `<button class="tl-row ${next ? "next" : ""}" data-act="detail" data-arg="${s.id}">
    <span class="tl-num"><span class="sr">Stop </span>${numOf(s.id)}</span>
    <span class="tl-body"><span class="tl-name">${shapeHtml(s)}<span>${esc(nameOf(s))}</span></span><span class="meta">${esc(metaFor(s, it))}</span>${flagsHtml(it.flags)}</span>
    <span class="tl-time"><span class="sr">arrive </span>${fmtS(it.arrive)}</span></button>`;
}
function mealRow(it, kind) {
  const s = it.s, area = s.area || s.village || "";
  return `<div class="tl-row meal">
    <span class="tl-num"><span class="diamond" aria-hidden="true"></span></span>
    <span class="tl-body"><span class="kick">${kind}</span><span class="tl-name" style="display:block">${esc(s.name)}</span><span class="meta">${esc([areaName(area), dur(it.dwell), kind === "Dinner" ? dur(PLAN.homeLeg.min) + " home" : null].filter(Boolean).join(" · "))}</span>${flagsHtml(it.flags)}</span>
    <span class="tl-time"><span class="sr">arrive </span>${fmtS(it.arrive)}</span></div>`;
}
function spareHtml(it) {
  const last = PLAN.items.length ? PLAN.items[PLAN.items.length - 1].s : HOME;
  const toHome = ENGINE.legMinutes(last, HOME).min;
  let tip;
  if (it.spare >= 100 && toHome <= 30) tip = `Oceanview Drive is ${dur(toHome)} away. Go back to rest and change, then head out to dinner.`;
  else if (it.s.area === "Agat") tip = "Linger at Ga'an Point's beach or walk the Hågat (Agat) Marina breakwater as the light drops.";
  else if (it.s.area === "Tumon") tip = `Walk the Tumon Bay beach path, or catch sunset (${fmt(PLAN.sun.sunset)}) from Puntan Dos Amantes.`;
  else tip = "Walk Paseo de Susana and the old Plaza de España area in Hagåtña.";
  return `<div class="spare"><b>${dur(it.spare)} to spare</b>, then a ${dur(it.leg.min)} drive. ${esc(tip)}</div>`;
}

export function timeline() {
  const p = PLAN;
  const t0 = st.trip.on ? p.t0 : parseHM(st.start);
  let h = `<div class="tl">`;
  h += `<div class="tl-row"><span class="tl-num start">${st.trip.on ? "Now" : "Start"}</span><span class="tl-body"><span class="tl-name">${esc(st.trip.on && st.trip.last ? nameOf(byId(st.trip.last)) : HOME.name)}</span>${st.trip.on ? "" : `<span class="meta">Fill water bottles, check fuel and the advisories before you go.</span>`}</span><span class="tl-time">${fmtS(t0)}</span></div>`;
  for (const it of p.items) h += legHtml(it.leg) + stopRow(it, { next: it.s.id === st.selected });
  if (p.dinnerItem) {
    const it = p.dinnerItem;
    if (it.spare >= 15) h += spareHtml(it); else h += legHtml(it.leg);
    h += mealRow(it, "Dinner");
  }
  h += legHtml(p.homeLeg);
  h += `<div class="tl-row home"><span class="tl-num">Home</span><span class="tl-body"><span class="tl-name">Back at Oceanview Drive</span><span class="meta">${p.homeT < p.sun.sunset ? "Home before sunset at " + fmt(p.sun.sunset) : "After dark. The last stretch is the familiar Marine Corps Drive corridor."}</span></span><span class="tl-time">${fmtS(p.homeT)}</span></div>`;
  h += `</div>`;
  return h + offList();
}

function offList() {
  const off = STOPS.filter(s => s.kind !== "meal" && !PLAN.items.some(i => i.s.id === s.id) && !(st.trip.on && st.trip.status[s.id] === "done"));
  if (!off.length) return "";
  const skipped = off.filter(s => st.overrides[s.id] === false || st.trip.status[s.id] === "skip");
  const rest = off.filter(s => !skipped.includes(s));
  const row = (s, isSkipped) => {
    const lk = s.id === "ritidian" ? litekyanState() : { closed: false };
    const label = lk.closed ? lk.label : isSkipped ? "Skipped" : s.detour ? "Optional detour" : { essential: "Essential", recommended: "Recommended", optional: "Optional" }[s.priority];
    const action = lk.closed ? (PLAN.rit.code === "surf" ? `<button class="linkbtn" data-act="cond" data-arg="surf">Turn off High surf</button>` : "")
      : `<button class="linkbtn" data-act="add" data-arg="${s.id}" aria-label="${isSkipped ? "Restore" : "Add"} ${esc(nameOf(s))}">${isSkipped ? "Restore" : "Add"}</button>`;
    return `<div class="off-row ${isSkipped ? "skipped" : ""}"><span class="tl-num">${shapeHtml(s, "shape-off")}</span><span><span class="n">${esc(nameOf(s))}</span><br><span class="meta">${esc(label)} · ${s.dur[0]} to ${s.dur[1]} min</span></span>${action}</div>`;
  };
  return `<div class="off-list"><div class="label" style="padding-bottom:8px">Not on today's plan</div>${skipped.map(s => row(s, true)).join("")}${rest.map(s => row(s, false)).join("")}</div>`;
}

// ---------- Today (plan mode) ----------
const PACKLIST = ["Water, more than you expect to drink", "Reef-safe sunscreen and a hat", "Towel and swimwear", "Water shoes or sturdy sandals", "Light rain layer", "Snacks for the car", "Cash for small fees, coconuts and fruit stands", "Phone charger and offline map download"];

function cutList() {
  const inc = PLAN.items.filter(i => !i.s._meal);
  if (inc.length < 4) return "";
  const intr = new Set(st.interests);
  const score = s => ({ essential: 5, recommended: 3, optional: 0 }[s.priority]) + s.cats.reduce((a, c) => a + ((intr.has("history") && HISTORY_CATS.includes(c)) ? 2 : 0) + ((intr.has("nature") && (c === "nature" || c === "viewpoint")) ? 2 : 0) + ((intr.has("swimming") && c === "swimming") ? 2 : 0), 0);
  const list = inc.map(i => ({ s: i.s, score: score(i.s), save: i.dwell + 2 * (i.s.spur || 0) })).filter(x => x.s.priority !== "essential").sort((a, b) => a.score - b.score).slice(0, 3);
  if (!list.length) return "";
  const keep = inc.filter(i => i.s.priority === "essential").map(i => nameOf(i.s));
  return `<section class="section"><h2 class="h3">If the day runs long</h2><p class="meta" style="margin-top:6px">Cut in this order, ranked by priority and your interests.${keep.length ? ` ${esc(keep.slice(-2).join(" and "))} stay.` : ""}</p>
    <div class="chips" role="group" aria-label="Your interests" style="margin-top:12px">${[["history", "History"], ["nature", "Nature"], ["swimming", "Swimming"], ["seafood", "Seafood"]].map(([k, l]) => `<button class="chip" aria-pressed="${intr.has(k)}" data-act="interest" data-arg="${k}">${l}</button>`).join("")}</div>
    <ol class="cut">${list.map(x => `<li><span class="n">${numOf(x.s.id)}</span><span>${esc(nameOf(x.s))}</span><span class="s">saves ${dur(x.save)}</span></li>`).join("")}</ol></section>`;
}
function packing() {
  return `<section class="section"><h2 class="h3">Pack</h2><ul class="pack">${PACKLIST.map((x, i) => `<li><label><input type="checkbox" data-pack="${i}" ${st.packing[i] ? "checked" : ""}><span>${esc(x)}</span></label></li>`).join("")}</ul></section>`;
}

function condChips() {
  const c = st.cond, m = st.condManual || {};
  const chip = (k, label) => `<button class="chip cond" aria-pressed="${!!c[k]}" data-act="cond" data-arg="${k}">${label}${c[k] ? " · on" : ""}</button>`;
  const notes = [];
  if (c.rain && c.rainFromLive && !m.rain) notes.push("Rain was set by the Open-Meteo forecast.");
  if (c.surf && c.surfFromLive && !m.surf) notes.push("High surf was set by the Open-Meteo marine forecast.");
  const tail = notes.length ? notes.join(" ") + " Tap to override." : "The forecast sets Rain and High surf when the trip is within 15 days. Water quality has no live feed, so check Guam EPA.";
  return `<div class="chips" role="group" aria-label="Today's conditions" style="margin-top:var(--gcc-space-4)">${chip("rain", "Rain")}${chip("water", "Water advisory")}${chip("surf", "High surf")}</div><p class="hint">${tail}</p>`;
}

export function viewToday() {
  if (st.trip.on) return viewDayOf();
  const p = PLAN, n = stopCount();
  const startM = parseHM(st.start);
  const profileSeg = Object.entries(PROFILES).map(([k, v]) => `<button aria-pressed="${st.profile === k}" data-act="profile" data-arg="${k}">${esc(v.label)}</button>`).join("");
  return `<div class="wrap">
    <header class="mhead"><span class="wordmark">Guam, the loop</span><div class="btns"><button class="btn" data-act="layers">Layers</button><button class="btn btn-primary" data-act="startTrip">Start today</button></div></header>
    <section class="hero">
      <div><h1 class="display">${numberWord(n)} stop${n === 1 ? "" : "s"}, one <em>coast.</em></h1><p class="hero-sub">${esc(dateLabel(st.date))} from Oceanview Drive, Asan.</p></div>
      ${photo("cetti", { cls: "ph-tall", sizes: "176px", eager: true, short: true })}
    </section>
    ${conditionsStrip()}
    <section class="section"><h2 class="h2">Shape the day</h2>
      <div class="seg" role="group" aria-label="Travel style" style="margin-top:var(--gcc-space-4)">${profileSeg}</div>
      <p class="meta" style="margin-top:6px">${esc(PROFILES[st.profile].desc)}, ${esc(PROFILES[st.profile].range)}.</p>
      <div class="seg sm" role="group" aria-label="Direction" style="margin-top:var(--gcc-space-3)"><button aria-pressed="${st.dir === "cw"}" data-act="setDir" data-arg="cw">Clockwise</button><button aria-pressed="${st.dir === "ccw"}" data-act="setDir" data-arg="ccw">South first</button></div>
      <div class="fields"><div class="field"><label for="tripDate">Date</label><input id="tripDate" type="date" value="${st.date}"></div><div class="field"><label for="tripStart">Leave at</label><input id="tripStart" type="time" value="${st.start}" step="900"></div></div>
      ${condChips()}
      <div class="numbers ruled">
        <div><b>${fmtS(startM)}</b><span>Leave</span></div><div><b>${p.dinnerItem ? fmtS(p.dinnerItem.arrive) : "None"}</b><span>Dinner</span></div><div><b>${fmtS(p.homeT)}</b><span>Home</span></div>
        <div><b>${num2(n)}</b><span>Stops</span></div><div><b>${Math.floor(p.drive / 60)}:${String(p.drive % 60).padStart(2, "0")}</b><span>Driving</span></div><div><b>${fmtS(p.sun.sunset)}</b><span>Sunset</span></div>
      </div>
      ${p.alerts.length ? `<div class="alerts" aria-live="polite">${p.alerts.map(a => alertHtml(a)).join("")}</div>` : ""}
    </section>
    <section><div class="tl-head"><h2 class="h2">The route</h2><span class="meta">${st.dir === "cw" ? "Clockwise" : "South first"} · ${esc(PROFILES[st.profile].label.replace("Recommended ", ""))}</span></div>
      ${timeline()}
      <a class="btn btn-secondary btn-block" style="margin-top:var(--gcc-space-4)" href="${fullRouteLink()}" target="_blank" rel="noopener">Whole route in Google Maps</a>
    </section>
    ${st.dir === "ccw" ? whyClockwise() : ""}
    ${cutList()}
    ${packing()}
    <p class="foot">Drive times are planning estimates from a simplified road model, not live traffic. Hours, fees and status notes were last checked ${ACCESSED}; each stop lists its sources. <button class="linkbtn" data-act="layers">Sources and history</button> · <a href="/v0.html">Previous version</a></p>
  </div>`;
}
function whyClockwise() {
  return `<section class="section"><h2 class="h3">Why clockwise</h2><div class="stack" style="margin-top:8px">
    <p><b>Litekyan closes at 4:00 p.m.</b> and is shut Monday, Tuesday and on high-surf days. North first gets you there in the morning.</p>
    <p><b>The southern overlooks face west.</b> Cetti Bay and Fort Soledad are at their best in late-afternoon light.</p>
    <p><b>The day ends at Hågat</b>, about 20 minutes from Oceanview Drive, with dinner by the water at sunset.</p></div></section>`;
}
export function fullRouteLink() {
  const pts = [...PLAN.items.map(i => i.s), ...(PLAN.dinnerItem ? [PLAN.dinnerItem.s] : [])];
  const way = pts.slice(0, 9).map(p => encodeURIComponent(p.q)).join("%7C");
  const o = encodeURIComponent(HOME.q);
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${o}&waypoints=${way}&travelmode=driving`;
}

// ---------- day-of ----------
function nextItem() { return PLAN.items[0] || PLAN.dinnerItem || null; }
function isDinner(it) { return PLAN.dinnerItem && it === PLAN.dinnerItem; }

function viewDayOf() {
  const now = guamNow(), next = nextItem();
  const done = doneIds();
  const doneNames = done.map(id => byId(id)).filter(Boolean);
  const doneNums = done.map(id => numOf(id)).filter(Boolean).sort();
  const consecutive = doneNums.every((n, i) => i === 0 || Number(n) === Number(doneNums[i - 1]) + 1);
  const doneLabel = doneNums.length > 2 && consecutive ? `${doneNums[0]} to ${doneNums[doneNums.length - 1]}` : doneNums.join(", ");
  let hero;
  if (!next) hero = `<div class="dayof-name">Head home</div><p class="body-2" style="margin-top:8px">${dur(PLAN.homeLeg.min)} to Oceanview Drive.</p>`;
  else {
    const s = next.s, planned = plannedArrival(s.id);
    const meal = s._meal || isDinner(next);
    const big = meal ? `<span class="diamond" style="width:52px;height:52px;margin:22px 0 14px 14px" aria-hidden="true"></span>` : `<div class="num-xl" aria-hidden="true">${numOf(s.id)}</div>`;
    hero = `<div class="dayof-hero" ${meal ? 'style="grid-template-columns:1fr"' : ""}><div>${big}<div class="dayof-name">${esc(s._meal ? s.name : isDinner(next) ? s.name : nameOf(s))}</div>
      <p class="body-2" style="margin-top:6px">Next${s._meal ? " · lunch" : isDinner(next) ? " · dinner" : ""} · ${planned != null && Math.abs(planned - next.arrive) > 4 ? `planned ${fmtS(planned)}, now ${fmtS(next.arrive)}` : `arrive ${fmt(next.arrive)}`}</p></div>
      ${meal ? "" : photo(s.id, { cls: "ph-next", sizes: "110px", short: true })}</div>`;
  }
  const dark = PLAN.alerts.find(a => a.id === "dark");
  const others = PLAN.alerts.filter(a => a.id !== "dark" && a.id !== "wed");
  const doneRow = done.length ? `<div class="done-row"><span><b>${doneLabel} done</b><span class="meta">${esc(doneNames.map(nameOf).join(", "))}${st.trip.lunchDone ? ", lunch" : ""}</span></span><button class="linkbtn" data-act="showDone" aria-expanded="${st.showDone}">${st.showDone ? "Hide" : "Show"}</button></div>
    ${st.showDone ? `<div class="tl">${done.map(id => { const s = byId(id); return `<div class="tl-row done"><span class="tl-num">${numOf(id)}</span><span class="tl-body"><span class="tl-name">${esc(nameOf(s))}</span><span class="meta"><span aria-hidden="true">&check;</span> Done ${st.trip.doneAt && st.trip.doneAt[id] != null ? fmt(st.trip.doneAt[id]) : ""}</span></span><button class="linkbtn" data-act="undo" data-arg="${id}" aria-label="Undo done for ${esc(nameOf(s))}">Undo</button></div>`; }).join("")}</div>` : ""}` : "";
  const t = dark ? trimSuggestion() : null;
  const lateIds = new Set(PLAN.items.filter(i => !i.s._meal && i.arrive > PLAN.sun.sunset - 10 && i.s.cats.some(c => c === "viewpoint" || c === "swimming")).map(i => i.s.id));
  const rows = [...PLAN.items, ...(PLAN.dinnerItem ? [PLAN.dinnerItem] : [])].slice(next ? 1 : 0).map(it => {
    const s = it.s;
    if (s._meal || isDinner(it)) return `<div class="tl-row meal"><span class="tl-num"><span class="diamond" style="width:12px;height:12px" aria-hidden="true"></span></span><span class="tl-body"><span class="tl-name">${s._meal ? "Lunch" : "Dinner"}, ${esc(s.name)}</span></span><span class="tl-time">${fmtS(it.arrive)}</span></div>`;
    const planned = plannedArrival(s.id), late = planned != null ? Math.round(it.arrive - planned) : 0;
    const sub = t && t.single && t.stop.id === s.id ? `<span class="late" style="font-size:13px">Suggested trim</span>` : lateIds.has(s.id) ? `<span class="late" style="font-size:13px">${late > 5 ? dur(late) + " late · " : ""}light fading</span>` : "";
    return `<button class="tl-row" data-act="detail" data-arg="${s.id}"><span class="tl-num">${numOf(s.id)}</span><span class="tl-body"><span class="tl-name">${esc(nameOf(s))}</span>${sub}</span><span class="tl-time ${lateIds.has(s.id) ? "late" : ""}">${fmtS(it.arrive)}${lateIds.has(s.id) ? '<span class="sr">, after sunset</span>' : ""}</span></button>`;
  }).join("");
  return `<div class="wrap">
    <header class="dayof-head"><span class="meta">On the road · Guam time ${fmt(now.min)}</span><button class="btn btn-outline" data-act="endTrip">End day</button></header>
    ${hero}
    ${dark ? `<div class="alerts">${alertHtml(dark, { dayof: true })}</div>` : ""}
    ${doneRow}
    <div class="tl-list">${rows || `<p class="meta" style="padding:12px 0">Nothing else on the plan. Dinner and home are below.</p>`}
      <div class="tl-row home"><span class="tl-num">Home</span><span class="tl-body"><span class="tl-name">Oceanview Drive</span></span><span class="tl-time">${fmtS(PLAN.homeT)}</span></div></div>
    ${others.length ? `<div class="alerts">${others.map(a => alertHtml(a)).join("")}</div>` : ""}
    <p class="foot">Times move as you mark stops done. Drive times are estimates, not live traffic.</p>
  </div>`;
}

export function nextBar() {
  if (!st.trip.on) return "";
  const next = nextItem();
  if (!next) {
    return `<div class="nextbar gcc-light" role="region" aria-label="Next stop"><div class="in"><div class="kicker">All stops done</div><div class="name">Head home</div><p class="meta" style="color:var(--gcc-ink-2)">${dur(PLAN.homeLeg.min)} to Oceanview Drive</p>
      <div class="btns two-one"><a class="btn btn-lagoon" href="${navLinks(HOME).google}" target="_blank" rel="noopener">Navigate</a><button class="btn btn-primary" data-act="endTrip">End day</button></div></div></div>`;
  }
  const s = next.s, meal = s._meal ? "lunch" : isDinner(next) ? "dinner" : null;
  const doneArg = meal === "lunch" ? "lunch:" + s.id : meal === "dinner" ? "dinner:" + s.id : s.id;
  const logged = !meal && entryFor(s.id);
  return `<div class="nextbar gcc-light" role="region" aria-label="Next stop"><div class="in">
    <div class="between"><div style="min-width:0"><div class="kicker">Next stop · ${meal ? meal : numOf(s.id)}</div><div class="name">${esc(meal ? s.name : nameOf(s))}</div>
      <p class="meta" style="color:var(--gcc-ink-2);font-size:15px">Arrive ${fmt(next.arrive)} · ${dur(next.leg.min)} drive</p></div>
      ${meal ? "" : `<button class="linkbtn ink" data-act="log" data-arg="${s.id}">${logged ? "Logged" : "Log stop"}</button>`}</div>
    <div class="btns two-one"><a class="btn btn-lagoon" href="${navLinks(s).google}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(meal ? s.name : nameOf(s))} in Google Maps">Navigate</a><button class="btn btn-primary" data-act="done" data-arg="${doneArg}">Done</button></div>
  </div></div>`;
}
