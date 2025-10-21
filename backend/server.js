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
    }) => {
      const receiverSocketId = onlineUsers.get(receiver);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveMessage", {
          sender,
          message,
          conversationId,
          createdAt: new Date(),
          _id: messageId,
          messageType,
          imageUrl,
        });

        // Send delivery confirmation back to sender
        socket.emit("messageDelivered", messageId);
      }
    },
  );

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

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
  connectMongoDB();
});
