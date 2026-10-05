// Trip journal: shared per trip among invited emails. Photos go to Cloud Storage,
// entries to Firestore at trips/{tripId}/entries. Access rules live in firestore.rules
// and storage.rules; this file assumes them and surfaces their refusals as readable errors.
import { getFirebase } from "./firebase.js";
import { resizeImage } from "../lib/resize-image.js";

async function fb() {
  const f = await getFirebase();
  if (!f) throw new Error("The journal is not set up yet: this build has no Firebase project.");
  return f;
}

export async function currentUser() {
  const f = await getFirebase();
  if (!f) return null;
  await f.auth.authStateReady();
  return f.auth.currentUser;
}

export async function signIn() {
  const f = await fb();
  const { GoogleAuthProvider, signInWithPopup } = f.authMod;
  const cred = await signInWithPopup(f.auth, new GoogleAuthProvider());
  return cred.user;
}

export async function signOut() { const f = await fb(); await f.authMod.signOut(f.auth); }

// Create a trip the signed-in person owns. memberEmails must include the owner (rules enforce it).
export async function createTrip({ tripId, title, tripSlug, inviteEmails = [] }) {
  const f = await fb();
  const u = f.auth.currentUser; if (!u) throw new Error("Sign in first.");
  const { doc, setDoc, serverTimestamp } = f.firestore;
  const emails = [...new Set([u.email, ...inviteEmails].map(e => e.trim().toLowerCase()).filter(Boolean))];
  await setDoc(doc(f.db, "trips", tripId), { title, tripSlug, ownerUid: u.uid, memberEmails: emails, createdAt: serverTimestamp() });
  return tripId;
}

export async function setMembers(tripId, emails) {
  const f = await fb();
  const { doc, updateDoc } = f.firestore;
  await updateDoc(doc(f.db, "trips", tripId), { memberEmails: [...new Set(emails.map(e => e.trim().toLowerCase()))] });
}

// files: File[] from an <input type="file" accept="image/*" multiple capture>
// onProgress({done, total, fraction}) fires as bytes move
export async function addEntry(tripId, { stopId, note = "", rating = null, files = [] }, onProgress = () => {}) {
  const f = await fb();
  const u = f.auth.currentUser; if (!u) throw new Error("Sign in first.");
  if (files.length > 10) throw new Error("Up to 10 photos per entry.");
  const { ref, uploadBytesResumable, getDownloadURL } = f.storageMod;
  const resized = await Promise.all(files.map(file => resizeImage(file)));
  const total = resized.reduce((a, r) => a + r.blob.size, 0) || 1;
  const sent = new Array(resized.length).fill(0);
  const photos = [];
  for (const [i, r] of resized.entries()) {
    const path = `trips/${tripId}/photos/${u.uid}/${Date.now()}-${i}.jpg`;
    const task = uploadBytesResumable(ref(f.storage, path), r.blob, { contentType: "image/jpeg" });
    await new Promise((resolve, reject) => task.on("state_changed",
      s => { sent[i] = s.bytesTransferred; const done = sent.reduce((a, b) => a + b, 0); onProgress({ done, total, fraction: done / total }); },
      reject, resolve));
    photos.push({ path, url: await getDownloadURL(task.snapshot.ref), width: r.width, height: r.height, capturedAt: r.capturedAt });
  }
  const { collection, addDoc, serverTimestamp } = f.firestore;
  const entry = { authorUid: u.uid, authorName: u.displayName || u.email, stopId, note: note.slice(0, 2000),
    rating: rating == null ? null : Math.max(1, Math.min(5, Math.round(rating))), photos, createdAt: serverTimestamp() };
  const docRef = await addDoc(collection(f.db, "trips", tripId, "entries"), entry);
  return docRef.id;
}

// Live list of entries, oldest first, so the journal reads as the day in order.
export async function watchEntries(tripId, onChange, onError = () => {}) {
  const f = await fb();
  const { collection, query, orderBy, onSnapshot } = f.firestore;
  return onSnapshot(query(collection(f.db, "trips", tripId, "entries"), orderBy("createdAt", "asc")),
    snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
}
