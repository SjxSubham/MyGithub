// IndexedDB utility for offline message storage and synchronization

const DB_NAME = "ChatDB";
const DB_VERSION = 1;
const PENDING_MESSAGES_STORE = "pendingMessages";
const CACHED_MESSAGES_STORE = "cachedMessages";
const CONVERSATIONS_STORE = "conversations";

class IndexedDBManager {
  constructor() {
    this.db = null;
  }

  /**
   * Open IndexedDB database
   */
  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB opened successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create pending messages store
        if (!db.objectStoreNames.contains(PENDING_MESSAGES_STORE)) {
          const pendingStore = db.createObjectStore(PENDING_MESSAGES_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          pendingStore.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          pendingStore.createIndex("timestamp", "timestamp", {
            unique: false,
          });
        }

        // Create cached messages store
        if (!db.objectStoreNames.contains(CACHED_MESSAGES_STORE)) {
          const cachedStore = db.createObjectStore(CACHED_MESSAGES_STORE, {
            keyPath: "_id",
          });
          cachedStore.createIndex("conversationId", "conversationId", {
            unique: false,
          });
          cachedStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // Create conversations store
        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          const conversationsStore = db.createObjectStore(CONVERSATIONS_STORE, {
            keyPath: "_id",
          });
          conversationsStore.createIndex("lastMessageTime", "lastMessageTime", {
            unique: false,
          });
        }

        console.log("IndexedDB upgraded to version", DB_VERSION);
      };
    });
  }

  /**
   * Ensure database is open
   */
  async ensureDatabase() {
    if (!this.db) {
      await this.openDatabase();
    }
    return this.db;
  }

  /**
   * Add a pending message (to be sent when online)
   */
  async addPendingMessage(messageData) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [PENDING_MESSAGES_STORE],
        "readwrite",
      );
      const store = transaction.objectStore(PENDING_MESSAGES_STORE);

      const pendingMessage = {
        data: messageData,
        timestamp: new Date().toISOString(),
        conversationId: messageData.conversationId,
      };

      const request = store.add(pendingMessage);

      request.onsuccess = () => {
        console.log("Pending message added:", request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("Error adding pending message:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending messages
   */
  async getPendingMessages() {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_MESSAGES_STORE], "readonly");
      const store = transaction.objectStore(PENDING_MESSAGES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get pending messages for a specific conversation
   */
  async getPendingMessagesByConversation(conversationId) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_MESSAGES_STORE], "readonly");
      const store = transaction.objectStore(PENDING_MESSAGES_STORE);
      const index = store.index("conversationId");
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Remove a pending message
   */
  async removePendingMessage(id) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [PENDING_MESSAGES_STORE],
        "readwrite",
      );
      const store = transaction.objectStore(PENDING_MESSAGES_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("Pending message removed:", id);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all pending messages
   */
  async clearPendingMessages() {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [PENDING_MESSAGES_STORE],
        "readwrite",
      );
      const store = transaction.objectStore(PENDING_MESSAGES_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log("All pending messages cleared");
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Cache messages for offline viewing
   */
  async cacheMessages(messages) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHED_MESSAGES_STORE], "readwrite");
      const store = transaction.objectStore(CACHED_MESSAGES_STORE);

      let count = 0;
      messages.forEach((message) => {
        const request = store.put(message);
        request.onsuccess = () => {
          count++;
          if (count === messages.length) {
            console.log(`Cached ${count} messages`);
            resolve(count);
          }
        };
      });

      if (messages.length === 0) {
        resolve(0);
      }

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get cached messages for a conversation
   */
  async getCachedMessages(conversationId) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHED_MESSAGES_STORE], "readonly");
      const store = transaction.objectStore(CACHED_MESSAGES_STORE);
      const index = store.index("conversationId");
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Cache conversations
   */
  async cacheConversations(conversations) {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], "readwrite");
      const store = transaction.objectStore(CONVERSATIONS_STORE);

      let count = 0;
      conversations.forEach((conversation) => {
        const request = store.put(conversation);
        request.onsuccess = () => {
          count++;
          if (count === conversations.length) {
            console.log(`Cached ${count} conversations`);
            resolve(count);
          }
        };
      });

      if (conversations.length === 0) {
        resolve(0);
      }

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get cached conversations
   */
  async getCachedConversations() {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE], "readonly");
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [CACHED_MESSAGES_STORE, CONVERSATIONS_STORE],
        "readwrite",
      );

      const messagesStore = transaction.objectStore(CACHED_MESSAGES_STORE);
      const conversationsStore = transaction.objectStore(CONVERSATIONS_STORE);

      messagesStore.clear();
      conversationsStore.clear();

      transaction.oncomplete = () => {
        console.log("Cache cleared");
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Close database connection
   */
  closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("IndexedDB closed");
    }
  }
}

// Create singleton instance
const indexedDBManager = new IndexedDBManager();

export default indexedDBManager;
