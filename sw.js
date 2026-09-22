// Offline cache for the app shell. Network first, so a new deploy shows up on
// the next open without bumping VERSION; the cache is the fallback when the
// network is down or slow. Bump VERSION only to clear out old caches.
const VERSION = "cellar-v5";
const SHELL = ["./", "index.html", "app.js", "styles.css", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png"];
const SLOW_MS = 3000; // after this, serve the cached copy if we have one

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never cache API calls
  e.respondWith(networkFirst(e.request));
});

function networkFirst(req) {
  const network = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  });
  const cached = caches.match(req).then((hit) =>
    hit || (req.mode === "navigate" ? caches.match("./") : undefined));
  const slow = new Promise((r) => setTimeout(r, SLOW_MS))
    .then(() => cached).then((hit) => hit || network);
  return Promise.race([network, slow])
    .catch(() => cached.then((hit) => hit || Response.error()));
}
