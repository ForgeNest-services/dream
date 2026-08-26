import { PageHeader } from "@/components/common/primitives";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgePercent,
  BarChart3,
  BookUser,
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
  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <PageHeader title="Reports" subtitle="Detailed, filterable reports — export to XLSX or PDF from any of them." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
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
