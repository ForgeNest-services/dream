import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, useMoney } from "@/lib/app-state";
import { useRoomTypes } from "@/hooks/useRoomTypes";
import { useRooms } from "@/hooks/useRooms";
import { normalizeTableSearch, paginate } from "@/hooks/useTableQuery";
import type { RoomTypeDto } from "@/lib/room-types-api";
import type { RoomDto, RoomStatus } from "@/lib/rooms-api";
import { cn } from "@/lib/utils";

const CREATE_TYPE_SENTINEL = "__create_room_type__";
const ALL_FILTER = "all";

const ROOM_STATUSES: { value: RoomStatus; label: string; classes: string }[] = [
  { value: "available", label: "Available", classes: "bg-success/12 text-success border-success/25" },
  { value: "occupied", label: "Occupied", classes: "bg-accent/12 text-accent border-accent/25" },
  { value: "cleaning", label: "Cleaning", classes: "bg-info/12 text-info border-info/25" },
  { value: "maintenance", label: "Maintenance", classes: "bg-amber/15 text-amber-foreground border-amber/40" },
];

function statusMeta(status: string) {
  return ROOM_STATUSES.find((s) => s.value === status) ?? { label: status, classes: "" };
}

// -----------------------------------------------------------------------------

interface RoomsSearch {
  tab: "rooms" | "types";
  q: string;
  type: string;
  status: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Dream PMS" },
      {
        name: "description",
        content:
          "Manage every room, its rate, housekeeping status and the room types configured for the property.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): RoomsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      tab: search.tab === "types" ? "types" : "rooms",
      q: typeof search.q === "string" ? search.q : "",
      type: typeof search.type === "string" ? search.type : "",
      status: typeof search.status === "string" ? search.status : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: RoomsPage,
});

// -----------------------------------------------------------------------------

function RoomsPage() {
  const money = useMoney();
  const { property, actualRole } = useApp();
  const branchId = property?.id ?? null;
  const canManage = actualRole === "app_owner" || actualRole === "manager";
  const canDelete = actualRole === "app_owner";

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<RoomsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const {
    roomTypes,
    isMutating: isTypeMutating,
    create: createRoomType,
    update: updateRoomType,
    remove: removeRoomType,
  } = useRoomTypes(branchId);

  const {
    rooms,
    isLoading: isRoomsLoading,
    isMutating: isRoomMutating,
    create: createRoom,
    update: updateRoom,
    remove: removeRoom,
  } = useRooms(branchId);

  const [typeAddOpen, setTypeAddOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<RoomTypeDto | null>(null);
  const [confirmTypeDelete, setConfirmTypeDelete] = useState<RoomTypeDto | null>(null);
  const [roomAddOpen, setRoomAddOpen] = useState(false);
  const [roomEditing, setRoomEditing] = useState<RoomDto | null>(null);
  const [confirmRoomDelete, setConfirmRoomDelete] = useState<RoomDto | null>(null);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return rooms.filter((r) => {
      if (search.type && r.room_type_id !== search.type) return false;
      if (search.status && r.status !== search.status) return false;
      if (q) {
        const hay = `${r.room_number} ${r.floor ?? ""} ${r.room_type?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rooms, search.q, search.type, search.status]);

  const pageResult = paginate(filtered, search.page, search.perPage);

  useEffect(() => {
    if (search.page > pageResult.totalPages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResult.totalPages]);

  const headerAction =
    search.tab === "rooms" && canManage ? (
      <Button className="gap-2" onClick={() => setRoomAddOpen(true)} disabled={!branchId}>
        <Plus className="size-4" /> Add room
      </Button>
    ) : search.tab === "types" && canManage ? (
      <Button className="gap-2" onClick={() => setTypeAddOpen(true)} disabled={!branchId}>
        <Plus className="size-4" /> New room type
      </Button>
    ) : null;

  const activeFilterCount =
    (search.q ? 1 : 0) + (search.type ? 1 : 0) + (search.status ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle={
          branchId
            ? `${rooms.length} rooms · ${roomTypes.length} type${roomTypes.length === 1 ? "" : "s"}`
            : "Select a branch to manage rooms"
        }
        action={headerAction}
      />

      <Tabs
        value={search.tab}
        onValueChange={(v) => setSearch({ tab: v as "rooms" | "types", page: 1 })}
      >
        <TabsList className="mb-5">
          <TabsTrigger value="rooms">All rooms</TabsTrigger>
          <TabsTrigger value="types">Room types</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.q}
                onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
                placeholder="Search by number, floor or type…"
                className="pl-9"
              />
            </div>

            <Select
              value={search.type || ALL_FILTER}
              onValueChange={(v) =>
                setSearch({ type: v === ALL_FILTER ? "" : v, page: 1 })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL_FILTER}>All types</SelectItem>
                {roomTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={search.status || ALL_FILTER}
              onValueChange={(v) =>
                setSearch({ status: v === ALL_FILTER ? "" : v, page: 1 })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                {ROOM_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setSearch({ q: "", type: "", status: "", page: 1 })}
              >
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          {isRoomsLoading ? (
            <p className="text-sm text-muted-foreground">Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <div className="surface p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No rooms yet.{" "}
                {canManage && "Click \"Add room\" to add your first."}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="surface p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No rooms match the current filters.
              </p>
            </div>
          ) : (
            <section className="surface overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[100px]">Room</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[80px]">Floor</TableHead>
                      <TableHead className="w-[140px] text-right">Rate / night</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      {canManage && <TableHead className="w-[140px] text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageResult.items.map((r) => {
                      const meta = statusMeta(r.status);
                      const typeInfo = roomTypes.find((t) => t.id === r.room_type_id);
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="font-display text-xl">{r.room_number}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {r.room_type?.name ?? typeInfo?.name ?? "—"}
                              </span>
                              {typeInfo && (
                                <span className="text-xs text-muted-foreground">
                                  Sleeps {typeInfo.capacity}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.floor ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {typeInfo ? money(Number(typeInfo.base_rate)) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.classes}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => setRoomEditing(r)}
                                >
                                  <Pencil className="size-3.5" /> Edit
                                </Button>
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 text-destructive hover:text-destructive"
                                    onClick={() => setConfirmRoomDelete(r)}
                                    aria-label={`Delete room ${r.room_number}`}
                                  >
                                    <Trash2 className="size-3.5" />
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
        </TabsContent>

        <TabsContent value="types">
          {roomTypes.length === 0 ? (
            <div className="surface p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No room types yet.{" "}
                {canManage && "Click \"New room type\" to add your first."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {roomTypes.map((t) => (
                <div key={t.id} className="surface p-5">
                  <h3 className="text-2xl leading-none">{t.name}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sleeps {t.capacity} · {t.count} rooms
                  </p>
                  <p className="mt-5 font-display text-3xl text-accent">
                    {money(Number(t.base_rate))}
                  </p>
                  <p className="text-xs text-muted-foreground">base rate per night</p>
                  {canManage && (
                    <div className="mt-5 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => setTypeEditing(t)}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => setConfirmTypeDelete(t)}
                          aria-label={`Delete ${t.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {typeAddOpen && (
        <RoomTypeFormDialog
          title="New room type"
          submitLabel="Create"
          isSaving={isTypeMutating}
          onClose={() => setTypeAddOpen(false)}
          onSubmit={async (values) => {
            const created = await createRoomType(values);
            if (created) setTypeAddOpen(false);
          }}
        />
      )}

      {typeEditing && (
        <RoomTypeFormDialog
          title="Edit room type"
          submitLabel="Save"
          initial={{
            name: typeEditing.name,
            base_rate: Number(typeEditing.base_rate),
            capacity: typeEditing.capacity,
            count: typeEditing.count,
          }}
          isSaving={isTypeMutating}
          onClose={() => setTypeEditing(null)}
          onSubmit={async (values) => {
            const ok = await updateRoomType(typeEditing.id, values);
            if (ok) setTypeEditing(null);
          }}
        />
      )}

      {confirmTypeDelete && (
        <ConfirmDialog
          open
          title={`Remove "${confirmTypeDelete.name}"?`}
          description="Rooms already tagged with this type will keep their historical rate; new bookings won't be able to select it."
          confirmLabel="Remove"
          isBusy={isTypeMutating}
          onCancel={() => setConfirmTypeDelete(null)}
          onConfirm={async () => {
            const ok = await removeRoomType(confirmTypeDelete.id);
            if (ok) setConfirmTypeDelete(null);
          }}
        />
      )}

      {roomAddOpen && (
        <RoomFormDialog
          title="Add room"
          submitLabel="Save room"
          roomTypes={roomTypes}
          isSaving={isRoomMutating || isTypeMutating}
          onCreateRoomType={createRoomType}
          onClose={() => setRoomAddOpen(false)}
          onSubmit={async (values) => {
            const ok = await createRoom(values);
            if (ok) setRoomAddOpen(false);
          }}
        />
      )}

      {roomEditing && (
        <RoomFormDialog
          title={`Edit room ${roomEditing.room_number}`}
          submitLabel="Save"
          roomTypes={roomTypes}
          isSaving={isRoomMutating || isTypeMutating}
          onCreateRoomType={createRoomType}
          initial={{
            room_type_id: roomEditing.room_type_id,
            room_number: roomEditing.room_number,
            floor: roomEditing.floor ?? "",
            status: roomEditing.status,
          }}
          onClose={() => setRoomEditing(null)}
          onSubmit={async (values) => {
            const ok = await updateRoom(roomEditing.id, values);
            if (ok) setRoomEditing(null);
          }}
        />
      )}

      {confirmRoomDelete && (
        <ConfirmDialog
          open
          title={`Remove room ${confirmRoomDelete.room_number}?`}
          description="Historical bookings and folios stay intact; the room won't appear in new booking flows."
          confirmLabel="Remove"
          isBusy={isRoomMutating}
          onCancel={() => setConfirmRoomDelete(null)}
          onConfirm={async () => {
            const ok = await removeRoom(confirmRoomDelete.id);
            if (ok) setConfirmRoomDelete(null);
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

interface RoomFormValues {
  room_type_id: string;
  room_number: string;
  floor?: string | null;
  status: RoomStatus;
}

function RoomFormDialog({
  title,
  submitLabel,
  roomTypes,
  initial,
  isSaving,
  onCreateRoomType,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  roomTypes: RoomTypeDto[];
  initial?: RoomFormValues;
  isSaving: boolean;
  onCreateRoomType: (payload: {
    name: string;
    base_rate: number;
    capacity: number;
    count: number;
  }) => Promise<RoomTypeDto | null>;
  onClose: () => void;
  onSubmit: (values: RoomFormValues) => Promise<void>;
}) {
  const [roomTypeId, setRoomTypeId] = useState(initial?.room_type_id ?? "");
  const [roomNumber, setRoomNumber] = useState(initial?.room_number ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [status, setStatus] = useState<RoomStatus>(initial?.status ?? "available");
  const [showTypeCreator, setShowTypeCreator] = useState(false);

  const handleTypeChange = (value: string) => {
    if (value === CREATE_TYPE_SENTINEL) {
      setShowTypeCreator(true);
      return;
    }
    setRoomTypeId(value);
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!roomTypeId || !roomNumber.trim()) return;
              await onSubmit({
                room_type_id: roomTypeId,
                room_number: roomNumber.trim(),
                floor: floor.trim() || null,
                status,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="room-number">Room number</Label>
              <Input
                id="room-number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 401"
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-floor">Floor (optional)</Label>
              <Input
                id="room-floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 4"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Room type</Label>
              <Select
                value={roomTypeId || undefined}
                onValueChange={handleTypeChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      roomTypes.length === 0
                        ? "No types yet — create one below"
                        : "Pick a room type"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · sleeps {t.capacity}
                    </SelectItem>
                  ))}
                  {roomTypes.length > 0 && <SelectSeparator />}
                  <SelectItem value={CREATE_TYPE_SENTINEL} className="text-accent">
                    <span className="inline-flex items-center gap-1.5">
                      <Plus className="size-3.5" /> Create new room type…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RoomStatus)} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className={cn("inline-flex items-center gap-2")}>
                        <span className={cn("size-2 rounded-full", s.classes.split(" ")[0])} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !roomTypeId || !roomNumber.trim()}>
                {isSaving ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showTypeCreator && (
        <RoomTypeFormDialog
          title="New room type"
          submitLabel="Create"
          isSaving={isSaving}
          onClose={() => setShowTypeCreator(false)}
          onSubmit={async (values) => {
            const created = await onCreateRoomType(values);
            if (created) {
              setRoomTypeId(created.id);
              setShowTypeCreator(false);
            }
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

interface RoomTypeFormValues {
  name: string;
  base_rate: number;
  capacity: number;
  count: number;
}

function RoomTypeFormDialog({
  title,
  submitLabel,
  initial,
  isSaving,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial?: RoomTypeFormValues;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: RoomTypeFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseRate, setBaseRate] = useState(initial?.base_rate ?? 0);
  const [capacity, setCapacity] = useState(initial?.capacity ?? 2);
  const [count, setCount] = useState(initial?.count ?? 0);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setBaseRate(initial.base_rate);
      setCapacity(initial.capacity);
      setCount(initial.count);
    }
  }, [initial]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || baseRate <= 0 || capacity < 1) return;
            await onSubmit({ name: name.trim(), base_rate: baseRate, capacity, count });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rt-name">Name</Label>
            <Input
              id="rt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deluxe King"
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-rate">Base rate (per night)</Label>
            <Input
              id="rt-rate"
              type="number"
              min={1}
              value={baseRate}
              onChange={(e) => setBaseRate(Number(e.target.value))}
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-capacity">Max occupancy</Label>
            <Input
              id="rt-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rt-count">Room count (informational)</Label>
            <Input
              id="rt-count"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={isSaving}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isBusy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isBusy} onClick={onConfirm}>
            {isBusy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
