// public/sw.js

self.addEventListener("push", function (event) {
    if (!event.data) return;
  
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "You have a new update!",
        icon: data.icon || "/icons/icon-192x192.png", // Path to your PWA icon
        badge: data.badge || "/icons/icon-96x96.png",
        data: data.data || {},
      };
  
      event.waitUntil(
        self.registration.showNotification(data.title || "Notification", options)
      );
    } catch (error) {
      // Fallback if payload isn't clean JSON
      event.waitUntil(
        self.registration.showNotification("New Message", {
          body: event.data.text(),
        })
      );
    }
  });
  
  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    
    // Custom click handling: Open home page or a deep link
    const targetUrl = event.notification.data?.url || "/";
    
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  });