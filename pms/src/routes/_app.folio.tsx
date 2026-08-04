import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, QrCode } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMoney } from "@/lib/app-state";
import { bookings, folioCharges } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/folio")({
  head: () => ({
    meta: [
      { title: "Folio & Billing — Dream PMS" },
      {
        name: "description",
        content:
          "Itemised guest folio with room charges, extras, VAT breakdown, QR payment and manual settlement.",
      },
      { property: "og:title", content: "Folio & Billing — Dream PMS" },
      {
        property: "og:description",
        content: "Itemised folio with VAT breakdown, QR payment and manual settlement.",
      },
    ],
  }),
  component: FolioPage,
});

function FolioPage() {
  const money = useMoney();
  const [bookingId, setBookingId] = useState("b1");
  const [paid, setPaid] = useState(false);
  const [open, setOpen] = useState(false);
  const booking = bookings.find((b) => b.id === bookingId)!;

  const subtotal = folioCharges.reduce((s, c) => s + c.qty * c.unit, 0);
  const vat = Math.round(subtotal * 0.13);
  const serviceCharge = Math.round(subtotal * 0.1);
  const total = subtotal + vat + serviceCharge;

  return (
    <>
      <PageHeader
        title="Folio & billing"
        subtitle={`${booking.ref} · ${booking.guest} · Room ${booking.room}`}
        action={
          <div className="flex items-center gap-3">
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bookings
                  .filter((b) => b.status === "checked-in" || b.status === "reserved")
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.ref} · {b.guest}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" /> Add charge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-2xl">Add charge</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setOpen(false);
                  }}
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="desc">Description</Label>
                    <Input id="desc" placeholder="Minibar, spa, airport drop…" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qty">Quantity</Label>
                    <Input id="qty" type="number" defaultValue={1} min={1} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amt">Unit amount</Label>
                    <Input id="amt" type="number" defaultValue={500} />
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit">Add to folio</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folioCharges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {c.date}
                    </TableCell>
                    <TableCell>{c.description}</TableCell>
                    <TableCell className="text-right">{c.qty}</TableCell>
                    <TableCell className="text-right">{money(c.unit)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(c.qty * c.unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <dl className="space-y-2.5 border-t border-border bg-muted/40 p-6 text-sm">
            {[
              ["Subtotal", money(subtotal)],
              ["Service charge (10%)", money(serviceCharge)],
              ["VAT (13%)", money(vat)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
            <div className="flex items-end justify-between border-t border-border pt-3">
              <dt className="font-display text-2xl">Total due</dt>
              <dd className="font-display text-3xl text-accent">{money(total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="surface h-fit p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-none">Payment</h2>
            <Badge
              variant="outline"
              className={
                paid
                  ? "border-success/25 bg-success/12 text-success"
                  : "border-amber/40 bg-amber/15 text-amber-foreground"
              }
            >
              {paid ? "Paid" : "Unpaid"}
            </Badge>
          </div>

          <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-border bg-muted/50 p-8">
            <QrCode className="size-28 text-primary" strokeWidth={1} />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Scan to pay {money(total)} via FonePay / eSewa / Khalti
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <Label>Payment method</Label>
            <Select defaultValue="qr">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="qr">QR / wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="mt-5 w-full gap-2" disabled={paid} onClick={() => setPaid(true)}>
            <Check className="size-4" /> {paid ? "Settled" : "Mark as paid"}
          </Button>
          <Button variant="outline" className="mt-2.5 w-full">
            Generate invoice
          </Button>
        </aside>
      </div>
    </>
  );
}
