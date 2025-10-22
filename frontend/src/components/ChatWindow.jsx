import { useState, useEffect, useRef } from "react";
import { IoSend } from "react-icons/io5";
import { toast } from "react-hot-toast";
import { BiImageAdd } from "react-icons/bi";
import { MdEmojiEmotions } from "react-icons/md";
import Picker from "emoji-picker-react";

const ChatWindow = ({ activeChat, authUser, socket, handleNewMessage }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

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

    // Handle incoming message from socket
    const handleIncomingMessage = (data) => {
      console.log("Received message via socket:", data);

      if (data.conversationId === activeChat._id) {
        // Check if we already have a pending message with the same content
        // This could happen if both users are online and the message is sent/received
        const hasPendingMatch = chatMessages.some(
          (msg) =>
            msg.pending &&
            msg.message === data.message &&
            msg.sender === data.sender &&
            msg.messageType === data.messageType,
        );

        console.log("Message has pending match:", hasPendingMatch);

        if (!hasPendingMatch) {
          console.log("Adding new message to chat:", data);
          setChatMessages((prev) => [...prev, data]);
        }

        // Also update the conversation's last message through parent component
        handleNewMessage(data);
      }
    };

    // Handle message delivery confirmation
    const handleMessageDelivered = (messageId) => {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, delivered: true } : msg,
        ),
      );
    };

    socket.on("receiveMessage", handleIncomingMessage);
    socket.on("messageDelivered", handleMessageDelivered);

    return () => {
      socket.off("receiveMessage", handleIncomingMessage);
      socket.off("messageDelivered", handleMessageDelivered);
    };
  }, [socket, activeChat, handleNewMessage, chatMessages]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (e, emojiObject = null) => {
    e.preventDefault();

    // Use emoji if provided, otherwise use text message
    let messageToSend =
      emojiObject && emojiObject.emoji ? emojiObject.emoji : message.trim();
    let messageType = emojiObject && emojiObject.emoji ? "emoji" : "text";

    if ((!messageToSend && messageType === "text") || !activeChat) return;

    // Get the receiver's username (the other participant)
    const receiver = activeChat.participants.find(
      (username) => username !== authUser.username,
    );

    if (!receiver) {
      toast.error("Cannot determine message recipient");
      return;
    }

    // Create a temporary message with pending status
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      sender: authUser.username,
      receiver,
      message: messageToSend,
      messageType,
      conversationId: activeChat._id,
      createdAt: new Date(),
      pending: true,
    };

    // Add temporary message immediately for optimistic UI update
    setChatMessages((prev) => [...prev, tempMessage]);

    // Clear input field immediately
    const sentMessage = messageToSend;
    if (messageType === "text") {
      setMessage("");
    }

    // Close emoji picker if it was open
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    }

    // Scroll to the new message
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      setSendingMessage(true);
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver,
          message: sentMessage,
          conversationId: activeChat._id,
          messageType,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Replace the temporary message with the actual message
        setChatMessages((prev) =>
          prev.map((msg) => (msg._id === tempMessage._id ? data : msg)),
        );

        // Update the conversation's last message
        handleNewMessage({
          ...data,
          createdAt: new Date(),
        });

        // Emit message via socket
        socket.emit("sendMessage", {
          sender: authUser.username,
          receiver,
          message: sentMessage,
          conversationId: activeChat._id,
          messageId: data._id,
          messageType,
        });
      } else {
        // Mark the message as failed
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id
              ? { ...msg, failed: true, pending: false }
              : msg,
          ),
        );
        toast.error(data.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Mark the message as failed
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempMessage._id
            ? { ...msg, failed: true, pending: false }
            : msg,
        ),
      );
      toast.error("Something went wrong");
    } finally {
      setSendingMessage(false);
    }
  };

  const formatMessageTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Invalid timestamp:", timestamp, error);
      return "Unknown time";
    }
  };

  // Add CSS for image errors
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .image-error::after {
        content: "❌ Error loading image";
        display: block;
        color: #f56565;
        background-color: rgba(0,0,0,0.4);
        padding: 4px 8px;
        margin-top: 4px;
        border-radius: 4px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleImageUpload = async (e, retryFile = null) => {
    const file = retryFile || e?.target?.files?.[0];
    if (!file) return;

    // Clear file input value to allow re-uploading the same file
    if (fileInputRef.current && !retryFile) {
      fileInputRef.current.value = "";
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should not exceed 2MB");
      return;
    }

    // Check file type
    if (!file.type || !file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    const receiver = activeChat.participants.find(
      (username) => username !== authUser.username,
    );

    if (!receiver) {
      toast.error("Cannot determine message recipient");
      return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("image", file);
    formData.append("receiver", receiver);
    formData.append("conversationId", activeChat._id);

    // Create a temporary message
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      sender: authUser.username,
      receiver,
      message: "Sending image...",
      messageType: "image",
      conversationId: activeChat._id,
      file: file, // Store file reference for potential retry
      createdAt: new Date(),
      pending: true,
    };

    // Add temporary message
    setChatMessages((prev) => [...prev, tempMessage]);

    try {
      setUploading(true);
      const response = await fetch("/api/chat/messages/image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Replace temp message with actual message
        setChatMessages((prev) =>
          prev.map((msg) => (msg._id === tempMessage._id ? data : msg)),
        );

        // Update conversation's last message
        handleNewMessage({
          ...data,
          createdAt: new Date(),
        });

        // Log the image URL from the response for debugging
        console.log("Image upload response:", data);
        console.log("Image URL from response:", data.imageUrl);

        // Verify the imageUrl exists before sending via socket
        if (!data.imageUrl) {
          console.error("Missing imageUrl in server response:", data);
          toast.error("Image uploaded but URL is missing. Please try again.");
        }

        // Emit message via socket
        socket.emit("sendMessage", {
          sender: authUser.username,
          receiver,
          message: "Sent an image",
          conversationId: activeChat._id,
          messageId: data._id,
          messageType: "image",
          imageUrl: data.imageUrl,
        });

        // Log what's being sent via socket
        console.log("Sending via socket:", {
          messageId: data._id,
          messageType: "image",
          imageUrl: data.imageUrl,
        });
      } else {
        // Mark message as failed
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id
              ? { ...msg, failed: true, pending: false, file: tempMessage.file }
              : msg,
          ),
        );
        toast.error(data.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempMessage._id
            ? { ...msg, failed: true, pending: false, file: tempMessage.file }
            : msg,
        ),
      );
      toast.error("Something went wrong while uploading image");
    } finally {
      setUploading(false);
    }
  };

  // Function to retry failed image upload
  const retryImageUpload = (failedMsg) => {
    if (failedMsg.file) {
      // Remove the failed message
      setChatMessages((prev) =>
        prev.filter((msg) => msg._id !== failedMsg._id),
      );

      // Try upload again with the same file
      handleImageUpload(null, failedMsg.file);
    } else {
      toast.error("Cannot retry upload - original file not available");
    }
  };

  const onEmojiClick = (emojiObject) => {
    if (emojiObject && emojiObject.emoji) {
      sendMessage(new Event("submit"), emojiObject);
    }
  };

  // Handle clicks outside of emoji picker to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!activeChat) {
    return (
      <div className="w-2/3 flex items-center justify-center h-screen bg-glass text-gray-300">
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
    <div className="w-2/3 flex flex-col h-screen bg-glass">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-700 flex items-center">
        {otherUser.avatarUrl ? (
          <img
            src={otherUser.avatarUrl}
            alt={otherUser.username}
            className="w-10 h-10 rounded-full mr-3"
          />
        ) : (
          <div className="w-10 h-10 rounded-full mr-3 bg-glass flex items-center justify-center text-white font-medium">
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
                    } ${msg.pending ? "opacity-70" : ""} ${msg.failed ? "border border-red-500" : ""}`}
                  >
                    {msg.messageType === "image" && msg.imageUrl ? (
                      <div className="image-message">
                        <img
                          src={msg.imageUrl}
                          alt="Shared screenshot"
                          className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.imageUrl, "_blank")}
                          onError={(e) => {
                            console.error(
                              "Image failed to load:",
                              msg.imageUrl,
                            );
                            e.target.onerror = null;
                            e.target.src =
                              "https://via.placeholder.com/300x200?text=Image+Load+Failed";
                            // Add error state to the message element
                            e.target.parentNode.classList.add("image-error");
                          }}
                        />
                        <div className="mt-1 text-xs text-gray-400 flex items-center justify-between">
                          <span>Click to view full size</span>
                          <span
                            className="text-blue-300 hover:underline cursor-pointer"
                            onClick={() =>
                              navigator.clipboard.writeText(msg.imageUrl)
                            }
                          >
                            Copy URL
                          </span>
                        </div>
                      </div>
                    ) : msg.messageType === "image" && msg.pending ? (
                      <div className="text-center p-2">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                          <span>Uploading image...</span>
                        </div>
                      </div>
                    ) : msg.messageType === "image" && msg.failed ? (
                      <div className="text-center p-2">
                        <div className="text-red-400 mb-2">
                          Failed to upload image
                        </div>
                        <button
                          onClick={() => retryImageUpload(msg)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          Retry Upload
                        </button>
                      </div>
                    ) : msg.messageType === "emoji" ? (
                      <div className="text-4xl">{msg.message}</div>
                    ) : (
                      <div>{msg.message}</div>
                    )}
                    <div
                      className={`text-xs mt-1 flex items-center ${isCurrentUser ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {msg.pending ? (
                        <span className="flex items-center">
                          Sending...
                          <div className="ml-1 w-2 h-2 rounded-full bg-blue-200 animate-pulse"></div>
                        </span>
                      ) : msg.failed ? (
                        <span className="flex items-center">
                          <span className="text-red-300 mr-2">Failed</span>
                          {msg.messageType === "text" && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                sendMessage(e);
                              }}
                              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded"
                            >
                              Retry
                            </button>
                          )}
                        </span>
                      ) : (
                        formatMessageTime(msg.createdAt)
                      )}
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
      <div className="relative">
        {showEmojiPicker && (
          <div
            className="absolute bottom-full right-0 mb-2 z-10 shadow-lg rounded-lg bg-gray-800 border border-gray-700"
            ref={emojiPickerRef}
          >
            <Picker
              onEmojiClick={onEmojiClick}
              width={300}
              height={400}
              theme="dark"
              searchPlaceholder="Search emojis..."
            />
          </div>
        )}
        <form
          onSubmit={(e) => sendMessage(e)}
          className="p-4 border-t border-gray-700 flex items-center"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className={`p-2 mr-2 ${uploading ? "bg-blue-600" : "bg-gray-700"} text-gray-300 hover:bg-gray-600 rounded-full transition-colors relative`}
            title="Send Screenshot (max 2MB)"
          >
            {uploading ? (
              <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            ) : (
              <>
                <BiImageAdd size={20} />
                <span className="absolute -top-1 -right-1 text-xs bg-blue-300 text-white rounded-full px-1 animate-pulse opacity-35">
                  2MB
                </span>
              </>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: "none" }}
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 mr-2 ${showEmojiPicker ? "bg-blue-600" : "bg-gray-700"} text-gray-300 hover:bg-gray-600 rounded-full transition-colors`}
            title="Send Emoji"
          >
            <MdEmojiEmotions size={20} />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l-lg focus:outline-none focus:border-blue-500 text-gray-100"
          />
          <button
            type="submit"
            className="bg-blue-600 p-2 rounded-r-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            disabled={!message.trim() || sendingMessage}
          >
            {sendingMessage ? (
              <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            ) : (
              <IoSend
                className={message.trim() ? "text-white" : "text-gray-300"}
              />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
