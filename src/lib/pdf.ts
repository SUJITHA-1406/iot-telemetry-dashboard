import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatINR,
  formatNumber,
  materialOrder,
  materialUnits,
  type CostBreakdown,
  type Detections,
  type Quantities,
} from "@/lib/estimator";
import type { Material, Project } from "@/lib/workflow";

export function buildEstimationPdf(args: {
  project: Project;
  detections: Detections;
  quantities: Quantities;
  selected: Record<string, Material | undefined>;
  breakdown: CostBreakdown;
}): jsPDF {
  const { project, detections, quantities, selected, breakdown } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();

  // Header band
  doc.setFillColor(28, 42, 68);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setFillColor(232, 122, 32);
  doc.rect(40, 26, 38, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SMART CONSTRUCTION ESTIMATOR", 92, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("AI Blueprint Analysis & Cost Estimation Report", 92, 64);

  doc.setTextColor(30, 30, 30);
  let y = 118;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Project Details", 40, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: [28, 42, 68] },
    head: [["Field", "Value"]],
    body: [
      ["Project Name", project.project_name],
      ["Owner", project.owner_name || "-"],
      ["Location", project.location || "-"],
      ["Building Type", project.building_type],
      ["Floors", String(project.floors)],
      ["Built-up Area", `${formatNumber(project.area)} sq.ft`],
      ["Foundation", project.foundation || "-"],
      ["Roof", project.roof || "-"],
      ["Estimated Budget", formatINR(project.budget)],
      ["Start Date", project.start_date ?? "-"],
    ],
    styles: { fontSize: 9 },
  });

  const detectionRows = [
    ...Object.entries(detections.civil).map(([k, v]) => ["Civil", k, String(v)]),
    ...Object.entries(detections.electrical).map(([k, v]) => ["Electrical", k, String(v)]),
    ...Object.entries(detections.mechanical).map(([k, v]) => ["Mechanical", k, String(v)]),
  ];

  autoTable(doc, {
    startY: (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    theme: "grid",
    headStyles: { fillColor: [28, 42, 68] },
    head: [["Drawing", "Detected Component", "Count"]],
    body: detectionRows,
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    startY: (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    theme: "grid",
    headStyles: { fillColor: [232, 122, 32] },
    head: [["Material", "Quantity", "Unit", "Selected Brand", "Quality", "Rate", "Cost"]],
    body: materialOrder.map((key) => {
      const m = selected[key];
      const qty = quantities[key] ?? 0;
      return [
        key,
        formatNumber(qty),
        materialUnits[key],
        m?.brand ?? "-",
        m?.quality ?? "-",
        m ? formatINR(m.price) : "-",
        m ? formatINR(qty * m.price) : "-",
      ];
    }),
    styles: { fontSize: 9 },
  });

  if (breakdown.floors && breakdown.floors.length > 0) {
    autoTable(doc, {
      startY: (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
      theme: "grid",
      headStyles: { fillColor: [28, 42, 68] },
      head: [["Floor Name", "Material Cost", "Labour Cost", "Total Cost"]],
      body: breakdown.floors.map((fb) => [
        fb.floorName,
        formatINR(fb.breakdown.materialCost),
        formatINR(fb.breakdown.labor),
        formatINR(fb.breakdown.total),
      ]),
      styles: { fontSize: 9 },
    });
  }

  autoTable(doc, {
    startY: (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
    theme: "grid",
    headStyles: { fillColor: [28, 42, 68] },
    head: [["Total Project Cost Component", "Amount"]],
    body: [
      ["Material Cost", formatINR(breakdown.materialCost)],
      ["Labor Cost (28%)", formatINR(breakdown.labor)],
      ["Equipment (9%)", formatINR(breakdown.equipment)],
      ["Transportation (5%)", formatINR(breakdown.transportation)],
      ["GST (18%)", formatINR(breakdown.gst)],
      ["Contingency (5%)", formatINR(breakdown.contingency)],
      ["GRAND TOTAL", formatINR(breakdown.total)],
    ],
    styles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.row.index === 6) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 233, 220];
      }
    },
  });

  const finalY = (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 40;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, 40, finalY);
  doc.text(`Overall AI Confidence: ${
    ((detections.confidence.civil + detections.confidence.electrical + detections.confidence.mechanical) / 3).toFixed(1)
  }%`, 40, finalY + 14);

  doc.setDrawColor(120, 120, 120);
  doc.line(pageWidth - 200, finalY + 40, pageWidth - 40, finalY + 40);
  doc.text("Authorised Signature", pageWidth - 200, finalY + 54);

  return doc;
}
