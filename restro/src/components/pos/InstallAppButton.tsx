import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  consumeInstallPrompt,
  getInstallPrompt,
  isRunningStandalone,
  manualInstallHint,
  subscribe,
} from "@/lib/install-prompt";

export function InstallAppButton() {
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => Boolean(getInstallPrompt()));
  const [standalone] = useState<boolean>(() => isRunningStandalone());

  useEffect(() => {
    setHasPrompt(Boolean(getInstallPrompt()));
    return subscribe(() => {
      setHasPrompt(Boolean(getInstallPrompt()));
    });
  }, []);

  // Already inside the installed PWA — don't offer to install again.
  if (standalone) return null;

  const handleClick = async () => {
    const prompt = consumeInstallPrompt();
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      return;
    }
    // No native prompt available (already installed, unsupported browser, or
    // criteria not met yet). Show manual install instructions.
    const hint = manualInstallHint();
    toast.message(hint.title, {
      description: hint.steps.join(" "),
      duration: 8000,
    });
  };

  return (
    <Button
      variant="ghost"
      className="h-11 gap-2 rounded-xl bg-primary px-3 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      onClick={handleClick}
    >
      <Download className="size-4" />
      <span className="hidden text-sm sm:inline">
        {hasPrompt ? "Install app" : "Get app"}
      </span>
    </Button>
  );
}
