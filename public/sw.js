
const CACHE_NAME = "hangout-cache-v2";

// We cachen de core layout en Next.js build assets dynamisch zodra ze ingeladen worden
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

// Stale-While-Revalidate: Start app binnen 0.05s met cache, ververs op de achtergrond
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/rest/v1/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse); // Offline fallback

        return cachedResponse || fetchedResponse;
      });
    })
  );
});

// Periodic Background Sync: Update data geruisloos (Bespaart free-tier database requests!)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sync-expenses") {
    event.waitUntil(
      fetch("/api/sync-cache-background").catch((err) => console.log("Background sync failed", err))
    );
  }
});

// ... HIER STAAT JE BESTAANDE WEB-PUSH NOTIFICATIE LOGICA VAN DE API ROUTE ...

self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : { title: "Nieuwe update", body: "Er is iets gebeurd!" };
    
    const options = {
      body: data.body,
      icon: "/path/to/icon-192x192.png", 
      badge: "/path/to/icon-192x192.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/" }
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });
  
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  });