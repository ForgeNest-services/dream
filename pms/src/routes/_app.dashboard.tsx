import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, BedDouble, LogIn, LogOut, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { useApp, useMoney } from "@/lib/app-state";
import {
  bookings,
  bookingStatusClass,
  rooms,
  roomStatusClass,
  roomStatusLabel,
  type RoomStatus,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dream PMS" },
      {
        name: "description",
        content: "Live occupancy, arrivals, departures and revenue for your property today.",
      },
      { property: "og:title", content: "Dashboard — Dream PMS" },
      {
        property: "og:description",
        content: "Live occupancy, arrivals, departures and revenue for your property today.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof BedDouble;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 font-display text-4xl leading-none">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Dashboard() {
  const money = useMoney();
  const { property } = useApp();
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const occupancy = Math.round((occupied / rooms.length) * 100);

  return (
    <>
      <PageHeader title="Today at a glance" subtitle={`Sunday, 2 August 2026 · ${property.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupancy"
          value={`${occupancy}%`}
          sub={`${occupied} of ${rooms.length} rooms sold`}
          icon={TrendingUp}
        />
        <StatCard label="Check-ins" value="7" sub="3 arrivals still pending" icon={LogIn} />
        <StatCard label="Check-outs" value="5" sub="2 departures after noon" icon={LogOut} />
        <StatCard
          label="Revenue today"
          value={money(186900)}
          sub="+12% vs. last Sunday"
          icon={ArrowUpRight}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="surface p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl leading-none">Room status</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(roomStatusLabel) as RoomStatus[]).map((s) => (
                <span
                  key={s}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roomStatusClass[s]}`}
                >
                  {roomStatusLabel[s]}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:grid-cols-9">
            {rooms.map((r) => (
              <div
                key={r.id}
                title={`${r.number} · ${roomStatusLabel[r.status]}`}
                className={`rounded-lg border px-2 py-3 text-center transition-transform hover:-translate-y-0.5 ${roomStatusClass[r.status]}`}
              >
                <p className="font-display text-xl leading-none">{r.number}</p>
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider opacity-80">
                  {roomStatusLabel[r.status]}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface p-6">
          <h2 className="mb-5 text-2xl leading-none">Recent bookings</h2>
          <ul className="divide-y divide-border">
            {bookings.slice(0, 6).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.guest}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.ref} · Room {b.room} · {b.nights}N
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{money(b.rate * b.nights)}</p>
                  <Badge variant="outline" className={`mt-1 ${bookingStatusClass[b.status]}`}>
                    {b.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
