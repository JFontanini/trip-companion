// Stop photos: approved, licensed images from trips/<slug>/photos.json, or the person's own
// logged photo when they chose "Use as this stop's photo" (change 10). Anything else is a
// labeled empty slot that keeps its size.
import { PACK } from "../trip.js";
import { esc } from "./util.js";

const APPROVED = PACK.photos.photos || {};
const NEEDED = PACK.photos.needed || {};
const userPhotos = {}; // stopId -> object URL from the journal store
export function setUserPhoto(stopId, url) { if (url) userPhotos[stopId] = url; else delete userPhotos[stopId]; }

const ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/></svg>`;

function srcset(p) {
  return [500, 960, 1280].filter(w => w < p.width).map(w => `${p.thumbBase}/${w}px-${p.thumbName} ${w}w`).join(", ");
}

export function photoFor(stopId, slot = "hero") {
  if (slot === "hero" && userPhotos[stopId]) return { user: true, url: userPhotos[stopId] };
  const p = APPROVED[stopId] && APPROVED[stopId][slot];
  return p ? { ...p } : null;
}
export function neededLabel(stopId, slot = "hero") { return (NEEDED[stopId] || {})[slot] || null; }

export function credit(p, { short = false, tag = "figcaption" } = {}) {
  if (!p) return "";
  if (p.user) return `<${tag} class="credit"><b class="you">Your photo</b> · now shown for this stop</${tag}>`;
  return `<${tag} class="credit"><a href="${esc(p.pageUrl)}" target="_blank" rel="noopener"><b>${esc(p.artist)}</b>${short ? "" : " · " + esc(p.source)} · ${esc(p.license)}</a></${tag}>`;
}

// One photo slot. cls sets the crop (see app.css: .ph-tall, .ph-hero, .ph-card, .ph-sq, .ph-next, .ph-panel)
export function photo(stopId, { cls = "ph-card", slot = "hero", sizes = "100vw", eager = false, caption = true, short = false, label } = {}) {
  const p = photoFor(stopId, slot);
  if (!p) {
    const need = label || neededLabel(stopId, slot);
    return `<figure class="ph ${cls}"><div class="ph-empty" role="img" aria-label="${esc(need ? need + ", photo needed" : "Photo needed")}">${ICON}${need ? `<span>${esc(need)}</span>` : ""}<span class="ph-need">Photo needed</span></div></figure>`;
  }
  const img = p.user
    ? `<img src="${esc(p.url)}" alt="Your photo of this stop" ${eager ? "" : 'loading="lazy"'}>`
    : `<img src="${p.thumbBase}/960px-${p.thumbName}" srcset="${srcset(p)}" sizes="${esc(sizes)}" alt="${esc(p.alt)}" style="object-position:${esc(p.focus || "50% 50%")}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-photo>`;
  return `<figure class="ph ${cls}"><div class="ph-frame">${img}</div>${caption ? credit(p, { short }) : ""}</figure>`;
}

// Image error state: swap the frame for the labeled empty slot, keep the size.
document.addEventListener("error", e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-photo")) return;
  const frame = img.closest(".ph-frame");
  if (frame) frame.outerHTML = `<div class="ph-empty" role="img" aria-label="Photo did not load">${ICON}<span class="ph-need">Photo didn't load</span></div>`;
}, true);
