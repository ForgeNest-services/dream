import { PageHeader } from "@/components/common/primitives";
import { PaymentQrUploader } from "@/components/common/payment-qr-uploader";
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
  const [fyStart, setFyStart] = useState("");
  const [deleteFyId, setDeleteFyId] = useState<string | null>(null);
  const [deletingFy, setDeletingFy] = useState(false);

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
                      {app.users.filter((u) => u.branchIds.includes(b.id)).length}
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
