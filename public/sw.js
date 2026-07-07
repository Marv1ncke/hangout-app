// public/sw.js

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});


// PUSH ONTVANGEN (werkt ook als PWA gesloten is)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const title = data.title || "Nieuwe melding";

    const options = {
      body: data.body || "Je hebt een nieuwe update.",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-96x96.png",
      data: {
        url: data.data?.url || "/",
        notificationId: data.data?.notificationId || null,
      },
      tag: data.data?.notificationId || "app-notification",
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );

  } catch (error) {

    event.waitUntil(
      self.registration.showNotification("Nieuwe melding", {
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-96x96.png",
      })
    );

  }
});


// KLIK OP NOTIFICATIE
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((windowClients) => {

      for (const client of windowClients) {
        if (
          client.url === targetUrl &&
          "focus" in client
        ) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

    })
  );
});