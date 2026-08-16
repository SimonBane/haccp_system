/** No fetch handler: a passthrough SW is worse than none (disables navigation preload, hops every asset). */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
