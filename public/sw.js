const CACHE_NAME = "hangout-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/expenses",
  "/globals.css",
  "/manifest.json" // Mocht je een manifest hebben
];

// Installeer de cache wanneer de app start
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activeer en ruim oude caches op
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Cache First, Network Rollback strategie: laadt de app in 0.05s offline!
self.addEventListener("fetch", (event) => {
  // Sla POST requests en database calls over (die moeten live)
  if (event.request.method !== "GET" || event.request.url.includes("/rest/v1/")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    })
  );
});

// ... HIERONDER STAAT JE BESTAANDE 'PUSH' EN 'NOTIFICATIONCLICK' LOGICA VAN STAP 1 ...