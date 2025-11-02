// Notification Service for Browser and PWA notifications

class NotificationService {
  constructor() {
    this.permission = Notification.permission;
    this.isSupported = "Notification" in window;
    this.serviceWorkerRegistration = null;
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported() {
    return this.isSupported;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn("Notifications are not supported in this browser");
      return false;
    }

    if (this.permission === "granted") {
      return true;
    }

    if (this.permission === "denied") {
      console.warn("Notification permission was denied");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === "granted") {
        console.log("Notification permission granted");
        return true;
      } else {
        console.warn("Notification permission denied");
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }

  /**
   * Check current permission status
   */
  hasPermission() {
    return this.permission === "granted";
  }

  /**
   * Set service worker registration for PWA notifications
   */
  setServiceWorkerRegistration(registration) {
    this.serviceWorkerRegistration = registration;
  }

  /**
   * Show a notification (works in both browser and PWA)
   */
  async showNotification(title, options = {}) {
    if (!this.hasPermission()) {
      console.warn("Cannot show notification: permission not granted");
      return null;
    }

    const defaultOptions = {
      badge: "/logo.png",
      icon: "/logo.png",
      vibrate: [200, 100, 200],
      requireInteraction: false,
      ...options,
    };

    try {
      // If service worker is available (PWA mode), use it for better persistence
      if (this.serviceWorkerRegistration) {
        return await this.serviceWorkerRegistration.showNotification(
          title,
          defaultOptions,
        );
      } else {
        // Fallback to regular browser notification
        return new Notification(title, defaultOptions);
      }
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }

  /**
   * Show notification for new message
   */
  async showMessageNotification(messageData) {
    const { sender, message, conversationId, senderAvatar } = messageData;

    const options = {
      body: this.truncateMessage(message),
      icon: senderAvatar || "/logo.png",
      badge: "/logo.png",
      tag: `message-${conversationId}`, // Prevents duplicate notifications
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        type: "message",
        conversationId,
        sender,
        url: `/chat?conversation=${conversationId}`,
      },
      actions: [
        {
          action: "reply",
          title: "Reply",
        },
        {
          action: "view",
          title: "View",
        },
      ],
    };

    return await this.showNotification(`New message from ${sender}`, options);
  }

  /**
   * Show notification for multiple new messages
   */
  async showMultipleMessagesNotification(count, latestSender) {
    const options = {
      body: `You have ${count} new messages`,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "multiple-messages",
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        type: "multiple-messages",
        count,
        url: "/chat",
      },
      actions: [
        {
          action: "view",
          title: "View All",
        },
      ],
    };

    return await this.showNotification(
      latestSender ? `${latestSender} and others` : "New Messages",
      options,
    );
  }

  /**
   * Truncate long messages for notification display
   */
  truncateMessage(message, maxLength = 100) {
    if (!message) return "";

    // Remove image/file indicators
    if (message.startsWith("[Image]") || message.startsWith("[File]")) {
      return message;
    }

    if (message.length <= maxLength) {
      return message;
    }

    return message.substring(0, maxLength) + "...";
  }

  /**
   * Close all notifications with a specific tag
   */
  async closeNotificationsByTag(tag) {
    if (!this.serviceWorkerRegistration) return;

    try {
      const notifications =
        await this.serviceWorkerRegistration.getNotifications({
          tag,
        });

      notifications.forEach((notification) => notification.close());
    } catch (error) {
      console.error("Error closing notifications:", error);
    }
  }

  /**
   * Close all notifications
   */
  async closeAllNotifications() {
    if (!this.serviceWorkerRegistration) return;

    try {
      const notifications =
        await this.serviceWorkerRegistration.getNotifications();
      notifications.forEach((notification) => notification.close());
    } catch (error) {
      console.error("Error closing all notifications:", error);
    }
  }

  /**
   * Play notification sound (optional)
   */
  playNotificationSound() {
    try {
      // Try to play notification sound
      const audio = new Audio("/notification-sound.mp3");
      audio.volume = 0.7;

      // Fallback to data URL sound if file not found
      audio.onerror = () => {
        console.warn("Notification sound file not found, using fallback");
        this.playFallbackSound();
      };

      audio.play().catch((error) => {
        console.warn("Could not play notification sound:", error);
        // Try fallback sound
        this.playFallbackSound();
      });

      // Also vibrate on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (error) {
      console.warn("Notification sound not available:", error);
      this.playFallbackSound();
    }
  }

  /**
   * Play fallback notification sound using Web Audio API
   */
  playFallbackSound() {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn("Could not play fallback sound:", error);
    }
  }

  /**
   * Check if document is hidden (user not viewing the tab)
   */
  isDocumentHidden() {
    return document.hidden || document.visibilityState === "hidden";
  }

  /**
   * Should show notification based on various conditions
   */
  shouldShowNotification(options = {}) {
    const { onlyWhenHidden = true, checkPermission = true } = options;

    // Check if notifications are supported
    if (!this.isSupported) {
      return false;
    }

    // Check if we have permission
    if (checkPermission && !this.hasPermission()) {
      return false;
    }

    // Check if we should only show when document is hidden
    if (onlyWhenHidden && !this.isDocumentHidden()) {
      return false;
    }

    return true;
  }

  /**
   * Handle notification click (setup in service worker)
   */
  setupNotificationClickHandler(callback) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "notification-click") {
          callback(event.data);
        }
      });
    }
  }
}

// Create and export a singleton instance
const notificationService = new NotificationService();

export default notificationService;
