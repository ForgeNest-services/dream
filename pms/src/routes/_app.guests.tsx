import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMoney } from "@/lib/app-state";
import { guests, guestStays } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/guests")({
  head: () => ({
    meta: [
      { title: "Guest Directory — Dream PMS" },
      {
        name: "description",
        content:
          "Searchable guest directory with contact details, ID documents, nationality and full stay history.",
      },
      { property: "og:title", content: "Guest Directory — Dream PMS" },
      {
        property: "og:description",
        content: "Guest contact details, ID documents and stay history in one place.",
      },
    ],
  }),
  component: GuestsPage,
});

function GuestsPage() {
  const money = useMoney();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(guests[0]!.id);
  const guest = guests.find((g) => g.id === selected)!;
  const stays = guestStays[guest.id] ?? [
    { ref: "BK-24800", room: "208", dates: "12 Jun – 15 Jun 2026", amount: 21600 },
    { ref: "BK-23744", room: "115", dates: "04 Apr – 06 Apr 2026", amount: 12800 },
  ];

  const filtered = guests.filter((g) =>
    `${g.name} ${g.email} ${g.phone} ${g.nationality}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Guests" subtitle="Directory of every guest who has stayed with you" />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, phone or nationality"
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>ID document</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead className="text-right">Stays</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow
                    key={g.id}
                    onClick={() => setSelected(g.id)}
                    className={`cursor-pointer ${g.id === selected ? "bg-accent/8" : ""}`}
                  >
                    <TableCell className="font-semibold">{g.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.email}
                      <span className="block">{g.phone}</span>
                    </TableCell>
                    <TableCell>{g.idType}</TableCell>
                    <TableCell>{g.nationality}</TableCell>
                    <TableCell className="text-right font-semibold">{g.stays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className="surface h-fit p-6">
          <span className="grid size-14 place-items-center rounded-full bg-primary font-display text-2xl text-primary-foreground">
            {guest.name.slice(0, 1)}
          </span>
          <h2 className="mt-4 text-3xl leading-none">{guest.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {guest.nationality} · {guest.idType}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            {[
              ["Email", guest.email],
              ["Phone", guest.phone],
              ["Past stays", String(guest.stays)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-7 text-xl leading-none">Stay history</h3>
          <ul className="mt-3 space-y-3">
            {stays.map((s) => (
              <li key={s.ref} className="rounded-lg bg-muted/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Room {s.room}</p>
                  <p className="text-sm font-semibold">{money(s.amount)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.ref} · {s.dates}
                </p>
              </li>
            ))}
          </ul>

          <Button variant="outline" className="mt-6 w-full">
            View full profile
          </Button>
        </aside>
      </div>
    </>
  );
}
