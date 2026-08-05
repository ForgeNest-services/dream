import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app-layout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp, useMoney } from "@/lib/app-state";
import { useRoomTypes } from "@/hooks/useRoomTypes";
import type { RoomTypeDto } from "@/lib/room-types-api";

export const Route = createFileRoute("/_app/rooms")({
  head: () => ({
    meta: [
      { title: "Room Types — Dream PMS" },
      {
        name: "description",
        content:
          "Define the room categories for your property — set base rates, occupancy, and inventory count.",
      },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const money = useMoney();
  const { property, actualRole } = useApp();
  const branchId = property?.id ?? null;
  const canManage = actualRole === "app_owner" || actualRole === "manager";
  const canDelete = actualRole === "app_owner";

  const { roomTypes, isLoading, isMutating, create, update, remove } = useRoomTypes(branchId);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<RoomTypeDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoomTypeDto | null>(null);
  const [activeTab, setActiveTab] = useState<"rooms" | "types">("rooms");

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle={
          branchId
            ? `${roomTypes.length} type${roomTypes.length === 1 ? "" : "s"} configured`
            : "Select a branch to manage rooms"
        }
        action={
          activeTab === "types" && canManage ? (
            <Button className="gap-2" onClick={() => setAddOpen(true)} disabled={!branchId}>
              <Plus className="size-4" /> New room type
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "rooms" | "types")}>
        <TabsList className="mb-5">
          <TabsTrigger value="rooms">All rooms</TabsTrigger>
          <TabsTrigger value="types">Room types</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms">
          <div className="surface p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Individual room management is coming next (Phase 3).
              <br />
              For now, configure your room types in the tab beside this one.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="types">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading room types…</p>
          ) : roomTypes.length === 0 ? (
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
                        onClick={() => setEditing(t)}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(t)}
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

      {addOpen && (
        <RoomTypeFormDialog
          title="New room type"
          submitLabel="Create"
          isSaving={isMutating}
          onClose={() => setAddOpen(false)}
          onSubmit={async (values) => {
            const ok = await create(values);
            if (ok) setAddOpen(false);
          }}
        />
      )}

      {editing && (
        <RoomTypeFormDialog
          title="Edit room type"
          submitLabel="Save"
          initial={{
            name: editing.name,
            base_rate: Number(editing.base_rate),
            capacity: editing.capacity,
            count: editing.count,
          }}
          isSaving={isMutating}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const ok = await update(editing.id, values);
            if (ok) setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove "{confirmDelete.name}"?</DialogTitle>
              <DialogDescription>
                Rooms already tagged with this type will keep their historical rate; new bookings won't
                be able to select it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isMutating}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isMutating}
                onClick={async () => {
                  const ok = await remove(confirmDelete.id);
                  if (ok) setConfirmDelete(null);
                }}
              >
                {isMutating ? "Removing…" : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

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
