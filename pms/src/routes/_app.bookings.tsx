import { createFileRoute } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Search,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
import { Textarea } from "@/components/ui/textarea";
import { useApp, useMoney } from "@/lib/app-state";
import { useBookings } from "@/hooks/useBookings";
import { useGuests } from "@/hooks/useGuests";
import { useRooms } from "@/hooks/useRooms";
import { useRoomTypes } from "@/hooks/useRoomTypes";
import { normalizeTableSearch, paginate } from "@/hooks/useTableQuery";
import type { BookingDto, BookingStatus, CreateBookingPayload } from "@/lib/bookings-api";
import type { CreateGuestPayload, GuestDto } from "@/lib/guests-api";
import type { RoomDto } from "@/lib/rooms-api";

const ALL_FILTER = "all";
const CREATE_GUEST_SENTINEL = "__create_guest__";

const STATUS_META: Record<
  BookingStatus,
  { label: string; classes: string }
> = {
  reserved: { label: "Reserved", classes: "bg-info/12 text-info border-info/25" },
  checked_in: { label: "Checked in", classes: "bg-success/12 text-success border-success/25" },
  checked_out: { label: "Checked out", classes: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", classes: "bg-destructive/10 text-destructive border-destructive/25" },
  no_show: { label: "No-show", classes: "bg-amber/15 text-amber-foreground border-amber/40" },
};

const STATUS_OPTIONS: BookingStatus[] = [
  "reserved",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
];

interface BookingsSearch {
  q: string;
  status: string;
  room: string;
  from: string;
  to: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings — Dream PMS" },
      {
        name: "description",
        content:
          "Manage reservations end-to-end: create bookings, check guests in and out, cancel, and track no-shows.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): BookingsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      status: typeof search.status === "string" ? search.status : "",
      room: typeof search.room === "string" ? search.room : "",
      from: typeof search.from === "string" ? search.from : "",
      to: typeof search.to === "string" ? search.to : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: BookingsPage,
});

// -----------------------------------------------------------------------------

function BookingsPage() {
  const money = useMoney();
  const { property, actualRole } = useApp();
  const branchId = property?.id ?? null;
  const canManage =
    actualRole === "app_owner" || actualRole === "manager" || actualRole === "front_desk";
  const canCancel = actualRole === "app_owner" || actualRole === "manager";

  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (patch: Partial<BookingsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const {
    bookings,
    isLoading,
    isMutating,
    create,
    update,
    checkIn,
    checkOut,
    cancel,
    noShow,
    fetchAvailability,
  } = useBookings(branchId);

  const { rooms } = useRooms(branchId);
  const { roomTypes } = useRoomTypes(branchId);
  const { guests, create: createGuest, isMutating: isGuestMutating } = useGuests(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BookingDto | null>(null);
  const [confirming, setConfirming] = useState<
    | { action: "checkIn" | "checkOut" | "cancel" | "noShow"; booking: BookingDto }
    | null
  >(null);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return bookings.filter((b) => {
      if (search.status && b.status !== search.status) return false;
      if (search.room && b.room_id !== search.room) return false;
      if (search.from && b.check_out_date < search.from) return false;
      if (search.to && b.check_in_date > search.to) return false;
      if (q) {
        const hay = [
          b.guest?.full_name,
          b.guest?.phone,
          b.room?.room_number,
          b.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, search.q, search.status, search.room, search.from, search.to]);

  const pageResult = paginate(filtered, search.page, search.perPage);

  useEffect(() => {
    if (search.page > pageResult.totalPages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResult.totalPages]);

  const activeFilterCount =
    (search.q ? 1 : 0) +
    (search.status ? 1 : 0) +
    (search.room ? 1 : 0) +
    (search.from ? 1 : 0) +
    (search.to ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle={
          branchId ? `${bookings.length} total reservations` : "Select a branch to manage bookings"
        }
        action={
          canManage ? (
            <Button className="gap-2" onClick={() => setCreateOpen(true)} disabled={!branchId}>
              <Plus className="size-4" /> New booking
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search guest, phone or room…"
            className="pl-9"
          />
        </div>

        <Select
          value={search.status || ALL_FILTER}
          onValueChange={(v) => setSearch({ status: v === ALL_FILTER ? "" : v, page: 1 })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.room || ALL_FILTER}
          onValueChange={(v) => setSearch({ room: v === ALL_FILTER ? "" : v, page: 1 })}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All rooms" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value={ALL_FILTER}>All rooms</SelectItem>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                Room {r.room_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={search.from}
            onChange={(e) => setSearch({ from: e.target.value, page: 1 })}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={search.to}
            onChange={(e) => setSearch({ to: e.target.value, page: 1 })}
            className="w-[160px]"
          />
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() =>
              setSearch({ q: "", status: "", room: "", from: "", to: "", page: 1 })
            }
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No bookings yet. {canManage && `Click "New booking" to create the first reservation.`}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="text-sm text-muted-foreground">No bookings match the current filters.</p>
        </div>
      ) : (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Guest</TableHead>
                  <TableHead className="w-[110px]">Room</TableHead>
                  <TableHead className="w-[220px]">Stay</TableHead>
                  <TableHead className="w-[70px] text-center">Pax</TableHead>
                  <TableHead className="w-[130px] text-right">Rate</TableHead>
                  <TableHead className="w-[130px] text-right">Total</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  {canManage && <TableHead className="w-[200px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResult.items.map((b) => {
                  const nights = nightsBetween(b.check_in_date, b.check_out_date);
                  const rate = Number(b.rate_per_night);
                  const total = rate * nights;
                  const meta = STATUS_META[b.status];
                  const canEdit = canManage && b.status === "reserved";
                  return (
                    <TableRow key={b.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {b.guest?.full_name ?? "—"}
                          </span>
                          {b.guest?.phone && (
                            <span className="text-xs text-muted-foreground">{b.guest.phone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-display text-lg">
                        {b.room?.room_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2 text-foreground">
                          <span>{formatDate(b.check_in_date)}</span>
                          <ChevronRight className="size-3 text-muted-foreground" />
                          <span>{formatDate(b.check_out_date)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {nights} night{nights === 1 ? "" : "s"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{b.num_guests}</TableCell>
                      <TableCell className="text-right font-medium">{money(rate)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.classes}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {b.status === "reserved" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-success hover:text-success"
                                onClick={() => setConfirming({ action: "checkIn", booking: b })}
                              >
                                <LogIn className="size-3.5" /> Check in
                              </Button>
                            )}
                            {b.status === "checked_in" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-info hover:text-info"
                                onClick={() => setConfirming({ action: "checkOut", booking: b })}
                              >
                                <LogOut className="size-3.5" /> Check out
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setEditing(b)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {b.status === "reserved" && canCancel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-amber-foreground hover:text-amber-foreground"
                                onClick={() => setConfirming({ action: "noShow", booking: b })}
                                aria-label="Mark no-show"
                              >
                                <UserX className="size-3.5" />
                              </Button>
                            )}
                            {(b.status === "reserved" || b.status === "checked_in") &&
                              canCancel && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-destructive hover:text-destructive"
                                  onClick={() => setConfirming({ action: "cancel", booking: b })}
                                  aria-label="Cancel booking"
                                >
                                  <Ban className="size-3.5" />
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={pageResult.page}
            perPage={pageResult.perPage}
            totalItems={pageResult.totalItems}
            totalPages={pageResult.totalPages}
            onPageChange={(page) => setSearch({ page })}
            onPerPageChange={(perPage) => setSearch({ perPage, page: 1 })}
          />
        </section>
      )}

      {createOpen && (
        <BookingFormDialog
          title="New booking"
          submitLabel="Create booking"
          guests={guests}
          rooms={rooms}
          roomTypes={roomTypes}
          isSaving={isMutating}
          onCreateGuest={createGuest}
          isGuestSaving={isGuestMutating}
          fetchAvailability={fetchAvailability}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            const created = await create(values);
            if (created) setCreateOpen(false);
          }}
        />
      )}

      {editing && (
        <BookingFormDialog
          title={`Edit booking · ${editing.guest?.full_name ?? "guest"}`}
          submitLabel="Save"
          guests={guests}
          rooms={rooms}
          roomTypes={roomTypes}
          isSaving={isMutating}
          onCreateGuest={createGuest}
          isGuestSaving={isGuestMutating}
          fetchAvailability={fetchAvailability}
          initial={{
            guest_id: editing.guest_id,
            room_id: editing.room_id,
            check_in_date: editing.check_in_date,
            check_out_date: editing.check_out_date,
            num_guests: editing.num_guests,
            notes: editing.notes ?? "",
            rate_per_night: Number(editing.rate_per_night),
          }}
          lockGuest
          excludeBookingId={editing.id}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await update(editing.id, {
              room_id: values.room_id,
              check_in_date: values.check_in_date,
              check_out_date: values.check_out_date,
              num_guests: values.num_guests,
              notes: values.notes ?? null,
              rate_per_night: values.rate_per_night ?? null,
            });
            if (ok) setEditing(null);
          }}
        />
      )}

      {confirming && (
        <TransitionDialog
          action={confirming.action}
          booking={confirming.booking}
          isBusy={isMutating}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const map = { checkIn, checkOut, cancel, noShow };
            const ok = await map[confirming.action](confirming.booking.id);
            if (ok) setConfirming(null);
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

interface BookingFormValues {
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string;
  rate_per_night: number | null;
}

function BookingFormDialog({
  title,
  submitLabel,
  guests,
  rooms,
  roomTypes,
  initial,
  lockGuest = false,
  excludeBookingId,
  isSaving,
  isGuestSaving,
  onCreateGuest,
  fetchAvailability,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  guests: GuestDto[];
  rooms: RoomDto[];
  roomTypes: { id: string; name: string; base_rate: string }[];
  initial?: BookingFormValues;
  lockGuest?: boolean;
  excludeBookingId?: string;
  isSaving: boolean;
  isGuestSaving: boolean;
  onCreateGuest: (payload: CreateGuestPayload) => Promise<GuestDto | null>;
  fetchAvailability: (checkIn: string, checkOut: string) => Promise<RoomDto[]>;
  onClose: () => void;
  onSubmit: (values: CreateBookingPayload) => Promise<void>;
}) {
  const money = useMoney();
  const [guestId, setGuestId] = useState(initial?.guest_id ?? "");
  const [roomId, setRoomId] = useState(initial?.room_id ?? "");
  const [checkIn, setCheckIn] = useState(initial?.check_in_date ?? "");
  const [checkOut, setCheckOut] = useState(initial?.check_out_date ?? "");
  const [numGuests, setNumGuests] = useState(initial?.num_guests ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rateInput, setRateInput] = useState<string>(
    initial?.rate_per_night != null ? String(initial.rate_per_night) : "",
  );
  const [availableRooms, setAvailableRooms] = useState<RoomDto[] | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [showGuestCreator, setShowGuestCreator] = useState(false);

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);
  const datesValid = Boolean(checkIn && checkOut && nights > 0);

  useEffect(() => {
    if (!datesValid) {
      setAvailableRooms(null);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    fetchAvailability(checkIn, checkOut)
      .then((list) => {
        if (cancelled) return;
        setAvailableRooms(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, datesValid, fetchAvailability]);

  const currentRoom = rooms.find((r) => r.id === roomId);
  const availableIds = new Set(availableRooms?.map((r) => r.id) ?? []);
  const roomPickerList = useMemo(() => {
    if (!availableRooms) return [];
    const combined = [...availableRooms];
    if (currentRoom && excludeBookingId && !availableIds.has(currentRoom.id)) {
      combined.unshift(currentRoom);
    }
    return combined;
  }, [availableRooms, currentRoom, excludeBookingId, availableIds]);

  const effectiveRateFor = (room: RoomDto | undefined): number | null => {
    if (!room) return null;
    if (room.rate_override != null) return Number(room.rate_override);
    const type = roomTypes.find((t) => t.id === room.room_type_id);
    return type ? Number(type.base_rate) : null;
  };

  const suggestedRate = effectiveRateFor(currentRoom);
  const enteredRate = rateInput.trim() ? Number(rateInput) : null;
  const finalRate = enteredRate != null && !Number.isNaN(enteredRate) ? enteredRate : suggestedRate;
  const total = finalRate != null && nights > 0 ? finalRate * nights : null;

  const handleRoomChange = (id: string) => {
    setRoomId(id);
    if (!rateInput.trim()) {
      const room = rooms.find((r) => r.id === id);
      const rate = effectiveRateFor(room);
      if (rate != null) setRateInput(String(rate));
    }
  };

  const handleGuestChange = (value: string) => {
    if (value === CREATE_GUEST_SENTINEL) {
      setShowGuestCreator(true);
      return;
    }
    setGuestId(value);
  };

  const canSubmit =
    Boolean(guestId) &&
    Boolean(roomId) &&
    datesValid &&
    numGuests >= 1 &&
    !isSaving;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            <DialogDescription>
              Rate is auto-filled from the room; override for this booking if needed.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canSubmit) return;
              await onSubmit({
                guest_id: guestId,
                room_id: roomId,
                check_in_date: checkIn,
                check_out_date: checkOut,
                num_guests: numGuests,
                notes: notes.trim() ? notes.trim() : null,
                rate_per_night: enteredRate,
              });
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label>Guest</Label>
              <Select
                value={guestId || undefined}
                onValueChange={handleGuestChange}
                disabled={isSaving || lockGuest}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      guests.length === 0 ? "No guests yet — create one below" : "Pick a guest"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {guests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.full_name}
                      {g.phone ? ` · ${g.phone}` : ""}
                    </SelectItem>
                  ))}
                  {!lockGuest && (
                    <>
                      {guests.length > 0 && <SelectSeparator />}
                      <SelectItem value={CREATE_GUEST_SENTINEL} className="text-accent">
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="size-3.5" /> Create new guest…
                        </span>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-checkin">Check-in</Label>
              <Input
                id="b-checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-checkout">Check-out</Label>
              <Input
                id="b-checkout"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || undefined}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Room</Label>
              <Select
                value={roomId || undefined}
                onValueChange={handleRoomChange}
                disabled={isSaving || !datesValid}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !datesValid
                        ? "Pick dates first"
                        : loadingAvailability
                          ? "Checking availability…"
                          : roomPickerList.length === 0
                            ? "No rooms available for these dates"
                            : "Pick a room"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {roomPickerList.map((r) => {
                    const type = roomTypes.find((t) => t.id === r.room_type_id);
                    const rate = effectiveRateFor(r);
                    const isCurrent =
                      excludeBookingId && currentRoom && r.id === currentRoom.id;
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.room_number}
                        {type ? ` · ${type.name}` : ""}
                        {rate != null ? ` · ${money(rate)}/night` : ""}
                        {isCurrent ? " · current" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {datesValid && !loadingAvailability && availableRooms && (
                <p className="text-[11px] text-muted-foreground">
                  {roomPickerList.length} room{roomPickerList.length === 1 ? "" : "s"} available
                  for {nights} night{nights === 1 ? "" : "s"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-pax">Guests</Label>
              <Input
                id="b-pax"
                type="number"
                min={1}
                value={numGuests}
                onChange={(e) => setNumGuests(Math.max(1, Number(e.target.value) || 1))}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-rate">Rate / night</Label>
              <Input
                id="b-rate"
                type="number"
                min={1}
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder={
                  suggestedRate != null ? `Room default: ${suggestedRate}` : "Enter nightly rate"
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="b-notes">Notes (optional)</Label>
              <Textarea
                id="b-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Late arrival, extra bed, dietary preferences…"
                rows={2}
                disabled={isSaving}
              />
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nights</span>
                <span className="font-semibold">{nights > 0 ? nights : "—"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Rate / night</span>
                <span className="font-semibold">
                  {finalRate != null ? money(finalRate) : "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base">
                <span className="font-medium">Total</span>
                <span className="font-display text-xl text-accent">
                  {total != null ? money(total) : "—"}
                </span>
              </div>
            </div>

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSaving ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showGuestCreator && (
        <GuestQuickCreateDialog
          isSaving={isGuestSaving}
          onClose={() => setShowGuestCreator(false)}
          onCreate={async (payload) => {
            const created = await onCreateGuest(payload);
            if (created) {
              setGuestId(created.id);
              setShowGuestCreator(false);
            }
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

function GuestQuickCreateDialog({
  isSaving,
  onClose,
  onCreate,
}: {
  isSaving: boolean;
  onClose: () => void;
  onCreate: (payload: CreateGuestPayload) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Quick add guest</DialogTitle>
          <DialogDescription>
            You can add ID details and nationality later from the guest profile.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!fullName.trim()) return;
            await onCreate({
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              email: email.trim() || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="g-name">Full name</Label>
            <Input
              id="g-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name as on ID"
              required
              disabled={isSaving}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="g-phone">Phone</Label>
              <Input
                id="g-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-email">Email</Label>
              <Input
                id="g-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !fullName.trim()}>
              {isSaving ? "Adding…" : "Add guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

function TransitionDialog({
  action,
  booking,
  isBusy,
  onCancel,
  onConfirm,
}: {
  action: "checkIn" | "checkOut" | "cancel" | "noShow";
  booking: BookingDto;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const config = {
    checkIn: {
      title: `Check in ${booking.guest?.full_name ?? "guest"}?`,
      description: `Room ${booking.room?.room_number ?? "—"} will be marked as occupied.`,
      confirmLabel: "Check in",
      confirmIcon: <CheckCircle2 className="size-4" />,
      variant: "default" as const,
    },
    checkOut: {
      title: `Check out ${booking.guest?.full_name ?? "guest"}?`,
      description: `Room ${booking.room?.room_number ?? "—"} will be sent to cleaning; folio will be closed for billing.`,
      confirmLabel: "Check out",
      confirmIcon: <LogOut className="size-4" />,
      variant: "default" as const,
    },
    cancel: {
      title: `Cancel this booking?`,
      description:
        "The reservation will be marked cancelled. This can't be undone from the UI.",
      confirmLabel: "Cancel booking",
      confirmIcon: <Ban className="size-4" />,
      variant: "destructive" as const,
    },
    noShow: {
      title: `Mark as no-show?`,
      description: "Use this only after the check-in window has passed and the guest never arrived.",
      confirmLabel: "Mark no-show",
      confirmIcon: <UserX className="size-4" />,
      variant: "destructive" as const,
    },
  }[action];

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isBusy}>
            Back
          </Button>
          <Button variant={config.variant} disabled={isBusy} onClick={onConfirm} className="gap-2">
            {config.confirmIcon}
            {isBusy ? "Working…" : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
