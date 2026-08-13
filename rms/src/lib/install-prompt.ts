// Captures the browser's `beforeinstallprompt` event at page-load time so
// components that mount later (e.g. after login) can still open the install
// prompt. Chrome fires this event once — miss it and it's gone until reload.

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KEY_INSTALLED = "zestro_pwa_installed_v1";

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    // Remember across sessions that this device has installed the PWA — the
    // browser never re-fires beforeinstallprompt once installed, so this flag
    // is how we know to show "Open app" instead of "Get app" next time.
    try {
      localStorage.setItem(KEY_INSTALLED, "1");
    } catch {
      /* private-mode etc. */
    }
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): InstallPrompt | null {
  return deferred;
}

// True whenever the page is running as the installed PWA (any PWA display
// mode, including iOS Safari's navigator.standalone). Fresh check each call.
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia;
  if (
    mq("(display-mode: standalone)").matches ||
    mq("(display-mode: fullscreen)").matches ||
    mq("(display-mode: minimal-ui)").matches ||
    mq("(display-mode: window-controls-overlay)").matches
  ) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

// Best-effort: has the user ever installed the PWA on THIS browser profile?
export function isLikelyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY_INSTALLED) === "1";
  } catch {
    return false;
  }
}

// Attempt to open the URL in the installed PWA window rather than a browser
// tab. Chrome routes new-tab opens into an installed PWA *only* when the user
// has enabled "Open supported links in the app" for that PWA. If they haven't,
// this just opens a new browser tab.
export function openInPwa(url: string = window.location.href): void {
  window.open(url, "_blank", "noopener");
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
    return { title: "Install Srota RMS", steps: ["Use your browser's Install menu."] };
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
        "Choose \"Apps\" → \"Install Srota RMS\".",
      ],
    };
  }
  return {
    title: "Install Srota RMS",
    steps: [
      "Click the install icon on the right of the address bar,",
      "or open the browser menu and choose \"Install Srota RMS\".",
    ],
  };
}
