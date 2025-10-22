import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";
import "./passport/github.auth.js";
import userRoutes from "./routes/user.route.js";
import exploreRoutes from "./routes/explore.route.js";
import authRoutes from "./routes/auth.route.js";
import chatRoutes from "./routes/chat.route.js";
import connectMongoDB from "./db/connectMongoDB.js";
import path from "path";
import nodeCron from "node-cron";
import { pingServer } from "./utils/pingServer.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

console.log("dirname", __dirname);

app.use(
  session({ secret: "keyboard cat", resave: false, saveUninitialized: false }),
);
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api/chat", chatRoutes);

// Health check endpoint for keeping the server alive
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// Socket.io setup
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("join", (username) => {
    onlineUsers.set(username, socket.id);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    console.log(`${username} joined the chat`);
  });

  socket.on(
    "sendMessage",
    ({
      sender,
      receiver,
      message,
      conversationId,
      messageId,
      messageType,
      imageUrl,
      replyTo,
      replyToSender,
      replyToMessage,
    }) => {
      const receiverSocketId = onlineUsers.get(receiver);

      // Log incoming message data for debugging
      console.log(`Socket message from ${sender} to ${receiver}:`, {
        type: messageType,
        id: messageId,
        hasImage: !!imageUrl,
        isReply: !!replyTo,
      });

      // Create the message object with all necessary fields
      const messageData = {
        sender,
        message,
        conversationId,
        createdAt: new Date(),
        _id: messageId,
        messageType: messageType || "text",
      };

      // Add reply information if it exists
      if (replyTo) {
        messageData.replyTo = replyTo;
        messageData.replyToSender = replyToSender;
        messageData.replyToMessage = replyToMessage;
      }

      // Only add imageUrl if it exists and message type is image
      if (messageType === "image" && imageUrl) {
        console.log(
          `Adding image URL to socket message: ${imageUrl.substring(0, 30)}...`,
        );
        messageData.imageUrl = imageUrl;
      }

      if (receiverSocketId) {
        // Send to receiver
        console.log(
          `Sending message to ${receiver} (socket: ${receiverSocketId.substring(0, 8)}...)`,
        );
        io.to(receiverSocketId).emit("receiveMessage", messageData);

        // Send delivery confirmation back to sender
        socket.emit("messageDelivered", messageId);
      } else {
        console.log(
          `User ${receiver} is not online. Message will be delivered when they connect.`,
        );
      }
    },
  );

  // Handle message deletion for everyone
  socket.on(
    "deleteMessageForEveryone",
    ({ messageId, conversationId, deletedBy }) => {
      console.log(
        `Message deletion request for message ${messageId} in conversation ${conversationId}`,
      );

      // Find all participants in this conversation to notify them
      // In a real implementation, you should query the database
      // This is a simplified version that broadcasts to all relevant users
      for (const [username, socketId] of onlineUsers.entries()) {
        if (socketId !== socket.id) {
          // Don't send back to the deleter
          io.to(socketId).emit("messageDeleted", {
            messageId,
            conversationId,
            deletedBy,
          });
        }
      }
    },
  );

  // Handle message reactions
  socket.on("messageReaction", ({ messageId, conversationId, reaction }) => {
    console.log(
      `Reaction ${reaction.type} on message ${messageId} from ${reaction.username}`,
    );

    // Notify other users about the reaction
    for (const [username, socketId] of onlineUsers.entries()) {
      if (socketId !== socket.id && username !== reaction.username) {
        io.to(socketId).emit("messageReaction", {
          messageId,
          conversationId,
          reaction,
        });
      }
    }
  });

  // Handle message forwarding
  socket.on("messageForwarded", ({ conversationId, receiver, sender }) => {
    const receiverSocketId = onlineUsers.get(receiver);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageForwarded", {
        conversationId,
        sender,
      });
    }
  });

  socket.on("disconnect", () => {
    let disconnectedUser;
    for (const [username, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        disconnectedUser = username;
        break;
      }
    }

    if (disconnectedUser) {
      onlineUsers.delete(disconnectedUser);
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      console.log(`${disconnectedUser} left the chat`);
    }
  });
});

// Set up a cron job to ping the server every 14 minutes to prevent Render from sleeping
const setupCronJob = () => {
  // Get the deployment URL from environment or use localhost for development
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const pingUrl = `${appUrl}/api/health`;

  console.log(
    `Setting up cron job to ping ${pingUrl} every 14 minutes to prevent sleep`,
  );

  // Schedule the cron job to run every 14 minutes
  // The "*/14 * * * *" format means: "At every 14th minute"
  nodeCron.schedule("*/14 * * * *", async () => {
    const timestamp = new Date().toISOString();
    console.log(
      `🔄 [${timestamp}] Running scheduled ping to keep server alive`,
    );

    try {
      await pingServer(pingUrl);
    } catch (error) {
      console.error(`❌ Scheduled ping failed: ${error.message}`);
    }
  });

  // Run an initial ping immediately on startup
  setTimeout(async () => {
    try {
      console.log("🚀 Running initial ping on startup");
      await pingServer(pingUrl);
    } catch (error) {
      console.error(`❌ Initial ping failed: ${error.message}`);
    }
  }, 5000); // Wait 5 seconds after server start
};

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
  connectMongoDB();
  setupCronJob();
});
