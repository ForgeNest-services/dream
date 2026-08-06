import { useState } from "react";
import { LogIn, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePos } from "@/lib/pos/store";

export function LoginScreen() {
  const { login } = usePos();
  const [username, setUsername] = useState("suman");
  const [password, setPassword] = useState("demo1234");

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-8" />
          </div>
          <h1 className="font-display text-3xl text-navy-foreground">Restro POS</h1>
          <p className="mt-1 text-sm font-medium tracking-wide text-navy-foreground/60">
            Restaurant Point of Sale
          </p>
        </div>

        <form
          className="rounded-2xl bg-card p-6 shadow-[var(--shadow-pop)] sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            login(username.trim() || "staff");
          }}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="h-14 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-14 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 w-full text-base font-medium">
              <LogIn className="size-5" />
              Sign in
            </Button>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Demo build — any credentials work. Switch roles from the header after sign in.
          </p>
        </form>
      </div>
    </div>
  );
}
