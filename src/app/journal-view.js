// Journal tab and the Log this stop sheet, with every entry and upload state from the design:
// empty, saved, uploading with progress, failed with Retry, and saved while a photo is still uploading.
import { st } from "./state.js";
import { esc, dateLabel, ARROW, guamNow } from "./util.js";
import { PLAN, byId, nameOf, numOf, fmt, doneIds } from "./plan.js";
import { journal, entriesToday, entryFor, photoUrl, pendingUploads, inviteLink } from "./journal-store.js";

const bars = r => `<span class="bars" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= r ? "on" : ""}"></i>`).join("")}</span>`;

function nextToLog() {
  const done = new Set(entriesToday().map(e => e.stopId));
  const cand = [...doneIds(), ...PLAN.items.filter(i => !i.s._meal).map(i => i.s.id)].find(id => !done.has(id));
  return cand ? byId(cand) : null;
}

function entryHtml(e, { remote = false } = {}) {
  const s = byId(e.stopId); if (!s) return "";
  const photos = remote ? (e.photos || []).map(p => p.url) : e.photoIds.map(photoUrl).filter(Boolean);
  const time = remote ? (e.createdAt && e.createdAt.toDate ? e.createdAt.toDate().toLocaleTimeString("en-US", { timeZone: "Pacific/Guam", hour: "numeric", minute: "2-digit" }).replace("AM", "a.m.").replace("PM", "p.m.") : "") : fmt(e.loggedMin);
  const uploading = remote ? 0 : pendingUploads(e.photoIds);
  const failed = remote ? 0 : e.photoIds.filter(id => journal.photos.get(id)?.up?.state === "error").length;
  return `<article class="jentry"><div class="between"><span class="jnum">${numOf(s.id) || ""}</span><span class="label">${esc(time)}</span></div>
    <h3>${esc(nameOf(s))}</h3>${remote ? `<p class="meta">by ${esc(e.authorName || "a trip member")}</p>` : ""}
    ${photos.length ? `<div class="jphotos ${photos.length === 1 ? "one" : ""}">${photos.slice(0, 4).map(u => `<img src="${esc(u)}" alt="Photo at ${esc(nameOf(s))}" loading="lazy">`).join("")}</div>` : ""}
    ${!remote && e.useAsStopPhoto ? `<p class="credit"><b class="you">Your photo</b> · now shown for this stop</p>` : ""}
    ${e.note ? `<p class="note">${esc(e.note)}</p>` : ""}
    ${uploading ? `<p class="meta" style="margin-top:6px">${uploading} photo${uploading > 1 ? "s" : ""} still uploading</p>` : ""}
    ${failed ? `<p class="err">${failed} photo${failed > 1 ? "s" : ""} didn't upload. Open the entry to retry.</p>` : ""}
    <div class="between rating">${e.rating ? `<span style="display:flex;gap:10px;align-items:center">${bars(e.rating)}<span class="meta">${e.rating} of 5</span></span>` : "<span></span>"}
      ${remote ? "" : `<button class="linkbtn" data-act="log" data-arg="${s.id}" data-entry="${e.id}">${photos.length ? "Edit" : "Add photos"}</button>`}</div>
  </article>`;
}

function cloudHtml() {
  const c = journal.cloud;
  if (!c.configured) return "";
  let body;
  if (!c.user) body = `<p class="body-2">Sign in to back up photos and share this journal with the people on the trip. Without it, the journal stays on this phone.</p><button class="btn btn-outline" style="margin-top:12px" data-act="signIn" ${c.busy ? "disabled" : ""}>${c.busy ? "Signing in" : "Sign in with Google"}</button>`;
  else if (!c.trip) body = `<p class="body-2">Signed in as ${esc(c.user.email)}. Start a shared journal to back up your photos and invite others.</p><div class="btns" style="margin-top:12px"><button class="btn btn-primary" data-act="startShared" ${c.busy ? "disabled" : ""}>Start a shared journal</button><button class="btn btn-outline" data-act="signOut">Sign out</button></div>`;
  else body = `<p class="body-2">Shared with ${c.trip.memberEmails.length === 1 ? "just you" : c.trip.memberEmails.length + " people"}. Photos back up as you log.</p>
    <form data-form="invite" style="margin-top:12px"><label class="label" for="inviteEmail">Invite by email</label><div class="btns" style="grid-template-columns:1fr auto;grid-auto-flow:row;margin-top:6px"><input id="inviteEmail" type="email" autocomplete="email" required placeholder="name@example.com"><button class="btn btn-primary" type="submit">Invite</button></div></form>
    <p class="meta" style="margin-top:8px">Invited people open <button class="linkbtn" data-act="copyInvite">the invite link</button> and sign in with that email.</p>
    <button class="linkbtn" data-act="signOut">Sign out</button>`;
  return `<section class="cloud"><h2 class="h4">Back up and share</h2><div style="margin-top:8px">${body}</div>${c.error ? `<p class="err" role="alert">${esc(c.error)}</p>` : ""}</section>`;
}

export function viewJournal() {
  const entries = entriesToday();
  const guamDate = ms => new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Guam" }).format(new Date(ms));
  const remote = journal.remote.filter(e => e.createdAt && guamDate(e.createdAt.toMillis()) === st.date);
  const next = nextToLog();
  const n = entries.length + remote.length;
  const head = `<header class="mhead"><span class="wordmark">Guam, the loop</span></header>`;
  if (!journal.ready) return `<div class="wrap">${head}<p class="meta" style="padding-top:24px">Opening the journal</p></div>`;
  if (journal.error) return `<div class="wrap">${head}<div class="alerts"><div class="alert advisory"><div class="sev">Advisory</div><h3>The journal can't save here</h3><p>${esc(journal.error)}</p></div></div></div>`;
  if (!n) {
    return `<div class="wrap">${head}<h1 class="display" style="padding-top:var(--gcc-space-5)">Nothing<br><em>logged yet.</em></h1>
      <div class="empty-state"><p class="body-2">At each stop, tap Log stop in the Next Stop bar or on its card. Add a photo, a line or two and a rating. The time is stamped for you.</p>
      ${next ? `<button class="btn btn-primary btn-long btn-block" style="margin-top:var(--gcc-space-4)" data-act="log" data-arg="${next.id}"><span>Log ${numOf(next.id)} ${esc(nameOf(next))}</span>${ARROW}</button>` : ""}</div>${cloudHtml()}<div style="height:var(--gcc-space-6)"></div></div>`;
  }
  const merged = [...entries.map(e => ({ t: e.loggedAt, html: entryHtml(e) })), ...remote.map(e => ({ t: e.createdAt.toMillis(), html: entryHtml(e, { remote: true }) }))].sort((a, b) => a.t - b.t);
  return `<div class="wrap">${head}
    <h1 class="display" style="padding-top:var(--gcc-space-5)">The day,<br><em>so far.</em></h1>
    <p class="lede">${esc(dateLabel(st.date))} · ${n} entr${n === 1 ? "y" : "ies"}</p>
    <div style="margin-top:var(--gcc-space-5)">${merged.map(x => x.html).join("")}</div>
    ${next ? `<div class="jnext"><b>Next: ${numOf(next.id)} ${esc(nameOf(next))}</b><p class="meta" style="color:var(--gcc-ink-2)">Tap Log stop when you arrive.</p><button class="btn btn-outline" style="margin-top:10px" data-act="log" data-arg="${next.id}">Log it now</button></div>` : ""}
    ${cloudHtml()}<div style="height:var(--gcc-space-6)"></div></div>`;
}

// ---------- Log sheet ----------
export const draft = { stopId: null, entryId: null, photoIds: [], note: "", rating: null, useAsStopPhoto: false, loggedAt: null, loggedMin: null };
export function openDraft(stopId, entryId) {
  const e = entryId ? journal.entries.find(x => x.id === entryId) : entryFor(stopId);
  const now = guamNow();
  Object.assign(draft, e ? { stopId, entryId: e.id, photoIds: [...e.photoIds], note: e.note, rating: e.rating, useAsStopPhoto: e.useAsStopPhoto, loggedAt: e.loggedAt, loggedMin: e.loggedMin }
    : { stopId, entryId: null, photoIds: [], note: "", rating: null, useAsStopPhoto: false, loggedAt: Date.now(), loggedMin: now.min });
}

function tile(id) {
  const p = journal.photos.get(id); if (!p) return "";
  const u = p.up || { state: "local" };
  const img = `<img src="${esc(photoUrl(id))}" alt="">`;
  const remove = `<button class="x" data-act="removePhoto" data-arg="${id}" aria-label="Remove this photo">&times;</button>`;
  if (u.state === "uploading") return `<div class="tile uploading">${img}${remove}<div class="st">${Math.round((u.progress || 0) * 100)}%<div class="bar"><i style="width:${Math.round((u.progress || 0) * 100)}%"></i></div>Uploading</div></div>`;
  if (u.state === "error") return `<div class="tile error">${img}${remove}<div class="st">Didn't upload</div><button class="btn btn-lagoon retry" data-act="retryPhoto" data-arg="${id}">Retry</button></div>`;
  return `<div class="tile">${img}${remove}<div class="st">${u.state === "done" ? "Saved" : journal.cloud.trip ? "Saved" : "On this phone"}</div></div>`;
}

export function logSheetHtml() {
  const s = byId(draft.stopId);
  const pending = pendingUploads(draft.photoIds);
  const cloudOn = !!(journal.cloud.user && journal.cloud.trip);
  return `<div class="logsheet">
    <div class="between" style="align-items:flex-start"><div><div class="kicker">Log · ${numOf(s.id) || ""}</div><h2 id="sheetTitle" class="h2" style="margin-top:4px">${esc(nameOf(s))}</h2><p class="meta" style="margin-top:6px">${fmt(draft.loggedMin)}, stamped for you</p></div><button class="btn" data-act="close">Cancel</button></div>
    ${draft.photoIds.length ? `<div class="tiles" aria-live="polite">${draft.photoIds.map(tile).join("")}</div>` : ""}
    <div class="btns" style="margin-top:var(--gcc-space-3)">
      <label class="btn btn-outline filepick">Take photo<input type="file" accept="image/*" capture="environment" data-photo-input aria-label="Take a photo"></label>
      <label class="btn btn-outline filepick">Choose photos<input type="file" accept="image/*" multiple data-photo-input aria-label="Choose photos"></label>
    </div>
    <p class="meta" style="margin-top:6px">${cloudOn ? "Photos are stored with this trip's shared journal. Remove them any time." : "Photos stay on this phone. Sign in under Journal to back them up and share."} Location data is removed from every photo.</p>
    <label class="switch"><span><b>Use as this stop's photo</b><br><span class="meta">Credited as Your photo</span></span><input type="checkbox" data-draft="useAsStopPhoto" ${draft.useAsStopPhoto ? "checked" : ""} ${draft.photoIds.length ? "" : "disabled"}></label>
    <label class="label" for="logNote" style="display:block;margin-top:var(--gcc-space-4)">Note</label>
    <textarea id="logNote" maxlength="280" data-draft="note" style="margin-top:6px">${esc(draft.note)}</textarea>
    <p class="meta" style="text-align:right" data-count>${draft.note.length} / 280</p>
    <div class="label" id="rateLabel" style="margin-top:var(--gcc-space-3)">Rating</div>
    <div class="rate" role="group" aria-labelledby="rateLabel">${[1, 2, 3, 4, 5].map(i => `<button aria-pressed="${draft.rating === i}" data-act="rate" data-arg="${i}" aria-label="${i} of 5">${i}</button>`).join("")}</div>
    <button class="btn btn-primary btn-long btn-block" style="margin-top:var(--gcc-space-5)" data-act="saveEntry"><span>Save entry</span>${ARROW}</button>
    ${pending ? `<p class="meta" style="margin-top:8px">${pending === 1 ? "One photo is" : pending + " photos are"} still uploading. ${pending === 1 ? "It" : "They"} will finish after you save.</p>` : ""}
  </div>`;
}
