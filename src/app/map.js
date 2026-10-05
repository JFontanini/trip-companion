// Map tab: the v0 drawn SVG map with Reef Atlas markers (circle, square, diamond, outline square
// for off plan), a 3 px primary route line, 44 px hit areas and a 3 px ink ring on the selection.
// Below 980 px the selected stop sits in a drawer under the map; at 980 px and up, a 420 px panel.
import { st, save } from "./state.js";
import { esc, navLinks } from "./util.js";
import { photo, photoFor, credit } from "./photos.js";
import { ENGINE } from "../trip.js";
import { PLAN, STOPS, RESTAURANTS, HOME, byId, nameOf, numOf, catOf, catVar, shapeHtml, HISTORY_CATS, primaryCat, litekyanState, fmt, fmtS, dur } from "./plan.js";

const K = 1000, COS = Math.cos(13.45 * Math.PI / 180), LON0 = 144.60, LAT0 = 13.68;
const P = (lat, lon) => [(lon - LON0) * K * COS, (LAT0 - lat) * K];
const OUTLINE = [[144.8852,13.6409],[144.896,13.6172],[144.914,13.6054],[144.9356,13.6004],[144.9536,13.5987],[144.9536,13.5868],[144.9392,13.5598],[144.9068,13.5159],[144.8708,13.4855],[144.8096,13.445],[144.7844,13.4197],[144.77,13.3792],[144.7592,13.2863],[144.734,13.2491],[144.7196,13.2424],[144.698,13.2407],[144.68,13.2474],[144.6692,13.2643],[144.6584,13.2812],[144.6548,13.2863],[144.6476,13.3251],[144.644,13.3319],[144.6404,13.3369],[144.6332,13.342],[144.626,13.3454],[144.6368,13.3555],[144.644,13.3656],[144.6476,13.3792],[144.6476,13.396],[144.644,13.4045],[144.6404,13.4146],[144.6332,13.4231],[144.6224,13.4315],[144.6296,13.4383],[144.6368,13.4433],[144.6404,13.4383],[144.6548,13.4399],[144.716,13.4737],[144.7304,13.4855],[144.7844,13.5159],[144.7952,13.5277],[144.8024,13.5396],[144.8096,13.5531],[144.8312,13.6206],[144.8384,13.6324],[144.8492,13.6443],[144.8672,13.6527],[144.8816,13.6544]];
function smoothClosed(pts) {
  const n = pts.length; let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}
const LAND = smoothClosed(OUTLINE.map(([lon, lat]) => P(lat, lon)));

export const LAYERS = [["viewpoint", "Views"], ["nature", "Nature"], ["swimming", "Swimming"], ["history", "History"], ["seafood", "Food"]];
const layerShape = k => k === "history" ? `<span class="shape shape-s" style="--c:var(--gcc-cat-spanish)" aria-hidden="true"></span>` : k === "seafood" ? `<span class="shape shape-d" style="--c:var(--gcc-cat-food)" aria-hidden="true"></span>` : shapeHtml({ cats: [k] });
function visible(s) {
  const layers = new Set(st.layers);
  if (!layers.size) return true;
  if (s.kind === "meal") return layers.has("seafood");
  return (s.cats || []).some(c => layers.has(c) || (layers.has("history") && HISTORY_CATS.includes(c)));
}

export let mapVB = { x: -10, y: -24, w: 380, h: 500 };
function mapSvg() {
  const p = PLAN;
  const seq = [HOME, ...p.items.map(i => i.s), ...(p.dinnerItem ? [p.dinnerItem.s] : []), HOME];
  if (st.trip.on && st.trip.last) seq[0] = byId(st.trip.last) || HOME;
  const legs = [...p.items.map(i => i.leg), ...(p.dinnerItem ? [p.dinnerItem.leg] : []), p.homeLeg];
  let all = [];
  for (let i = 0; i < seq.length - 1; i++) { const lp = ENGINE.legPath(seq[i], seq[i + 1], legs[i]); all = all.concat(lp.slice(i ? 1 : 0)); }
  const rd = all.map(([la, lo], i) => { const [x, y] = P(la, lo); return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1); }).join("");
  // Direction arrows on a sparse copy of the path, about one every 30 map units
  const pts = all.map(([la, lo]) => P(la, lo)); let acc = 0; const sparse = [pts[0]];
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc > 30) { sparse.push(pts[i]); acc = 0; } }
  const ad = sparse.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1)).join("");
  const route = `<path d="${rd}" fill="none" stroke="var(--gcc-bg)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/><path d="${rd}" fill="none" stroke="var(--gcc-primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="${ad}" fill="none" stroke="none" stroke-width="3" marker-mid="url(#arw)"/>`;
  const LBL = [["Philippine Sea", 13.50, 144.635, 1], ["Pacific Ocean", 13.33, 144.86, 1], ["Hagåtña", 13.488, 144.745], ["Tumon", 13.523, 144.786], ["Yigo", 13.555, 144.905], ["Andersen AFB (no access)", 13.592, 144.912], ["Apra Harbor", 13.447, 144.648], ["Hågat", 13.381, 144.672], ["Humåtak", 13.300, 144.672], ["Malesso'", 13.252, 144.688], ["Inalåhan", 13.284, 144.735], ["Talo'fo'fo", 13.352, 144.748], ["Yona", 13.412, 144.763], ["Mangilao", 13.462, 144.828]];
  const lbl = LBL.map(([t, la, lo, sea]) => { const [x, y] = P(la, lo); return `<text class="maplabel" x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-size="${sea ? 10 : 7.5}" ${sea ? 'font-style="italic" letter-spacing="1"' : ""} text-anchor="middle">${t}</text>`; }).join("");

  const marker = (s, { inPlan, label, meal, done }) => {
    const [x, y] = P(s.lat, s.lon);
    const sel = st.selected === s.id, r = 9;
    const shape = meal ? "d" : catOf(s).shape;
    const fill = inPlan ? (meal ? "var(--gcc-cat-food)" : catVar(s)) : "var(--gcc-bg)";
    const stroke = inPlan ? "var(--gcc-bg)" : "var(--gcc-ink-3)";
    let g = shape === "s" ? `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"` : shape === "d" ? `<rect x="${-r * .82}" y="${-r * .82}" width="${1.64 * r}" height="${1.64 * r}" transform="rotate(45)"` : `<circle r="${r}"`;
    if (done) g = `<circle r="${r}" fill="var(--gcc-bg)" stroke="${catVar(s)}" stroke-width="2"/>`;
    else { if (!inPlan) g = `<rect x="-6.5" y="-6.5" width="13" height="13"`; g += ` fill="${fill}" stroke="${stroke}" stroke-width="${inPlan ? 1.5 : 1.8}"/>`; }
    const ring = sel ? `<circle class="ring" r="13.5" fill="none" stroke="var(--gcc-ink)" stroke-width="3"/>` : `<circle class="ring" r="13.5" fill="none" stroke="transparent" stroke-width="3"/>`;
    const txtFill = done ? catVar(s) : meal ? "var(--gcc-on-sunset)" : "var(--gcc-on-marker)";
    const txt = (inPlan || done) && label ? `<text y="2.7" font-size="${label.length > 1 ? 7.4 : 8.5}" text-anchor="middle" fill="${txtFill}">${label}</text>` : "";
    const aria = meal ? `${label === "L" ? "Lunch" : "Dinner"}, ${s.name}` : `${nameOf(s)}, ${catOf(s).label}${inPlan ? ", stop " + numOf(s.id) : done ? ", stop " + numOf(s.id) + ", done" : ", not on plan"}`;
    return `<g class="mk" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(aria)}" aria-pressed="${sel}" data-sel="${s.id}"><circle r="22" fill="transparent"/>${ring}${g}${txt}</g>`;
  };
  let mk = "";
  const ordered = STOPS.filter(s => s.kind !== "meal" && visible(s)).sort((a, b) => (PLAN.items.some(i => i.s.id === a.id) ? 1 : 0) - (PLAN.items.some(i => i.s.id === b.id) ? 1 : 0));
  for (const s of ordered) {
    const inPlan = p.items.some(i => i.s.id === s.id), done = st.trip.on && st.trip.status[s.id] === "done";
    mk += marker(s, { inPlan, done, label: inPlan || done ? numOf(s.id) : "" });
  }
  if (visible({ kind: "meal" })) {
    if (p.lunch) { const it = p.items.find(i => i.s._meal); if (it) mk += marker(byId(it.s.id), { inPlan: true, label: "L", meal: true }); }
    if (p.dinnerItem) mk += marker(p.dinnerItem.s, { inPlan: true, label: "D", meal: true });
  }
  const [hx, hy] = P(HOME.lat, HOME.lon);
  mk += `<g class="mk" transform="translate(${hx},${hy})" data-sel="home" tabindex="0" role="button" aria-label="Start and finish: Oceanview Drive, Asan"><circle r="22" fill="transparent"/><circle r="7" fill="var(--gcc-bg)" stroke="var(--gcc-ink)" stroke-width="2.5"/></g><text class="maplabel" x="${hx + 12}" y="${hy + 3}" font-size="8" font-weight="700" style="fill:var(--gcc-ink)">Asan (start)</text>`;
  const sb = 5 / 111.32 * K;
  const deco = `<g transform="translate(14,448)"><path d="M0,0 h${sb.toFixed(1)}" stroke="var(--gcc-ink)" stroke-width="2"/><path d="M0,-3 v6 M${sb.toFixed(1)},-3 v6" stroke="var(--gcc-ink)" stroke-width="1.5"/><text class="maplabel" x="${(sb / 2).toFixed(0)}" y="-5" font-size="7.5" text-anchor="middle">5 km</text></g>`;
  return `<svg id="mapsvg" viewBox="${mapVB.x} ${mapVB.y} ${mapVB.w} ${mapVB.h}" role="group" aria-label="Drawn map of Guam with today's route and numbered stops. The Today tab lists the same stops in order.">
    <defs><marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--gcc-primary)" stroke-width="2"/></marker></defs>
    <rect x="-400" y="-400" width="1200" height="1300" fill="var(--gcc-map-sea)"/>
    <path d="${LAND}" fill="var(--gcc-map-land)" stroke="var(--gcc-line)" stroke-width="1.2"/>
    ${lbl}${route}${mk}${deco}</svg>`;
}

const legend = `<div class="maplegend" aria-hidden="true"><div><span class="shape shape-c" style="--c:var(--gcc-cat-view)"></span>View, nature, swim</div><div><span class="shape shape-s" style="--c:var(--gcc-cat-ancient)"></span>History</div><div><span class="shape shape-d" style="--c:var(--gcc-cat-food)"></span>Meal</div><div><span class="shape shape-s shape-off"></span>Not on plan</div></div>`;
const controls = `<div class="mapctl"><button class="btn" data-act="zoom" data-arg="in" aria-label="Zoom in">+</button><button class="btn" data-act="zoom" data-arg="out" aria-label="Zoom out">&minus;</button><button class="btn fit" data-act="zoom" data-arg="fit" aria-label="Show the whole island">Fit</button></div>`;
const layerChips = () => {
  const layers = new Set(st.layers);
  return `<div class="chips scroll" role="group" aria-label="Show on map"><button class="chip" aria-pressed="${!layers.size}" data-act="layerclear">All</button>${LAYERS.map(([k, l]) => `<button class="chip" aria-pressed="${layers.has(k)}" data-act="layer" data-arg="${k}">${layerShape(k)}${l}</button>`).join("")}</div>`;
};

function itemFor(id) { return PLAN.items.find(i => i.s.id === id) || (PLAN.dinnerItem && PLAN.dinnerItem.s.id === id ? PLAN.dinnerItem : null); }
function isMealId(id) { const it = itemFor(id); return !!(it && (it.s._meal || it === PLAN.dinnerItem)); }

function drawer(s) {
  if (!s || s.id === "home") return `<div class="drawer"><div><div class="kicker">Start and finish</div><h3>Oceanview Drive, Asan</h3><p class="meta">The loop starts and ends here.</p></div><div></div></div>`;
  const it = itemFor(s.id), meal = isMealId(s.id);
  const L = navLinks(s);
  return `<div class="drawer" aria-live="polite"><div style="min-width:0">
      <div>${meal ? `<span class="diamond" style="display:inline-block;width:20px;height:20px;margin:6px 8px 0 4px" aria-hidden="true"></span>` : `<span class="n">${numOf(s.id) || "+"}</span>`}<span class="when">${it ? `${fmtS(it.arrive)} · ${dur(it.dwell)}` : st.trip.on && st.trip.status[s.id] === "done" ? "Done" : "Not on today's plan"}</span></div>
      <h3>${esc(meal ? s.name : nameOf(s))}</h3><p class="meta" style="color:var(--gcc-ink-2);font-size:14px">${esc(s.short)}</p></div>
    ${meal ? "<div></div>" : photo(s.id, { cls: "ph-drawer", sizes: "110px", caption: false })}
    <div class="btns"><a class="btn btn-primary" href="${L.google}" target="_blank" rel="noopener">Navigate</a>${meal ? `<button class="btn btn-secondary" data-act="tab" data-arg="eat">Change</button>` : `<button class="btn btn-secondary" data-act="detail" data-arg="${s.id}">Details</button>`}</div></div>`;
}

function panel(s) {
  if (!s || s.id === "home") s = PLAN.items.find(i => !i.s._meal)?.s || STOPS.find(x => x.id === "cetti");
  const it = itemFor(s.id), meal = isMealId(s.id);
  const L = navLinks(s);
  const list = PLAN.items.filter(i => !i.s._meal);
  const idx = Math.max(0, list.findIndex(i => i.s.id === s.id));
  const near = list.slice(Math.max(0, idx - 2), idx + 2);
  const cat = catOf(s);
  return `<aside class="panel" aria-label="Selected stop">
    <div class="detail-hero">${meal ? "" : photo(s.id, { cls: "ph-panel", sizes: "420px", caption: false })}${!meal && numOf(s.id) ? `<span class="num-l" aria-hidden="true">${numOf(s.id)}</span>` : ""}</div>
    <div class="in">${meal ? "" : credit(photoFor(s.id), { tag: "p" })}
      <div class="kicker" style="margin-top:12px">${meal ? (PLAN.lunch && PLAN.lunch.id === s.id ? "Lunch" : "Dinner") : esc(cat.label)} · ${esc(s.village || s.area || "")}</div>
      <h2>${esc(meal ? s.name : nameOf(s))}</h2>
      <p class="body-2" style="margin-top:8px">${esc(s.short)}</p>
      <p class="meta" style="margin-top:6px">${it ? `Arrive ${fmt(it.arrive)} · ${dur(it.leg.min)} from the previous stop` : st.trip.on && st.trip.status[s.id] === "done" ? "Done" : "Not on today's plan"}</p>
      <div class="btns" style="margin-top:12px"><a class="btn btn-primary" href="${L.google}" target="_blank" rel="noopener">Google Maps</a><a class="btn btn-secondary" href="${L.apple}" target="_blank" rel="noopener">Apple Maps</a><a class="btn btn-secondary" href="${L.waze}" target="_blank" rel="noopener">Waze</a></div>
      ${meal ? "" : `<div class="btns" style="margin-top:2px"><button class="btn btn-outline" data-act="detail" data-arg="${s.id}">Stop details</button>${it ? `<button class="btn btn-outline" data-act="skip" data-arg="${s.id}">Skip</button>` : (s.id === "ritidian" && !PLAN.rit.open ? (PLAN.rit.code === "surf" ? `<button class="btn btn-outline" data-act="cond" data-arg="surf">Turn off High surf</button>` : `<button class="btn" disabled>${esc(litekyanState().short)}</button>`) : `<button class="btn btn-outline" data-act="add" data-arg="${s.id}">Add to plan</button>`)}</div>`}
      <p class="meta" style="margin-top:12px">Drawn map, not to road-level detail. Use Navigate for turn-by-turn directions.</p>
      <ul class="near">${near.map(i => `<li><button data-sel="${i.s.id}" aria-current="${i.s.id === s.id}"><span class="n">${numOf(i.s.id)}</span><span>${esc(nameOf(i.s))}</span><span>${fmtS(i.arrive)}</span></button></li>`).join("")}</ul>
    </div></aside>`;
}

export function viewMap() {
  const sel = byId(st.selected) || STOPS.find(s => s.id === "cetti");
  const n = PLAN.items.filter(i => !i.s._meal).length;
  return `<div class="mapview"><div class="map-head"><div class="between"><h1 class="h2">Map</h1><span class="meta">${String(n).padStart(2, "0")} stops · ${st.dir === "cw" ? "clockwise" : "south first"}</span></div>${layerChips()}</div>
    <div class="mapgrid"><div class="mapcol"><div class="maplayers">${layerChips()}</div><div class="mapbox" id="mapbox">${mapSvg()}${controls}${legend}</div>${drawer(sel)}
      <p class="meta mapnote">Drawn map, not to road-level detail. Use Navigate for turn-by-turn directions. Arrows show the direction of travel.</p></div>
    ${panel(sel)}</div></div>`;
}

// pan and zoom (from v0)
export let dragMoved = false;
function setVB() { const svg = document.getElementById("mapsvg"); if (svg) svg.setAttribute("viewBox", `${mapVB.x} ${mapVB.y} ${mapVB.w} ${mapVB.h}`); }
export function zoom(k) {
  if (k === "fit") { mapVB = { x: -10, y: -24, w: 380, h: 500 }; fitAspect(); return setVB(); }
  const f = k === "in" ? 0.7 : 1 / 0.7; const cx = mapVB.x + mapVB.w / 2, cy = mapVB.y + mapVB.h / 2;
  const ratio = mapVB.h / mapVB.w;
  mapVB.w = Math.min(700, Math.max(60, mapVB.w * f)); mapVB.h = mapVB.w * ratio; mapVB.x = cx - mapVB.w / 2; mapVB.y = cy - mapVB.h / 2; setVB();
}
function fitAspect() {
  const box = document.getElementById("mapbox"); if (!box || !box.clientWidth) return;
  const ratio = box.clientHeight / box.clientWidth;
  const cx = mapVB.x + mapVB.w / 2, cy = mapVB.y + mapVB.h / 2;
  if (ratio > 500 / 380) { mapVB.w = Math.max(mapVB.w, 380); mapVB.h = mapVB.w * ratio; } else { mapVB.h = Math.max(mapVB.h, 500); mapVB.w = mapVB.h / ratio; }
  mapVB.x = cx - mapVB.w / 2; mapVB.y = cy - mapVB.h / 2;
}
export function bindMap() {
  const svg = document.getElementById("mapsvg"); if (!svg) return;
  const box = document.getElementById("mapbox");
  if (Math.abs(mapVB.h / mapVB.w - box.clientHeight / box.clientWidth) > 0.01) { fitAspect(); setVB(); }
  let start = null; const pts = new Map();
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  svg.addEventListener("pointerdown", e => { pts.set(e.pointerId, [e.clientX, e.clientY]); dragMoved = false; start = { x: e.clientX, y: e.clientY, vb: { ...mapVB }, d: pts.size === 2 ? dist() : null }; });
  svg.addEventListener("pointermove", e => {
    if (!start || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect();
    if (pts.size === 2 && start.d) { const f = start.d / dist(); const w = Math.min(700, Math.max(60, start.vb.w * f)); const cx = start.vb.x + start.vb.w / 2, cy = start.vb.y + start.vb.h / 2; mapVB.w = w; mapVB.h = w * start.vb.h / start.vb.w; mapVB.x = cx - w / 2; mapVB.y = cy - mapVB.h / 2; dragMoved = true; setVB(); return; }
    const dx = (e.clientX - start.x) * mapVB.w / r.width, dy = (e.clientY - start.y) * mapVB.h / r.height;
    if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 6) { dragMoved = true; if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId); }
    if (dragMoved) { mapVB.x = start.vb.x - dx; mapVB.y = start.vb.y - dy; setVB(); }
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size === 0) { start = null; setTimeout(() => { dragMoved = false; }, 0); } };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? "in" : "out"); }, { passive: false });
}
export function selectStop(id) { st.selected = id; save(); }
