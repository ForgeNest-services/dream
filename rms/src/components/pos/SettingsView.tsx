import { Building2, Info, Lock } from "lucide-react";
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

export function SettingsView() {
  const {
    settings,
    updateSettings,
    branch,
    branchId,
    branches,
    canSwitchBranch,
    setBranchId,
    tenant,
    tenantLoading,
  } = usePos();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const menuUrl = `${origin}/menu/${branchId}`;

  // Business identity (name, PAN, VAT status) is authoritative on the tenant
  // row — edited in the admin app, read-only here. If the tenant hasn't
  // registered VAT, the VAT toggle stays locked off no matter what the local
  // per-branch settings say.
  const canToggleVat = tenant?.is_vat_registered === true;
  const businessName = tenant?.name ?? settings.restaurantName;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="pos-card p-5">
        <h2 className="font-display text-xl">Restaurant & branch</h2>
        <p className="text-sm text-muted-foreground">Viewing settings for {branch?.name ?? "—"}</p>
        <div className="mt-4 space-y-4">
          {/* Branch switcher — the primary place to change branch since the
              header switcher was removed for mobile clarity. Owner-only:
              managers/waiters/chefs are locked to their branch by their JWT. */}
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
          <h2 className="font-display text-xl">Tax</h2>
          <div className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="size-3.5" />
              Business tax status
            </p>
            <p className="mt-1 text-muted-foreground">
              {tenantLoading ? (
                "Loading…"
              ) : tenant?.is_vat_registered ? (
                <>
                  <span className="font-semibold text-primary">VAT-registered</span>
                  {tenant.pan && <> · PAN {tenant.pan}</>} — VAT can be applied to bills.
                </>
              ) : tenant?.pan ? (
                <>
                  <span className="font-semibold">PAN only</span> · PAN {tenant.pan} — VAT is not
                  available. Change this in the admin app if you register for VAT.
                </>
              ) : (
                <>No PAN or VAT on file. Update your business info in the admin app.</>
              )}
            </p>
          </div>
          <div
            className={`mt-4 flex items-center justify-between rounded-xl p-4 ${
              canToggleVat ? "bg-secondary" : "bg-muted/40 opacity-70"
            }`}
          >
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                {!canToggleVat && <Lock className="size-3.5 text-muted-foreground" />}
                Apply VAT on bills
              </p>
              <p className="text-xs text-muted-foreground">
                {canToggleVat
                  ? "Applied as a single line on every bill"
                  : "Only available for VAT-registered businesses"}
              </p>
            </div>
            <Switch
              checked={canToggleVat && settings.vatEnabled}
              disabled={!canToggleVat}
              onCheckedChange={(v) => updateSettings({ vatEnabled: v })}
            />
          </div>
          {canToggleVat && settings.vatEnabled && (
            <div className="mt-4 space-y-2">
              <Label>VAT rate (%)</Label>
              <Input
                type="number"
                className="h-12"
                value={settings.vatRate}
                onChange={(e) => updateSettings({ vatRate: Number(e.target.value) })}
              />
            </div>
          )}
        </div>

        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Payment QR</h2>
          <p className="text-sm text-muted-foreground">One static QR image per branch.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
              {settings.qrImage ? (
                <img src={settings.qrImage} alt="Payment QR" className="size-full object-contain" />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">No QR uploaded</span>
              )}
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <Input
                type="file"
                accept="image/*"
                className="h-12"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) updateSettings({ qrImage: URL.createObjectURL(file) });
                }}
              />
              {settings.qrImage && (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => updateSettings({ qrImage: undefined })}
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
              <Button variant="outline" className="h-11" onClick={() => window.print()}>
                Print QR
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
