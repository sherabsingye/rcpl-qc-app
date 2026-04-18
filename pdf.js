import { readChecklist, computeResult } from "./qc.js";

const EQ_MAP = {
  exc: "Excavator (PC200 / CAT)",
  drill: "Drill Rig (Epiroc Boomer E2C)",
  crane: "Crane (SANY)",
  gen: "Generator (CAT 540 KVA)",
  grade: "Motor Grader",
  pump: "Concrete Pump (Putzmeister)",
  comp: "Compactor / Roller",
  tipper: "Tipper / Dump Truck",
  wl: "Wheel Loader",
  paver: "Paver",
  shot: "Shotcrete Machine",
  tanker: "Fuel Tanker",
  muck: "Muck Loader",
  lv: "Light Vehicle",
};

function activeEqKey() {
  const active = document.querySelector(".eq-panel.active");
  if (!active) return "exc";
  return active.id.replace("eq-", "");
}

export function downloadQCPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const qcRef = document.getElementById("qc-ref")?.value || "—";
  const date = document.getElementById("qc-date")?.value || "—";
  const fleet = document.getElementById("qc-fleet")?.value || "—";
  const site = document.getElementById("qc-site")?.value || "—";
  const inspector = document.getElementById("qc-inspector")?.value || "—";
  const operator = document.getElementById("qc-operator")?.value || "—";
  const contact = document.getElementById("qc-operator-contact")?.value || "—";
  const repairedBy = document.getElementById("qc-repaired-by")?.value || "—";

  const eqKey = activeEqKey();
  const { items, counts } = readChecklist(eqKey);
  const result = computeResult(eqKey, items, counts);
  const eqName = EQ_MAP[eqKey] || eqKey;

  let y = 15;
  const L = 14;
  const W = 182;

  // Header bar
  doc.setFillColor(251, 176, 66);
  doc.rect(L, y, W, 12, "F");
  doc.setTextColor(19, 19, 19);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("RIGSAR CONSTRUCTION — Equipment QC Record", L + 4, y + 8);
  y += 16;

  // Sub header
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Equipment Maintenance Division | Phuentsholing, Bhutan", L + 4, y);
  y += 8;

  // Reference details box
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 248, 248);
  doc.rect(L, y, W, 38, "FD");
  doc.setTextColor(19, 19, 19);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const col2 = L + 95;
  doc.text("QC Ref No:", L + 4, y + 7);
  doc.text("Date:", L + 4, y + 14);
  doc.text("Fleet / Equipment No:", L + 4, y + 21);
  doc.text("Site / Project:", L + 4, y + 28);
  doc.text("Equipment Type:", L + 4, y + 35);

  doc.text("Inspector / Mechanic:", col2, y + 7);
  doc.text("Operator / Driver:", col2, y + 14);
  doc.text("Contact No:", col2, y + 21);
  doc.text("Repaired By:", col2, y + 28);

  doc.setFont("helvetica", "normal");
  doc.text(qcRef, L + 40, y + 7);
  doc.text(date, L + 40, y + 14);
  doc.text(fleet, L + 55, y + 21);
  doc.text(site, L + 40, y + 28);
  doc.text(eqName, L + 42, y + 35);

  doc.text(inspector, col2 + 44, y + 7);
  doc.text(operator, col2 + 40, y + 14);
  doc.text(contact, col2 + 28, y + 21);
  doc.text(repairedBy, col2 + 30, y + 28);

  y += 44;

  // Overall result badge
  const resultColor = result === "PASS" ? [212, 237, 218] :
                      result === "FAIL" ? [248, 215, 218] : [255, 243, 205];
  const resultText = result === "PASS" ? [21, 87, 36] :
                     result === "FAIL" ? [114, 28, 36] : [133, 100, 4];
  doc.setFillColor(...resultColor);
  doc.rect(L, y, W, 10, "F");
  doc.setTextColor(...resultText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`OVERALL RESULT: ${result}`, L + 4, y + 7);
  doc.setFontSize(9);
  doc.text(`OK: ${counts.ok}   Mon: ${counts.mon}   Fail: ${counts.fail}   Pending: ${counts.pending}`, col2, y + 7);
  y += 15;

  // Checklist items
  doc.setTextColor(19, 19, 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Checklist Items", L, y);
  y += 6;

  let lastSection = "";
  for (const item of items) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }

    if (item.section !== lastSection) {
      doc.setFillColor(251, 176, 66);
      doc.rect(L, y, W, 6, "F");
      doc.setTextColor(19, 19, 19);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(item.section.toUpperCase(), L + 2, y + 4);
      y += 8;
      lastSection = item.section;
    }

    const statusColor = item.status === "OK" ? [21, 87, 36] :
                        item.status === "Fail" ? [114, 28, 36] :
                        item.status === "Mon" ? [133, 100, 4] : [120, 120, 120];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text(`• ${item.name}`, L + 2, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...statusColor);
    doc.text(item.status, L + W - 15, y + 4);
    doc.setDrawColor(230, 230, 230);
    doc.line(L, y + 6, L + W, y + 6);
    y += 7;
  }

  // Footer
  if (y > 270) { doc.addPage(); y = 15; }
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(L, y, L + W, y);
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | RCPL Equipment QC & Dispatch System`, L, y);

  doc.save(`QC-${qcRef}-${eqKey}.pdf`);
}
