import { useState, useEffect, useRef } from "react";
import { IoSend } from "react-icons/io5";
import { toast } from "react-hot-toast";
import { BiImageAdd } from "react-icons/bi";
import { MdEmojiEmotions } from "react-icons/md";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaReply, FaForward, FaTrash } from "react-icons/fa";
import { AiFillHeart } from "react-icons/ai";
import { BiSad, BiWinkSmile, BiHappy } from "react-icons/bi";
import Picker from "emoji-picker-react";

const ChatWindow = ({ activeChat, authUser, socket, handleNewMessage }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeMessageOptions, setActiveMessageOptions] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  // We'll use forwardingMessage state to determine if dialog should be shown
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const optionsMenuRef = useRef(null);

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
      // console.log("Received message via socket:", data);

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

        // console.log("Message has pending match:", hasPendingMatch);

        if (!hasPendingMatch) {
          // console.log("Adding new message to chat:", data);
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

    // Handle socket reconnection and check for any pending operations
    const handleReconnect = () => {
      if (deletingMessageId) {
        // Inform user that connection is restored and operation can continue
        toast.success("Connection restored, resuming message operation");
      }
    };

    // Handle message deleted for everyone
    const handleMessageDeleted = (data) => {
      if (!data || !data.messageId) {
        console.error("Invalid message deletion data received:", data);
        return;
      }

      if (data.conversationId === activeChat._id) {
        // Check if the message exists before showing notification
        const messageExists = chatMessages.some(
          (msg) => msg._id === data.messageId,
        );

        setChatMessages((prev) =>
          prev.filter((msg) => msg._id !== data.messageId),
        );

        if (messageExists) {
          const deletedBy = data.deletedBy || "Someone";
          toast.info(`${deletedBy} deleted a message`);
        }
      }
    };

    // Handle message reactions
    const handleMessageReaction = (data) => {
      if (data.conversationId === activeChat._id) {
        setChatMessages((prev) =>
          prev.map((msg) => {
            if (msg._id === data.messageId) {
              const existingReactions = msg.reactions || [];
              const userReactionIndex = existingReactions.findIndex(
                (r) =>
                  r.username === data.reaction.username &&
                  r.type === data.reaction.type,
              );

              let updatedReactions;
              if (userReactionIndex >= 0) {
                updatedReactions = [...existingReactions];
                updatedReactions.splice(userReactionIndex, 1);
              } else {
                updatedReactions = [
                  ...existingReactions.filter(
                    (r) => r.username !== data.reaction.username,
                  ),
                  data.reaction,
                ];
              }

              return { ...msg, reactions: updatedReactions };
            }
            return msg;
          }),
        );
      }
    };

    socket.on("receiveMessage", handleIncomingMessage);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("messageReaction", handleMessageReaction);
    socket.on("connect", handleReconnect);
    socket.on("disconnect", () => {
      if (deletingMessageId) {
        toast.warning(
          "Connection lost while deleting a message. Will retry when connection is restored.",
        );
      }
    });

    return () => {
      socket.off("receiveMessage", handleIncomingMessage);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("messageReaction", handleMessageReaction);
      socket.off("connect", handleReconnect);
      socket.off("disconnect");
    };
  }, [socket, activeChat, handleNewMessage, chatMessages, deletingMessageId]);

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

      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target) &&
        !event.target.closest(".message-options-trigger")
      ) {
        setActiveMessageOptions(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Function to delete messages
  const deleteMessage = async (messageId, deleteType) => {
    // Validate message ID and check if message exists
    if (!messageId) {
      toast.error("Cannot delete message: Invalid message ID");
      return;
    }

    // Check if message exists in chat history
    const messageExists = chatMessages.some((msg) => msg._id === messageId);
    if (!messageExists) {
      toast.error("Cannot delete message: Message not found");
      return;
    }

    // Prevent deleting a message that's already being deleted
    if (deletingMessageId === messageId) {
      return;
    }

    try {
      setDeletingMessageId(messageId);

      const endpoint =
        deleteType === "everyone"
          ? `/api/chat/messages/${messageId}/delete-for-everyone`
          : `/api/chat/messages/${messageId}/delete-for-me`;

      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "include",
      });

      // Handle potential network errors or server timeouts
      if (!response) {
        throw new Error("Network error: No response from server");
      }

      const data = await response.json();

      if (response.ok) {
        if (deleteType === "everyone") {
          // Remove from UI
          setChatMessages((prev) =>
            prev.filter((msg) => msg._id !== messageId),
          );

          // Notify other users via socket
          if (socket && socket.connected) {
            socket.emit("deleteMessageForEveryone", {
              messageId,
              conversationId: activeChat._id,
              deletedBy: authUser.username,
            });
          } else {
            console.warn(
              "Socket not connected, couldn't notify other users about deletion",
            );
            toast.warning(
              "Network issue: Other users will see this message disappear when you reconnect",
            );

            // Set up retry mechanism when socket reconnects
            const retryEmit = () => {
              socket.emit("deleteMessageForEveryone", {
                messageId,
                conversationId: activeChat._id,
                deletedBy: authUser.username,
              });
              socket.off("connect", retryEmit); // Remove listener after retrying
            };
            socket.on("connect", retryEmit);
          }

          toast.success("Message deleted for everyone");
        } else {
          // Mark as deleted for this user only (hide in UI)
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg._id === messageId ? { ...msg, deletedForMe: true } : msg,
            ),
          );
          toast.success("Message deleted for you");
        }
      } else {
        // Handle specific error cases
        if (response.status === 403) {
          toast.error("You don't have permission to delete this message");
        } else if (response.status === 404) {
          toast.error("Message not found or already deleted");
          // Update UI to reflect the message is gone
          setChatMessages((prev) =>
            prev.filter((msg) => msg._id !== messageId),
          );
        } else if (response.status === 429) {
          toast.error(
            "Too many delete requests. Please try again in a moment.",
          );
        } else if (response.status >= 500) {
          toast.error(
            "Server error. Your message will be deleted when the server recovers.",
          );
          // Keep the message ID in a retry queue
          const retryAfterDelay = () => {
            setTimeout(() => {
              deleteMessage(messageId, deleteType);
            }, 5000); // Retry after 5 seconds
          };
          retryAfterDelay();
        } else {
          toast.error(data.error || "Failed to delete message");
        }
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(
        `Error deleting message: ${error.message || "Something went wrong"}`,
      );
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Function to add reactions to messages
  const addReaction = async (messageId, reactionType) => {
    if (!messageId) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reactionType,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Update message in UI with reaction
        setChatMessages((prev) =>
          prev.map((msg) => {
            if (msg._id === messageId) {
              const existingReactions = msg.reactions || [];
              // Check if user already reacted with this type
              const userReactionIndex = existingReactions.findIndex(
                (r) =>
                  r.username === authUser.username && r.type === reactionType,
              );

              let updatedReactions;
              if (userReactionIndex >= 0) {
                // Remove reaction if already exists (toggle behavior)
                updatedReactions = [...existingReactions];
                updatedReactions.splice(userReactionIndex, 1);
              } else {
                // Add new reaction
                updatedReactions = [
                  ...existingReactions.filter(
                    (r) => r.username !== authUser.username,
                  ),
                  { username: authUser.username, type: reactionType },
                ];
              }

              return { ...msg, reactions: updatedReactions };
            }
            return msg;
          }),
        );

        // Notify other users via socket
        socket.emit("messageReaction", {
          messageId,
          conversationId: activeChat._id,
          reaction: {
            username: authUser.username,
            type: reactionType,
          },
        });
      } else {
        toast.error(data.error || "Failed to add reaction");
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Something went wrong");
    }
  };

  // Function to send reply to a message
  const sendReply = async (e, originalMessage) => {
    e.preventDefault();

    const messageToSend = message.trim();
    if (!messageToSend || !activeChat || !originalMessage) return;

    // Get the receiver's username
    const receiver = activeChat.participants.find(
      (username) => username !== authUser.username,
    );

    if (!receiver) {
      toast.error("Cannot determine message recipient");
      return;
    }

    // Create a temporary message
    const tempMessage = {
      _id: `temp-${Date.now()}`,
      sender: authUser.username,
      receiver,
      message: messageToSend,
      messageType: "text",
      conversationId: activeChat._id,
      createdAt: new Date(),
      pending: true,
      replyTo: originalMessage._id,
      replyToSender: originalMessage.sender,
      replyToMessage:
        originalMessage.messageType === "image"
          ? "Image"
          : originalMessage.message,
    };

    // Add temporary message
    setChatMessages((prev) => [...prev, tempMessage]);

    // Clear input and reply state
    setMessage("");
    setReplyingTo(null);

    try {
      setSendingMessage(true);
      const response = await fetch("/api/chat/messages/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiver,
          message: messageToSend,
          conversationId: activeChat._id,
          replyTo: originalMessage._id,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Replace temporary message
        setChatMessages((prev) =>
          prev.map((msg) => (msg._id === tempMessage._id ? data : msg)),
        );

        // Update last message
        handleNewMessage({
          ...data,
          createdAt: new Date(),
        });

        // Emit via socket
        socket.emit("sendMessage", {
          sender: authUser.username,
          receiver,
          message: messageToSend,
          conversationId: activeChat._id,
          messageId: data._id,
          messageType: "text",
          replyTo: originalMessage._id,
          replyToSender: originalMessage.sender,
          replyToMessage:
            originalMessage.messageType === "image"
              ? "Image"
              : originalMessage.message,
        });
      } else {
        // Mark as failed
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessage._id
              ? { ...msg, failed: true, pending: false }
              : msg,
          ),
        );
        toast.error(data.error || "Failed to send reply");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
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

  // Function to forward a message
  const handleForwardMessage = async (targetConversationId, targetReceiver) => {
    if (!forwardingMessage || !targetConversationId) return;

    try {
      const response = await fetch("/api/chat/messages/forward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalMessageId: forwardingMessage._id,
          conversationId: targetConversationId,
          receiver: targetReceiver,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setForwardingMessage(null);
        toast.success("Message forwarded successfully");

        // Emit via socket
        socket.emit("messageForwarded", {
          ...data,
          conversationId: targetConversationId,
          receiver: targetReceiver,
        });
      } else {
        toast.error(data.error || "Failed to forward message");
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      toast.error("Something went wrong");
    }
  };

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
                  {/* Skip rendering messages deleted for current user */}
                  {msg.deletedForMe ? (
                    <div className="text-gray-500 italic text-xs p-2">
                      This message was deleted
                    </div>
                  ) : deletingMessageId === msg._id ? (
                    <div className="relative max-w-[70%] rounded-lg p-3 bg-red-500 bg-opacity-20 text-white">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        <span>Deleting message...</span>
                      </div>
                      <div className="text-xs text-center mt-1">
                        Please wait...{" "}
                        {socket &&
                          !socket.connected &&
                          "(Reconnecting to server)"}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative max-w-[70%] rounded-lg p-3 group ${
                        isCurrentUser
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-gray-700 text-gray-100 rounded-tl-none"
                      } ${msg.pending ? "opacity-70" : ""} ${msg.failed ? "border border-red-500" : ""}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveMessageOptions(msg._id || index);
                      }}
                    >
                      {/* Message options button */}
                      {!msg.pending && !msg.failed && (
                        <button
                          onClick={() =>
                            setActiveMessageOptions(
                              activeMessageOptions === (msg._id || index)
                                ? null
                                : msg._id || index,
                            )
                          }
                          className="absolute top-2 right-2 opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 transition-opacity message-options-trigger"
                        >
                          <BsThreeDotsVertical size={16} />
                        </button>
                      )}

                      {/* Message options menu */}
                      {activeMessageOptions === (msg._id || index) && (
                        <div
                          ref={optionsMenuRef}
                          className="absolute z-10 bg-gray-800 rounded-md shadow-lg p-2 w-48 right-0 top-0"
                        >
                          <ul className="space-y-1">
                            <li>
                              <button
                                onClick={() => {
                                  setReplyingTo(msg);
                                  setActiveMessageOptions(null);
                                }}
                                className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <FaReply className="mr-2" /> Reply
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => {
                                  setForwardingMessage(msg);
                                  setActiveMessageOptions(null);
                                  toast.success(
                                    "Select a conversation to forward to",
                                  );
                                }}
                                className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <FaForward className="mr-2" /> Forward
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => {
                                  setActiveMessageOptions(null);
                                  deleteMessage(msg._id, "self");
                                }}
                                disabled={deletingMessageId === msg._id}
                                className={`flex items-center w-full px-3 py-2 text-left hover:bg-gray-700 rounded-md transition-colors ${deletingMessageId === msg._id ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <FaTrash className="mr-2" /> Delete for me
                              </button>
                            </li>
                            {isCurrentUser && (
                              <li>
                                <button
                                  onClick={() => {
                                    setActiveMessageOptions(null);
                                    deleteMessage(msg._id, "everyone");
                                  }}
                                  disabled={deletingMessageId === msg._id}
                                  className={`flex items-center w-full px-3 py-2 text-left hover:bg-gray-700 rounded-md transition-colors ${deletingMessageId === msg._id ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  <FaTrash className="mr-2" /> Delete for
                                  everyone
                                </button>
                              </li>
                            )}
                            <li className="border-t border-gray-700 pt-1 mt-1">
                              <p className="px-3 py-1 text-xs text-gray-400">
                                Reactions
                              </p>
                              <div className="flex justify-around pt-1">
                                <button
                                  onClick={() => {
                                    addReaction(msg._id, "like");
                                    setActiveMessageOptions(null);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded-full"
                                >
                                  <AiFillHeart
                                    className="text-red-500"
                                    size={18}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    addReaction(msg._id, "love");
                                    setActiveMessageOptions(null);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded-full"
                                >
                                  <BiHappy
                                    className="text-yellow-500"
                                    size={18}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    addReaction(msg._id, "sad");
                                    setActiveMessageOptions(null);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded-full"
                                >
                                  <BiSad className="text-blue-400" size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    addReaction(msg._id, "wow");
                                    setActiveMessageOptions(null);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded-full"
                                >
                                  <BiWinkSmile
                                    className="text-green-400"
                                    size={18}
                                  />
                                </button>
                                <button
                                  onClick={() => {
                                    addReaction(msg._id, "100");
                                    setActiveMessageOptions(null);
                                  }}
                                  className="p-1 hover:bg-gray-700 rounded-full text-xs font-bold"
                                >
                                  💯
                                </button>
                              </div>
                            </li>
                          </ul>
                        </div>
                      )}

                      {/* Reply indicator */}
                      {msg.replyTo && (
                        <div className="bg-gray-600 p-1 rounded mb-2 text-xs text-gray-300 border-l-2 border-blue-400">
                          <p className="font-semibold">
                            Reply to {msg.replyToSender}
                          </p>
                          <p className="truncate">{msg.replyToMessage}</p>
                        </div>
                      )}
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
                      {/* Display reactions if any */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex space-x-1 mt-1">
                          {msg.reactions.map((reaction, i) => (
                            <span
                              key={i}
                              className="bg-gray-600 rounded-full px-2 py-0.5 text-xs flex items-center"
                            >
                              {reaction.type === "like" && (
                                <AiFillHeart
                                  className="text-red-500 mr-1"
                                  size={12}
                                />
                              )}
                              {reaction.type === "love" && (
                                <BiHappy
                                  className="text-yellow-500 mr-1"
                                  size={12}
                                />
                              )}
                              {reaction.type === "sad" && (
                                <BiSad
                                  className="text-blue-400 mr-1"
                                  size={12}
                                />
                              )}
                              {reaction.type === "wow" && (
                                <BiWinkSmile
                                  className="text-green-400 mr-1"
                                  size={12}
                                />
                              )}
                              {reaction.type === "100" && (
                                <span className="mr-1 text-xs">💯</span>
                              )}
                              {reaction.username}
                            </span>
                          ))}
                        </div>
                      )}
                      <div
                        className={`text-xs mt-1 flex items-center justify-between ${isCurrentUser ? "text-blue-200" : "text-gray-400"}`}
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
                  )}
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

        {/* Forward message dialog */}
        {forwardingMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-96">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Forward message</h3>
                <button
                  onClick={() => {
                    setForwardingMessage(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  &times;
                </button>
              </div>
              <div className="bg-gray-700 p-3 rounded mb-4">
                <p className="text-sm text-gray-300">
                  {forwardingMessage.messageType === "image"
                    ? "Forward this image"
                    : `"${forwardingMessage.message}"`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Originally from {forwardingMessage.sender}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm mb-2">Select conversation:</p>
                <div className="max-h-40 overflow-y-auto">
                  {/* This would be populated with your conversation list */}
                  <p className="text-center text-gray-400 p-2">
                    Forwarding functionality requires integration with your
                    conversation list. Please connect this UI to your
                    conversation selection logic.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setForwardingMessage(null);
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded mr-2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Call the handleForwardMessage with target conversation details
                    // This would be replaced with actual selected conversation data
                    handleForwardMessage(
                      "example-conversation-id",
                      "example-user",
                    );
                    toast.info(
                      "Forward functionality needs backend implementation",
                    );
                    setForwardingMessage(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Forward
                </button>
              </div>
            </div>
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
        {/* Reply UI */}
        {replyingTo && (
          <div className="px-4 pt-2 border-t border-gray-700 bg-gray-800 flex items-center justify-between">
            <div className="flex items-center">
              <div className="border-l-2 border-blue-500 pl-2">
                <p className="text-xs text-gray-400">
                  Replying to {replyingTo.sender}
                </p>
                <p className="text-sm truncate text-gray-300 max-w-[350px]">
                  {replyingTo.messageType === "image"
                    ? "An image"
                    : replyingTo.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-gray-200 p-1"
            >
              &times;
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            if (replyingTo) {
              sendReply(e, replyingTo);
            } else {
              sendMessage(e);
            }
          }}
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
