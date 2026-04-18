import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, FIREBASE_READY } from "./firebase-config.js";
import { currentUser } from "./auth.js";

const EQ_MAP = {
  exc: "Excavator (PC200 / CAT)",
  drill: "Drill Rig (Epiroc Boomer E2C)",
  crane: "Crane (SANY)",
  gen: "Generator (CAT 540 KVA)",
  grade: "Motor Grader",
  pump: "Concrete Pump (Putzmeister)",
  comp: "Compactor / Roller",
  tipper: "Tipper / Dump Truck",
};

// Crane zero-tolerance keywords: any Mon or Fail here ⇒ overall FAIL.
const CRANE_HARD_KEYWORDS = ["wire rope", "hook", "lmi", "load test", "load-test"];

function activeEqKey() {
  const active = document.querySelector(".eq-panel.active");
  if (!active) return "exc";
  return active.id.replace("eq-", "");
}

export function readChecklist(eqKey) {
  const panel = document.getElementById(`eq-${eqKey}`);
  if (!panel) return { items: [], counts: { ok: 0, mon: 0, fail: 0, pending: 0 } };

  const items = [];
  let sectionName = "General";
  panel.childNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    if (n.classList && n.classList.contains("sec")) sectionName = n.textContent.trim();
    if (n.classList && n.classList.contains("cl-grid")) {
      n.querySelectorAll(".cl-group").forEach((g) => {
        const h4 = g.querySelector("h4");
        const subSection = h4 ? h4.textContent.trim() : "";
        g.querySelectorAll(".ci").forEach((row) => {
          const label = row.querySelector("span")?.textContent.trim() || "";
          const status = row.querySelector("select")?.value || "—";
          items.push({ section: sectionName, subSection, name: label, status });
        });
      });
    }
  });

  const counts = { ok: 0, mon: 0, fail: 0, pending: 0 };
  for (const it of items) {
    if (it.status === "OK") counts.ok++;
    else if (it.status === "Mon") counts.mon++;
    else if (it.status === "Fail") counts.fail++;
    else counts.pending++;
  }
  return { items, counts };
}

export function computeResult(eqKey, items, counts) {
  if (counts.fail > 0) return "FAIL";
  if (eqKey === "crane") {
    for (const it of items) {
      const lower = it.name.toLowerCase();
      const isHard = CRANE_HARD_KEYWORDS.some((kw) => lower.includes(kw));
      if (isHard && it.status === "Mon") return "FAIL";
    }
  }
  if (counts.mon > 0) return "CONDITIONAL";
  if (counts.pending > 0) return "PENDING";
  return "PASS";
}

export function bindScoreUpdates() {
  // Any change in a QC panel updates its progress bar + badge if present.
  document.querySelectorAll(".eq-panel").forEach((panel) => {
    const eqKey = panel.id.replace("eq-", "");
    const update = () => {
      const { items, counts } = readChecklist(eqKey);
      const total = items.length || 1;
      const done = total - counts.pending;
      const pct = Math.round((done / total) * 100);
      const fill = document.getElementById(`${eqKey}-fill`);
      const pctLabel = document.getElementById(`${eqKey}-pct`);
      const badge = document.getElementById(`${eqKey}-badge`);
      if (fill) fill.style.width = pct + "%";
      if (pctLabel) pctLabel.textContent = pct + "%";
      if (badge) {
        const result = computeResult(eqKey, items, counts);
        if (result === "PASS") { badge.className = "badge-ok"; badge.textContent = "PASS"; }
        else if (result === "CONDITIONAL") { badge.className = "badge-warn"; badge.textContent = "CONDITIONAL"; }
        else if (result === "FAIL") { badge.className = "badge-fail"; badge.textContent = "FAIL"; }
        else { badge.className = "badge-warn"; badge.textContent = pct + "% done"; }
      }
    };
    panel.addEventListener("change", update);
    update();
  });
}

export async function saveQC() {
  const qcRef = document.getElementById("qc-ref")?.value?.trim();
  if (!qcRef) throw new Error("Generate a QC Ref No. first (click 'Auto-generate Ref').");
  const fleet = document.getElementById("qc-fleet")?.value?.trim();
  if (!fleet) throw new Error("Enter Fleet / Equipment No.");

  const eqKey = activeEqKey();
  const { items, counts } = readChecklist(eqKey);
  if (items.length === 0) throw new Error("No checklist items found for this equipment.");

  const overallResult = computeResult(eqKey, items, counts);
  const user = currentUser();
  const qcId = qcRef;

  const payload = {
    qcRef,
    fleetNo: fleet,
    site: document.getElementById("qc-site")?.value || "",
    inspector: document.getElementById("qc-inspector")?.value || (user ? user.name : ""),
    equipmentType: EQ_MAP[eqKey] || eqKey,
    items,
    counts,
    overallResult,
    signedBy: user ? user.name : "unknown",
    signedAt: serverTimestamp(),
  };

  if (FIREBASE_READY) {
    await setDoc(doc(db, "qcRecords", qcId), payload, { merge: true });
    // Also write a jobCards entry so the Tracker can display it.
    await setDoc(
      doc(db, "jobCards", qcId),
      {
        jobCardNo: qcId,
        fleetNo: fleet,
        site: payload.site,
        equipmentType: payload.equipmentType,
        status: overallResult === "FAIL" ? "qc-fail" : "qc-done",
        qcResult: overallResult,
        updatedAt: serverTimestamp(),
        updatedBy: user ? user.name : "unknown",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    const local = JSON.parse(localStorage.getItem("rcpl_qc") || "{}");
    local[qcId] = { ...payload, signedAt: new Date().toISOString() };
    localStorage.setItem("rcpl_qc", JSON.stringify(local));
    // Mirror in rcpl_jobs for tracker.
    const jobs = JSON.parse(localStorage.getItem("rcpl_jobs") || "{}");
    jobs[qcId] = {
      jobCardNo: qcId, fleetNo: fleet, site: payload.site,
      equipmentType: payload.equipmentType,
      status: overallResult === "FAIL" ? "qc-fail" : "qc-done",
      qcResult: overallResult,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("rcpl_jobs", JSON.stringify(jobs));
  }
  return { qcId, overallResult };
}
