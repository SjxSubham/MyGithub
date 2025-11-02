import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/Auth.Context";
import { useNotificationContext } from "../context/NotificationContext";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import NotificationSettings from "../components/NotificationSettings";
import NotificationBadge from "../components/NotificationBadge";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";

const ChatPage = () => {
  const { authUser, loading } = useAuthContext();
  const {
    showMessageNotification,
    isNotificationEnabled,
    requestNotificationPermission,
  } = useNotificationContext();
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading2, setLoading2] = useState(true);
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);

          // Handle service worker updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                toast.success("New version available! Refresh to update.", {
                  duration: 5000,
                });
              }
            });
          });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });

      // Handle messages from service worker
      const handleServiceWorkerMessage = (event) => {
        // Handle notification click
        if (event.data && event.data.type === "notification-click") {
          if (event.data.data && event.data.data.conversationId) {
            const conversation = conversations.find(
              (c) => c._id === event.data.data.conversationId,
            );
            if (conversation) {
              setActiveChat(conversation);
            }
          }
        }

        // Handle play notification sound request from service worker
        if (event.data && event.data.type === "play-notification-sound") {
          playNotificationSound();
        }

        // Handle messages synced notification
        if (event.data && event.data.type === "messages-synced") {
          if (event.data.success) {
            toast.success("Messages synced successfully");
            // Refresh conversations
            fetchConversations();
          }
        }

        // Handle new messages available
        if (event.data && event.data.type === "new-messages-available") {
          fetchConversations();
        }
      };

      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    if (!loading && !authUser) {
      navigate("/login");
    }
  }, [authUser, loading, navigate]);

  // Request notification permission on first load
  useEffect(() => {
    if (authUser && !isNotificationEnabled) {
      // Show a subtle prompt after a delay
      const timer = setTimeout(() => {
        if (Notification.permission === "default") {
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium">Enable notifications?</p>
                  <p className="text-sm text-gray-400">
                    Get notified about new messages
                  </p>
                </div>
                <button
                  onClick={async () => {
                    toast.dismiss(t.id);
                    await requestNotificationPermission();
                  }}
                  className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  Enable
                </button>
              </div>
            ),
            {
              duration: 10000,
              position: "top-center",
            },
          );
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [authUser, isNotificationEnabled, requestNotificationPermission]);

  useEffect(() => {
    // Initialize socket connection
    if (authUser) {
      try {
        const newSocket = io("/", {
          transports: ["websocket"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        newSocket.on("connect", () => {
          console.log("Socket connected successfully");
        });

        newSocket.on("connect_error", (err) => {
          console.error("Socket connection error:", err);
          toast.error("Chat connection error. Please refresh the page.");
        });

        setSocket(newSocket);

        return () => {
          newSocket.disconnect();
        };
      } catch (error) {
        console.error("Failed to initialize socket:", error);
        toast.error("Could not connect to chat service");
      }
    }
  }, [authUser]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You're back online!");

      // Trigger background sync if available
      if ("serviceWorker" in navigator && "sync" in navigator.serviceWorker) {
        navigator.serviceWorker.ready
          .then((registration) => {
            return registration.sync.register("sync-messages");
          })
          .catch((error) => {
            console.error("Background sync registration failed:", error);
          });
      }

      // Refresh conversations to get any missed messages
      fetchConversations();

      // Reconnect socket if needed
      if (socket && !socket.connected) {
        socket.connect();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You're offline. Messages will be sent when you reconnect.", {
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Connect to socket when it's available
  useEffect(() => {
    if (socket && authUser) {
      socket.emit("join", authUser.username);

      socket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      // Listen for incoming messages for notifications
      socket.on("receiveMessage", (messageData) => {
        // Only show notification if not the sender and chat is not active or window is hidden
        if (
          messageData.sender !== authUser.username &&
          (!activeChat ||
            activeChat._id !== messageData.conversationId ||
            document.hidden)
        ) {
          // Find the sender's details from conversations
          const conversation = conversations.find(
            (c) => c._id === messageData.conversationId,
          );

          const senderDetails = conversation?.participantDetails?.find(
            (p) => p.username === messageData.sender,
          );

          showMessageNotification({
            sender: messageData.sender,
            message: messageData.message,
            conversationId: messageData.conversationId,
            senderAvatar: senderDetails?.avatarUrl || "/logo.png",
          });
        }
      });

      return () => {
        socket.off("onlineUsers");
        socket.off("receiveMessage");
      };
    }
  }, [socket, authUser, activeChat, conversations, showMessageNotification]);

  // Function to fetch conversations
  const fetchConversations = async () => {
    if (!authUser) return;

    try {
      setLoading2(true);
      const response = await fetch("/api/chat/conversations", {
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        setConversations(data);
      } else {
        console.error("Error fetching conversations:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      setLoading2(false);
    }
  };

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Function to play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/notification-sound.mp3");
      audio.volume = 0.7;

      audio.onerror = () => {
        // Fallback to Web Audio API
        playFallbackSound();
      };

      audio.play().catch((error) => {
        console.warn("Could not play notification sound:", error);
        playFallbackSound();
      });

      // Vibrate on mobile
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (error) {
      console.warn("Notification sound error:", error);
    }
  };

  // Fallback sound using Web Audio API
  const playFallbackSound = () => {
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
      console.warn("Fallback sound error:", error);
    }
  };

  // Add new message to the appropriate conversation
  const handleNewMessage = (message) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv._id === message.conversationId
          ? {
              ...conv,
              lastMessage: message.message,
              lastMessageTime: message.createdAt,
            }
          : conv,
      ),
    );

    // Show notification for new message (if not from current user)
    if (message.sender !== authUser.username) {
      const conversation = conversations.find(
        (c) => c._id === message.conversationId,
      );

      const senderDetails = conversation?.participantDetails?.find(
        (p) => p.username === message.sender,
      );

      // Only show if chat is not active or window is hidden
      if (
        !activeChat ||
        activeChat._id !== message.conversationId ||
        document.hidden
      ) {
        showMessageNotification({
          sender: message.sender,
          message: message.message,
          conversationId: message.conversationId,
          senderAvatar: senderDetails?.avatarUrl || "/logo.png",
        });

        // Play notification sound
        playNotificationSound();
      }
    }
  };

  if (loading || !authUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-300"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full bg-glass relative">
        {/* Online/Offline Indicator */}
        {!isOnline && (
          <div className="absolute top-4 left-4 z-10 bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Offline</span>
          </div>
        )}

        {/* Notification Settings Button */}
        <div className="absolute top-4 right-4 z-10 bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors border border-gray-700 shadow-lg">
          <NotificationBadge
            onClick={() => setShowNotificationSettings(true)}
          />
        </div>

        <ChatSidebar
          conversations={conversations}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          onlineUsers={onlineUsers}
          loading={loading2}
        />
        <ChatWindow
          activeChat={activeChat}
          authUser={authUser}
          socket={socket}
          handleNewMessage={handleNewMessage}
        />
      </div>

      {/* Notification Settings Modal */}
      <NotificationSettings
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </>
  );
};

export default ChatPage;
