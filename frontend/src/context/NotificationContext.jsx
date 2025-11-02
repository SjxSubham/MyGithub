import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import notificationService from "../services/notificationService";
import { toast } from "react-hot-toast";

const NotificationContext = createContext();

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider",
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notificationPermission, setNotificationPermission] = useState(
    notificationService.permission,
  );
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingNotifications, setPendingNotifications] = useState([]);

  // Initialize notification permission on mount
  useEffect(() => {
    const checkPermission = () => {
      const permission = Notification.permission;
      setNotificationPermission(permission);
      setIsNotificationEnabled(permission === "granted");
    };

    checkPermission();

    // Listen for permission changes
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "notifications" })
        .then((permissionStatus) => {
          permissionStatus.onchange = () => {
            checkPermission();
          };
        })
        .catch(() => {
          // Permissions API not supported, that's okay
        });
    }

    // Register service worker and set it in notification service
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        notificationService.setServiceWorkerRegistration(registration);
      });
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = async () => {
    try {
      const granted = await notificationService.requestPermission();
      setNotificationPermission(Notification.permission);
      setIsNotificationEnabled(granted);

      if (granted) {
        toast.success("Notifications enabled successfully!");

        // Process any pending notifications
        if (pendingNotifications.length > 0) {
          pendingNotifications.forEach((notification) => {
            showNotification(notification);
          });
          setPendingNotifications([]);
        }
      } else {
        toast.error("Notification permission denied");
      }

      return granted;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      notificationService.playNotificationSound();
    } catch (error) {
      console.warn("Error playing notification sound:", error);
    }
  }, [soundEnabled]);

  // Show notification for new message
  const showMessageNotification = useCallback(
    async (messageData, options = {}) => {
      const {
        showOnlyWhenHidden = true,
        playSound = soundEnabled,
        force = false,
      } = options;

      // Check if we should show notification
      if (
        !force &&
        !notificationService.shouldShowNotification({
          onlyWhenHidden: showOnlyWhenHidden,
        })
      ) {
        // Still play sound even if notification not shown
        if (playSound && !document.hidden) {
          playNotificationSound();
        }
        return;
      }

      // If no permission yet, queue the notification
      if (notificationPermission === "default") {
        setPendingNotifications((prev) => [
          ...prev,
          { type: "message", data: messageData },
        ]);
        // Still play sound
        if (playSound) {
          playNotificationSound();
        }
        return;
      }

      // If permission denied, just play sound
      if (notificationPermission === "denied") {
        if (playSound) {
          playNotificationSound();
        }
        return;
      }

      try {
        await notificationService.showMessageNotification(messageData);

        // Play sound if enabled
        if (playSound) {
          playNotificationSound();
        }

        // Increment unread count
        setUnreadCount((prev) => prev + 1);
      } catch (error) {
        console.error("Error showing message notification:", error);
        // Still try to play sound
        if (playSound) {
          playNotificationSound();
        }
      }
    },
    [notificationPermission, soundEnabled, playNotificationSound],
  );

  // Show notification for multiple messages
  const showMultipleMessagesNotification = useCallback(
    async (count, latestSender, options = {}) => {
      const { showOnlyWhenHidden = true, playSound = soundEnabled } = options;

      if (
        !notificationService.shouldShowNotification({
          onlyWhenHidden: showOnlyWhenHidden,
        })
      ) {
        // Still play sound
        if (playSound) {
          playNotificationSound();
        }
        return;
      }

      try {
        await notificationService.showMultipleMessagesNotification(
          count,
          latestSender,
        );

        if (playSound) {
          playNotificationSound();
        }

        setUnreadCount((prev) => prev + count);
      } catch (error) {
        console.error("Error showing multiple messages notification:", error);
        // Still play sound on error
        if (playSound) {
          playNotificationSound();
        }
      }
    },
    [soundEnabled, playNotificationSound],
  );

  // Generic show notification
  const showNotification = async (notification) => {
    if (notification.type === "message") {
      await showMessageNotification(notification.data);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await notificationService.closeAllNotifications();
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // Clear notifications by tag
  const clearNotificationsByTag = async (tag) => {
    try {
      await notificationService.closeNotificationsByTag(tag);
    } catch (error) {
      console.error("Error clearing notifications by tag:", error);
    }
  };

  // Toggle sound
  const toggleSound = () => {
    setSoundEnabled((prev) => !prev);
    const newState = !soundEnabled;
    localStorage.setItem("notificationSound", JSON.stringify(newState));
    toast.success(
      newState ? "Notification sound enabled" : "Notification sound disabled",
    );
  };

  // Load sound preference from localStorage
  useEffect(() => {
    try {
      const savedSoundPref = localStorage.getItem("notificationSound");
      if (savedSoundPref !== null) {
        setSoundEnabled(JSON.parse(savedSoundPref));
      }
    } catch (error) {
      console.error("Error loading sound preference:", error);
    }
  }, []);

  // Reset unread count when user views the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setUnreadCount(0);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const value = {
    notificationPermission,
    isNotificationEnabled,
    soundEnabled,
    unreadCount,
    requestNotificationPermission,
    showMessageNotification,
    showMultipleMessagesNotification,
    clearAllNotifications,
    clearNotificationsByTag,
    toggleSound,
    playNotificationSound,
    isSupported: notificationService.isNotificationSupported(),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
