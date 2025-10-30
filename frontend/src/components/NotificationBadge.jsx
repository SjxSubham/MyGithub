import { useNotificationContext } from "../context/NotificationContext";
import { IoMdNotifications } from "react-icons/io";

const NotificationBadge = ({ onClick, className = "" }) => {
  const { unreadCount, isNotificationEnabled } = useNotificationContext();

  return (
    <button
      onClick={onClick}
      className={`relative ${className}`}
      title={
        isNotificationEnabled
          ? unreadCount > 0
            ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`
            : "Notifications enabled"
          : "Enable notifications"
      }
    >
      <IoMdNotifications
        className={`text-2xl transition-colors ${
          isNotificationEnabled ? "text-blue-400" : "text-gray-400"
        }`}
      />

      {/* Unread count badge */}
      {isNotificationEnabled && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      {/* Notification disabled indicator */}
      {!isNotificationEnabled && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse">
          <span className="absolute inset-0 rounded-full bg-yellow-500 animate-pulse-ring"></span>
        </span>
      )}
    </button>
  );
};

export default NotificationBadge;
