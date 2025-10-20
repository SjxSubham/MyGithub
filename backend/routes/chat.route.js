import express from "express";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import ensureAuthenticated from "../middleware/ensureAuthenticated.js";

const router = express.Router();

// Helper function to extract repo info from URL
const extractRepoInfo = (url) => {
  try {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(regex);
    if (match && match.length >= 3) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (error) {
    console.error("Error extracting repo info:", error);
  }
  return null;
};

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

      const messages = await Message.find({ conversationId })
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

      res.status(200).json(messages);
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

// Send a new message
router.post("/messages", ensureAuthenticated, async (req, res) => {
  try {
    const {
      receiver,
      message,
      conversationId,
      repoReference,
      issueReferences,
    } = req.body;
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

    // Extract issue references from message if they exist
    const extractedIssueRefs = [];
    const issueRegex = /#(\d+)\s\(([^)]+)\)/g;
    let match;

    // Get the conversation to check if it has a linked repo
    const linkedRepo = conversation.linkedRepo;

    while ((match = issueRegex.exec(message)) !== null) {
      const issueNumber = parseInt(match[1]);
      const title = match[2];
      const type = title.toLowerCase().includes("pr") ? "pr" : "issue";

      let url = null;
      if (linkedRepo && linkedRepo.url) {
        const baseUrl = linkedRepo.url.replace(/\/+$/, "");
        const endpoint = type === "pr" ? "pull" : "issues";
        url = `${baseUrl}/${endpoint}/${issueNumber}`;
      }

      extractedIssueRefs.push({
        issueNumber: issueNumber,
        title: title,
        type: type,
        url: url,
      });
    }

    // Create new message
    const newMessage = new Message({
      sender,
      receiver,
      message,
      conversationId,
      repoReference,
      issueReferences:
        extractedIssueRefs.length > 0 ? extractedIssueRefs : undefined,
    });

    await newMessage.save();

    // Update the conversation with last message
    conversation.lastMessage = message;
    conversation.lastMessageTime = new Date();
    await conversation.save();

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

// Link a GitHub repository to a conversation
router.post(
  "/conversations/:conversationId/repo",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { repoUrl } = req.body;
      const currentUser = req.user.username;

      if (!repoUrl) {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      // Extract repo owner and name from URL
      const repoInfo = extractRepoInfo(repoUrl);
      if (!repoInfo) {
        return res.status(400).json({ error: "Invalid GitHub repository URL" });
      }

      // Find the conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check if user is part of this conversation
      if (!conversation.participants.includes(currentUser)) {
        return res
          .status(403)
          .json({ error: "Not authorized to modify this conversation" });
      }

      // Clean up the repo URL for consistency
      const cleanRepoUrl = repoUrl
        .trim()
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

      // Update the conversation with repo link
      conversation.linkedRepo = {
        url: cleanRepoUrl,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        addedBy: currentUser,
        addedAt: new Date(),
      };

      await conversation.save();

      res.status(200).json(conversation);
    } catch (error) {
      console.error("Error linking repository:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Remove repository link from conversation
router.delete(
  "/conversations/:conversationId/repo",
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const currentUser = req.user.username;

      // Find the conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check if user is part of this conversation
      if (!conversation.participants.includes(currentUser)) {
        return res
          .status(403)
          .json({ error: "Not authorized to modify this conversation" });
      }

      // Remove the repository link
      conversation.linkedRepo = null;

      await conversation.save();

      res.status(200).json(conversation);
    } catch (error) {
      console.error("Error removing repository link:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
