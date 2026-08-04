import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMoney } from "@/lib/app-state";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Dream PMS" },
      {
        name: "description",
        content:
          "Settled and pending payments across cash, bank transfer and QR wallets, with daily reconciliation totals.",
      },
      { property: "og:title", content: "Payments — Dream PMS" },
      {
        property: "og:description",
        content: "Payment reconciliation across cash, bank transfer and QR wallets.",
      },
    ],
  }),
  component: PaymentsPage,
});

const payments = [
  { id: "p1", ref: "PAY-9921", date: "02 Aug 2026", guest: "Sita Gurung", method: "QR / FonePay", amount: 7232, status: "settled" },
  { id: "p2", ref: "PAY-9920", date: "02 Aug 2026", guest: "Mika Tanaka", method: "Cash", amount: 20340, status: "settled" },
  { id: "p3", ref: "PAY-9919", date: "01 Aug 2026", guest: "Tom Bakker", method: "Bank transfer", amount: 15255, status: "pending" },
  { id: "p4", ref: "PAY-9918", date: "31 Jul 2026", guest: "Elena Fischer", method: "QR / eSewa", amount: 16272, status: "settled" },
  { id: "p5", ref: "PAY-9917", date: "30 Jul 2026", guest: "Rahul Menon", method: "Bank transfer", amount: 81925, status: "settled" },
];

function PaymentsPage() {
  const money = useMoney();
  const settled = payments.filter((p) => p.status === "settled").reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Reconciliation across cash, bank and wallets" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Settled this week", money(settled)],
          ["Pending settlement", money(pending)],
          ["Transactions", String(payments.length)],
        ].map(([label, value]) => (
          <div key={label} className="surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 font-display text-3xl leading-none">{value}</p>
          </div>
        ))}
      </div>

      <section className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.ref}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{p.date}</TableCell>
                <TableCell>{p.guest}</TableCell>
                <TableCell>{p.method}</TableCell>
                <TableCell className="text-right font-semibold">{money(p.amount)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      p.status === "settled"
                        ? "border-success/25 bg-success/12 text-success"
                        : "border-amber/40 bg-amber/15 text-amber-foreground"
                    }
                  >
                    {p.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
