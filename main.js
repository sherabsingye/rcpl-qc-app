import { FIREBASE_READY } from "./firebase-config.js";
import { currentUser, login, signOut, bootstrapAuth } from "./auth.js";
import { saveQC, bindScoreUpdates } from "./qc.js";
import { downloadQCPdf } from "./pdf.js";
import { saveDispatch } from "./dispatch.js";
import { startTracker, setFilter, refreshLocalTracker } from "./tracker.js";
import {
  getDocs, collection, query, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---------- Tab navigation ----------
const TABS = ["qc", "dispatch", "tracker"];
const EQ_IDS = ["exc", "drill", "crane", "gen", "grade", "pump", "comp", "tipper", "wl", "paver", "shot", "tanker", "muck", "lv"];

function showTab(name) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".main-nav button").forEach((b) => b.classList.remove("active"));
  document.getElementById("tab-" + name)?.classList.add("active");
  const idx = TABS.indexOf(name);
  if (idx >= 0) document.querySelectorAll(".main-nav button")[idx]?.classList.add("active");
  if (name === "tracker") refreshLocalTracker();
}
function goTo(name) { showTab(name); window.scrollTo(0, 0); }
function showEq(id) {
  document.querySelectorAll(".eq-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".eq-tab").forEach((t) => t.classList.remove("active"));
  document.getElementById("eq-" + id)?.classList.add("active");
  const idx = EQ_IDS.indexOf(id);
  if (idx >= 0) document.querySelectorAll(".eq-tab")[idx]?.classList.add("active");
}

// ---------- Toast ----------
function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast"; }, 2600);
}

// ---------- Online / offline indicator ----------
function updateStatus() {
  const strip = document.getElementById("status-strip");
  const text = document.getElementById("status-text");
  if (!strip || !text) return;
  if (!FIREBASE_READY) {
    strip.classList.add("offline");
    text.textContent = "Local mode — Firebase not configured (see README)";
    return;
  }
  if (navigator.onLine) {
    strip.classList.remove("offline");
    text.textContent = "Connected — team sync live";
  } else {
    strip.classList.add("offline");
    text.textContent = "Offline — changes will sync when back online";
  }
}
window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);

// ---------- Auto-fill QC Ref ----------
async function autoFillQcRef() {
  const d = new Date();
  const year = d.getFullYear();
  let next = 1;
  if (FIREBASE_READY) {
    try {
      const q = query(collection(db, "qcRecords"), orderBy("signedAt", "desc"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const last = snap.docs[0].id || "";
        const m = last.match(/QC-(\d{4})-(\d+)/);
        if (m && Number(m[1]) === year) next = Number(m[2]) + 1;
      }
    } catch { next = Math.floor(Math.random() * 900) + 100; }
  } else {
    const local = JSON.parse(localStorage.getItem("rcpl_qc") || "{}");
    const keys = Object.keys(local).filter((k) => k.startsWith(`QC-${year}`));
    if (keys.length) {
      const nums = keys.map((k) => Number((k.match(/QC-\d{4}-(\d+)/) || [])[1] || 0));
      next = Math.max(...nums) + 1;
    }
  }
  const ref = `QC-${year}-${String(next).padStart(3, "0")}`;
  const refEl = document.getElementById("qc-ref");
  const dateEl = document.getElementById("qc-date");
  if (refEl) refEl.value = ref;
  if (dateEl) dateEl.value = d.toISOString().split("T")[0];
  return ref;
}

// Fill inspector from signed-in user.
function fillInspector() {
  const user = currentUser();
  const el = document.getElementById("qc-inspector");
  if (el && user) el.value = user.name;
}

// ---------- Login flow ----------
function showLogin() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "flex";
}
function hideLogin() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "none";
}
function renderUserChip() {
  const chip = document.getElementById("user-chip");
  const user = currentUser();
  if (chip) chip.textContent = user ? `${user.name} · ${user.role}` : "Sign in";
}

async function handleLogin() {
  const nameEl = document.getElementById("login-name");
  const roleEl = document.getElementById("login-role");
  const codeEl = document.getElementById("login-code");
  const errEl = document.getElementById("login-err");
  errEl.classList.remove("visible");
  try {
    await login({ name: nameEl.value, role: roleEl.value, code: codeEl.value });
    hideLogin();
    renderUserChip();
    fillInspector();
    toast(`Welcome, ${nameEl.value.trim()}`, "success");
    startTracker();
  } catch (e) {
    errEl.textContent = e.message || "Sign in failed.";
    errEl.classList.add("visible");
  }
}

// ---------- Save actions ----------
async function withSave(fn, successMsg, nextTab) {
  try {
    const result = await fn();
    toast(successMsg, "success");
    if (nextTab) goTo(nextTab);
    return result;
  } catch (e) {
    console.error(e);
    toast(e.message || "Save failed", "error");
  }
}

const rcpl = {
  signOut,
  autoFillQcRef: async () => {
    try { await autoFillQcRef(); } catch (e) { toast(e.message, "error"); }
  },
  saveQC: (proceed) =>
    withSave(async () => {
      const { overallResult } = await saveQC();
      if (overallResult === "FAIL" && proceed) {
        throw new Error("QC result is FAIL — dispatch blocked until resolved.");
      }
      return { overallResult };
    }, "QC record saved", proceed ? "dispatch" : null),
  saveDispatch: (proceed) =>
    withSave(saveDispatch, "Dispatch saved", proceed ? "tracker" : null),
  newQC: async () => {
    document.querySelectorAll("#tab-qc input, #tab-qc select, #tab-qc textarea").forEach((el) => {
      if (el.type !== "button") el.value = "";
    });
    document.querySelectorAll("#tab-qc .eq-panel select").forEach((el) => { el.value = "—"; });
    document.querySelectorAll("#tab-qc input[type=checkbox]").forEach((el) => { el.checked = false; });
    await autoFillQcRef();
    fillInspector();
    goTo("qc");
  },
  setFilter,
  downloadPdf: () => {
    try { downloadQCPdf(); } catch (e) { toast(e.message || "PDF failed", "error"); }
  },
};

// Expose to inline onclick handlers in index.html.
window.showTab = showTab;
window.goTo = goTo;
window.showEq = showEq;
window.rcpl = rcpl;

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((e) =>
      console.warn("SW registration failed:", e)
    );
  });
}

// ---------- Boot ----------
(async function boot() {
  updateStatus();
  renderUserChip();
  bindScoreUpdates();

  document.getElementById("login-btn")?.addEventListener("click", handleLogin);
  document.getElementById("login-code")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  const user = await bootstrapAuth();
  if (!user) {
    showLogin();
  } else {
    fillInspector();
    startTracker();
    // Auto-fill a ref if none yet.
    if (!document.getElementById("qc-ref")?.value) autoFillQcRef();
  }
})();
