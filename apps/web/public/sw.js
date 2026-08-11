/**
 * Minimal service worker — registered only so the app is installable.
 *
 * There is deliberately no `fetch` handler. A passthrough
 * `event.respondWith(fetch(event.request))` looks harmless but is not: it
 * disables navigation preload, puts a worker hop in front of every asset, and
 * takes range and streaming responses off the browser's own fast path — all
 * for no caching benefit whatsoever. A worker with no fetch listener lets the
 * network go straight through.
 *
 * Real offline support means precaching the app shell and choosing a strategy
 * per route; that is its own piece of work, not a one-liner here.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
