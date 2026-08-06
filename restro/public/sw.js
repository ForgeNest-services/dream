// Minimal service worker — satisfies Chrome/Edge's PWA install criteria
// (must have a fetch handler) without adding offline caching yet.
// Extend later with a caching strategy when the app is ready for offline.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough: hand every request straight to the network.
  event.respondWith(fetch(event.request));
});
