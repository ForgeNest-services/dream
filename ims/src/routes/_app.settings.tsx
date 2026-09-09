import { PageHeader } from "@/components/common/primitives";
import { PaymentQrUploader } from "@/components/common/payment-qr-uploader";
import { TablePagination } from "@/components/common/table-pagination";
import { UsersSection } from "@/components/common/users-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-store";
import { auditLogApi, type AuditLogEntryDto } from "@/lib/audit-log-api";
import type { PageMeta } from "@/lib/api-client";
import { cbmsSyncLogApi, type CbmsSyncLogEntry } from "@/lib/invoices-api";
import { staffCredentialsApi, type StaffCredentialDto } from "@/lib/staff-credentials-api";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Info, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SROTA IMS" },
      {
        name: "description",
        content:
          "Company profile, VAT toggle, invoice numbering, branches, units and payment QR.",
      },
      { property: "og:title", content: "Settings — SROTA IMS" },
      {
        property: "og:description",
        content: "Company profile, branches, units and payment configuration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const app = useApp();
  const [form, setForm] = useState(app.company);
  const [fyStart, setFyStart] = useState("");
  const [deleteFyId, setDeleteFyId] = useState<string | null>(null);
  const [deletingFy, setDeletingFy] = useState(false);
  // Per-branch user counts on the Branches tab — app.users is mock/seed
  // data, never real credentials, so this is fetched separately rather than
  // read off that (see UsersSection, which fetches this same list).
  const [credentials, setCredentials] = useState<StaffCredentialDto[]>([]);
  useEffect(() => {
    staffCredentialsApi
      .list()
      .then((r) => setCredentials(r.data ?? []))
      .catch(() => {
        // Non-fatal — the branches table still renders, just without counts.
      });
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <PageHeader
        title="Settings"
        subtitle="Company profile, branches, users, units and payment configuration."
      />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal years</TabsTrigger>
          <TabsTrigger value="units">Units &amp; brands</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          {/* CBMS real-time sync only applies once admin has actually saved
              IRD credentials AND enabled sync for this org
              (company.cbmsConfigured — see TenantInfoDto), matching RMS's
              SettingsView. A VAT-registered tenant that hasn't set this up
              yet has no sync history to show. Kept visible while
              branch/tenant data is still loading so it doesn't flash in/out
              on page load. */}
          {(!app.branchesReady || app.company.cbmsConfigured) && (
            <TabsTrigger value="ird">IRD / CBMS</TabsTrigger>
          )}
          <TabsTrigger value="audit">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-sm font-medium">Business profile</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fetched from your business registration — edit it from the admin app
              (app.dream.com), not here.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Trade / legal name</Label>
                <p className="mt-1 text-sm">{app.company.legalName || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">PAN / VAT number</Label>
                <p className="num mt-1 text-sm">{app.company.pan || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Registration status</Label>
                <p className="mt-1 text-sm">
                  {app.company.isVatRegisteredTenant ? "VAT registered" : "PAN only"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Address</Label>
                <p className="mt-1 text-sm">{app.company.address || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <p className="mt-1 text-sm">{app.company.phone || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <p className="mt-1 text-sm">{app.company.email || "—"}</p>
              </div>
            </div>
          </div>

          <VatSettingsCard />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <div>
              <p className="text-sm font-medium">Fiscal years (Bikram Sambat)</p>
              <p className="text-xs text-muted-foreground">
                Nepali fiscal year runs Shrawan 1 to Ashad end. The active year drives invoice
                numbering and report periods.
              </p>
            </div>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Fiscal year</th>
                    <th className="px-3 py-2.5 text-left font-medium">Starts</th>
                    <th className="px-3 py-2.5 text-left font-medium">Ends</th>
                    <th className="px-3 py-2.5 text-right font-medium">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {app.fiscalYears.map((f) => {
                    const isActive = app.fiscalYear.id === f.id;
                    return (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="num px-3 py-2.5 font-medium">{f.label}</td>
                        <td className="num px-3 py-2.5 text-muted-foreground">
                          {new Date(f.startDate).toISOString().slice(0, 10)}
                        </td>
                        <td className="num px-3 py-2.5 text-muted-foreground">
                          {new Date(f.endDate).toISOString().slice(0, 10)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isActive ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Active
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const res = await app.setFiscalYearId(f.id);
                                if (!res.ok) {
                                  toast.error(res.error ?? "Failed to switch fiscal year");
                                  return;
                                }
                                toast.success(`${f.label} set active`);
                              }}
                            >
                              Set active
                            </Button>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {!isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteFyId(f.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">New fiscal year start (BS)</Label>
                <Input
                  value={fyStart}
                  onChange={(e) => setFyStart(e.target.value)}
                  placeholder="2084"
                  className="num mt-1 w-32"
                />
              </div>
              <Button
                onClick={async () => {
                  const year = Number(fyStart);
                  if (!year || year < 2075 || year > 2089) {
                    toast.error("Enter a BS year between 2075 and 2089");
                    return;
                  }
                  const res = await app.addFiscalYear(year);
                  if (!res.ok || !res.fiscalYear) {
                    toast.error(res.error ?? `Fiscal year ${year} already exists`);
                    return;
                  }
                  toast.success(`Fiscal year ${res.fiscalYear.label} created`);
                  setFyStart("");
                }}
              >
                Create fiscal year
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Branch</th>
                  <th className="px-3 py-2.5 text-left font-medium">Code</th>
                  <th className="px-3 py-2.5 text-left font-medium">Address</th>
                  <th className="px-3 py-2.5 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {app.branches.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium">{b.name}</td>
                    <td className="num px-3 py-2.5">{b.code}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{b.address}</td>
                    <td className="num px-3 py-2.5 text-right">
                      {credentials.filter((c) => c.branch_id === b.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UsersSection />
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-lg border bg-card">
              <p className="border-b px-3 py-2 text-sm font-medium">Units of measure</p>
              <table className="w-full text-sm">
                <tbody>
                  {app.units.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{u.name}</td>
                      <td className="num px-3 py-2 text-muted-foreground">{u.symbol}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {u.allowsDecimals ? "Decimals allowed" : "Whole numbers"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <p className="border-b px-3 py-2 text-sm font-medium">Brands</p>
              <table className="w-full text-sm">
                <tbody>
                  {app.brands.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{b.name}</td>
                      <td className="num px-3 py-2 text-right text-muted-foreground">
                        {app.products.filter((p) => p.brandId === b.id).length} products
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="max-w-md rounded-lg border bg-card p-5">
            <p className="text-sm font-medium">Static payment QR</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shown on the POS screen and printed on QR-paid invoices. Dynamic Fonepay QR comes
              later.
            </p>
            <div className="mt-3">
              <PaymentQrUploader />
            </div>
            {app.company.qrImageUrl ? (
              <img
                src={app.company.qrImageUrl}
                alt="Current static payment QR code"
                className="mt-3 h-40 w-40 rounded border object-contain"
              />
            ) : null}
          </div>
        </TabsContent>

        {(!app.branchesReady || app.company.cbmsConfigured) && (
          <TabsContent value="ird" className="mt-4">
            <CbmsCredentialsCard />
          </TabsContent>
        )}

        <TabsContent value="audit" className="mt-4">
          <AuditLogCard />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteFyId !== null} onOpenChange={(o) => !o && setDeleteFyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this fiscal year?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. It won't affect any purchases or invoices already recorded —
              only removes it from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingFy}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteFyId) return;
                setDeletingFy(true);
                try {
                  const res = await app.deleteFiscalYear(deleteFyId);
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to delete fiscal year");
                    return;
                  }
                  toast.success("Fiscal year deleted");
                  setDeleteFyId(null);
                } finally {
                  setDeletingFy(false);
                }
              }}
            >
              {deletingFy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CbmsCredentialsCard() {
  const app = useApp();
  const canResync = ["owner", "manager"].includes(app.effectiveRole ?? "");
  const [entries, setEntries] = useState<CbmsSyncLogEntry[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  const load = () => {
    cbmsSyncLogApi
      .list({ status: statusFilter || undefined, per_page: 25 })
      .then((res) => {
        if (res.success) setEntries(res.data ?? []);
      })
      .catch(() => {
        // silently ignore — not critical to render the rest of the page
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleResync = async (id: string) => {
    setResyncingId(id);
    try {
      const res = await cbmsSyncLogApi.resync(id);
      if (res.success && res.data?.status === "synced") {
        toast.success("Synced to CBMS");
      } else {
        toast.error("Still not synced — see the response code below");
      }
      load();
    } catch {
      toast.error("Resync failed");
    } finally {
      setResyncingId(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm font-medium">IRD CBMS Integration</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Credentials and the auto-sync toggle are shared across every app and managed once from
          the business admin app (app.dream.com → Settings). This page shows IMS's own sync
          history and lets you retry a failed submission.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Sync log</p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {entries === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sync attempts yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Document</th>
                <th className="py-1 text-left font-medium">Type</th>
                <th className="py-1 text-left font-medium">Status</th>
                <th className="py-1 text-left font-medium">Code</th>
                <th className="py-1 text-left font-medium">Last attempt</th>
                <th className="py-1 text-right font-medium">Attempts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="py-1.5">{e.document_number ?? e.document_id.slice(0, 8)}</td>
                  <td className="py-1.5 capitalize">{e.document_type.replace("_", " ")}</td>
                  <td className="py-1.5">
                    <span
                      className={
                        e.status === "synced"
                          ? "text-success"
                          : e.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="py-1.5">{e.cbms_response_code ?? "—"}</td>
                  <td className="py-1.5">
                    {e.last_attempted_at ? new Date(e.last_attempted_at).toLocaleString() : "—"}
                  </td>
                  <td className="py-1.5 text-right">{e.attempt_count}</td>
                  <td className="py-1.5 text-right">
                    {canResync && e.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={resyncingId === e.id}
                        onClick={() => handleResync(e.id)}
                      >
                        {resyncingId === e.id ? "Resyncing…" : "Resync"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// IRD: Electronic Billing Procedure 2082, clause 6.3ग — the User Activity
// Log must be viewable and filterable from the front-end. Owner/Manager
// only (matches the backend's role gate on GET /ims/audit-log).
function AuditLogCard() {
  const [entries, setEntries] = useState<AuditLogEntryDto[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  useEffect(() => {
    auditLogApi
      .list({
        entity_type: entityType || undefined,
        action: action || undefined,
        q: q || undefined,
        page,
        per_page: perPage,
      })
      .then((res) => {
        if (res.success) {
          setEntries(res.data ?? []);
          setMeta(res.meta ?? null);
        }
      })
      .catch(() => {
        // Non-fatal — the rest of Settings still renders.
      });
  }, [entityType, action, q, page, perPage]);

  const ACTION_LABELS: Record<string, string> = {
    create: "Sale created",
    login: "Logged in",
    login_failed: "Login failed",
    logout: "Logged out",
    credit_note: "Credit note issued",
    record_payment: "Payment recorded",
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm font-medium">User Activity Log</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every login, sale, payment, and credit note is recorded here permanently — this list
          can be filtered but nothing in it can be edited or removed (IRD requirement).
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">All types</option>
            <option value="invoice">Invoices</option>
            <option value="credential">Logins</option>
          </select>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoice #, staff, reason…"
            className="h-8 max-w-[220px] text-xs"
          />
        </div>

        {entries === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity matches this filter.</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">When</th>
                  <th className="py-1 text-left font-medium">Action</th>
                  <th className="py-1 text-left font-medium">Document / Entity</th>
                  <th className="py-1 text-left font-medium">Reason</th>
                  <th className="py-1 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="py-1.5 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-1.5">{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="py-1.5">
                      {(e.after_state?.number as string | undefined) ??
                        (e.after_state?.username as string | undefined) ??
                        `${e.entity_type} · ${e.entity_id.slice(0, 8)}`}
                    </td>
                    <td className="py-1.5">{e.reason ?? "—"}</td>
                    <td className="py-1.5">{e.terminal_ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && (
              <TablePagination
                page={meta.page}
                perPage={meta.per_page}
                totalItems={meta.total}
                totalPages={meta.total_pages}
                onPageChange={setPage}
                onPerPageChange={(pp) => {
                  setPerPage(pp);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VatSettingsCard() {
  const app = useApp();
  const canToggleVat = app.company.isVatRegisteredTenant === true;
  const [rateDraft, setRateDraft] = useState(String(app.company.vatRate ?? 13));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setRateDraft(String(app.company.vatRate ?? 13));
  }, [app.company.vatRate]);

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Tax</p>
        {savedFlash && (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
      <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <Info className="h-3.5 w-3.5" />
          Business tax status
        </p>
        <p className="mt-1 text-muted-foreground">
          {app.company.isVatRegisteredTenant ? (
            <>
              <span className="font-semibold text-primary">VAT-registered</span>
              {app.company.pan && <> · PAN {app.company.pan}</>} — VAT can be applied to bills.
            </>
          ) : app.company.pan ? (
            <>
              <span className="font-semibold">PAN only</span> · PAN {app.company.pan} — VAT isn't
              available. Change this in the admin app if you register for VAT.
            </>
          ) : (
            <>No PAN or VAT on file. Update your business info in the admin app.</>
          )}
        </p>
      </div>
      <div
        className={`mt-4 flex items-center justify-between rounded-md p-4 ${
          canToggleVat ? "bg-muted/40" : "bg-muted/20 opacity-70"
        }`}
      >
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {!canToggleVat && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            Apply VAT on bills
          </p>
          <p className="text-xs text-muted-foreground">
            {canToggleVat
              ? "Applied as a single line on every purchase, sale and invoice."
              : "Only available for VAT-registered businesses."}
          </p>
        </div>
        <Switch
          checked={canToggleVat && app.company.vatRegistered}
          disabled={!canToggleVat}
          onCheckedChange={async (v) => {
            const res = await app.updateVatSettings({ vatEnabled: v });
            if (!res.ok) {
              toast.error(res.error ?? "Failed to update VAT setting");
              return;
            }
            flashSaved();
          }}
        />
      </div>
      {canToggleVat && app.company.vatRegistered && (
        <div className="mt-4 space-y-2">
          <Label className="text-xs">VAT rate (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={async () => {
              const next = Number(rateDraft);
              if (
                !Number.isFinite(next) ||
                next < 0 ||
                next > 100 ||
                next === app.company.vatRate
              ) {
                setRateDraft(String(app.company.vatRate ?? 13));
                if (Number.isFinite(next) && (next < 0 || next > 100)) {
                  toast.error("VAT rate must be between 0 and 100");
                }
                return;
              }
              const res = await app.updateVatSettings({ vatRate: next });
              if (!res.ok) {
                toast.error(res.error ?? "Failed to update VAT rate");
                return;
              }
              flashSaved();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="num mt-1"
          />
          <p className="text-[11px] text-muted-foreground">Auto-saves when you tab out or press Enter.</p>
        </div>
      )}
    </div>
  );
}
