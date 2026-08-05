import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, List, Plus, Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { bookings, bookingStatusClass, type BookingStatus } from "@/lib/mock-data";

// TODO(phase-3): replace with real rooms + room types from API
const rooms: { id: string; number: string; type: string }[] = [];
const roomTypes: { id: string; name: string }[] = [];

export const Route = createFileRoute("/_app/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings & Reservations — Dream PMS" },
      {
        name: "description",
        content:
          "Calendar and list views of every reservation, with search, status filters and quick booking creation.",
      },
      { property: "og:title", content: "Bookings & Reservations — Dream PMS" },
      {
        property: "og:description",
        content: "Calendar and list views of every reservation with fast booking creation.",
      },
    ],
  }),
  component: BookingsPage,
});

const WEEK = ["Mon 3", "Tue 4", "Wed 5", "Thu 6", "Fri 7", "Sat 8", "Sun 9"];
const blocks = [
  { room: "104", start: 0, span: 3, guest: "N. Karki", tone: "bg-accent/85 text-accent-foreground" },
  { room: "112", start: 2, span: 2, guest: "S. Gurung", tone: "bg-primary/85 text-primary-foreground" },
  { room: "203", start: 1, span: 4, guest: "T. Bakker", tone: "bg-info/80 text-info-foreground" },
  { room: "208", start: 3, span: 3, guest: "J. O'Connor", tone: "bg-amber/85 text-amber-foreground" },
  { room: "210", start: 0, span: 2, guest: "E. Fischer", tone: "bg-primary/85 text-primary-foreground" },
  { room: "301", start: 4, span: 3, guest: "M. Tanaka", tone: "bg-accent/85 text-accent-foreground" },
  { room: "305", start: 1, span: 5, guest: "R. Menon", tone: "bg-info/80 text-info-foreground" },
];

function BookingsPage() {
  const money = useMoney();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [range, setRange] = useState<"week" | "month">("week");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [open, setOpen] = useState(false);

  const filtered = bookings.filter(
    (b) =>
      (status === "all" || b.status === status) &&
      (b.guest.toLowerCase().includes(query.toLowerCase()) ||
        b.ref.toLowerCase().includes(query.toLowerCase()) ||
        b.room.includes(query)),
  );

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle="Reservations across all room types"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> New booking
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-2xl">New booking</DialogTitle>
                <DialogDescription>Create a reservation for an incoming guest.</DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="guest">Guest name</Label>
                  <Input id="guest" placeholder="Full name as on ID" required />
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select disabled={rooms.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={rooms.length === 0 ? "No rooms yet (Phase 3)" : "Pick a room"} />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.slice(0, 18).map((r) => (
                        <SelectItem key={r.id} value={r.number}>
                          {r.number} · {r.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pax">Number of guests</Label>
                  <Input id="pax" type="number" min={1} defaultValue={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="in">Check-in</Label>
                  <Input id="in" type="date" defaultValue="2026-08-03" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="out">Check-out</Label>
                  <Input id="out" type="date" defaultValue="2026-08-06" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="rate">Nightly rate</Label>
                  <Input id="rate" type="number" defaultValue={4500} />
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create booking</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-card p-1">
          {(["calendar", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {v === "calendar" ? <CalendarDays className="size-4" /> : <List className="size-4" />}
              {v}
            </button>
          ))}
        </div>

        {view === "calendar" ? (
          <div className="flex rounded-lg border border-border bg-card p-1">
            {(["week", "month"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
                  range === r ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guest, ref or room"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus | "all")}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="checked-in">Checked in</SelectItem>
                <SelectItem value="checked-out">Checked out</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {view === "calendar" ? (
        <section className="surface overflow-x-auto p-6">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[110px_repeat(7,1fr)] gap-2 border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Room
              </span>
              {(range === "week" ? WEEK : WEEK.map((_, i) => `W${i + 1}`)).map((d) => (
                <span key={d} className="text-center text-xs font-semibold text-muted-foreground">
                  {range === "week" ? d : `Week ${d.slice(1)}`}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {blocks.map((b) => (
                <div key={b.room} className="grid grid-cols-[110px_repeat(7,1fr)] items-center gap-2">
                  <div className="text-sm font-semibold">
                    Room {b.room}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {roomTypes.length > 0 ? roomTypes[Number(b.room) % roomTypes.length]!.name : "—"}
                    </span>
                  </div>
                  {Array.from({ length: 7 }).map((_, i) => {
                    if (i === b.start)
                      return (
                        <div
                          key={i}
                          style={{ gridColumn: `span ${b.span}` }}
                          className={`truncate rounded-lg px-3 py-2.5 text-xs font-semibold ${b.tone}`}
                        >
                          {b.guest} · {b.span}N
                        </div>
                      );
                    if (i > b.start && i < b.start + b.span) return null;
                    return <div key={i} className="h-10 rounded-lg bg-muted/60" />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-semibold">{b.ref}</TableCell>
                  <TableCell>{b.guest}</TableCell>
                  <TableCell>
                    {b.room}
                    <span className="block text-xs text-muted-foreground">{b.roomType}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {b.checkIn} → {b.checkOut}
                  </TableCell>
                  <TableCell>{b.guests}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {money(b.rate * b.nights)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={bookingStatusClass[b.status]}>
                      {b.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No bookings match.</p>
          )}
        </section>
      )}
    </>
  );
}
