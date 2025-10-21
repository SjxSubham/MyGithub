import mongoose from "mongoose";

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
  },
  { timestamps: true },
);

// Create an index for faster queries
messageSchema.index({ conversationId: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
