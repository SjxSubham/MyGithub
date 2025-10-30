import { useState } from "react";
import { useNotificationContext } from "../context/NotificationContext";
import { toast } from "react-hot-toast";
import { IoMdNotifications, IoMdNotificationsOff } from "react-icons/io";
import { HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { IoClose, IoSettings } from "react-icons/io5";
import { MdInfo } from "react-icons/md";

const NotificationSettings = ({ isOpen, onClose }) => {
  const {
    notificationPermission,
    isNotificationEnabled,
    soundEnabled,
    requestNotificationPermission,
    toggleSound,
    isSupported,
  } = useNotificationContext();

  const [testingNotification, setTestingNotification] = useState(false);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      toast.success(
        "Notifications enabled! You'll now receive message alerts.",
      );
    }
  };

  const handleTestNotification = async () => {
    if (!isNotificationEnabled) {
      toast.error("Please enable notifications first");
      return;
    }

    setTestingNotification(true);
    try {
      const notification = new Notification("Test Notification", {
        body: "This is how your message notifications will appear! 🎉",
        icon: "/logo.png",
        badge: "/logo.png",
        vibrate: [200, 100, 200],
        tag: "test-notification",
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      toast.success("Test notification sent!");
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setTestingNotification(false);
    }
  };

  const getPermissionStatus = () => {
    if (!isSupported) {
      return {
        text: "Not Supported",
        color: "text-gray-500",
        bgColor: "bg-gray-800",
      };
    }

    switch (notificationPermission) {
      case "granted":
        return {
          text: "Enabled",
          color: "text-green-400",
          bgColor: "bg-green-900/30",
        };
      case "denied":
        return {
          text: "Blocked",
          color: "text-red-400",
          bgColor: "bg-red-900/30",
        };
      default:
        return {
          text: "Not Set",
          color: "text-yellow-400",
          bgColor: "bg-yellow-900/30",
        };
    }
  };

  const permissionStatus = getPermissionStatus();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <IoSettings className="text-blue-400 text-xl" />
            <h2 className="text-xl font-semibold text-white">
              Notification Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-800"
          >
            <IoClose className="text-2xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Browser Support Info */}
          {!isSupported && (
            <div className="flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <MdInfo className="text-yellow-400 text-xl flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-200">
                <p className="font-medium mb-1">Notifications Not Supported</p>
                <p className="text-yellow-300/80">
                  Your browser doesn&apos;t support notifications. Please use a
                  modern browser like Chrome, Firefox, or Safari.
                </p>
              </div>
            </div>
          )}

          {/* Permission Status */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Status</label>
            <div
              className={`flex items-center justify-between p-3 rounded-lg ${permissionStatus.bgColor} border border-gray-700`}
            >
              <span className="text-sm text-gray-300">
                Notification Permission
              </span>
              <span className={`text-sm font-medium ${permissionStatus.color}`}>
                {permissionStatus.text}
              </span>
            </div>
          </div>

          {/* Enable/Disable Notifications */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">
              Browser Notifications
            </label>
            {!isNotificationEnabled && notificationPermission !== "denied" ? (
              <button
                onClick={handleEnableNotifications}
                disabled={!isSupported}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg transition-colors font-medium"
              >
                <IoMdNotifications className="text-xl" />
                Enable Notifications
              </button>
            ) : notificationPermission === "denied" ? (
              <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <IoMdNotificationsOff className="text-red-400 text-xl flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-200">
                    <p className="font-medium mb-2">Notifications Blocked</p>
                    <p className="text-red-300/80 mb-2">
                      You&apos;ve blocked notifications for this site. To enable
                      them:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-red-300/80">
                      <li>
                        Click the lock icon in your browser&apos;s address bar
                      </li>
                      <li>
                        Find &quot;Notifications&quot; and change to
                        &quot;Allow&quot;
                      </li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <IoMdNotifications className="text-green-400 text-xl" />
                  <span className="text-sm text-green-200">
                    Notifications are enabled
                  </span>
                </div>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>

          {/* Sound Toggle */}
          {isNotificationEnabled && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Sound</label>
              <button
                onClick={toggleSound}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  soundEnabled
                    ? "bg-blue-900/20 border-blue-700/50 hover:bg-blue-900/30"
                    : "bg-gray-800 border-gray-700 hover:bg-gray-750"
                }`}
              >
                <div className="flex items-center gap-2">
                  {soundEnabled ? (
                    <HiSpeakerWave className="text-blue-400 text-xl" />
                  ) : (
                    <HiSpeakerXMark className="text-gray-400 text-xl" />
                  )}
                  <span className="text-sm text-gray-300">
                    Notification Sound
                  </span>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors ${
                    soundEnabled ? "bg-blue-600" : "bg-gray-600"
                  } relative`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      soundEnabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  ></div>
                </div>
              </button>
            </div>
          )}

          {/* Test Notification */}
          {isNotificationEnabled && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Test</label>
              <button
                onClick={handleTestNotification}
                disabled={testingNotification}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-wait text-white py-3 px-4 rounded-lg transition-colors border border-gray-700"
              >
                {testingNotification ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <IoMdNotifications className="text-xl" />
                    Send Test Notification
                  </>
                )}
              </button>
            </div>
          )}

          {/* Info */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <MdInfo className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p>
                Notifications will appear when you receive new messages, even
                when the app is in the background or minimized.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
