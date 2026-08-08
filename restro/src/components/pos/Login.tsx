import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePos } from "@/lib/pos/store";

export function LoginScreen() {
  const { login } = usePos();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(username.trim(), password);
    setIsSubmitting(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Zestro"
            className="mb-4 h-24 w-auto sm:h-28"
          />
          <p className="text-sm font-medium tracking-wide text-navy-foreground/60">
            Restaurant Point of Sale
          </p>
        </div>

        <form
          className="rounded-2xl bg-card p-6 shadow-(--shadow-pop) sm:p-8"
          onSubmit={handleSubmit}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full text-base font-medium"
              disabled={isSubmitting || !username.trim() || !password}
            >
              <LogIn className="size-5" />
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
