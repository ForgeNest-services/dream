import { useEffect, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, Info, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Tabs defaultValue="users">
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
        <TabsTrigger value="tax">Tax</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        {(tenantLoading || tenant?.cbms_configured) && (
          <TabsTrigger value="ird">IRD / CBMS</TabsTrigger>
        )}
        {(actualRole === "owner" || actualRole === "manager") && (
          <TabsTrigger value="audit">Activity Log</TabsTrigger>
        )}
      </TabsList>

      {/* ── Users ── */}
      <TabsContent value="users" className="mt-4">
        <UsersSection />
      </TabsContent>

      {/* ── Restaurant & Branch ── */}
      <TabsContent value="restaurant" className="mt-4">
        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Restaurant &amp; branch</h2>
          <p className="text-sm text-muted-foreground">
            Viewing settings for {branch?.name ?? "—"}
          </p>
          <div className="mt-4 space-y-4">
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
            <div className="rounded-xl border border-border bg-secondary/50 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Info className="size-3.5" />
                Business PAN
              </p>
              <p className="mt-1 text-muted-foreground">
                {tenantLoading ? (
                  "Loading…"
                ) : tenant?.pan ? (
                  <>
                    PAN <span className="font-semibold text-foreground">{tenant.pan}</span> —
                    printed on every bill for IRD compliance.
                  </>
                ) : (
                  <>No PAN on file. Add your PAN in the admin app under Settings.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Tax ── */}
      <TabsContent value="tax" className="mt-4">
        <VatSettingsCard
          tenant={tenant}
          tenantLoading={tenantLoading}
          settings={settings}
          updateSettings={updateSettings}
        />
      </TabsContent>

      {/* ── Payments ── */}
      <TabsContent value="payments" className="mt-4 space-y-4">
        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Payment QR</h2>
          <p className="text-sm text-muted-foreground">
            One static QR image per branch — uploaded to storage and printed on receipts.
            Replacing or removing it also deletes the old file from storage.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
              {settings.qrImage ? (
                <img
                  src={settings.qrImage}
                  alt="Payment QR"
                  className="size-full object-contain"
                />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">
                  No QR uploaded
                </span>
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
            Printable QR. Scanning opens the read-only public menu for{" "}
            {branch?.name ?? "this branch"}.
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
              <MenuQrPrintButton menuUrl={menuUrl} branchName={branch?.name ?? "Menu"} />
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── IRD / CBMS ── */}
      {/* CBMS real-time sync only applies once admin has actually saved IRD
          credentials AND enabled sync for this org (tenant.cbms_configured
          — see RestroTenantInfo) — a VAT-registered tenant that hasn't set
          this up yet has no sync history to show, so the whole tab (trigger
          above + content here) is hidden rather than showing an empty/
          confusing panel. Kept visible while tenant is still loading (see
          the trigger's own condition above) so it doesn't flash in/out on
          every page load. */}
      {(tenantLoading || tenant?.cbms_configured) && (
        <TabsContent value="ird" className="mt-4 space-y-4">
          <CbmsRealtimeCard
            tenant={tenant}
            tenantLoading={tenantLoading}
            settings={settings}
            updateSettings={updateSettings}
            isOwner={actualRole === "owner"}
          />
          <CbmsCredentialsCard isOwner={actualRole === "owner"} />
        </TabsContent>
      )}

      {/* ── Activity Log ── */}
      {(actualRole === "owner" || actualRole === "manager") && (
        <TabsContent value="audit" className="mt-4">
          <AuditLogCard />
        </TabsContent>
      )}
    </Tabs>
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
      <HsCodeInput settings={settings} updateSettings={updateSettings} flashSaved={flashSaved} />
    </div>
  );
}

function HsCodeInput({
  settings,
  updateSettings,
  flashSaved,
}: {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  flashSaved: () => void;
}) {
  const [draft, setDraft] = useState(settings.defaultHsCode ?? "");

  useEffect(() => {
    setDraft(settings.defaultHsCode ?? "");
  }, [settings.defaultHsCode]);

  const save = async () => {
    const trimmed = draft.trim() || undefined;
    if (trimmed === settings.defaultHsCode) return;
    await updateSettings({ defaultHsCode: trimmed });
    flashSaved();
  };

  return (
    <div className="mt-4 space-y-2">
      <Label className="text-xs">Default HS Code</Label>
      <p className="text-[11px] text-muted-foreground">
        Harmonized System code printed on every bill line — required by IRD Annexure 6 for all
        businesses (VAT and PAN). Restaurants typically use{" "}
        <span className="font-mono font-medium">2106.90</span> (prepared food). Leave blank if
        unknown — IRD requires it, but you can set it once confirmed.
      </p>
      <Input
        className="h-12 font-mono"
        placeholder="e.g. 2106.90"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function CbmsRealtimeCard({
  tenant,
  tenantLoading,
  settings,
  updateSettings,
  isOwner,
}: {
  tenant: TenantInfoDto | null;
  tenantLoading: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  isOwner: boolean;
}) {
  const [savedFlash, setSavedFlash] = useState(false);
  const canEnable = tenant?.is_vat_registered === true;

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="pos-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">Real-time CBMS</h2>
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
          IRD requirement
        </p>
        <p className="mt-1 text-muted-foreground">
          {tenantLoading
            ? "Loading…"
            : canEnable
              ? "When enabled, each VAT bill is pushed to CBMS immediately at payment time. IRD Annex-5 records this as Is_realtime = Yes."
              : "Real-time CBMS sync is only available for VAT-registered businesses. Enable VAT registration in the admin app first."}
        </p>
      </div>
      <div
        className={`mt-4 flex items-center justify-between rounded-xl p-4 ${
          canEnable && isOwner ? "bg-secondary" : "bg-secondary/50 opacity-70"
        }`}
      >
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {(!canEnable || !isOwner) && <Lock className="size-3.5 text-muted-foreground" />}
            Push bills to CBMS in real time
          </p>
          <p className="text-xs text-muted-foreground">
            {canEnable && isOwner
              ? "Bills are submitted to IRD's Central Billing Monitoring System as they are paid."
              : !isOwner
                ? "Only the owner can change this setting."
                : "Only available for VAT-registered businesses."}
          </p>
        </div>
        <Switch
          checked={canEnable && settings.cbmsRealtimeEnabled}
          disabled={!canEnable || !isOwner}
          onCheckedChange={async (v) => {
            await updateSettings({ cbmsRealtimeEnabled: v });
            flashSaved();
          }}
        />
      </div>
    </div>
  );
}

function CbmsCredentialsCard({ isOwner }: { isOwner: boolean }) {
  const [entries, setEntries] = useState<CbmsSyncLogEntry[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  const load = () => {
    cbmsApi
      .syncLog({ ...(statusFilter ? { status: statusFilter } : {}), per_page: 25 })
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
        ...(entityType ? { entity_type: entityType } : {}),
        ...(action ? { action } : {}),
        ...(q ? { q } : {}),
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
          className="h-8 max-w-55 text-xs"
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
                    {(e.after_state?.["bill_code"] as string | undefined) ??
                      ((e.after_state?.["bill_number"] as number | undefined) !== undefined
                        ? `Bill #${e.after_state?.["bill_number"]}`
                        : ((e.after_state?.["username"] as string | undefined) ??
                          `${e.entity_type} · ${e.entity_id.slice(0, 8)}`))}
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
              <span className="min-w-17.5 text-center text-muted-foreground">
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
