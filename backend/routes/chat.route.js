import express from "express";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import ensureAuthenticated from "../middleware/ensureAuthenticated.js";
import { upload, uploadToCloudinary } from "../utils/imageUpload.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get all conversations for the logged-in user
router.get("/conversations", ensureAuthenticated, async (req, res) => {
  try {
    const { username } = req.user;

    const conversations = await Conversation.find({
      participants: { $in: [username] },
    }).sort({ lastMessageTime: -1 });

    // Get user details for all participants
    const populatedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const otherParticipants = conversation.participants.filter(
          (participant) => participant !== username,
        );

        const participantDetails = await User.find({
          username: { $in: otherParticipants },
        }).select("username avatarUrl name");

        return {
          _id: conversation._id,
          participants: conversation.participants,
          participantDetails,
          lastMessage: conversation.lastMessage,
          lastMessageTime: conversation.lastMessageTime,
          updatedAt: conversation.updatedAt,
        };
      }),
    );

    res.status(200).json(populatedConversations);
  } catch (error) {
    console.error("Error in getting conversations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get messages for a specific conversation
router.get(
  "/messages/:conversationId",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { username } = req.user;

      // Check if user is part of this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(username)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Filter out messages deleted for this user
      const messages = await Message.find({
        conversationId,
        deletedFor: { $ne: username }, // Don't include messages deleted for this user
      })
        .sort({ createdAt: 1 })
        .limit(100);

      // Mark messages as read
      await Message.updateMany(
        {
          conversationId,
          receiver: username,
          read: false,
        },
        { read: true },
      );

      // Add client-side display properties
      const processedMessages = messages.map((msg) => {
        // Convert to plain object so we can modify it
        const msgObj = msg.toObject();

        // Add a UI flag to indicate if this message was deleted for the current user
        msgObj.deletedForMe =
          msgObj.deletedFor && msgObj.deletedFor.includes(username);

        return msgObj;
      });

      res.status(200).json(processedMessages);
    } catch (error) {
      console.error("Error in getting messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Get or create a conversation between two users
router.get("/conversation/:username", ensureAuthenticated, async (req, res) => {
  try {
    const currentUser = req.user.username;
    const otherUser = req.params.username;

    // Check if the other user exists
    const userExists = await User.findOne({ username: otherUser });
    if (!userExists) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find existing conversation between these users
    const existingConversation = await Conversation.findOne({
      participants: { $all: [currentUser, otherUser] },
    });

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    // If no conversation exists, create a new one
    const newConversation = new Conversation({
      participants: [currentUser, otherUser],
      lastMessage: "",
      lastMessageTime: new Date(),
      linkedRepo: null,
    });

    await newConversation.save();
    res.status(201).json(newConversation);
  } catch (error) {
    console.error("Error in getting/creating conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send a new text or emoji message
router.post("/messages", ensureAuthenticated, async (req, res) => {
  try {
    const { receiver, message, conversationId, messageType } = req.body;
    const sender = req.user.username;

    if (!receiver || !message || !conversationId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify conversation exists and both users are participants
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (
      !conversation.participants.includes(sender) ||
      !conversation.participants.includes(receiver)
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to send message in this conversation" });
    }

    // Create new message
    const newMessage = new Message({
      sender,
      receiver,
      message,
      conversationId,
      messageType: messageType || "text", // Default to text if not specified
    });

    await newMessage.save();

    // Update the conversation with last message
    conversation.lastMessage =
      messageType === "emoji" ? `${message} (emoji)` : message;
    conversation.lastMessageTime = new Date();
    await conversation.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send an image message
router.post(
  "/messages/image",
  ensureAuthenticated,
  upload.single("image"),
  async (req, res) => {
    try {
      const { receiver, conversationId } = req.body;
      const sender = req.user.username;

      if (!receiver || !conversationId || !req.file) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify conversation exists and both users are participants
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (
        !conversation.participants.includes(sender) ||
        !conversation.participants.includes(receiver)
      ) {
        return res.status(403).json({
          error: "Not authorized to send message in this conversation",
        });
      }

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Check file size (double-check even though multer does this)
      if (req.file.size > 2 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Image size should not exceed 2MB" });
      }

      // Check file type
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Upload image to Cloudinary
      let imageUrl;
      try {
        const uploadResult = await uploadToCloudinary(req.file.path);
        console.log("Cloudinary upload result:", uploadResult);

        if (!uploadResult.success) {
          return res
            .status(500)
            .json({ error: uploadResult.error || "Failed to upload image" });
        }

        imageUrl = uploadResult.url;

        if (!imageUrl) {
          return res
            .status(500)
            .json({ error: "No image URL returned from Cloudinary" });
        }
      } catch (error) {
        console.error("Error in cloudinary upload:", error);
        return res
          .status(500)
          .json({ error: "Failed to process image upload" });
      }

      // Create new message
      const newMessage = new Message({
        sender,
        receiver,
        message: "Sent an image",
        conversationId,
        messageType: "image",
        imageUrl: imageUrl,
      });

      console.log("Creating image message with URL:", imageUrl);

      const savedMessage = await newMessage.save();

      // Update the conversation with last message
      conversation.lastMessage = "Sent an image";
      conversation.lastMessageTime = new Date();
      await conversation.save();

      // Return the complete saved message document
      res.status(201).json(savedMessage);
    } catch (error) {
      console.error("Error in sending image message:", error);

      // Check if error is related to file size (from multer)
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ error: "Image size should not exceed 2MB" });
      }

      // Handle other multer errors
      if (error.code && error.code.startsWith("LIMIT_")) {
        return res
          .status(400)
          .json({ error: error.message || "Invalid file upload" });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Get all users for chat (for displaying potential chat partners)
router.get("/users", ensureAuthenticated, async (req, res) => {
  try {
    const currentUser = req.user.username;

    const users = await User.find({ username: { $ne: currentUser } })
      .select("username avatarUrl name")
      .limit(50);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete message for me (soft delete - only hides from requester's view)
router.delete(
  "/messages/:messageId/delete-for-me",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { username } = req.user;

      // Validate message ID
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ error: "Invalid message ID format" });
      }

      // Find the message
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check if user is part of this conversation
      if (message.sender !== username && message.receiver !== username) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this message" });
      }

      // Add user to deletedFor array if it doesn't exist
      if (!message.deletedFor) {
        message.deletedFor = [username];
      } else if (!message.deletedFor.includes(username)) {
        message.deletedFor.push(username);
      }

      await message.save();
      res.status(200).json({ message: "Message deleted for you" });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Delete message for everyone (hard delete)
router.delete(
  "/messages/:messageId/delete-for-everyone",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { username } = req.user;

      // Validate message ID
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ error: "Invalid message ID format" });
      }

      // Find the message
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only sender can delete for everyone
      if (message.sender !== username) {
        return res
          .status(403)
          .json({ error: "Only the sender can delete a message for everyone" });
      }

      // If it's an image message, delete from storage if needed
      if (message.messageType === "image" && message.imageUrl) {
        try {
          // Extract public ID from Cloudinary URL if applicable
          // This assumes URLs like: https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/public-id.jpg
          const publicIdMatch = message.imageUrl.match(/\/v\d+\/(.+?)\.\w+$/);

          if (publicIdMatch && publicIdMatch[1]) {
            // If you have a direct Cloudinary SDK integration:
            // await cloudinary.uploader.destroy(publicIdMatch[1]);
            console.log(
              `Image would be deleted from Cloudinary: ${publicIdMatch[1]}`,
            );
          }
        } catch (imageDeleteError) {
          console.error("Error deleting image from storage:", imageDeleteError);
          // Continue with message deletion even if image deletion fails
        }
      }

      // Delete the message from database
      await Message.findByIdAndDelete(messageId);

      res.status(200).json({ message: "Message deleted for everyone" });
    } catch (error) {
      console.error("Error deleting message for everyone:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Add reaction to a message
router.post(
  "/messages/:messageId/react",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { reactionType } = req.body;
      const { username } = req.user;

      // Validate message ID
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ error: "Invalid message ID format" });
      }

      // Validate reaction type
      const validReactions = ["like", "love", "sad", "wow", "100"];
      if (!validReactions.includes(reactionType)) {
        return res.status(400).json({ error: "Invalid reaction type" });
      }

      // Find the message
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check if user is part of this conversation
      if (message.sender !== username && message.receiver !== username) {
        return res
          .status(403)
          .json({ error: "Not authorized to react to this message" });
      }

      // Initialize reactions array if it doesn't exist
      if (!message.reactions) {
        message.reactions = [];
      }

      // Check if user already reacted with this type
      const existingReactionIndex = message.reactions.findIndex(
        (r) => r.username === username && r.type === reactionType,
      );

      if (existingReactionIndex >= 0) {
        // Remove reaction (toggle behavior)
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Remove any existing reaction from this user
        const userReactionIndex = message.reactions.findIndex(
          (r) => r.username === username,
        );
        if (userReactionIndex >= 0) {
          message.reactions.splice(userReactionIndex, 1);
        }

        // Add new reaction
        message.reactions.push({ username, type: reactionType });
      }

      await message.save();
      res
        .status(200)
        .json({ message: "Reaction updated", reactions: message.reactions });
    } catch (error) {
      console.error("Error updating reaction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Reply to a message
router.post("/messages/reply", ensureAuthenticated, async (req, res) => {
  try {
    const { receiver, message, conversationId, replyTo } = req.body;
    const sender = req.user.username;

    if (!receiver || !message || !conversationId || !replyTo) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate replyTo message ID
    if (!mongoose.Types.ObjectId.isValid(replyTo)) {
      return res.status(400).json({ error: "Invalid reply message ID" });
    }

    // Verify conversation exists and both users are participants
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (
      !conversation.participants.includes(sender) ||
      !conversation.participants.includes(receiver)
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to send message in this conversation" });
    }

    // Verify the replied-to message exists
    const originalMessage = await Message.findById(replyTo);
    if (!originalMessage) {
      return res.status(404).json({ error: "Original message not found" });
    }

    // Create new reply message
    const newMessage = new Message({
      sender,
      receiver,
      message,
      conversationId,
      messageType: "text",
      replyTo: replyTo,
      replyToSender: originalMessage.sender,
      replyToMessage:
        originalMessage.messageType === "image"
          ? "Image"
          : originalMessage.message,
    });

    await newMessage.save();

    // Update the conversation with last message
    conversation.lastMessage = `Replied: ${message.substring(0, 20)}${message.length > 20 ? "..." : ""}`;
    conversation.lastMessageTime = new Date();
    await conversation.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sending reply:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forward a message to another conversation
router.post("/messages/forward", ensureAuthenticated, async (req, res) => {
  try {
    const { originalMessageId, conversationId, receiver } = req.body;
    const sender = req.user.username;

    if (!originalMessageId || !conversationId || !receiver) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate message ID
    if (!mongoose.Types.ObjectId.isValid(originalMessageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    // Verify the original message exists
    const originalMessage = await Message.findById(originalMessageId);
    if (!originalMessage) {
      return res.status(404).json({ error: "Original message not found" });
    }

    // Verify conversation exists and both users are participants
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (
      !conversation.participants.includes(sender) ||
      !conversation.participants.includes(receiver)
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to send message in this conversation" });
    }

    // Create forwarded message
    const newMessage = new Message({
      sender,
      receiver,
      message: originalMessage.message,
      conversationId,
      messageType: originalMessage.messageType,
      imageUrl: originalMessage.imageUrl,
      forwardedFrom: originalMessage.sender,
      forwardedMessageId: originalMessageId,
    });

    await newMessage.save();

    // Update the conversation with last message
    conversation.lastMessage = "Forwarded message";
    conversation.lastMessageTime = new Date();
    await conversation.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in forwarding message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
