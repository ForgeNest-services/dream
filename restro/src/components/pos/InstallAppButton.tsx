import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  consumeInstallPrompt,
  getInstallPrompt,
  isLikelyInstalled,
  isRunningStandalone,
  manualInstallHint,
  openInPwa,
  subscribe,
} from "@/lib/install-prompt";

type Mode = "install" | "open" | "manual";

export function InstallAppButton() {
  const [standalone, setStandalone] = useState<boolean>(() => isRunningStandalone());
  const [mode, setMode] = useState<Mode>(() => resolveMode());

  useEffect(() => {
    // Recompute on mount + whenever the prompt state changes.
    setStandalone(isRunningStandalone());
    setMode(resolveMode());
    return subscribe(() => {
      setStandalone(isRunningStandalone());
      setMode(resolveMode());
    });
  }, []);

  // Never show inside the installed PWA — we're already in the app.
  if (standalone) return null;

  const handleClick = async () => {
    if (mode === "install") {
      const prompt = consumeInstallPrompt();
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    if (mode === "open") {
      openInPwa();
      // We don't know for sure if the browser routed the open into the PWA or
      // a new tab (depends on Chrome's per-app "Open supported links in the
      // app" setting). Nudge the user how to enable it if it didn't work.
      toast.message("Opening Zestro…", {
        description:
          "Nothing happened? In Chrome, open chrome://apps, right-click Zestro, and enable \"Open supported links in the app\".",
        duration: 8000,
      });
      return;
    }
    // Manual fallback for Safari/Firefox/etc.
    const hint = manualInstallHint();
    toast.message(hint.title, {
      description: hint.steps.join(" "),
      duration: 8000,
    });
  };

  const label = mode === "open" ? "Open app" : mode === "install" ? "Install app" : "Get app";
  const Icon = mode === "open" ? ExternalLink : Download;

  return (
    <Button
      variant="ghost"
      className="h-11 gap-2 rounded-xl bg-primary px-3 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      onClick={handleClick}
    >
      <Icon className="size-4" />
      <span className="hidden text-sm sm:inline">{label}</span>
    </Button>
  );
}

function resolveMode(): Mode {
  if (getInstallPrompt()) return "install";
  if (isLikelyInstalled()) return "open";
  return "manual";
}
