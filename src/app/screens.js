// Stops, Eat, Safety, the stop detail sheet and Guam in layers.
import { st } from "./state.js";
import { esc, navLinks, ARROW, dateLabel } from "./util.js";
import { photo, photoFor, credit } from "./photos.js";
import { ENGINE, ACCESSED, PACK } from "../trip.js";
import { PLAN, STOPS, RESTAURANTS, HOME, byId, nameOf, numOf, catOf, shapeHtml, fmt, fmtS, dur, stopCount, litekyanState, areaName } from "./plan.js";
import { entryFor } from "./journal-store.js";
import { fullRouteLink } from "./today.js";
import { DOW, dowOf } from "../engine/loop-drive.js";

const S = PACK.sources;
const src = k => S[k];
const PRI = { essential: "Must see", recommended: "Recommended", optional: "Optional" };

// ---------- Stops ----------
export function viewStops() {
  const onPlan = s => PLAN.items.some(i => i.s.id === s.id) || (st.trip.on && st.trip.status[s.id] === "done");
  // On-plan stops in plan order by number, then the rest in loop order
  const rank = s => onPlan(s) && numOf(s.id) ? Number(numOf(s.id)) : 100 + ENGINE.orderKey(s, st.dir);
  const order = STOPS.filter(s => s.kind !== "meal").sort((a, b) => rank(a) - rank(b));
  const isSkipped = s => st.overrides[s.id] === false;
  const filt = st.stopsFilter;
  const list = order.filter(s => filt === "all" ? true : filt === "on" ? onPlan(s) : !onPlan(s));
  const card = s => {
    const it = PLAN.items.find(i => i.s.id === s.id), on = onPlan(s), lk = s.id === "ritidian" ? litekyanState() : { closed: false }, closed = lk.closed;
    const logged = entryFor(s.id);
    const meta = [s.alt && s.alt[0] && s.id !== "inalahan-village" ? s.alt[0] : s.village, catOf(s).short, it ? `${fmt(it.arrive)} · ${dur(it.dwell)}` : `${s.dur[0]} to ${s.dur[1]} min`].filter(Boolean).join(" · ");
    return `<article class="scard ${on ? "" : "skipped"}">
      <div style="position:relative">${photo(s.id, { cls: "ph-card", sizes: "(min-width:700px) 340px, 100vw" })}${on && numOf(s.id) ? `<span class="badge" aria-hidden="true">${numOf(s.id)}</span>` : ""}</div>
      <h3><button class="linkbtn ink" style="font-size:inherit;color:inherit;text-decoration:none;padding:0;text-align:left;font-weight:inherit;letter-spacing:inherit" data-act="detail" data-arg="${s.id}">${esc(nameOf(s))}</button></h3>
      <p class="meta">${esc(meta)}${on ? "" : closed ? " · " + esc(lk.short.toLowerCase()) : isSkipped(s) ? " · skipped" : " · not on plan"}</p>
      <div class="btns">${closed ? (PLAN.rit.code === "surf" ? `<button class="btn btn-outline" data-act="cond" data-arg="surf">Turn off High surf</button>` : `<button class="btn" disabled>${esc(lk.short)}</button>`)
        : on ? `<button class="btn btn-primary" aria-pressed="true" data-act="skip" data-arg="${s.id}" aria-label="On plan. Skip ${esc(nameOf(s))}">On plan</button>`
        : `<button class="btn btn-outline" data-act="add" data-arg="${s.id}">Add to plan</button>`}
        ${on ? `<button class="btn ${logged ? "btn-ok" : "btn-secondary"}" data-act="log" data-arg="${s.id}">${logged ? "Logged" : "Log this stop"}</button>` : `<button class="btn btn-secondary" data-act="detail" data-arg="${s.id}">Details</button>`}</div>
    </article>`;
  };
  return `<div class="wrap">
    <header class="mhead"><span class="wordmark">Guam, the loop</span></header>
    <div class="between" style="padding-top:var(--gcc-space-5);align-items:flex-end"><h1 class="display">${order.length} <em>places</em></h1><span class="meta">${String(stopCount()).padStart(2, "0")} on today's plan</span></div>
    <div class="seg sm" role="group" aria-label="Filter stops" style="margin-top:var(--gcc-space-4)">${[["all", "All"], ["on", "On plan"], ["off", "Not on plan"]].map(([k, l]) => `<button aria-pressed="${filt === k}" data-act="stopsFilter" data-arg="${k}">${l}</button>`).join("")}</div>
    <div class="cards">${list.map(card).join("") || `<p class="body-2">Nothing here. Every stop is on today's plan.</p>`}</div>
    <button class="btn btn-long btn-block btn-outline" style="margin:var(--gcc-space-6) 0" data-act="layers"><span>Guam in layers: history and sources</span>${ARROW}</button>
  </div>`;
}

// ---------- Eat ----------
export function viewEat() {
  const ranked = ENGINE.rankDinner(st, PLAN);
  const dinnerOn = !!PLAN.dinnerItem;
  const fitTags = r => [["grilled", "Grilled fish"], ["sashimi", "Sashimi or ceviche"], ["lowCarb", "Low-carb options"], ["sauceSide", "Sauce on the side"], ["spicy", "Spicy options"]].filter(([k]) => r.fits[k]).map(([, l]) => `<span class="tag ok">${l}</span>`).join("");
  const card = (x, i) => {
    const r = x.r, chosen = PLAN.dinnerId === r.id;
    const L = navLinks(r);
    const timeTag = chosen && PLAN.dinnerItem ? `<span class="tag ok">Dinner at ${fmtS(PLAN.dinnerItem.arrive)}</span>` : x.extra > 15 ? `<span class="tag warn">Adds ${dur(x.extra)} driving</span>` : "";
    return `<article class="rcard ${chosen ? "chosen" : ""}"><span class="rank" aria-hidden="true">${i + 1}</span>
      <div><div class="kicker">${chosen ? "Your dinner" : `Ranked ${i + 1}`}</div><h3>${esc(r.name)}</h3><p class="meta">${esc(areaName(r.area))} · ${esc(r.type)} · ${r.price}</p></div>
      <div class="full">
        <div class="three"><div><b>${x.toR}</b><span>min there</span></div><div><b>${x.toHome}</b><span>min home</span></div><div><b class="${x.extra <= 3 ? "zero" : x.extra > 15 ? "plus" : ""}">+${Math.max(0, x.extra)}</b><span>extra min</span></div></div>
        <div class="tags">${timeTag}${fitTags(r)}</div>
        <p class="order"><b>How to order:</b> ${esc(r.orders.join(". "))}.</p>
        <p class="meta" style="margin-top:8px">${esc(r.hoursNote)} Last checked ${ACCESSED}. <a href="${src(r.sources[0]).url}" target="_blank" rel="noopener">Source</a></p>
        <div class="btns" style="margin-top:12px"><a class="btn btn-primary" href="${L.google}" target="_blank" rel="noopener">Navigate</a>${chosen ? `<button class="btn btn-secondary" aria-pressed="true" data-act="dinnerOff">Chosen · remove</button>` : `<button class="btn btn-secondary" data-act="dinner" data-arg="${r.id}">Choose</button>`}</div>
      </div></article>`;
  };
  const lunchC = [STOPS.find(s => s.id === "jeffs"), RESTAURANTS.find(r => r.id === "marina")];
  const lunchIt = PLAN.items.find(i => i.s._meal);
  return `<div class="wrap">
    <header class="mhead"><span class="wordmark">Guam, the loop</span></header>
    <h1 class="display" style="padding-top:var(--gcc-space-5)">Dinner,<br><em>ranked.</em></h1>
    <p class="lede">Seafood that fits the end of your loop: fresh fish, simple grilling, sashimi, shrimp, lower-carb sides and sauces on the side.</p>
    <div class="chips" role="group" aria-label="Tonight I want" style="margin-top:var(--gcc-space-4)">${ENGINE.MOODS.map(m => `<button class="chip" aria-pressed="${st.mood === m.id}" data-act="mood" data-arg="${m.id}">${esc(m.label)}</button>`).join("")}</div>
    ${dinnerOn ? "" : `<div class="alerts"><div class="alert note"><div class="sev">Note</div><h3>${st.dinnerForced && st.dinner === "none" ? "Dinner is off the plan" : "Scenic Express has one meal"}</h3><p>Choose a restaurant below, or add the default dinner for your direction.</p><div class="acts"><button class="btn btn-primary" data-act="dinnerOn">Add dinner</button></div></div></div>`}
    <div style="margin-top:var(--gcc-space-5)">${ranked.map(card).join("")}</div>
    <section class="section"><h2 class="h3">Lunch on the road</h2><p class="meta" style="margin-top:6px">The plan picks whichever lands closest to midday.${lunchIt ? ` Today that is ${esc(lunchIt.s.name)}, arriving ${fmt(lunchIt.arrive)}` : ""}</p>
      <div style="margin-top:12px;border-top:var(--gcc-rule-w) solid var(--gcc-rule)">${lunchC.map(c => `<div class="lunch-row"><div><b>${esc(c.name)}</b><p class="meta">${esc(c.village || areaName(c.area))}${lunchIt && lunchIt.s.id === c.id ? " · planned" : ""}</p><p class="meta" style="color:var(--gcc-ink-2)">${esc(c.kind === "meal" ? c.practical[0] : c.orders.join(". ") + ".")}</p><p class="meta">${esc(c.hours && c.hours.note ? c.hours.note : c.hoursNote)} Last checked ${ACCESSED}.</p></div><a class="linkbtn" href="${navLinks(c).google}" target="_blank" rel="noopener">Navigate</a></div>`).join("")}</div>
    </section>
    <section class="section"><div class="shallows"><h2 class="h4">Chamorro Village, Hagåtña</h2><p class="body-2" style="margin-top:6px">On Wednesdays the night market runs 5:30 to 9:30 p.m., with more than 80 vendors, barbecue and kelaguen, local produce, weavers and woodworkers, and dancing in the center court. It is about 10 minutes from Oceanview Drive and can replace dinner.</p>
      <p class="meta" style="margin-top:8px"><a href="${S.cvMarket.url}" target="_blank" rel="noopener">The Guam Guide</a> · <a href="${S.dcaCV.url}" target="_blank" rel="noopener">Department of Chamorro Affairs</a> · market hours last checked ${ACCESSED}</p></div></section>
    <div style="height:var(--gcc-space-6)"></div>
  </div>`;
}

// ---------- Safety ----------
export function viewSafety() {
  const sec = (t, a) => `<div class="safety-sec"><h3>${t}</h3>${a.map(x => `<p>${esc(x)}</p>`).join("")}</div>`;
  return `<div class="wrap">
    <header class="mhead"><span class="wordmark">Guam, the loop</span></header>
    <h1 class="display" style="padding-top:var(--gcc-space-5)">Stay<br><em>safe.</em></h1>
    <div class="sos" role="region" aria-label="Emergency"><div style="font-size:13px;font-weight:700">Emergency</div><div class="big">911</div><p>Police, fire and ambulance. Give your village and the nearest stop.</p><a class="btn btn-block" href="tel:911">Call 911</a></div>
    <section class="section"><h2 class="h3">Check before you go</h2>
      <div class="checkgrid">
        <a href="${S.nws.url}" target="_blank" rel="noopener">Forecast and surf<span>NWS Guam</span></a>
        <a href="${S.epa.url}" target="_blank" rel="noopener">Beach water<span>Guam EPA</span></a>
        <a href="${S.fws.url}" target="_blank" rel="noopener">Litekyan status<span>USFWS</span></a>
        <a href="${S.npsAlerts.url}" target="_blank" rel="noopener">War in the Pacific alerts<span>National Park Service</span></a>
      </div>
      <a class="btn btn-secondary btn-block" style="margin-top:2px" href="${fullRouteLink()}" target="_blank" rel="noopener">Today's route in Google Maps</a>
    </section>
    <section class="section">
      ${sec("Driving", ["Drive on the right.", "Roads in the south and north can be narrow, wet, uneven and slower than map estimates.", "Rain can arrive quickly. Slow down on the hill sections south of Hågat.", "Do not stop on unmarked shoulders or curves, and do not block driveways, narrow roads or beach access.", "Keep fuel above a quarter tank when exploring the south or north."])}
      ${sec("Ocean", ["Sea conditions change quickly.", "Reefs, currents, sharp coral and surge can make good-looking water unsafe.", "Use designated access points.", "Check official water-quality advisories before swimming, and stay out after heavy rain if advisories are issued.", "Wear reef-safe sunscreen and do not step on coral."])}
      ${sec("Heat", ["Carry more water than you expect to need.", "Use sun protection; the midday sun is strong year-round.", "Schedule strenuous walks early, and keep snacks in the car."])}
      ${sec("Respect", ["Use CHamoru place names where you can: Hågat, Humåtak, Malesso', Inalåhan, Talo'fo'fo, Hagåtña.", "Villages are communities, not exhibits. Ask before photographing people or homes.", "Respect sacred, archaeological, military and memorial sites. Do not climb on latte stones or memorials.", "Do not remove rocks, coral, artifacts, shells or historic material, and stay on marked trails."])}
      ${sec("Offline", ["The plan, map and stop guides are saved on this phone once the page has loaded, and keep working without signal. Navigation and source links need a connection. Your plan and journal are stored in this browser."])}
    </section>
    <div style="height:var(--gcc-space-6)"></div>
  </div>`;
}

// ---------- Stop detail ----------
export function detailHtml(s) {
  const it = PLAN.items.find(i => i.s.id === s.id);
  const dw = dowOf(st.date), h = s.hours ? ENGINE.hoursFor(s, dw) : null;
  const L = navLinks(s);
  const idx = it ? PLAN.items.indexOf(it) : -1;
  const then = idx >= 0 ? (PLAN.items[idx + 1] ? PLAN.items[idx + 1].s : PLAN.dinnerItem ? PLAN.dinnerItem.s : null) : null;
  const cat = catOf(s), p = photoFor(s.id);
  const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const lk = s.id === "ritidian" ? litekyanState() : { closed: false }, closed = lk.closed;
  const lookPhoto = PACK.photos.photos[s.id]?.detail || PACK.photos.needed[s.id]?.detail;
  return `<div class="detail-hero">${photo(s.id, { cls: "ph-hero", sizes: "600px", eager: true, caption: false })}
      <button class="btn close" data-act="close">Close</button>${numOf(s.id) && it ? `<span class="num-l" aria-hidden="true">${numOf(s.id)}</span>` : ""}</div>
    ${credit(p, { tag: "p" }) ? `<div style="padding:0 var(--gcc-space-5)">${credit(p, { tag: "p" })}</div>` : ""}
    <div class="wrap" style="padding-top:var(--gcc-space-4)">
      <div class="kicker">${esc(cat.label)} · ${esc(s.village)}</div>
      <h2 id="sheetTitle" class="h1" style="margin-top:6px">${esc(nameOf(s))}</h2>
      ${s.alt && s.alt.length ? `<p class="meta" style="margin-top:6px">Also ${esc(s.alt.join(", "))}${s.short_name ? ", " + esc(s.name) : ""}</p>` : ""}
      <div class="tags">${(s.cats || []).map(c => `<span class="tag">${shapeHtml({ cats: [c] })}${esc(catOf({ cats: [c] }).label)}</span>`).join("")}<span class="tag">${s.detour ? "Optional detour" : PRI[s.priority]}</span><span class="tag">${s.dur[0]} to ${s.dur[1]} min</span></div>
      <p style="margin-top:var(--gcc-space-4);font-size:17px">${esc(s.short)}</p>
      <div class="facts3">${it ? `<div><span>Arrive</span><b>${fmt(it.arrive)}</b></div><div><span>Stay</span><b>${dur(it.dwell)}</b></div><div><span>Then</span><b>${then ? esc((then.short_name || then.name).split(",")[0]) : "Home"}</b></div>`
        : `<div><span>On today's plan</span><b>${closed ? esc(lk.short) : "No"}</b></div><div><span>Suggested</span><b>${s.dur[0]} to ${s.dur[1]} min</b></div><div></div>`}</div>
      ${it && it.flags.length ? `<div class="tl-flags" style="margin-top:12px">${it.flags.map(f => `<span class="tl-flag ${f.lvl === "warn" || f.lvl === "crit" ? "warn" : ""}">${esc(f.t)}</span>`).join("")}</div>` : ""}
      <div class="btns" style="margin-top:var(--gcc-space-4)"><a class="btn btn-primary" href="${L.google}" target="_blank" rel="noopener">Google Maps</a><a class="btn btn-secondary" href="${L.apple}" target="_blank" rel="noopener">Apple Maps</a><a class="btn btn-secondary" href="${L.waze}" target="_blank" rel="noopener">Waze</a></div>
      ${s.why ? `<div class="block ruled"><h3>Why it matters</h3><p>${esc(s.why)}</p></div>` : ""}
      ${s.happened ? `<div class="block"><h3>What happened here</h3><p>${esc(s.happened)}</p></div>` : ""}
      ${s.look && s.look.length ? `<div class="block"><h3>Look for</h3>${lookPhoto ? `<div class="lookfor">${list(s.look)}${photo(s.id, { cls: "ph-sq", slot: "detail", sizes: "128px" })}</div>` : list(s.look)}</div>` : ""}
      ${s.respect ? `<div class="block"><h3>Respectful visiting</h3><p>${esc(s.respect)}</p></div>` : ""}
      <div class="block two-col"><div><h3>Practical</h3>${s.practical && s.practical.length ? list(s.practical) : "<p>Nothing special to plan for.</p>"}</div><div><h3>Hours</h3><p>${s.hours ? esc(s.hours.note) + (h && h.closed ? ` <b>Closed on ${DOW[dw]}s.</b>` : "") : "No set hours."}</p><p class="meta" style="margin-top:4px">Last checked ${ACCESSED}</p></div></div>
      ${s.safety && s.safety.length ? `<div class="block"><h3>Safety</h3>${list(s.safety)}${s.swim ? `<p class="meta" style="margin-top:6px">Check the <a href="${S.epa.url}" target="_blank" rel="noopener">Guam EPA beach report</a> and <a href="${S.nws.url}" target="_blank" rel="noopener">NWS Guam</a> before entering the water.</p>` : ""}</div>` : ""}
      <div class="block"><h3>Sources</h3><ul class="srcs">${s.sources.map(src).map(x => `<li><a href="${x.url}" target="_blank" rel="noopener">${esc(x.title)}</a><span>${esc(x.publisher)} · accessed ${ACCESSED}</span></li>`).join("")}</ul></div>
      <div class="btns" style="margin-top:var(--gcc-space-4)">${it || (st.trip.on && st.trip.status[s.id] === "done") ? `<button class="btn btn-outline" data-act="log" data-arg="${s.id}">${entryFor(s.id) ? "Edit log" : "Log this stop"}</button>` : ""}
        ${closed ? (PLAN.rit.code === "surf" ? `<button class="btn btn-outline" data-act="cond" data-arg="surf">Turn off High surf</button>` : `<button class="btn" disabled>${esc(lk.short)}</button>`) : it ? `<button class="btn btn-outline" data-act="skip" data-arg="${s.id}">Skip</button>` : `<button class="btn btn-primary" data-act="add" data-arg="${s.id}">Add to plan</button>`}</div>
    </div>`;
}

// ---------- Guam in layers ----------
const ERAS = [
  { yr: "c. 1500 BC to 1668", cat: "ancient", title: "Ancient CHamoru", text: "Long before European contact, CHamoru people built village communities across Guam and the Mariana Islands. Latte stones, pillar-and-capstone foundations of houses, remain the most visible symbol of that legacy.", at: ["ritidian", "cetti", "two-lovers", "pago"] },
  { yr: "1521 to 1898", cat: "spanish", title: "Spanish era", text: "Magellan's ships reached Guam in 1521, and Spain claimed the island in 1565. Permanent colonial rule began with the Jesuit mission of 1668, followed by decades of war, disease and forced resettlement into church-centered villages such as Inalåhan. Humåtak Bay served Manila galleons until 1815, guarded by Fort Soledad and three other forts.", at: ["inalahan-village", "merizo", "soledad"] },
  { yr: "1898 to 1941", cat: "view", title: "American naval era", text: "Spain ceded Guam to the United States after the Spanish-American War. The U.S. Navy governed the island for most of the next half century.", at: [] },
  { yr: "1941 to 1944", cat: "wwii", title: "Occupation and war", text: "Japan occupied Guam from December 1941 to July 1944, 31 months marked by forced labor, internment and killings of CHamoru civilians. U.S. forces landed at Asan and Hågat on July 21, 1944, now Liberation Day. The last organized fighting came at Mataguac in Yigo that August.", at: ["gaan", "asan-overlook", "spmp"] },
  { yr: "1950 to today", cat: "swim", title: "Guam today", text: "The Organic Act of 1950 made Guam an unincorporated U.S. territory and its people U.S. citizens. CHamoru language, food, fiestas and family networks remain central to the island's identity.", at: [] }
];
export function layersHtml() {
  const seeIt = ids => { const on = ids.filter(id => numOf(id) && PLAN.items.some(i => i.s.id === id)); return on.length ? `<p class="meta" style="margin-top:6px">See it at ${on.map(id => `${numOf(id)} ${esc(nameOf(byId(id)))}`).join(", ")}</p>` : ""; };
  const all = Object.values(S).sort((a, b) => a.publisher.localeCompare(b.publisher));
  return `<div class="wrap" style="padding-top:var(--gcc-space-5)">
    <div class="between"><h2 id="sheetTitle" class="display">Guam<br>in <em>layers.</em></h2><button class="btn close-r" data-act="close">Close</button></div>
    <p class="lede">Five eras you pass through on the drive, oldest first.</p>
    <div style="margin-top:var(--gcc-space-5)">${ERAS.map(e => `<div class="era"><div class="yr" style="color:var(--gcc-${e.cat === "view" ? "cat-view" : e.cat === "swim" ? "lagoon-text" : "cat-" + e.cat})">${e.yr.replace(" to ", "<br>to ")}</div><div><h3>${e.cat !== "swim" ? `<span class="shape shape-s" style="--c:var(--gcc-cat-${e.cat})" aria-hidden="true"></span>` : ""}${e.title}</h3><p>${esc(e.text)}</p>${seeIt(e.at)}</div></div>`).join("")}</div>
    <p class="meta" style="margin-top:var(--gcc-space-3)">The era summaries draw on general reference history; stop claims carry their own sources.</p>
    <div class="block ruled"><h3 class="h3">Sources</h3><ul class="srcs" style="margin-top:12px">${all.map(x => `<li><a href="${x.url}" target="_blank" rel="noopener">${esc(x.title)}</a><span>${esc(x.publisher)} · ${dateLabel(x.accessedAt, { month: "short", day: "numeric", year: "numeric" })}</span></li>`).join("")}</ul></div>
  </div>`;
}
