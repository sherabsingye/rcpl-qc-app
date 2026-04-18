import {
  doc, setDoc, getDocs, collection, query, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, FIREBASE_READY } from "./firebase-config.js";
import { currentUser } from "./auth.js";

const FIELDS = {
  "jc-no": "jobCardNo",
  "jc-date": "date",
  "jc-type": "equipmentType",
  "jc-fleet": "fleetNo",
  "jc-hmr": "hmr",
  "jc-site": "site",
  "jc-mech": "mechanic",
  "jc-sup": "supervisor",
  "jc-complaint": "complaint",
  "jc-cause": "rootCause",
  "jc-work": "workPerformed",
  "jc-pending": "pendingIssues",
  "jc-parts": "partsReplaced",
  "jc-order": "partsOnOrder",
};

export function readJobCardForm() {
  const data = {};
  for (const [id, key] of Object.entries(FIELDS)) {
    const el = document.getElementById(id);
    data[key] = el ? el.value.trim() : "";
  }
  return data;
}

export function writeJobCardForm(data) {
  for (const [id, key] of Object.entries(FIELDS)) {
    const el = document.getElementById(id);
    if (el && data[key] != null) el.value = data[key];
  }
}

export async function autoFillJobRef() {
  const d = new Date();
  const year = d.getFullYear();
  let next = 1;

  if (FIREBASE_READY) {
    try {
      const q = query(
        collection(db, "jobCards"),
        orderBy("jobCardNo", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const last = snap.docs[0].data().jobCardNo || "";
        const m = last.match(/JC-(\d{4})-(\d+)/);
        if (m && Number(m[1]) === year) next = Number(m[2]) + 1;
      }
    } catch (e) {
      console.warn("Could not look up last job ref", e);
      next = Math.floor(Math.random() * 900) + 100;
    }
  } else {
    next = Math.floor(Math.random() * 900) + 100;
  }

  const jcNo = `JC-${year}-${String(next).padStart(3, "0")}`;
  const jcNoEl = document.getElementById("jc-no");
  const jcDateEl = document.getElementById("jc-date");
  if (jcNoEl) jcNoEl.value = jcNo;
  if (jcDateEl) jcDateEl.value = d.toISOString().split("T")[0];
  return jcNo;
}

export async function saveJobCard() {
  const form = readJobCardForm();
  if (!form.jobCardNo) throw new Error("Job Card No. is required. Click 'Auto-generate Job Ref'.");
  if (!form.equipmentType) throw new Error("Select equipment type.");
  if (!form.fleetNo) throw new Error("Enter fleet / equipment number.");

  const user = currentUser();
  const payload = {
    ...form,
    status: "open",
    updatedAt: serverTimestamp(),
    updatedBy: user ? user.name : "unknown",
  };

  if (FIREBASE_READY) {
    await setDoc(
      doc(db, "jobCards", form.jobCardNo),
      { ...payload, createdAt: serverTimestamp(), createdBy: user ? user.name : "unknown" },
      { merge: true }
    );
  } else {
    const local = JSON.parse(localStorage.getItem("rcpl_jobs") || "{}");
    local[form.jobCardNo] = { ...payload, updatedAt: new Date().toISOString() };
    localStorage.setItem("rcpl_jobs", JSON.stringify(local));
  }
  return form.jobCardNo;
}
