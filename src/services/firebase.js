// Firebase is optional at runtime: the planner works without it. Services that need it
// call getFirebase(), which returns null until the project's web config is set in the build env.
// The web config is a set of public identifiers, not secrets (same posture as chief-os-3a357).

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let cached = null;
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

export async function getFirebase() {
  if (!firebaseConfigured) return null;
  if (cached) return cached;
  const [{ initializeApp }, firestore, auth, storage] = await Promise.all([
    import("firebase/app"), import("firebase/firestore"), import("firebase/auth"), import("firebase/storage")
  ]);
  const app = initializeApp(config);
  const db = firestore.initializeFirestore(app, { localCache: firestore.persistentLocalCache() });
  cached = { app, db, firestore, auth: auth.getAuth(app), authMod: auth, storage: storage.getStorage(app), storageMod: storage };
  return cached;
}
