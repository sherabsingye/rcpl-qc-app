import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, FIREBASE_READY } from "./firebase-config.js";
import { currentUser } from "./auth.js";

export function bindSignaturePads() {
  document.querySelectorAll(".sig").forEach((el) => {
    el.addEventListener("click", () => {
      const who = el.previousElementSibling?.value?.trim() || "—";
      const stamp = new Date().toLocaleString();
      el.textContent = `Signed by ${who} · ${stamp}`;
      el.classList.add("signed");
      el.dataset.signed = `${who}|${stamp}`;
    });
  });
}

function collectHandoverForm() {
  const panel = document.getElementById("tab-handover");
  if (!panel) return { values: [], signatures: [] };
  const values = [];
  panel.querySelectorAll(".fg").forEach((fg) => {
    const label = fg.querySelector("label")?.textContent?.trim() || "";
    const input = fg.querySelector("input, select, textarea");
    if (input && input.value) values.push({ label, value: input.value });
  });
  const signatures = [];
  panel.querySelectorAll(".sig.signed").forEach((s) => {
    signatures.push(s.dataset.signed || s.textContent);
  });
  return { values, signatures };
}

export async function saveHandover() {
  const jobCardNo = document.getElementById("jc-no")?.value?.trim();
  if (!jobCardNo) throw new Error("Save the Job Card first.");

  const { values, signatures } = collectHandoverForm();
  const user = currentUser();
  const hId = `${jobCardNo}-handover`;

  const payload = {
    jobCardRef: jobCardNo,
    values,
    signatures,
    completedAt: serverTimestamp(),
    signedBy: user ? user.name : "unknown",
  };

  if (FIREBASE_READY) {
    await setDoc(doc(db, "handover", hId), payload, { merge: true });
    await setDoc(
      doc(db, "jobCards", jobCardNo),
      {
        status: signatures.length >= 2 ? "closed" : "handed-over",
        updatedAt: serverTimestamp(),
        updatedBy: user ? user.name : "unknown",
      },
      { merge: true }
    );
  } else {
    const local = JSON.parse(localStorage.getItem("rcpl_handover") || "{}");
    local[hId] = { ...payload, completedAt: new Date().toISOString() };
    localStorage.setItem("rcpl_handover", JSON.stringify(local));
  }
  return hId;
}
