import { useState, useEffect, useRef } from "react";
import { IoSend } from "react-icons/io5";
import { toast } from "react-hot-toast";

const ChatWindow = ({ activeChat, authUser, socket, handleNewMessage }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messageEndRef = useRef(null);

  // Fetch chat messages when active chat changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChat) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/chat/messages/${activeChat._id}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (response.ok) {
          setChatMessages(data);
        } else {
          toast.error("Failed to load messages");
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeChat]);

  // Listen for new messages from socket
  useEffect(() => {
    if (!socket || !activeChat) return;

    const handleIncomingMessage = (data) => {
      if (data.conversationId === activeChat._id) {
        setChatMessages((prev) => [...prev, data]);

        // Also update the conversation's last message through parent component
        handleNewMessage(data);
      }
    };

    socket.on("receiveMessage", handleIncomingMessage);

    return () => {
      socket.off("receiveMessage", handleIncomingMessage);
    };
  }, [socket, activeChat, handleNewMessage]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!message.trim() || !activeChat) return;

    // Get the receiver's username (the other participant)
    const receiver = activeChat.participants.find(
      (username) => username !== authUser.username,
    );

    if (!receiver) {
      toast.error("Cannot determine message recipient");
      return;
    }

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver,
          message: message.trim(),
          conversationId: activeChat._id,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Add message to local state
        setChatMessages((prev) => [...prev, data]);

        // Update the conversation's last message
        handleNewMessage({
          ...data,
          createdAt: new Date(),
        });

        // Emit message via socket
        socket.emit("sendMessage", {
          sender: authUser.username,
          receiver,
          message: message.trim(),
          conversationId: activeChat._id,
        });

        setMessage("");
      } else {
        toast.error(data.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Something went wrong");
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!activeChat) {
    return (
      <div className="w-2/3 flex items-center justify-center h-screen bg-gray-800 text-gray-300">
        <div className="text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-semibold">Select a conversation</h2>
          <p className="text-gray-500 mt-2">
            Choose a chat or start a new conversation
          </p>
        </div>
      </div>
    );
  }

  // Find other user details from active chat
  const otherUser = activeChat.participantDetails[0];

  return (
    <div className="w-2/3 flex flex-col h-screen bg-gray-800">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-700 flex items-center">
        {otherUser.avatarUrl ? (
          <img
            src={otherUser.avatarUrl}
            alt={otherUser.username}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 flex items-center justify-center text-white font-medium">
            {otherUser.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-medium">
            {otherUser.name || otherUser.username}
          </div>
          <div className="text-sm text-gray-400">@{otherUser.username}</div>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : chatMessages.length > 0 ? (
          <div className="space-y-3">
            {chatMessages.map((msg, index) => {
              const isCurrentUser = msg.sender === authUser.username;
              return (
                <div
                  key={msg._id || index}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isCurrentUser
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-gray-700 text-gray-100 rounded-tl-none"
                    }`}
                  >
                    <div>{msg.message}</div>
                    <div
                      className={`text-xs mt-1 ${isCurrentUser ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            This is the beginning of your conversation with{" "}
            {otherUser.name || otherUser.username}
          </div>
        )}
      </div>

      {/* Message input */}
      <form
        onSubmit={sendMessage}
        className="p-4 border-t border-gray-700 flex"
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l-lg focus:outline-none focus:border-blue-500 text-gray-100"
        />
        <button
          type="submit"
          className="bg-blue-600 px-4 rounded-r-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          disabled={!message.trim()}
        >
          <IoSend className={message.trim() ? "text-white" : "text-gray-300"} />
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
