import { PageHeader } from "@/components/common/primitives";
import { useApp } from "@/context/app-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgePercent,
  BarChart3,
  Banknote,
  BookUser,
  ClipboardList,
  FileMinus,
  FileSpreadsheet,
  Landmark,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  TrendingDown,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_app/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — SROTA IMS" },
      {
        name: "description",
        content:
          "Sales, purchase, stock, low-stock, profit margin, VAT register and party statement reports.",
      },
    ],
  }),
  component: ReportsLandingPage,
});

const REPORTS = [
  {
    to: "/reports/standard-view" as const,
    icon: FileSpreadsheet,
    title: "Standard View",
    description: "अनुसूची ५ — all 20 mandatory fields, every invoice in the period.",
  },
  {
    to: "/reports/credit-notes" as const,
    icon: FileMinus,
    title: "Credit Notes",
    description: "Credit notes issued in the period with their reference invoice.",
  },
  {
    to: "/reports/sales" as const,
    icon: ReceiptText,
    title: "Sales report",
    description: "Every sale — customer, items, taxable amount, VAT and total, filterable by date.",
  },
  {
    to: "/reports/vat-register" as const,
    icon: BadgePercent,
    title: "VAT sales register",
    description: "IRD-format VAT register: buyer PAN, taxable amount and VAT per invoice.",
    vatOnly: true,
  },
  {
    to: "/reports/annexure-13" as const,
    icon: ClipboardList,
    title: "Annexure 13",
    description: "अनुसूची १३ — output/input VAT summary and net payable for the period.",
    vatOnly: true,
  },
  {
    to: "/reports/monthly-vat-summary" as const,
    icon: Landmark,
    title: "Monthly VAT summary",
    description: "मासिक — one row per BS month: taxable amounts and net VAT payable.",
    vatOnly: true,
  },
  {
    to: "/reports/tds" as const,
    icon: Banknote,
    title: "TDS report",
    description: "Tax Deducted at Source on supplier purchases for the selected period.",
  },
  {
    to: "/reports/purchases" as const,
    icon: ShoppingCart,
    title: "Purchase report",
    description: "Every supplier bill received, with items, cost and VAT breakdown.",
  },
  {
    to: "/reports/stock" as const,
    icon: PackageSearch,
    title: "Stock summary",
    description: "On-hand quantity, cost value and retail value per variant, by category and branch.",
  },
  {
    to: "/reports/low-stock" as const,
    icon: TrendingDown,
    title: "Low stock",
    description: "Variants at or below their reorder threshold — the same stock report, pre-filtered.",
  },
  {
    to: "/reports/margin" as const,
    icon: BarChart3,
    title: "Profit margin",
    description: "Revenue, cost and margin % per variant, ranked highest revenue first.",
  },
  {
    to: "/reports/customers" as const,
    icon: Users,
    title: "Customer statement",
    description: "Every customer's outstanding balance and activity in the selected period.",
  },
  {
    to: "/reports/suppliers" as const,
    icon: BookUser,
    title: "Supplier statement",
    description: "Every supplier's outstanding balance and activity in the selected period.",
  },
];

function ReportsLandingPage() {
  const app = useApp();
  // A PAN-only tenant has no VAT to report — these three reports would
  // only ever show zero/N/A rows for it (see isVatRegisteredTenant's
  // definition in data/types.ts).
  const reports = app.company.isVatRegisteredTenant
    ? REPORTS
    : REPORTS.filter((r) => !r.vatOnly);

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <PageHeader title="Reports" subtitle="Detailed, filterable reports — export to XLSX or PDF from any of them." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {reports.map((r) => (
          // Each report route has its own (heterogeneous) search schema, so
          // there's no single search value valid for every `to` in this
          // union — navigating with none lets the target route's own
          // validateSearch supply its defaults, same as opening it fresh.
          <Link
            key={r.to}
            to={r.to as never}
            className="group rounded-lg border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
          >
            <r.icon className="h-6 w-6 text-primary" />
            <p className="mt-3 font-medium">{r.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
