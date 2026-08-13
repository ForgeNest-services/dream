import { PageHeader } from "@/components/common/primitives";
import { MediaPicker } from "@/components/inventory/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/app-store";
import { ROLE_LABELS, type DateSystem, type Role } from "@/data/types";
import { CURRENCIES } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SROTA IMS" },
      {
        name: "description",
        content:
          "Configure company PAN/VAT profile, VAT rate, invoice numbering, branches, users and roles, units, and payment QR.",
      },
      { property: "og:title", content: "Settings — SROTA IMS" },
      {
        property: "og:description",
        content: "Company profile, branches, users and roles, units and payment configuration.",
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

  const save = () => {
    app.updateCompany(form);
    toast.success("Company profile saved");
  };

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
          <TabsTrigger value="fiscal">Fiscal years</TabsTrigger>
          <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="units">Units &amp; brands</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <div className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Trade name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Legal name (as registered)</Label>
              <Input
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">PAN / VAT number</Label>
              <Input
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value })}
                className="num mt-1"
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <Switch
                checked={form.vatRegistered}
                onCheckedChange={(v) => setForm({ ...form, vatRegistered: v })}
              />
              <div>
                <p className="text-sm">VAT registered</p>
                <p className="text-xs text-muted-foreground">
                  {form.vatRegistered
                    ? "Documents print as Tax Invoice with a VAT breakdown."
                    : "PAN-only: documents print as Invoice, no VAT columns."}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs">VAT rate (%)</Label>
              <Input
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) || 0 })}
                className="num mt-1"
                disabled={!form.vatRegistered}
              />
            </div>
            <div>
              <Label className="text-xs">Invoice prefix</Label>
              <Input
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2 grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Default date system</Label>
                <Select
                  value={app.dateSystem}
                  onValueChange={(v) => app.setDateSystem(v as DateSystem)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BS">Bikram Sambat (BS)</SelectItem>
                    <SelectItem value="AD">Gregorian (AD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Default currency</Label>
                <Select value={app.currency} onValueChange={app.setCurrency}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={save}>Save profile</Button>
            </div>
          </div>
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
                  </tr>
                </thead>
                <tbody>
                  {app.fiscalYears.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="num px-3 py-2.5 font-medium">{f.label}</td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {new Date(f.startDate).toISOString().slice(0, 10)}
                      </td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {new Date(f.endDate).toISOString().slice(0, 10)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {app.fiscalYear.id === f.id ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Active
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => app.setFiscalYearId(f.id)}
                          >
                            Set active
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
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
                onClick={() => {
                  const year = Number(fyStart);
                  if (!year || year < 2075 || year > 2089) {
                    toast.error("Enter a BS year between 2075 and 2089");
                    return;
                  }
                  const created = app.addFiscalYear(year);
                  if (!created) {
                    toast.error(`Fiscal year ${year} already exists`);
                    return;
                  }
                  toast.success(`Fiscal year ${created.label} created and set active`);
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
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left font-medium">Username</th>
                  <th className="px-3 py-2.5 text-left font-medium">Role</th>
                  <th className="px-3 py-2.5 text-left font-medium">Branches</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {app.users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium">{u.name}</td>
                    <td className="num px-3 py-2.5">{u.username}</td>
                    <td className="px-3 py-2.5">{ROLE_LABELS[u.role as Role]}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {u.branchIds
                        .map((id) => app.branches.find((b) => b.id === id)?.code ?? id)
                        .join(", ")}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${u.active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <MediaPicker
                label="Choose or upload QR"
                value={undefined}
                onChange={(id) => {
                  const m = app.media.find((x) => x.id === id);
                  setForm({ ...form, qrImageUrl: m?.url });
                  app.updateCompany({ qrImageUrl: m?.url });
                  toast.success("Payment QR updated");
                }}
              />
            </div>
            {form.qrImageUrl ? (
              <img
                src={form.qrImageUrl}
                alt="Current static payment QR code"
                className="mt-3 h-40 w-40 rounded border object-contain"
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
