// Trip journal, local first. Entries and resized photos live in this browser's IndexedDB, so
// logging works offline and without an account. When the person signs in and starts a shared
// journal, photos upload to Cloud Storage and entries to Firestore, and an entry saved while a
// photo is still uploading is written again when the upload finishes (change 10).
import { firebaseConfigured } from "../services/firebase.js";
import * as cloudApi from "../services/journal.js";
import { resizeImage } from "../lib/resize-image.js";
import { st, save } from "./state.js";
import { setUserPhoto } from "./photos.js";

const DB = "tc-journal", VER = 1;
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("entries")) d.createObjectStore("entries", { keyPath: "id" });
      if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    let out; const req = fn(s);
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => resolve(out); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  });
}
const put = (store, v) => tx(store, "readwrite", s => s.put(v));
const get = (store, id) => tx(store, "readonly", s => s.get(id));
const all = store => tx(store, "readonly", s => s.getAll());
const del = (store, id) => tx(store, "readwrite", s => s.delete(id));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const urls = new Map();
let listeners = new Set();
export function onJournal(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => { for (const fn of listeners) fn(); };

export const journal = { entries: [], photos: new Map(), remote: [], cloud: { configured: firebaseConfigured, user: null, trip: null, error: null, busy: false }, ready: false };

export function photoUrl(id) {
  const p = journal.photos.get(id);
  if (!p) return null;
  if (p.blob) { if (!urls.has(id)) urls.set(id, URL.createObjectURL(p.blob)); return urls.get(id); }
  return p.up && p.up.url || null;
}

function refreshStopPhotos() {
  const latest = {};
  for (const e of journal.entries) if (e.useAsStopPhoto && e.photoIds.length) latest[e.stopId] = e;
  const ids = new Set([...Object.keys(latest)]);
  for (const e of journal.entries) if (!ids.has(e.stopId)) setUserPhoto(e.stopId, null);
  for (const [stopId, e] of Object.entries(latest)) setUserPhoto(stopId, photoUrl(e.photoIds[0]));
}

export async function loadJournal() {
  try {
    const [entries, photos] = await Promise.all([all("entries"), all("photos")]);
    journal.entries = entries.filter(e => e.slug === "guam").sort((a, b) => a.loggedAt - b.loggedAt);
    journal.photos = new Map(photos.map(p => [p.id, p]));
  } catch (err) { journal.error = "This browser can't store the journal (private browsing can block it)."; }
  journal.ready = true;
  refreshStopPhotos(); emit();
  initCloud();
}

export const entryFor = stopId => [...journal.entries].reverse().find(e => e.stopId === stopId && e.date === st.date) || null;
export const entriesToday = () => journal.entries.filter(e => e.date === st.date);

// Photos: resize first (drops EXIF and GPS), keep locally, then upload if a shared journal is on.
export async function addPhoto(file) {
  const r = await resizeImage(file);
  const p = { id: uid(), entryId: null, blob: r.blob, width: r.width, height: r.height, createdAt: Date.now(), up: { state: "local", progress: 0 } };
  journal.photos.set(p.id, p); await put("photos", p); emit();
  upload(p.id);
  return p.id;
}
export async function removePhoto(id) {
  journal.photos.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  await del("photos", id); emit();
}

export async function saveEntry({ id, stopId, note, rating, photoIds, useAsStopPhoto, loggedAt, loggedMin }) {
  const prev = id ? journal.entries.find(e => e.id === id) : null;
  const e = { id: id || uid(), slug: "guam", date: prev ? prev.date : st.date, stopId, note: (note || "").slice(0, 280), rating: rating || null,
    photoIds: photoIds.slice(0, 10), useAsStopPhoto: !!useAsStopPhoto && photoIds.length > 0, loggedAt: prev ? prev.loggedAt : loggedAt, loggedMin: prev ? prev.loggedMin : loggedMin, updatedAt: Date.now() };
  for (const pid of e.photoIds) { const p = journal.photos.get(pid); if (p && p.entryId !== e.id) { p.entryId = e.id; await put("photos", p); } }
  if (prev) for (const pid of prev.photoIds) if (!e.photoIds.includes(pid)) await removePhoto(pid);
  await put("entries", e);
  journal.entries = [...journal.entries.filter(x => x.id !== e.id), e].sort((a, b) => a.loggedAt - b.loggedAt);
  refreshStopPhotos(); emit();
  pushEntry(e);
  return e;
}

export const pendingUploads = ids => ids.filter(id => { const p = journal.photos.get(id); return p && p.up && p.up.state === "uploading"; }).length;

// ---------- cloud ----------
async function initCloud() {
  if (!firebaseConfigured) return;
  try {
    journal.cloud.user = await cloudApi.currentUser();
    if (journal.cloud.user && st.cloudTripId) journal.cloud.trip = await cloudApi.getTrip(st.cloudTripId).catch(() => null);
    await maybeJoin();
    watchRemote();
    emit();
    retryAll();
  } catch (err) { journal.cloud.error = readable(err); emit(); }
}

function readable(err) {
  const c = err && err.code || "";
  if (c.includes("permission-denied") || c.includes("unauthorized")) return "The journal server refused this. The shared journal may not include your email.";
  if (c.includes("unavailable") || c.includes("network")) return "No connection. Photos will upload when you're back online.";
  if (c.includes("popup-closed")) return "Sign-in was closed before it finished.";
  return (err && err.message) || "Something went wrong.";
}

export async function signIn() {
  journal.cloud.busy = true; journal.cloud.error = null; emit();
  try { journal.cloud.user = await cloudApi.signIn(); await maybeJoin(); watchRemote(); retryAll(); }
  catch (err) { journal.cloud.error = readable(err); }
  journal.cloud.busy = false; emit();
}
export async function signOut() { await cloudApi.signOut(); journal.cloud.user = null; journal.cloud.trip = null; journal.remote = []; emit(); }

export async function startShared() {
  journal.cloud.busy = true; journal.cloud.error = null; emit();
  try {
    const id = `guam-${st.date}-${uid()}`;
    await cloudApi.createTrip({ tripId: id, title: `Guam Coastal Circuit, ${st.date}`, tripSlug: "guam" });
    st.cloudTripId = id; save();
    journal.cloud.trip = await cloudApi.getTrip(id);
    watchRemote(); retryAll();
  } catch (err) { journal.cloud.error = readable(err); }
  journal.cloud.busy = false; emit();
}
export async function invite(email) {
  const t = journal.cloud.trip; if (!t) return;
  journal.cloud.error = null;
  try {
    const emails = [...new Set([...t.memberEmails, email.trim().toLowerCase()])];
    await cloudApi.setMembers(t.id, emails); t.memberEmails = emails;
  } catch (err) { journal.cloud.error = readable(err); }
  emit();
}
export const inviteLink = () => journal.cloud.trip ? `${location.origin}/?join=${encodeURIComponent(journal.cloud.trip.id)}` : "";

async function maybeJoin() {
  const want = new URLSearchParams(location.search).get("join") || sessionStorage.getItem("tc-join");
  if (!want) return;
  sessionStorage.setItem("tc-join", want);
  if (!journal.cloud.user) return;
  try {
    const t = await cloudApi.getTrip(want);
    if (t) { st.cloudTripId = t.id; save(); journal.cloud.trip = t; sessionStorage.removeItem("tc-join"); history.replaceState(null, "", location.pathname); }
  } catch (err) { journal.cloud.error = `This shared journal hasn't been shared with ${journal.cloud.user.email}. Ask the person who invited you to add that address.`; sessionStorage.removeItem("tc-join"); }
}

let unwatch = null;
async function watchRemote() {
  if (unwatch) { unwatch(); unwatch = null; }
  const t = journal.cloud.trip, u = journal.cloud.user;
  if (!t || !u) return;
  unwatch = await cloudApi.watchEntries(t.id, list => {
    journal.remote = list.filter(e => e.authorUid !== u.uid);
    emit();
  }, () => {});
}

const cloudOn = () => journal.cloud.user && journal.cloud.trip;

async function upload(photoId) {
  const p = journal.photos.get(photoId);
  if (!p || !cloudOn() || p.up.state === "done" || p.up.state === "uploading") return;
  p.up = { state: "uploading", progress: 0 }; emit();
  try {
    const r = await cloudApi.uploadPhoto(journal.cloud.trip.id, p.id, p.blob, f => { p.up.progress = f; emit(); });
    p.up = { state: "done", progress: 1, path: r.path, url: r.url };
  } catch (err) { p.up = { state: "error", progress: 0, error: readable(err) }; }
  if (!journal.photos.has(p.id)) return; // removed while uploading
  await put("photos", p); emit();
  const e = journal.entries.find(x => x.id === p.entryId);
  if (e) pushEntry(e);
}
export function retry(photoId) { const p = journal.photos.get(photoId); if (p) { p.up.state = "local"; upload(photoId); } }

async function pushEntry(e) {
  if (!cloudOn()) return;
  for (const id of e.photoIds) upload(id);
  const photos = e.photoIds.map(id => journal.photos.get(id)).filter(p => p && p.up.state === "done")
    .map(p => ({ path: p.up.path, url: p.up.url, width: p.width, height: p.height }));
  try { await cloudApi.putEntry(journal.cloud.trip.id, e.id, { stopId: e.stopId, note: e.note, rating: e.rating, photos, loggedAt: e.loggedAt }); e.synced = photos.length === e.photoIds.length; }
  catch (err) { e.synced = false; journal.cloud.error = readable(err); }
  emit();
}
function retryAll() { if (!cloudOn()) return; for (const e of journal.entries) pushEntry(e); }
window.addEventListener("online", retryAll);
