import { useState } from "react";
import { CalendarClock, Layers, Link2, Link2Off, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type RestaurantTable } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const STATUS_STYLES: Record<RestaurantTable["status"], string> = {
  empty: "bg-success/12 text-success border-success",
  occupied: "bg-danger/12 text-danger border-danger",
  reserved: "bg-warning/15 text-foreground border-warning",
};

const STATUS_LABEL: Record<RestaurantTable["status"], string> = {
  empty: "Available",
  occupied: "Active",
  reserved: "Reserved",
};

export function TableGrid({
  onOpen,
  showControls = false,
}: {
  onOpen: (table: RestaurantTable) => void;
  showControls?: boolean;
}) {
  const { tables, zones, orders, setTableCount, unmergeTable } = usePos();
  const [tab, setTab] = useState(zones[0]?.id ?? "");
  const activeZone = zones.some((z) => z.id === tab) ? tab : (zones[0]?.id ?? "");
  const list = tables.filter((t) => t.groupId === activeZone);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(["empty", "occupied", "reserved"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px]">
            <span className={`size-3 rounded-full border-2 ${STATUS_STYLES[s]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      {/* Zone tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => setTab(z.id)}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-sm transition-colors ${
              activeZone === z.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
            }`}
          >
            {z.name}
          </button>
        ))}
        {showControls && <ZoneDialog />}
      </div>

      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5">
            <span className="pl-2 text-xs text-muted-foreground">Tables</span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Remove a table"
              onClick={() => setTableCount(activeZone, list.length - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-8 text-center text-sm">{list.length}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Add a table"
              onClick={() => setTableCount(activeZone, list.length + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <SetCountDialog zoneId={activeZone} current={list.length} />
          <MergeDialog zoneId={activeZone} />
        </div>
      )}

      {list.length === 0 ? (
        <p className="pos-card p-8 text-center text-sm text-muted-foreground">
          No tables here yet — use the + button to add some.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 xl:grid-cols-8">
          {list.map((t) => {
            const order = orders.find((o) => o.tableId === t.id && o.status === "draft");
            const merged = t.mergeId ? tables.filter((x) => x.mergeId === t.mergeId) : [];
            return (
              <div key={t.id} className="relative">
                <button
                  onClick={() => onOpen(t)}
                  className={`flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition-transform active:scale-[0.97] sm:min-h-28 ${STATUS_STYLES[t.status]}`}
                >
                  <span className="font-display text-2xl leading-none">{t.label}</span>
                  <span className="w-full truncate text-[11px] opacity-90">{STATUS_LABEL[t.status]}</span>
                  {merged.length > 1 && (
                    <span className="flex w-full items-center justify-center gap-1 truncate text-[10px]">
                      <Link2 className="size-3 shrink-0" />
                      {merged.map((m) => m.label).join("+")}
                    </span>
                  )}
                  {order && order.lines.length > 0 && (
                    <span className="text-[10px] opacity-90">{order.lines.length} item(s)</span>
                  )}
                  {t.reservation && (
                    <span className="w-full truncate text-[10px] opacity-90">
                      {t.reservation.guestName} · {t.reservation.time}
                    </span>
                  )}
                </button>
                {showControls && t.mergeId && (
                  <button
                    aria-label={`Unmerge ${t.label}`}
                    onClick={() => unmergeTable(t.id)}
                    className="absolute right-1 top-1 grid size-7 place-items-center rounded-lg bg-card text-foreground shadow-[var(--shadow-card)]"
                  >
                    <Link2Off className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SetCountDialog({ zoneId, current }: { zoneId: string; current: number }) {
  const { setTableCount } = usePos();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(current);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setCount(current);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11">
          Set total
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Number of tables</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tables are created automatically as T1, T2, T3 … for this area.
        </p>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          className="h-12"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <DialogFooter>
          <Button
            className="h-12 w-full"
            onClick={() => {
              setTableCount(zoneId, count);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ZoneDialog() {
  const { zones, addZone, renameZone, deleteZone } = usePos();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 shrink-0">
          <Layers className="size-4" />
          Areas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Floors & areas</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Arrange your restaurant however you like — Floor 1, Top Floor, Indoor, Outdoor …
        </p>
        <ul className="space-y-2">
          {zones.map((z) => (
            <li key={z.id} className="flex items-center gap-2">
              <Input
                key={z.id}
                className="h-12"
                defaultValue={z.name}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== z.name) renameZone(z.id, next);
                  else e.target.value = z.name;
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${z.name}`}
                className="size-11 shrink-0 text-danger"
                onClick={() => deleteZone(z.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            className="h-12"
            placeholder="e.g. Outdoor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="h-12 shrink-0"
            onClick={() => {
              if (!name.trim()) return;
              addZone(name);
              setName("");
            }}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({ zoneId }: { zoneId: string }) {
  const { tables, mergeTables } = usePos();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const list = tables.filter((t) => t.groupId === zoneId);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicked([]);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11">
          <Link2 className="size-4" />
          Merge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Merge tables</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Only tables in this same area can be merged. They share one bill and settle together.
        </p>
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`min-h-14 rounded-xl border-2 px-2 text-sm transition-colors ${
                picked.includes(t.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full"
            disabled={picked.length < 2}
            onClick={() => {
              mergeTables(picked);
              setPicked([]);
              setOpen(false);
            }}
          >
            Merge {picked.length || ""} tables
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReserveDialog() {
  const { tables, zones, reserveTable, clearReservation } = usePos();
  const [open, setOpen] = useState(false);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [tableId, setTableId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("19:00");
  const [partySize, setPartySize] = useState(2);
  const reserved = tables.filter((t) => t.reservation);
  const zoneTables = tables.filter((t) => t.groupId === zoneId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 shrink-0">
          <CalendarClock className="size-4" />
          <span className="hidden sm:inline">Reserve table</span>
          <span className="sm:hidden">Reserve</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Reserve a table</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Floor / area</Label>
            <Select
              value={zoneId}
              onValueChange={(v) => {
                setZoneId(v);
                setTableId("");
              }}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Pick a floor" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Table</Label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Pick a table" />
              </SelectTrigger>
              <SelectContent>
                {zoneTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Guest name</Label>
            <Input className="h-12" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input className="h-12" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" className="h-12" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time slot</Label>
              <Input type="time" className="h-12" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Party size</Label>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              className="h-12"
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
            />
          </div>

          {reserved.length > 0 && (
            <div className="rounded-xl bg-secondary p-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Current reservations
              </p>
              <ul className="space-y-2">
                {reserved.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {t.label} · {t.reservation!.guestName} · {t.reservation!.time} ·{" "}
                      {t.reservation!.partySize} pax
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Cancel reservation ${t.label}`}
                      className="size-9 shrink-0 text-danger"
                      onClick={() => clearReservation(t.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            className="h-12 w-full"
            disabled={!tableId || !guestName}
            onClick={() => {
              reserveTable(tableId, { guestName, phone, date, time, partySize });
              setOpen(false);
              setGuestName("");
              setPhone("");
            }}
          >
            Confirm reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
