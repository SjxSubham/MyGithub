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
    requireInteraction: false,
    silent: false,
    tag: notificationData.tag || "default",
    renotify: true,
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
    self.registration
      .showNotification(notificationData.title, options)
      .then(() => {
        // Play notification sound by messaging all clients
        return self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
      })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: "play-notification-sound",
            data: notificationData.data,
          });
        });
      }),
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
    event.waitUntil(
      self.registration
        .showNotification(title, options)
        .then(() => {
          // Notify clients to play sound
          return self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });
        })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "play-notification-sound",
              data: options.data || {},
            });
          });
        }),
    );
  }

  // Handle sync request from client
  if (event.data && event.data.type === "SYNC_MESSAGES") {
    event.waitUntil(
      syncPendingMessages()
        .then(() => {
          // Notify client that sync is complete
          event.source.postMessage({
            type: "sync-complete",
            success: true,
          });
        })
        .catch((error) => {
          event.source.postMessage({
            type: "sync-complete",
            success: false,
            error: error.message,
          });
        }),
    );
  }

  // Handle fetch new messages request
  if (event.data && event.data.type === "FETCH_NEW_MESSAGES") {
    const { conversationId } = event.data;
    event.waitUntil(
      fetchNewMessages(conversationId)
        .then((messages) => {
          event.source.postMessage({
            type: "new-messages-fetched",
            conversationId,
            messages,
          });
        })
        .catch((error) => {
          console.error("[Service Worker] Error fetching new messages:", error);
        }),
    );
  }
});

// Background sync for sending messages when offline (future enhancement)
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background sync:", event.tag);

  if (event.tag === "sync-messages") {
    event.waitUntil(
      syncPendingMessages()
        .then(() => {
          console.log("[Service Worker] Messages synced successfully");
          // Notify all clients about successful sync
          return self.clients.matchAll({ type: "window" });
        })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "messages-synced",
              success: true,
            });
          });
        })
        .catch((error) => {
          console.error("[Service Worker] Sync failed:", error);
        }),
    );
  }

  if (event.tag === "fetch-new-messages") {
    event.waitUntil(
      fetchAllNewMessages()
        .then(() => {
          // Notify clients about new messages
          return self.clients.matchAll({ type: "window" });
        })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: "new-messages-available",
              success: true,
            });
          });
        }),
    );
  }
});

// Function to sync pending messages
async function syncPendingMessages() {
  try {
    // Open IndexedDB to get pending messages
    const db = await openDatabase();
    const pendingMessages = await getPendingMessages(db);

    if (pendingMessages.length === 0) {
      console.log("[Service Worker] No pending messages to sync");
      return Promise.resolve();
    }

    console.log(
      `[Service Worker] Syncing ${pendingMessages.length} pending messages...`,
    );

    // Send each pending message
    const syncPromises = pendingMessages.map(async (msg) => {
      try {
        const response = await fetch("/api/chat/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(msg.data),
        });

        if (response.ok) {
          // Remove from pending queue
          await removePendingMessage(db, msg.id);
          return { success: true, id: msg.id };
        } else {
          return { success: false, id: msg.id };
        }
      } catch (error) {
        console.error("[Service Worker] Failed to sync message:", error);
        return { success: false, id: msg.id, error };
      }
    });

    await Promise.all(syncPromises);
    return Promise.resolve();
  } catch (error) {
    console.error("[Service Worker] Sync failed:", error);
    return Promise.reject(error);
  }
}

// Function to fetch new messages for a conversation
async function fetchNewMessages(conversationId) {
  try {
    const response = await fetch(`/api/chat/messages/${conversationId}`, {
      credentials: "include",
    });

    if (response.ok) {
      const messages = await response.json();
      return messages;
    } else {
      throw new Error("Failed to fetch messages");
    }
  } catch (error) {
    console.error("[Service Worker] Error fetching messages:", error);
    throw error;
  }
}

// Function to fetch all new messages when coming back online
async function fetchAllNewMessages() {
  try {
    const response = await fetch("/api/chat/conversations", {
      credentials: "include",
    });

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error("Failed to fetch conversations");
    }
  } catch (error) {
    console.error("[Service Worker] Error fetching all messages:", error);
    throw error;
  }
}

// IndexedDB helper functions
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ChatDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pendingMessages")) {
        db.createObjectStore("pendingMessages", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pendingMessages"], "readonly");
    const store = transaction.objectStore("pendingMessages");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["pendingMessages"], "readwrite");
    const store = transaction.objectStore("pendingMessages");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
