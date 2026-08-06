// Captures the browser's `beforeinstallprompt` event at page-load time so
// components that mount later (e.g. after login) can still open the install
// prompt. Chrome fires this event once — miss it and it's gone until reload.

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPrompt | null = null;
let runningStandalone = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    runningStandalone = true;
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    // Note: appinstalled means the user *installed* the PWA from THIS tab.
    // It does NOT mean this tab is now the standalone window.
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): InstallPrompt | null {
  return deferred;
}

export function isRunningStandalone(): boolean {
  return runningStandalone;
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

// Rough browser detection for tailoring the "install manually" instructions
// shown when no native beforeinstallprompt event is available.
export type ManualInstallHint = {
  title: string;
  steps: string[];
};

export function manualInstallHint(): ManualInstallHint {
  if (typeof navigator === "undefined") {
    return { title: "Install Zestro", steps: ["Use your browser's Install menu."] };
  }
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isEdge = /edg/i.test(ua);

  if (isIOS && isSafari) {
    return {
      title: "Install on iOS",
      steps: [
        "Tap the Share button in Safari.",
        "Choose \"Add to Home Screen\".",
        "Tap Add.",
      ],
    };
  }
  if (isFirefox) {
    return {
      title: "Install with Firefox",
      steps: [
        "Firefox on desktop doesn't support installing this app.",
        "Try Chrome, Edge or Brave for the full install experience.",
      ],
    };
  }
  if (isEdge) {
    return {
      title: "Install with Edge",
      steps: [
        "Click the menu (…) in the top-right corner.",
        "Choose \"Apps\" → \"Install Zestro\".",
      ],
    };
  }
  return {
    title: "Install Zestro",
    steps: [
      "Click the install icon on the right of the address bar,",
      "or open the browser menu and choose \"Install Zestro\".",
    ],
  };
}
