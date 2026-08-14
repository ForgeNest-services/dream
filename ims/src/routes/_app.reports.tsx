import { DateRangeFilter } from "@/components/common/date-picker";
import { DateText, EmptyState, Money, PageHeader, StatCard } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { downloadCsv, printPdf } from "@/lib/csv";
import { computeTotals } from "@/lib/invoice";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — SROTA IMS" },
      {
        name: "description",
        content:
          "Sales, purchase, stock, low-stock, profit margin and VAT register reports with BS/AD date ranges and CSV or PDF export.",
      },
      { property: "og:title", content: "Reports — SROTA IMS" },
      {
        property: "og:description",
        content: "Business reporting with VAT registers, stock valuation and margin analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

type ReportKey =
  | "sales"
  | "purchase"
  | "stock"
  | "lowstock"
  | "margin"
  | "vat-sales"
  | "customer"
  | "supplier";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "sales", label: "Sales report" },
  { key: "purchase", label: "Purchase report" },
  { key: "stock", label: "Stock summary" },
  { key: "lowstock", label: "Low stock" },
  { key: "margin", label: "Profit margin" },
  { key: "vat-sales", label: "VAT sales register" },
  { key: "customer", label: "Customer statement" },
  { key: "supplier", label: "Supplier statement" },
];

function ReportsPage() {
  const app = useApp();
  const [report, setReport] = useState<ReportKey>("sales");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("all");

  const inBranch = <T extends { branchId?: string }>(x: T) =>
    app.branchId === "all" || !x.branchId ? true : x.branchId === app.branchId;
  const inRange = (d: string) => (from ? d >= from : true) && (to ? d <= to : true);

  const invoices = app.invoices.filter(
    (i) => i.kind !== "quotation" && inBranch(i) && inRange(i.date),
  );
  const movements = app.movements.filter((m) => inBranch(m) && inRange(m.date));

  const inCategory = (productId: string) => {
    if (categoryId === "all") return true;
    const p = app.products.find((x) => x.id === productId);
    return p?.categoryId === categoryId;
  };

  const table = useMemo<{ columns: string[]; rows: Record<string, unknown>[] }>(() => {
    switch (report) {
      case "sales": {
        return {
          columns: ["Invoice", "Date", "Customer", "Items", "Taxable", "VAT", "Total", "Status"],
          rows: invoices.map((i) => {
            const t = computeTotals(i.lines, app.company);
            return {
              Invoice: i.number,
              Date: i.date,
              Customer: app.parties.find((p) => p.id === i.customerId)?.name ?? "—",
              Items: i.lines.length,
              Taxable: t.taxable,
              VAT: t.vat,
              Total: t.total,
              Status: i.status,
            };
          }),
        };
      }
      case "purchase": {
        return {
          columns: ["Date", "Product", "Supplier", "Qty", "Unit cost", "Total"],
          rows: movements
            .filter((m) => m.type === "restock" && inCategory(m.productId))
            .map((m) => ({
              Date: m.date,
              Product: app.products.find((p) => p.id === m.productId)?.name ?? "—",
              Supplier: app.parties.find((p) => p.id === m.supplierId)?.name ?? "Direct",
              Qty: m.qty,
              "Unit cost": m.unitCost ?? 0,
              Total: (m.unitCost ?? 0) * m.qty,
            })),
        };
      }
      case "stock": {
        return {
          columns: ["Product", "Variant", "Category", "Stock", "Cost value", "Retail value"],
          rows: app.variants
            .filter((v) => inCategory(v.productId))
            .map((v) => {
              const p = app.products.find((x) => x.id === v.productId);
              const qty = app.stockOf(v);
              return {
                Product: p?.name ?? "—",
                Variant: v.name,
                Category: p ? app.categoryPath(p.categoryId) : "—",
                Stock: qty,
                "Cost value": qty * v.costPrice,
                "Retail value": qty * v.sellingPrice,
              };
            }),
        };
      }
      case "lowstock": {
        return {
          columns: ["Product", "Variant", "Stock", "Reorder at", "Shortfall"],
          rows: app.variants
            .filter((v) => inCategory(v.productId) && app.stockOf(v) <= v.lowStockAt)
            .map((v) => ({
              Product: app.products.find((x) => x.id === v.productId)?.name ?? "—",
              Variant: v.name,
              Stock: app.stockOf(v),
              "Reorder at": v.lowStockAt,
              Shortfall: Math.max(0, v.lowStockAt - app.stockOf(v)),
            })),
        };
      }
      case "margin": {
        const map = new Map<string, { qty: number; revenue: number; cost: number }>();
        invoices.forEach((i) =>
          i.lines.forEach((l) => {
            if (!inCategory(l.productId)) return;
            const v = app.variants.find((x) => x.id === l.variantId);
            const cur = map.get(l.variantId) ?? { qty: 0, revenue: 0, cost: 0 };
            cur.qty += l.qty;
            cur.revenue += (l.rate - l.discount) * l.qty;
            cur.cost += (v?.costPrice ?? 0) * l.qty;
            map.set(l.variantId, cur);
          }),
        );
        return {
          columns: ["Product", "Variant", "Qty sold", "Revenue", "Cost", "Profit", "Margin %"],
          rows: [...map.entries()].map(([vid, m]) => {
            const v = app.variants.find((x) => x.id === vid);
            const profit = m.revenue - m.cost;
            return {
              Product: app.products.find((x) => x.id === v?.productId)?.name ?? "—",
              Variant: v?.name ?? "—",
              "Qty sold": m.qty,
              Revenue: m.revenue,
              Cost: m.cost,
              Profit: profit,
              "Margin %": m.revenue ? Math.round((profit / m.revenue) * 100) : 0,
            };
          }),
        };
      }
      case "vat-sales": {
        return {
          columns: ["Invoice", "Date", "Buyer", "Buyer PAN", "Taxable", "VAT", "Total"],
          rows: invoices.map((i) => {
            const t = computeTotals(i.lines, app.company);
            const c = app.parties.find((p) => p.id === i.customerId);
            return {
              Invoice: i.number,
              Date: i.date,
              Buyer: c?.name ?? "—",
              "Buyer PAN": c?.pan ?? "—",
              Taxable: t.taxable,
              VAT: t.vat,
              Total: t.total,
            };
          }),
        };
      }
      case "customer":
      case "supplier": {
        const kind = report === "customer" ? "customer" : "supplier";
        return {
          columns: ["Party", "PAN", "Debit", "Credit", "Balance"],
          rows: app.parties
            .filter((p) => p.kind === kind)
            .map((p) => {
              const entries = app.ledger.filter((l) => l.partyId === p.id && inRange(l.date));
              const debit = entries.reduce((s, e) => s + e.debit, 0);
              const credit = entries.reduce((s, e) => s + e.credit, 0);
              return {
                Party: p.name,
                PAN: p.pan ?? "—",
                Debit: debit,
                Credit: credit,
                Balance: app.partyBalance(p.id),
              };
            }),
        };
      }
    }
  }, [report, invoices, movements, app, categoryId, from, to]);

  const moneyCols = new Set([
    "Taxable",
    "VAT",
    "Total",
    "Unit cost",
    "Cost value",
    "Retail value",
    "Revenue",
    "Cost",
    "Profit",
    "Debit",
    "Credit",
    "Balance",
  ]);

  const totalsRow = table.columns
    .filter((c) => moneyCols.has(c))
    .map((c) => ({
      col: c,
      value: table.rows.reduce((s, r) => s + (Number(r[c]) || 0), 0),
    }));

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <PageHeader
        title="Reports"
        subtitle="Filter by branch, category and BS/AD date range, then export."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(report, table.rows, table.columns)}
            >
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printPdf}>
              <Printer className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Select value={report} onValueChange={(v) => setReport(v as ReportKey)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORTS.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {app.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {app.categoryPath(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      {totalsRow.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totalsRow.slice(0, 4).map((t) => (
            <StatCard key={t.col} label={`Total ${t.col.toLowerCase()}`} value={<Money value={t.value} />} />
          ))}
        </div>
      )}

      {table.rows.length === 0 ? (
        <EmptyState title="Nothing to report" description="Widen the filters or date range." />
      ) : (
        <div className="overflow-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c}
                    className={`px-3 py-2.5 font-medium ${moneyCols.has(c) || c === "Qty" ? "text-right" : "text-left"}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 200).map((r, idx) => (
                <tr key={idx} className="border-b last:border-0 hover:bg-accent/40">
                  {table.columns.map((c) => {
                    const v = r[c];
                    return (
                      <td
                        key={c}
                        className={`px-3 py-2 ${moneyCols.has(c) ? "text-right" : "text-left"}`}
                      >
                        {moneyCols.has(c) ? (
                          <Money value={Number(v) || 0} />
                        ) : c === "Date" ? (
                          <DateText value={String(v)} />
                        ) : (
                          <span className={typeof v === "number" ? "num" : ""}>{String(v)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
