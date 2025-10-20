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
    read: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: String,
      required: true,
    },
    issueReferences: [
      {
        issueNumber: Number,
        title: String,
        url: String,
        type: {
          type: String,
          enum: ["issue", "pr"],
          default: "issue",
        },
      },
    ],
    repoReference: {
      url: String,
      owner: String,
      repo: String,
    },
  },
  { timestamps: true },
);

// Create an index for faster queries
messageSchema.index({ conversationId: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
