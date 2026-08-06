// Captures the browser's `beforeinstallprompt` event at page-load time so
// components that mount later (e.g. after login) can still open the install
// prompt. Chrome fires this event once — miss it and it's gone until reload.

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    installed = true;
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): InstallPrompt | null {
  return deferred;
}

export function isInstalled(): boolean {
  return installed;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function consumeInstallPrompt(): InstallPrompt | null {
  const current = deferred;
  deferred = null;
  notify();
  return current;
}
