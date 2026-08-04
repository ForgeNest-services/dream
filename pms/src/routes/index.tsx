import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Hotel, Lock, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp, PRODUCT_NAME } from "@/lib/app-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Dream PMS" },
      {
        name: "description",
        content:
          "Secure staff sign-in for Dream PMS, the property management system for hotels: bookings, folios, invoices and reporting.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, authed, isBootstrapping } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isBootstrapping && authed) {
      navigate({ to: "/dashboard" });
    }
  }, [authed, isBootstrapping, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Enter your username and password to continue.");
      return;
    }
    setIsSubmitting(true);
    const result = await login({ username: username.trim(), password });
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.message || "Incorrect username or password.");
      return;
    }
    toast.success("Signed in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Hotel className="size-5" />
          </span>
          <span className="font-display text-2xl font-semibold leading-none">{PRODUCT_NAME}</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-5xl leading-[1.05]">
            Run the whole property from one calm dashboard.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-primary-foreground/70">
            Front desk, housekeeping, folios, VAT invoices and owner reporting — unified across every
            property you manage.
          </p>
        </div>
        <div className="flex gap-10">
          {[
            ["36", "Rooms managed"],
            ["1.2k", "Stays this year"],
            ["99.9%", "Uptime"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-display text-3xl text-accent">{v}</p>
              <p className="text-xs uppercase tracking-widest text-primary-foreground/60">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Hotel className="size-6" />
            </span>
            <h2 className="mt-4 text-3xl leading-none">Staff sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the login your owner shared with you.
            </p>
          </div>

          <form className="surface space-y-5 p-6 sm:p-8" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  placeholder="e.g. manager-sunset"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Forgot the password? Ask your owner to reset it.
          </p>
        </div>
      </div>
    </div>
  );
}
