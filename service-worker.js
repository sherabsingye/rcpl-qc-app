const CACHE = "rcpl-qc-v2";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/main.js",
  "./js/auth.js",
  "./js/firebase-config.js",
  "./js/job-card.js",
  "./js/qc.js",
  "./js/dispatch.js",
  "./js/handover.js",
  "./js/tracker.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Let Firebase / Firestore handle its own offline cache.
  if (
    url.host.includes("firestore.googleapis.com") ||
    url.host.includes("firebaseio.com") ||
    url.host.includes("googleapis.com") ||
    url.host.includes("gstatic.com")
  ) {
    return; // default network handling; Firestore SDK has its own persistence
  }

  // Same-origin: cache-first with network fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((resp) => {
            if (resp && resp.status === 200 && event.request.method === "GET") {
              const clone = resp.clone();
              caches.open(CACHE).then((c) => c.put(event.request, clone));
            }
            return resp;
          })
          .catch(() => caches.match("./index.html"));
      })
    );
  }
});
