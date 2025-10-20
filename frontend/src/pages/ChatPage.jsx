import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../context/Auth.Context";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";

const ChatPage = () => {
  const { authUser, loading } = useAuthContext();
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading2, setLoading2] = useState(true);

  useEffect(() => {
    if (!loading && !authUser) {
      navigate("/login");
    }
  }, [authUser, loading, navigate]);

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

  // Connect to socket when it's available
  useEffect(() => {
    if (socket && authUser) {
      socket.emit("join", authUser.username);

      socket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      return () => {
        socket.off("onlineUsers");
      };
    }
  }, [socket, authUser]);

  // Fetch conversations on component mount
  useEffect(() => {
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

    fetchConversations();
  }, [authUser]);

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
  };

  if (loading || !authUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-300"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-glass">
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
  );
};

export default ChatPage;
