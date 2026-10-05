// Ritidian refuge status, written to Firestore status/ritidian by the scheduled
// Cloud Function in functions/index.js (the FWS page cannot be read from a browser: no CORS).
import { getFirebase } from "./firebase.js";

export async function watchRitidian(onChange) {
  const fb = await getFirebase();
  if (!fb) { onChange({ status: "unavailable", reason: "not-configured" }); return () => {}; }
  const { doc, onSnapshot } = fb.firestore;
  return onSnapshot(doc(fb.db, "status", "ritidian"),
    snap => onChange(snap.exists() ? { status: "fresh", ...snap.data() } : { status: "unavailable", reason: "no-data" }),
    () => onChange({ status: "unavailable", reason: "read-failed" }));
}
