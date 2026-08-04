import { createFileRoute } from "@tanstack/react-router";
import { Download, Eye } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/lib/app-state";
import { invoices, revenueSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices & Reports — Dream PMS" },
      {
        name: "description",
        content:
          "Generated VAT invoices plus daily revenue, occupancy trends and a VAT summary for your accountant.",
      },
      { property: "og:title", content: "Invoices & Reports — Dream PMS" },
      {
        property: "og:description",
        content: "VAT invoices, revenue and occupancy reporting for the property.",
      },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const money = useMoney();
  const totalVat = invoices.reduce((s, i) => s + i.vat, 0);
  const totalNet = invoices.reduce((s, i) => s + (i.amount - i.vat), 0);

  return (
    <>
      <PageHeader title="Invoices & reports" subtitle="VAT-compliant billing and performance" />

      <Tabs defaultValue="invoices">
        <TabsList className="mb-5">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <section className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice no.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-semibold">{inv.number}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {inv.date}
                    </TableCell>
                    <TableCell>{inv.guest}</TableCell>
                    <TableCell className="text-right">{money(inv.vat)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(inv.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "paid"
                            ? "border-success/25 bg-success/12 text-success"
                            : "border-amber/40 bg-amber/15 text-amber-foreground"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="View invoice">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Download invoice">
                          <Download className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="surface p-6">
              <h2 className="text-2xl leading-none">Daily revenue</h2>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">Last 7 days</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      fill="url(#rev)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="surface p-6">
              <h2 className="text-2xl leading-none">Occupancy %</h2>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">Last 7 days</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="occupancy" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="surface overflow-x-auto xl:col-span-2">
              <div className="p-6 pb-0">
                <h2 className="text-2xl leading-none">VAT summary</h2>
                <p className="mt-1 text-xs text-muted-foreground">Current billing period</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT 13%</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Room revenue", Math.round(totalNet * 0.78)],
                    ["Food & beverage", Math.round(totalNet * 0.15)],
                    ["Other services", Math.round(totalNet * 0.07)],
                  ].map(([label, net]) => (
                    <TableRow key={label as string}>
                      <TableCell>{label}</TableCell>
                      <TableCell className="text-right">{money(net as number)}</TableCell>
                      <TableCell className="text-right">
                        {money(Math.round((net as number) * 0.13))}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(Math.round((net as number) * 1.13))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{money(totalNet)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(totalVat)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(totalNet + totalVat)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
