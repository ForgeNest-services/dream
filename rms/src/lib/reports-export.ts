/**
 * Client-side XLSX + PDF exports for the Reports view. Both operate on
 * already-fetched data (SummaryDto + orders + topItems) so what you see is
 * exactly what gets exported. If the report ever grows past a few thousand
 * bills we should move this to a backend streaming endpoint — but at
 * restaurant scale (~500 bills/day/branch) client-side is fine.
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SummaryDto, TopItemDto } from "./reports-api";
import type { OrderDto } from "./orders-api";

export interface ExportContext {
  branchName: string;
  bsFrom: string;
  bsTo: string;
  summary: SummaryDto;
  orders: OrderDto[];
  topItems: TopItemDto[];
  vatEnabled: boolean;
  vatRate: number;
}

// ----- shared helpers ---------------------------------------------------

const asN = (v: string | number | undefined) =>
  typeof v === "number" ? v : Number(v ?? 0);

// Line prices are stored VAT-inclusive — total is just subtotal minus
// discount, no VAT added on top (mirrors store.tsx's billTotals()).
// vatEnabled/vatRate are unused here now but kept in the signature/
// ExportContext since callers already pass them through.
function billTotal(o: OrderDto, _vatEnabled: boolean, _vatRate: number): number {
  const subtotal = o.lines
    .filter((l) => !l.is_voided)
    .reduce((s, l) => s + Number(l.price) * l.qty, 0);
  const discount =
    o.discount_type === "percent"
      ? (subtotal * Number(o.discount_value)) / 100
      : Number(o.discount_value);
  return Math.max(0, subtotal - discount);
}

function fileStamp(bsFrom: string, bsTo: string): string {
  const same = bsFrom === bsTo;
  return same ? bsFrom : `${bsFrom}_to_${bsTo}`;
}

// ----- XLSX -------------------------------------------------------------

export function exportReportXlsx(ctx: ExportContext): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryRows: (string | number)[][] = [
    ["Srota RMS — Sales Report"],
    ["Branch", ctx.branchName],
    ["From (BS)", ctx.bsFrom],
    ["To (BS)", ctx.bsTo],
    [],
    ["KPI", "Value"],
    ["Closed bills", ctx.summary.orders.paid],
    ["Running bills", ctx.summary.orders.draft],
    ["Cancelled bills", ctx.summary.orders.cancelled],
    ["Items sold", ctx.summary.items_sold],
    ["Sales (gross)", asN(ctx.summary.sales_gross)],
    ["Expenses", asN(ctx.summary.expenses_total)],
    ["Net (sales − expenses)", asN(ctx.summary.net)],
    [],
    ["Payment method", "Bills", "Amount"],
    ...(["cash", "qr", "khata"] as const).map((m) => [
      m.toUpperCase(),
      ctx.summary.by_payment[m].count,
      asN(ctx.summary.by_payment[m].amount),
    ]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Category breakdown
  const catRows: (string | number)[][] = [
    ["Category", "Qty sold", "Revenue"],
    ...ctx.summary.by_category.map((c) => [c.category, c.qty, asN(c.revenue)]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), "By Category");

  // Top items
  const itemRows: (string | number)[][] = [
    ["Item", "Variant", "Qty sold", "Revenue"],
    ...ctx.topItems.map((i) => [i.name, i.variant_name ?? "", i.qty, asN(i.revenue)]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemRows), "Menu Items");

  // Expenses
  if (ctx.summary.expenses_by_category.length > 0) {
    const expRows: (string | number)[][] = [
      ["Category", "Amount"],
      ...ctx.summary.expenses_by_category.map((c) => [c.category, asN(c.amount)]),
      ["TOTAL", asN(ctx.summary.expenses_total)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), "Expenses");
  }

  // Bills — one row per order, no lines expansion (too wide for xlsx)
  const billRows: (string | number)[][] = [
    ["Bill #", "Date (BS)", "Type", "Status", "Payment", "Items", "Total"],
    ...ctx.orders.map((o) => [
      o.bill_code ?? `#${o.bill_number}`,
      o.placed_at_bs,
      o.type,
      o.status,
      o.payment_method ?? "",
      o.lines.reduce((n, l) => n + l.qty, 0),
      billTotal(o, ctx.vatEnabled, ctx.vatRate),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(billRows), "Bills");

  XLSX.writeFile(wb, `srota-report-${fileStamp(ctx.bsFrom, ctx.bsTo)}.xlsx`);
}

// ----- PDF --------------------------------------------------------------

export function exportReportPdf(ctx: ExportContext): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Srota RMS — Sales Report", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(ctx.branchName, 40, 68);
  doc.text(
    `Range: ${ctx.bsFrom}${ctx.bsFrom === ctx.bsTo ? "" : ` → ${ctx.bsTo}`} (BS)`,
    40,
    82,
  );
  doc.text(`Generated ${new Date().toLocaleString()}`, pageW - 40, 68, {
    align: "right",
  });

  let cursorY = 100;

  // KPIs
  autoTable(doc, {
    startY: cursorY,
    head: [["KPI", "Value"]],
    body: [
      ["Closed bills", String(ctx.summary.orders.paid)],
      ["Items sold", String(ctx.summary.items_sold)],
      ["Sales (gross) NPR", asN(ctx.summary.sales_gross).toLocaleString("en-IN")],
      ["Expenses NPR", asN(ctx.summary.expenses_total).toLocaleString("en-IN")],
      ["Net NPR", asN(ctx.summary.net).toLocaleString("en-IN")],
    ],
    theme: "grid",
    headStyles: { fillColor: [10, 41, 71], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  // Payments
  autoTable(doc, {
    startY: cursorY,
    head: [["Payment method", "Bills", "Amount NPR"]],
    body: (["cash", "qr", "khata"] as const).map((m) => [
      m.toUpperCase(),
      String(ctx.summary.by_payment[m].count),
      asN(ctx.summary.by_payment[m].amount).toLocaleString("en-IN"),
    ]),
    theme: "grid",
    headStyles: { fillColor: [10, 41, 71], textColor: 255 },
    margin: { left: 40, right: 40 },
  });
  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  // Category breakdown
  if (ctx.summary.by_category.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Category", "Qty", "Revenue NPR"]],
      body: ctx.summary.by_category.map((c) => [
        c.category,
        String(c.qty),
        asN(c.revenue).toLocaleString("en-IN"),
      ]),
      theme: "grid",
      headStyles: { fillColor: [10, 41, 71], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Top items — new page if we're deep in the report
  if (cursorY > 650) {
    doc.addPage();
    cursorY = 40;
  }
  if (ctx.topItems.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Item", "Qty", "Revenue NPR"]],
      body: ctx.topItems.map((i) => [
        i.variant_name ? `${i.name} (${i.variant_name})` : i.name,
        String(i.qty),
        asN(i.revenue).toLocaleString("en-IN"),
      ]),
      theme: "grid",
      headStyles: { fillColor: [10, 41, 71], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Expenses
  if (ctx.summary.expenses_by_category.length > 0) {
    if (cursorY > 650) {
      doc.addPage();
      cursorY = 40;
    }
    autoTable(doc, {
      startY: cursorY,
      head: [["Expense category", "Amount NPR"]],
      body: [
        ...ctx.summary.expenses_by_category.map((c) => [
          c.category,
          asN(c.amount).toLocaleString("en-IN"),
        ]),
        [
          { content: "TOTAL", styles: { fontStyle: "bold" as const } },
          {
            content: asN(ctx.summary.expenses_total).toLocaleString("en-IN"),
            styles: { fontStyle: "bold" as const },
          },
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: [10, 41, 71], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Bills — always start on a fresh page (typically the longest section)
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Bills", 40, 50);
  autoTable(doc, {
    startY: 60,
    head: [["Bill #", "Date", "Type", "Status", "Pay", "Items", "Total"]],
    body: ctx.orders.map((o) => [
      o.bill_code ?? `#${o.bill_number}`,
      o.placed_at_bs,
      o.type,
      o.status,
      o.payment_method ?? "",
      String(o.lines.reduce((n, l) => n + l.qty, 0)),
      billTotal(o, ctx.vatEnabled, ctx.vatRate).toLocaleString("en-IN"),
    ]),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [10, 41, 71], textColor: 255, fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`srota-report-${fileStamp(ctx.bsFrom, ctx.bsTo)}.pdf`);
}
