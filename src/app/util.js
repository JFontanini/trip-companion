import { PACK } from "../trip.js";

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const $ = s => document.querySelector(s);
export const num2 = n => String(n).padStart(2, "0");

export function guamNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: PACK.trip.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10) };
}

export function dateLabel(date, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", opts);
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"];
export const numberWord = n => WORDS[n] || String(n);

// "2 h 10 min" style age for live data
export function age(min) {
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
}

export function navLinks(p) {
  const q = encodeURIComponent(p.q || p.name + ", Guam");
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${q}&ll=${p.lat},${p.lon}&dirflg=d`,
    waze: `https://waze.com/ul?q=${q}&ll=${p.lat},${p.lon}&navigate=yes`
  };
}

export const ARROW = `<span class="arrow" aria-hidden="true">&rarr;</span>`;
