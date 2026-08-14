import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-store";
import { ROLE_LABELS } from "@/data/types";
import { Boxes, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — SROTA IMS Inventory & POS" },
      {
        name: "description",
        content:
          "Sign in to SROTA IMS, the IRD-compliant inventory, stock and point-of-sale system for Nepali businesses.",
      },
      { property: "og:title", content: "Sign in — SROTA IMS Inventory & POS" },
      {
        property: "og:description",
        content: "IRD-compliant inventory, stock movement and billing for multi-branch businesses.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const app = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("demo1234");

  useEffect(() => {
    if (app.currentUser) void navigate({ to: "/dashboard", replace: true });
  }, [app.currentUser, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (app.login(username, password)) {
      void navigate({ to: "/dashboard", replace: true });
    } else {
      toast.error("Invalid credentials", {
        description: "Use one of the demo accounts with any password of 4+ characters.",
      });
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            SR
          </span>
          <span className="font-medium">Srota Traders</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-medium leading-tight tracking-tight">
            Inventory, stock movement and IRD billing — in one place.
          </h1>
          <p className="mt-4 text-sm text-ink-foreground/70">
            Multi-branch stock, variant-level tracking, party ledgers, VAT and PAN invoicing, and a
            fast counter POS. Built for Bikram Sambat.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
            {[
              ["3", "Branches"],
              ["BS/AD", "Date systems"],
              ["13%", "VAT ready"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="num text-xl font-medium text-primary">{v}</p>
                <p className="text-xs text-ink-foreground/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-foreground/40">Prototype with sample data</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Boxes className="h-5 w-5 text-primary" />
            <span className="font-medium">Srota Traders</span>
          </div>
          <h2 className="text-xl font-medium">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts are created by the owner. There is no self-registration.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              <LockKeyhole className="mr-2 h-4 w-4" /> Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo accounts (any password)
            </p>
            <div className="space-y-1">
              {app.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setUsername(u.username);
                    setPassword("demo1234");
                  }}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <span className="num">{u.username}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
