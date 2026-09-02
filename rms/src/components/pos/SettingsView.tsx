import { useEffect, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, Info, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePos } from "@/lib/pos/store";
import type { Settings } from "@/lib/pos/data";
import type { TenantInfoDto } from "@/lib/tenant-api";
import type { PageMeta } from "@/lib/api-client";
import { auditLogApi, type AuditLogEntryDto } from "@/lib/audit-log-api";
import { cbmsApi, type CbmsSyncLogEntry } from "@/lib/cbms-api";
import { MenuQrPrintButton } from "./MenuQrPrint";
import { UsersSection } from "./UsersSection";

export function SettingsView() {
  const {
    settings,
    updateSettings,
    uploadQrImage,
    clearQrImage,
    branch,
    branchId,
    branches,
    canSwitchBranch,
    setBranchId,
    tenant,
    tenantLoading,
    actualRole,
  } = usePos();
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const menuUrl = `${origin}/menu/${branchId}`;

  const businessName = tenant?.name ?? settings.restaurantName;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4 xl:col-span-2">
        <UsersSection />
      </div>
      <div className="pos-card p-5">
        <h2 className="font-display text-xl">Restaurant & branch</h2>
        <p className="text-sm text-muted-foreground">Viewing settings for {branch?.name ?? "—"}</p>
        <div className="mt-4 space-y-4">
          {/* Branch switcher — mobile users switch here since the header
              switcher is hidden below the `sm` breakpoint (see Header.tsx).
              Owner-only: managers/waiters/chefs are locked to their branch
              by their JWT. */}
          {canSwitchBranch && branches.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Current branch</Label>
                <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Owner
                </span>
              </div>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-12">
                  <Building2 className="size-4 shrink-0 opacity-70" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="py-3">
                      <div>
                        <p className="font-semibold">{b.name}</p>
                        {b.address && (
                          <p className="text-xs text-muted-foreground">{b.address}</p>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Switch to view menu, orders and reports for a different branch.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Restaurant name</Label>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                From business
              </span>
            </div>
            <Input className="h-12 bg-muted/40" value={businessName} readOnly disabled />
            <p className="text-[11px] text-muted-foreground">
              Set on the business registration in the admin app.
            </p>
          </div>

          {/* Branch address/phone are authoritative on the branches table
              (managed in the admin app). Read-only here to prevent the local
              settings-store copy from silently diverging from the source. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Branch address</Label>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                From branch
              </span>
            </div>
            <Input
              className="h-12 bg-muted/40"
              value={branch?.address ?? ""}
              readOnly
              disabled
              placeholder="No address on branch record"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Branch phone</Label>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                From branch
              </span>
            </div>
            <Input
              className="h-12 bg-muted/40"
              value={branch?.phone ?? ""}
              readOnly
              disabled
              placeholder="No phone on branch record"
            />
            <p className="text-[11px] text-muted-foreground">
              Edit address / phone on the branch record in the admin app.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Business PAN</h2>
          <div className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="size-3.5" />
              PAN is printed on every bill for IRD compliance
            </p>
            <p className="mt-1 text-muted-foreground">
              {tenantLoading ? (
                "Loading…"
              ) : tenant?.pan ? (
                <>
                  PAN <span className="font-semibold text-foreground">{tenant.pan}</span> — printed
                  on receipts as required by IRD.
                </>
              ) : (
                <>No PAN on file. Add your PAN in the admin app under Settings.</>
              )}
            </p>
          </div>
        </div>

        <VatSettingsCard
          tenant={tenant}
          tenantLoading={tenantLoading}
          settings={settings}
          updateSettings={updateSettings}
        />

        <CbmsCredentialsCard isOwner={actualRole === "owner"} />

        {(actualRole === "owner" || actualRole === "manager") && <AuditLogCard />}

        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Payment QR</h2>
          <p className="text-sm text-muted-foreground">
            One static QR image per branch — uploaded to storage and printed on receipts. Replacing
            or removing it also deletes the old file from storage.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
              {settings.qrImage ? (
                <img src={settings.qrImage} alt="Payment QR" className="size-full object-contain" />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">No QR uploaded</span>
              )}
              {isUploadingQr && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Input
                type="file"
                accept="image/*"
                className="h-12"
                disabled={isUploadingQr}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsUploadingQr(true);
                  try {
                    await uploadQrImage(file);
                  } finally {
                    setIsUploadingQr(false);
                    // Reset the file input so the same filename can be
                    // re-picked to trigger an upload again if needed.
                    e.target.value = "";
                  }
                }}
              />
              {settings.qrImage && (
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={isUploadingQr}
                  onClick={() => clearQrImage()}
                >
                  Remove QR
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Menu QR (per branch)</h2>
          <p className="text-sm text-muted-foreground">
            Printable QR. Scanning opens a read-only public menu page for {branch?.name ?? "this branch"}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(menuUrl)}`}
              alt={`Menu QR for ${branch?.name ?? "branch"}`}
              width={128}
              height={128}
              className="size-32 shrink-0 rounded-xl border border-border bg-white p-2"
            />
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <a
                href={menuUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm"
              >
                Preview public menu
              </a>
              <MenuQrPrintButton
                menuUrl={menuUrl}
                branchName={branch?.name ?? "Menu"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VatSettingsCard({
  tenant,
  tenantLoading,
  settings,
  updateSettings,
}: {
  tenant: TenantInfoDto | null;
  tenantLoading: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}) {
  const canToggleVat = tenant?.is_vat_registered === true;
  const [rateDraft, setRateDraft] = useState(String(settings.vatRate ?? 13));
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setRateDraft(String(settings.vatRate ?? 13));
  }, [settings.vatRate]);

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="pos-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Tax</h2>
        {savedFlash && (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            <Check className="size-3" />
            Saved
          </span>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Info className="size-3.5" />
          Business tax status
        </p>
        <p className="mt-1 text-muted-foreground">
          {tenantLoading ? (
            "Loading…"
          ) : canToggleVat ? (
            <>
              <span className="font-semibold text-primary">VAT-registered</span>
              {tenant?.pan && <> · PAN {tenant.pan}</>} — VAT can be applied to bills.
            </>
          ) : tenant?.pan ? (
            <>
              <span className="font-semibold">PAN only</span> · PAN {tenant.pan} — VAT isn't
              available. Change this in the admin app if you register for VAT.
            </>
          ) : (
            <>No PAN or VAT on file. Update your business info in the admin app.</>
          )}
        </p>
      </div>
      <div
        className={`mt-4 flex items-center justify-between rounded-xl p-4 ${
          canToggleVat ? "bg-secondary" : "bg-secondary/50 opacity-70"
        }`}
      >
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {!canToggleVat && <Lock className="size-3.5 text-muted-foreground" />}
            Apply VAT on bills
          </p>
          <p className="text-xs text-muted-foreground">
            {canToggleVat
              ? "Menu prices are treated as VAT-inclusive; the bill shows the breakdown."
              : "Only available for VAT-registered businesses."}
          </p>
        </div>
        <Switch
          checked={canToggleVat && settings.vatEnabled}
          disabled={!canToggleVat}
          onCheckedChange={async (v) => {
            await updateSettings({ vatEnabled: v });
            flashSaved();
          }}
        />
      </div>
      {canToggleVat && settings.vatEnabled && (
        <div className="mt-4 space-y-2">
          <Label className="text-xs">VAT rate (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="h-12"
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={async () => {
              const next = Number(rateDraft);
              if (
                !Number.isFinite(next) ||
                next < 0 ||
                next > 100 ||
                next === settings.vatRate
              ) {
                setRateDraft(String(settings.vatRate ?? 13));
                if (Number.isFinite(next) && (next < 0 || next > 100)) {
                  toast.error("VAT rate must be between 0 and 100");
                }
                return;
              }
              await updateSettings({ vatRate: next });
              flashSaved();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      )}
    </div>
  );
}

function CbmsCredentialsCard({ isOwner }: { isOwner: boolean }) {
  const [entries, setEntries] = useState<CbmsSyncLogEntry[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  const load = () => {
    cbmsApi
      .syncLog({ status: statusFilter || undefined, per_page: 25 })
      .then((res) => {
        if (res.data) setEntries(res.data);
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
      const res = await cbmsApi.resync(id);
      if (res.data?.status === "synced") {
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
    <div className="pos-card p-5">
      <h2 className="font-display text-xl">IRD CBMS Integration</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Credentials and the auto-sync toggle are shared across every app and managed once from
        the business admin app (app.dream.com → Settings). This page shows RMS&apos;s own sync
        history and lets you retry a failed submission.
      </p>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-medium">Sync log</p>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="synced">Synced</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {entries === null ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No sync attempts yet.</p>
      ) : (
        <table className="mt-3 w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Bill</th>
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
                          ? "text-danger"
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
                  {isOwner && e.status === "failed" && (
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
  );
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  login_failed: "Login failed",
  logout: "Logged out",
  mark_paid: "Bill paid",
  cancel: "Order cancelled",
  credit_note: "Credit note issued",
  set_discount: "Discount changed",
  update_qty: "Line quantity changed",
  void: "Line voided",
};

// IRD: Electronic Billing Procedure 2082, clause 6.3ग — the User Activity
// Log must be viewable and filterable from the front-end. Owner/Manager
// only (matches the backend's role gate on GET /restro/audit-log).
function AuditLogCard() {
  const [entries, setEntries] = useState<AuditLogEntryDto[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    auditLogApi
      .list({
        entity_type: entityType || undefined,
        action: action || undefined,
        q: q || undefined,
        page,
        per_page: 25,
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
  }, [entityType, action, q, page]);

  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="pos-card p-5 xl:col-span-2">
      <h2 className="font-display text-xl">User Activity Log</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every login, bill, discount, cancellation, and credit note is recorded here permanently —
        this list can be filtered but nothing in it can be edited or removed (IRD requirement).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">All types</option>
          <option value="order">Orders</option>
          <option value="order_line">Order lines</option>
          <option value="credential">Logins</option>
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([k, label]) => (
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
          placeholder="Search bill #, staff, reason…"
          className="h-8 max-w-[220px] text-xs"
        />
      </div>

      {entries === null ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No activity matches this filter.</p>
      ) : (
        <>
          <table className="mt-3 w-full text-xs">
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
                  <td className="py-1.5">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="py-1.5">
                    {(e.after_state?.bill_number as number | undefined) !== undefined
                      ? `Bill #${e.after_state?.bill_number}`
                      : ((e.after_state?.username as string | undefined) ??
                        `${e.entity_type} · ${e.entity_id.slice(0, 8)}`)}
                  </td>
                  <td className="py-1.5">{e.reason ?? "—"}</td>
                  <td className="py-1.5">{e.terminal_ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta && totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[70px] text-center text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
