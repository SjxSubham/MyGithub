import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "love", "sad", "wow", "100"],
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      ref: "User",
    },
    receiver: {
      type: String,
      required: true,
      ref: "User",
    },
    message: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "emoji"],
      default: "text",
    },
    imageUrl: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: String,
      required: true,
    },
    // Message deletion
    deletedFor: {
      type: [String],
      default: [],
    },
    // Reactions feature
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    // Reply feature
    replyTo: {
      type: String,
      default: null,
    },
    replyToSender: {
      type: String,
      default: null,
    },
    replyToMessage: {
      type: String,
      default: null,
    },
    // Forward feature
    forwardedFrom: {
      type: String,
      default: null,
    },
    forwardedMessageId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Create an index for faster queries
messageSchema.index({ conversationId: 1 });
// Add index for deletedFor to efficiently query non-deleted messages
messageSchema.index({ conversationId: 1, deletedFor: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
