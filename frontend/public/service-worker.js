// Service Worker for PWA Notifications and Offline Support
/* global clients */

const CACHE_NAME = "mygithub-v1";
const urlsToCache = ["/", "/index.html", "/logo.png", "/offline.html"];

// Install event - cache essential resources
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Caching app shell");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("[Service Worker] Cache failed:", error);
      }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest)
        .then((response) => {
          // Check if valid response
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // If fetch fails, return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    }),
  );
});

// Listen for push notifications (for future push notification support)
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push notification received");

  let notificationData = {
    title: "New Notification",
    body: "You have a new message",
    icon: "/logo.png",
    badge: "/logo.png",
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      console.error("[Service Worker] Error parsing push data:", error);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || "/logo.png",
    badge: notificationData.badge || "/logo.png",
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: notificationData.actions || [
      {
        action: "view",
        title: "View",
      },
      {
        action: "close",
        title: "Close",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options),
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked:", event.action);

  event.notification.close();

  const notificationData = event.notification.data;
  let urlToOpen = "/";

  // Determine URL based on notification data
  if (notificationData && notificationData.url) {
    urlToOpen = notificationData.url;
  } else if (notificationData && notificationData.conversationId) {
    urlToOpen = `/chat?conversation=${notificationData.conversationId}`;
  } else if (notificationData && notificationData.type === "message") {
    urlToOpen = "/chat";
  }

  // Handle different actions
  if (event.action === "close") {
    return;
  }

  if (event.action === "reply") {
    // Open chat with reply focus (future enhancement)
    urlToOpen += "&action=reply";
  }

  // Open or focus the app window
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // Send message to the client to navigate
            client.postMessage({
              type: "notification-click",
              url: urlToOpen,
              data: notificationData,
            });
            return client.focus();
          }
        }

        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[Service Worker] Notification closed:", event.notification.tag);

  // Track notification dismissal (optional analytics)
  const notificationData = event.notification.data;

  if (notificationData) {
    // You can send analytics or tracking data here
    console.log("[Service Worker] Notification dismissed:", notificationData);
  }
});

// Handle messages from the main app
self.addEventListener("message", (event) => {
  console.log("[Service Worker] Message received:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log("[Service Worker] Cache cleared");
      }),
    );
  }

  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Background sync for sending messages when offline (future enhancement)
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background sync:", event.tag);

  if (event.tag === "sync-messages") {
    event.waitUntil(
      // Sync pending messages
      syncPendingMessages(),
    );
  }
});

async function syncPendingMessages() {
  try {
    // Retrieve pending messages from IndexedDB or cache
    // Send them to the server
    // This is a placeholder for future implementation
    console.log("[Service Worker] Syncing pending messages...");
    return Promise.resolve();
  } catch (error) {
    console.error("[Service Worker] Sync failed:", error);
    return Promise.reject(error);
  }
}
