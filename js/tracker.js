import {
  collection, query, orderBy, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, FIREBASE_READY } from "./firebase-config.js";

let currentFilter = "all";
let latestJobs = [];

const statusBadge = {
  "open":        { cls: "badge-warn", label: "Open" },
  "qc-pending":  { cls: "badge-warn", label: "QC Pending" },
  "dispatched":  { cls: "badge-ok",   label: "Dispatched" },
  "handed-over": { cls: "badge-ok",   label: "Handed Over" },
  "closed":      { cls: "badge-ok",   label: "Closed ✓" },
  "FAIL":        { cls: "badge-fail", label: "FAIL" },
};

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function render() {
  const body = document.getElementById("tracker-body");
  if (!body) return;

  const filtered =
    currentFilter === "all"
      ? latestJobs
      : latestJobs.filter((j) => j.status === currentFilter);

  if (filtered.length === 0) {
    body.innerHTML = `<tr class="empty-row"><td colspan="7">No jobs yet. Click "New Job Card" to add one.</td></tr>`;
  } else {
    body.innerHTML = filtered
      .map((j) => {
        const key = j.qcResult === "FAIL" ? "FAIL" : j.status || "open";
        const badge = statusBadge[key] || { cls: "badge-warn", label: key };
        const summary = (j.workPerformed || j.complaint || "—").slice(0, 80);
        return `
          <tr>
            <td>${j.jobCardNo || "—"}</td>
            <td>${j.equipmentType || "—"}</td>
            <td>${j.fleetNo || "—"}</td>
            <td>${j.site || "—"}</td>
            <td>${summary}</td>
            <td><span class="${badge.cls}">${badge.label}</span></td>
            <td>${formatDate(j.updatedAt)}</td>
          </tr>`;
      })
      .join("");
  }

  // Stats
  const total = latestJobs.length;
  const closed = latestJobs.filter((j) => j.status === "closed").length;
  const fail = latestJobs.filter((j) => j.qcResult === "FAIL").length;
  const inProg = latestJobs.filter(
    (j) => j.status && j.status !== "closed" && j.status !== "dispatched" && j.qcResult !== "FAIL"
  ).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("stat-total", total);
  set("stat-closed", closed);
  set("stat-inprogress", inProg);
  set("stat-fail", fail);
}

export function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.filter === filter);
  });
  render();
}

export function refreshLocalTracker() {
  if (FIREBASE_READY) return;
  const local = JSON.parse(localStorage.getItem("rcpl_jobs") || "{}");
  latestJobs = Object.values(local);
  render();
}

export function startTracker() {
  if (!FIREBASE_READY) {
    refreshLocalTracker();
    return;
  }
  const q = query(collection(db, "jobCards"), orderBy("updatedAt", "desc"));
  onSnapshot(
    q,
    (snap) => {
      latestJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("Tracker snapshot failed", err);
      const body = document.getElementById("tracker-body");
      if (body) body.innerHTML = `<tr class="empty-row"><td colspan="7">Tracker error — check connection or Firebase rules.</td></tr>`;
    }
  );
}
