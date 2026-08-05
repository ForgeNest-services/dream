import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApp, useMoney } from "@/lib/app-state";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Dream PMS" },
      {
        name: "description",
        content:
          "Property details, payment provider configuration for FonePay, eSewa and Khalti, and subscription billing.",
      },
      { property: "og:title", content: "Settings — Dream PMS" },
      {
        property: "og:description",
        content: "Property details, payment providers and subscription billing.",
      },
    ],
  }),
  component: SettingsPage,
});

const providers = ["FonePay", "eSewa", "Khalti"] as const;

function ProviderPanel({ name }: { name: string }) {
  const [mode, setMode] = useState<"automated" | "manual">("automated");

  return (
    <div className="space-y-5">
      <div className="flex w-fit rounded-lg border border-border bg-muted/60 p-1">
        {(["automated", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "automated" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${name}-mid`}>Merchant ID</Label>
            <Input id={`${name}-mid`} placeholder={`${name.toUpperCase()}-MERCHANT-001`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${name}-secret`}>Secret key</Label>
            <Input id={`${name}-secret`} type="password" placeholder="••••••••••••••" />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Payments settle automatically and are reconciled against the guest folio.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-border bg-muted/50 text-center">
            <div className="p-4">
              <Upload className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">Upload static QR image</p>
              <Button variant="outline" size="sm" className="mt-3">
                Choose file
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${name}-note`}>Instructions shown to guests</Label>
            <Textarea
              id={`${name}-note`}
              rows={5}
              defaultValue={`Scan this ${name} QR and show the payment confirmation at the front desk.`}
            />
          </div>
        </div>
      )}

      <Button>Save {name} settings</Button>
    </div>
  );
}

function SettingsPage() {
  const money = useMoney();
  const { property } = useApp();

  return (
    <>
      <PageHeader title="Settings" subtitle={`Configuration and billing for ${property?.name ?? "—"}`} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-2xl leading-none">Property details</h2>
            <form className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pname">Property name</Label>
                <Input key={property?.id} id="pname" defaultValue={property?.name ?? ""} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addr">Address</Label>
                <Input id="addr" defaultValue="Thamel Marg, Kathmandu 44600, Nepal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rooms">Room count</Label>
                <Input id="rooms" type="number" defaultValue={36} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan">VAT / PAN number</Label>
                <Input id="pan" defaultValue="601234567" />
              </div>
              <div className="sm:col-span-2">
                <Button>Save changes</Button>
              </div>
            </form>
          </section>

          <section className="surface p-6">
            <h2 className="text-2xl leading-none">Payment settings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure each provider as automated or manual.
            </p>
            <Tabs defaultValue={providers[0]} className="mt-5">
              <TabsList>
                {providers.map((p) => (
                  <TabsTrigger key={p} value={p}>
                    {p}
                  </TabsTrigger>
                ))}
              </TabsList>
              {providers.map((p) => (
                <TabsContent key={p} value={p} className="pt-5">
                  <ProviderPanel name={p} />
                </TabsContent>
              ))}
            </Tabs>
          </section>
        </div>

        <aside className="surface h-fit p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-none">Subscription</h2>
            <Badge variant="outline" className="border-amber/40 bg-amber/15 text-amber-foreground">
              Trial
            </Badge>
          </div>

          <p className="mt-5 font-display text-4xl leading-none text-accent">Growth</p>
          <p className="text-sm text-muted-foreground">Up to 50 rooms · 10 staff seats</p>

          <dl className="mt-6 space-y-3 text-sm">
            {[
              ["Price", `${money(7900)} / month`],
              ["Trial ends", "18 August 2026"],
              ["Renews on", "18 August 2026"],
              ["Properties", "2 of 3 used"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <Button className="mt-6 w-full">Upgrade plan</Button>
          <Button variant="outline" className="mt-2.5 w-full">
            Billing history
          </Button>
        </aside>
      </div>
    </>
  );
}
