// Firebase configuration. Replace the values below with your project's web
// config from Firebase Console → Project Settings → Web app. See README.md.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDA4CYr4uQb9bzWP21guNVKniOJHL1CU_c",
  authDomain: "rcpl-qc.firebaseapp.com",
  projectId: "rcpl-qc",
  storageBucket: "rcpl-qc.firebasestorage.app",
  messagingSenderId: "816100440369",
  appId: "1:816100440369:web:6f07bbbc84ee8cdd7b1810",
};

export const TEAM_CODE = "rcpl2026"; // shared code — change and tell the team.

const isConfigured = firebaseConfig.apiKey !== "REPLACE_ME";

export const app = isConfigured ? initializeApp(firebaseConfig) : null;

export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : null;

export const auth = app ? getAuth(app) : null;

export const FIREBASE_READY = isConfigured;
