// Hand-written service worker — vite-plugin-pwa was tried first but its
// generateSW step never runs under TanStack Start's Vite multi-environment
// build (confirmed via upstream GitHub issues on vite-pwa/vite-plugin-pwa;
// no supported fix exists as of this app's Vite/TanStack Start versions).
// This file is a plain static asset in public/, copied through untouched
// to dist/client and served directly by nginx (see nginx.conf) — no
// build-time precache manifest, just enough to satisfy Chrome's PWA
// installability check (an active SW with a fetch handler) and give a
// small real caching benefit for the app shell.
//
// Bump this on every deploy that changes cached files, so old clients pick
// up the new cache instead of serving stale assets forever.
const CACHE_VERSION = "srota-ims-v1";

const APP_SHELL = [
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/srota-ims-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first for the small fixed app-shell list above (rarely changes,
// safe to serve stale-then-revalidate-in-background); network-first for
// everything else (hashed JS/CSS bundles, API calls, SSR HTML) so a fresh
// deploy is never masked by a stale cache. API requests are never cached.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
