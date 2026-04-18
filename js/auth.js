import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db, TEAM_CODE, FIREBASE_READY } from "./firebase-config.js";

const LS_KEY = "rcpl_user";

export function currentUser() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

async function ensureAnonAuth() {
  if (!FIREBASE_READY) return null;
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (u) => {
      if (u) return resolve(u);
      const cred = await signInAnonymously(auth);
      resolve(cred.user);
    });
  });
}

export async function login({ name, role, code }) {
  if (!name || name.trim().length < 2) throw new Error("Enter your name.");
  if (code !== TEAM_CODE) throw new Error("Team code is incorrect.");
  const user = { name: name.trim(), role, signedInAt: new Date().toISOString() };
  localStorage.setItem(LS_KEY, JSON.stringify(user));

  if (FIREBASE_READY) {
    const fbUser = await ensureAnonAuth();
    if (fbUser) {
      user.uid = fbUser.uid;
      localStorage.setItem(LS_KEY, JSON.stringify(user));
      try {
        await setDoc(
          doc(db, "users", fbUser.uid),
          { name: user.name, role, lastSeen: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn("User profile write failed (offline?)", e);
      }
    }
  }
  return user;
}

export async function bootstrapAuth() {
  const user = currentUser();
  if (user && FIREBASE_READY) {
    await ensureAnonAuth().catch(() => {});
  }
  return user;
}
