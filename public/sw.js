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