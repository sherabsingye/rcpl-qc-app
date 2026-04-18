import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, FIREBASE_READY } from "./firebase-config.js";
import { currentUser } from "./auth.js";

function collectDispatchForm() {
  const panel = document.getElementById("tab-dispatch");
  if (!panel) return {};
  const inputs = panel.querySelectorAll("input, select, textarea");
  const values = [];
  inputs.forEach((el) => {
    const label = el.closest(".fg")?.querySelector("label")?.textContent?.trim() || el.placeholder || "";
    if (!el.value) return;
    values.push({ label, value: el.value });
  });
  return values;
}

export async function saveDispatch() {
  const jobCardNo = document.getElementById("qc-ref")?.value?.trim();
  if (!jobCardNo) throw new Error("Complete and save the QC first — no QC Ref found.");

  const values = collectDispatchForm();
  const user = currentUser();
  const dId = `${jobCardNo}-dispatch`;

  const payload = {
    jobCardRef: jobCardNo,
    values,
    signedBy: user ? user.name : "unknown",
    signedAt: serverTimestamp(),
  };

  if (FIREBASE_READY) {
    await setDoc(doc(db, "dispatch", dId), payload, { merge: true });
    await setDoc(
      doc(db, "jobCards", jobCardNo),
      {
        status: "dispatched",
        updatedAt: serverTimestamp(),
        updatedBy: user ? user.name : "unknown",
      },
      { merge: true }
    );
  } else {
    const local = JSON.parse(localStorage.getItem("rcpl_dispatch") || "{}");
    local[dId] = { ...payload, signedAt: new Date().toISOString() };
    localStorage.setItem("rcpl_dispatch", JSON.stringify(local));
    // Mirror status update in rcpl_jobs for tracker.
    const jobs = JSON.parse(localStorage.getItem("rcpl_jobs") || "{}");
    if (jobs[jobCardNo]) {
      jobs[jobCardNo].status = "dispatched";
      jobs[jobCardNo].updatedAt = new Date().toISOString();
      localStorage.setItem("rcpl_jobs", JSON.stringify(jobs));
    }
  }
  return dId;
}
