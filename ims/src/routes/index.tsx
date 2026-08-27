import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-store";
import { LockKeyhole } from "lucide-react";
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (app.currentUser) void navigate({ to: "/dashboard", replace: true });
  }, [app.currentUser, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await app.login(username, password);
      if (ok) {
        void navigate({ to: "/dashboard", replace: true });
      } else {
        toast.error("Invalid credentials", {
          description: "Check your username and password and try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground lg:flex">
        <img src="/white.png" alt="Srota" className="h-14 w-auto self-start" />
        <div className="max-w-md">
          <h1 className="text-3xl font-medium leading-tight tracking-tight">
            Inventory, stock movement and IRD billing — in one place.
          </h1>
          <p className="mt-4 text-sm text-ink-foreground/70">
            Multi-branch stock, variant-level tracking, party ledgers, VAT and PAN invoicing, and a
            fast counter POS. Built for Bikram Sambat.
          </p>
        </div>
        <p className="text-xs text-ink-foreground/40">Source of Solutions</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/srota-ims-logo.png" alt="Srota IMS" className="h-8 w-auto" />
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
            <Button type="submit" className="w-full" disabled={submitting}>
              <LockKeyhole className="mr-2 h-4 w-4" /> {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
