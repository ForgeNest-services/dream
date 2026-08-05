import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { TablePagination } from "@/components/table-pagination";
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
import { useApp } from "@/lib/app-state";
import { useGuests } from "@/hooks/useGuests";
import { normalizeTableSearch, paginate } from "@/hooks/useTableQuery";
import type { GuestDto } from "@/lib/guests-api";

const ALL_FILTER = "all";

const ID_DOCUMENT_TYPES = [
  { value: "citizenship", label: "Citizenship" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving license" },
  { value: "national_id", label: "National ID" },
  { value: "other", label: "Other" },
];

function labelForDocType(value: string | null): string {
  if (!value) return "—";
  return ID_DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

// -----------------------------------------------------------------------------

interface GuestsSearch {
  q: string;
  docType: string;
  nationality: string;
  page: number;
  perPage: number;
  selected: string;
}

export const Route = createFileRoute("/_app/guests")({
  head: () => ({
    meta: [
      { title: "Guest Directory — Dream PMS" },
      {
        name: "description",
        content:
          "Searchable guest directory with contact details, ID documents, nationality and full stay history.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): GuestsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      docType: typeof search.docType === "string" ? search.docType : "",
      nationality: typeof search.nationality === "string" ? search.nationality : "",
      selected: typeof search.selected === "string" ? search.selected : "",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: GuestsPage,
});

// -----------------------------------------------------------------------------

function GuestsPage() {
  const { actualRole } = useApp();
  const canManage =
    actualRole === "app_owner" ||
    actualRole === "manager" ||
    actualRole === "front_desk";
  const canDelete = actualRole === "app_owner";

  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (patch: Partial<GuestsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const { guests, isLoading, isMutating, create, update, remove } = useGuests();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GuestDto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuestDto | null>(null);

  const nationalities = useMemo(() => {
    const set = new Set<string>();
    guests.forEach((g) => g.nationality && set.add(g.nationality));
    return Array.from(set).sort();
  }, [guests]);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    return guests.filter((g) => {
      if (search.docType && g.id_document_type !== search.docType) return false;
      if (search.nationality && g.nationality !== search.nationality) return false;
      if (q) {
        const hay = [
          g.full_name,
          g.email ?? "",
          g.phone ?? "",
          g.nationality ?? "",
          g.id_document_number ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [guests, search.q, search.docType, search.nationality]);

  const pageResult = paginate(filtered, search.page, search.perPage);

  useEffect(() => {
    if (search.page > pageResult.totalPages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResult.totalPages]);

  const selectedGuest = useMemo(
    () => filtered.find((g) => g.id === search.selected) ?? filtered[0] ?? null,
    [filtered, search.selected],
  );

  const activeFilterCount =
    (search.q ? 1 : 0) + (search.docType ? 1 : 0) + (search.nationality ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Guests"
        subtitle={
          guests.length === 0
            ? "No guests yet"
            : `Directory of ${guests.length} guest${guests.length === 1 ? "" : "s"}`
        }
        action={
          canManage && (
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4" /> Add guest
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search name, phone, email, ID or nationality…"
            className="pl-9"
          />
        </div>

        <Select
          value={search.docType || ALL_FILTER}
          onValueChange={(v) => setSearch({ docType: v === ALL_FILTER ? "" : v, page: 1 })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All ID types" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value={ALL_FILTER}>All ID types</SelectItem>
            {ID_DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.nationality || ALL_FILTER}
          onValueChange={(v) =>
            setSearch({ nationality: v === ALL_FILTER ? "" : v, page: 1 })
          }
          disabled={nationalities.length === 0}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All nationalities" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value={ALL_FILTER}>All nationalities</SelectItem>
            {nationalities.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setSearch({ q: "", docType: "", nationality: "", page: 1 })}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading guests…</p>
        ) : guests.length === 0 ? (
          <div className="surface p-10 text-center xl:col-span-2">
            <p className="text-sm text-muted-foreground">
              No guests yet.{" "}
              {canManage && "Click \"Add guest\" to register your first."}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface p-10 text-center xl:col-span-2">
            <p className="text-sm text-muted-foreground">
              No guests match the current filters.
            </p>
          </div>
        ) : (
          <>
            <section className="surface overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Guest</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>ID document</TableHead>
                      <TableHead>Nationality</TableHead>
                      {canManage && (
                        <TableHead className="w-[130px] text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageResult.items.map((g) => (
                      <TableRow
                        key={g.id}
                        onClick={() => setSearch({ selected: g.id })}
                        className={`cursor-pointer ${
                          g.id === selectedGuest?.id ? "bg-accent/10" : "hover:bg-muted/30"
                        }`}
                      >
                        <TableCell className="font-semibold">{g.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {g.email ?? "—"}
                          {g.phone && <span className="block">{g.phone}</span>}
                        </TableCell>
                        <TableCell>
                          {labelForDocType(g.id_document_type)}
                          {g.id_document_number && (
                            <span className="block text-xs text-muted-foreground">
                              {g.id_document_number}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{g.nationality ?? "—"}</TableCell>
                        {canManage && (
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setEditing(g)}
                              >
                                <Pencil className="size-3.5" /> Edit
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-destructive hover:text-destructive"
                                  onClick={() => setConfirmDelete(g)}
                                  aria-label={`Delete ${g.full_name}`}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
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

            <aside className="surface h-fit p-6">
              {selectedGuest ? (
                <>
                  <span className="grid size-14 place-items-center rounded-full bg-primary font-display text-2xl text-primary-foreground">
                    {selectedGuest.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <h2 className="mt-4 text-3xl leading-none">{selectedGuest.full_name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedGuest.nationality ?? "—"} ·{" "}
                    {labelForDocType(selectedGuest.id_document_type)}
                  </p>

                  <dl className="mt-6 space-y-3 text-sm">
                    {(
                      [
                        ["Email", selectedGuest.email ?? "—"],
                        ["Phone", selectedGuest.phone ?? "—"],
                        ["ID number", selectedGuest.id_document_number ?? "—"],
                      ] as const
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-4 border-b border-border pb-3"
                      >
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="truncate font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <h3 className="mt-7 text-xl leading-none">Stay history</h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Available once bookings ship (Phase 5).
                  </p>

                  {canManage && (
                    <Button
                      variant="outline"
                      className="mt-6 w-full gap-1.5"
                      onClick={() => setEditing(selectedGuest)}
                    >
                      <Pencil className="size-3.5" /> Edit details
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pick a guest to see details.</p>
              )}
            </aside>
          </>
        )}
      </div>

      {addOpen && (
        <GuestFormDialog
          title="Add guest"
          submitLabel="Save guest"
          isSaving={isMutating}
          onClose={() => setAddOpen(false)}
          onSubmit={async (values) => {
            const created = await create(values);
            if (created) {
              setSearch({ selected: created.id });
              setAddOpen(false);
            }
          }}
        />
      )}

      {editing && (
        <GuestFormDialog
          title={`Edit ${editing.full_name}`}
          submitLabel="Save"
          initial={{
            full_name: editing.full_name,
            phone: editing.phone ?? "",
            email: editing.email ?? "",
            id_document_type: editing.id_document_type ?? "",
            id_document_number: editing.id_document_number ?? "",
            nationality: editing.nationality ?? "",
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
        <ConfirmDialog
          open
          title={`Remove ${confirmDelete.full_name}?`}
          description="Their past bookings and folios stay intact; the guest just won't appear in future new-booking flows."
          confirmLabel="Remove"
          isBusy={isMutating}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const ok = await remove(confirmDelete.id);
            if (ok) setConfirmDelete(null);
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------

interface GuestFormValues {
  full_name: string;
  phone: string;
  email: string;
  id_document_type: string;
  id_document_number: string;
  nationality: string;
}

function GuestFormDialog({
  title,
  submitLabel,
  initial,
  isSaving,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial?: GuestFormValues;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: {
    full_name: string;
    phone: string | null;
    email: string | null;
    id_document_type: string | null;
    id_document_number: string | null;
    nationality: string | null;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [docType, setDocType] = useState(initial?.id_document_type ?? "");
  const [docNumber, setDocNumber] = useState(initial?.id_document_number ?? "");
  const [nationality, setNationality] = useState(initial?.nationality ?? "");

  useEffect(() => {
    if (initial) {
      setFullName(initial.full_name);
      setPhone(initial.phone);
      setEmail(initial.email);
      setDocType(initial.id_document_type);
      setDocNumber(initial.id_document_number);
      setNationality(initial.nationality);
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
            if (!fullName.trim()) return;
            await onSubmit({
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              email: email.trim() || null,
              id_document_type: docType || null,
              id_document_number: docNumber.trim() || null,
              nationality: nationality.trim() || null,
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="g-name">Full name</Label>
            <Input
              id="g-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="As on ID document"
              required
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-phone">Phone</Label>
            <Input
              id="g-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+977 98…"
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
              placeholder="guest@example.com"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>ID document type</Label>
            <Select value={docType || undefined} onValueChange={setDocType} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {ID_DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-docnum">ID number</Label>
            <Input
              id="g-docnum"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="e.g. 12-345-67890"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="g-nationality">Nationality</Label>
            <Input
              id="g-nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. Nepal"
              disabled={isSaving}
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !fullName.trim()}>
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
