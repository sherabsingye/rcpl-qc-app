import { readChecklist, computeResult } from "./qc.js";

const EQ_MAP = {
  exc: "Excavator (PC200 / CAT)", drill: "Drill Rig (Epiroc Boomer E2C)",
  crane: "Crane (SANY)", gen: "Generator (CAT 540 KVA)",
  grade: "Motor Grader", pump: "Concrete Pump (Putzmeister)",
  comp: "Compactor / Roller", tipper: "Tipper / Dump Truck",
  wl: "Wheel Loader", paver: "Paver", shot: "Shotcrete Machine",
  tanker: "Fuel Tanker", muck: "Muck Loader", lv: "Light Vehicle",
};

function activeEqKey() {
  const a = document.querySelector(".eq-panel.active");
  return a ? a.id.replace("eq-", "") : "exc";
}

function v(id) { return document.getElementById(id)?.value?.trim() || "—"; }

export function downloadQCPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const eqKey = activeEqKey();
  const { items, counts } = readChecklist(eqKey);
  const result = computeResult(eqKey, items, counts);

  const M = 10;           // margin
  const PW = 190;         // page width usable
  const COL = PW / 2;     // column width
  let y = M;

  // ── HEADER ──────────────────────────────────────────────
  doc.setFillColor(251, 176, 66);
  doc.rect(M, y, PW, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(19, 19, 19);
  doc.text("RIGSAR CONSTRUCTION — Equipment QC Record", M + 2, y + 6);
  y += 11;

  // ── INFO GRID (2 columns) ────────────────────────────────
  doc.setFontSize(7.5);
  const infoLeft = [
    ["QC Ref", v("qc-ref")],
    ["Date", v("qc-date")],
    ["Fleet No.", v("qc-fleet")],
    ["Site", v("qc-site")],
    ["Equipment", EQ_MAP[eqKey] || eqKey],
  ];
  const infoRight = [
    ["Inspector", v("qc-inspector")],
    ["Operator", v("qc-operator")],
    ["Contact", v("qc-operator-contact")],
    ["Repaired By", v("qc-repaired-by")],
  ];

  const rows = Math.max(infoLeft.length, infoRight.length);
  const rowH = 5.5;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.rect(M, y, PW, rows * rowH + 2, "FD");

  infoLeft.forEach(([label, val], i) => {
    const ry = y + 1 + i * rowH + 4;
    doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80);
    doc.text(label + ":", M + 2, ry);
    doc.setFont("helvetica", "normal"); doc.setTextColor(19, 19, 19);
    doc.text(val, M + 28, ry);
  });
  infoRight.forEach(([label, val], i) => {
    const ry = y + 1 + i * rowH + 4;
    doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80);
    doc.text(label + ":", M + COL + 2, ry);
    doc.setFont("helvetica", "normal"); doc.setTextColor(19, 19, 19);
    doc.text(val, M + COL + 26, ry, { maxWidth: COL - 28 });
  });
  y += rows * rowH + 5;

  // ── RESULT BADGE ────────────────────────────────────────
  const rc = result === "PASS" ? [212,237,218] : result === "FAIL" ? [248,215,218] : [255,243,205];
  const rt = result === "PASS" ? [21,87,36] : result === "FAIL" ? [114,28,36] : [133,100,4];
  doc.setFillColor(...rc);
  doc.rect(M, y, PW, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...rt);
  doc.text(`OVERALL RESULT: ${result}`, M + 2, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
  doc.text(`OK: ${counts.ok}  |  Mon: ${counts.mon}  |  Fail: ${counts.fail}  |  Pending: ${counts.pending}`, M + COL, y + 5.5);
  y += 11;

  // ── CHECKLIST (2 columns) ────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(19,19,19);
  doc.text("CHECKLIST", M, y + 4);
  y += 6;

  // Split items into left and right columns
  const itemH = 5;
  const sectionItems = {};
  for (const it of items) {
    if (!sectionItems[it.section]) sectionItems[it.section] = [];
    sectionItems[it.section].push(it);
  }

  for (const [section, secItems] of Object.entries(sectionItems)) {
    // Section heading spans full width
    if (y > 272) { doc.addPage(); y = M; }
    doc.setFillColor(240, 240, 240);
    doc.rect(M, y, PW, 5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
    doc.text(section.toUpperCase(), M + 2, y + 3.5);
    y += 6;

    // Two-column layout for items
    const mid = Math.ceil(secItems.length / 2);
    const leftCol = secItems.slice(0, mid);
    const rightCol = secItems.slice(mid);
    const colRows = Math.max(leftCol.length, rightCol.length);

    for (let i = 0; i < colRows; i++) {
      if (y > 275) { doc.addPage(); y = M; }
      [leftCol[i], rightCol[i]].forEach((item, col) => {
        if (!item) return;
        const x = col === 0 ? M : M + COL + 1;
        const statusColor = item.status === "OK" ? [21,87,36] :
                            item.status === "Fail" ? [180,28,28] :
                            item.status === "Mon" ? [133,100,4] : [160,160,160];
        // Status badge
        doc.setFillColor(...statusColor);
        doc.roundedRect(x, y + 0.5, 8, 3.5, 1, 1, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.setTextColor(255,255,255);
        doc.text(item.status, x + 4, y + 2.8, { align: "center" });
        // Item name
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(40,40,40);
        doc.text(item.name, x + 10, y + 2.8, { maxWidth: COL - 12 });
        // Divider
        doc.setDrawColor(235,235,235);
        doc.line(x, y + itemH, x + COL - 1, y + itemH);
      });
      y += itemH;
    }
    y += 2;
  }

  // ── FOOTER ──────────────────────────────────────────────
  if (y > 275) { doc.addPage(); y = M; }
  y += 3;
  doc.setDrawColor(200,200,200); doc.line(M, y, M + PW, y); y += 4;
  doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(150,150,150);
  doc.text(`Generated: ${new Date().toLocaleString()} | RCPL QC & Dispatch System | rcpl-qc-app.vercel.app`, M, y);

  doc.save(`QC-${v("qc-ref")}-${eqKey}.pdf`);
}
