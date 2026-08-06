import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  consumeInstallPrompt,
  getInstallPrompt,
  isInstalled,
  subscribe,
} from "@/lib/install-prompt";

export function InstallAppButton() {
  const [available, setAvailable] = useState<boolean>(() => Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState<boolean>(() => isInstalled());

  useEffect(() => {
    setAvailable(Boolean(getInstallPrompt()));
    setInstalled(isInstalled());
    return subscribe(() => {
      setAvailable(Boolean(getInstallPrompt()));
      setInstalled(isInstalled());
    });
  }, []);

  if (installed || !available) return null;

  return (
    <Button
      variant="ghost"
      className="h-11 gap-2 rounded-xl bg-primary px-3 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      onClick={async () => {
        const prompt = consumeInstallPrompt();
        if (!prompt) return;
        await prompt.prompt();
        await prompt.userChoice;
      }}
    >
      <Download className="size-4" />
      <span className="hidden text-sm sm:inline">Install app</span>
    </Button>
  );
}
