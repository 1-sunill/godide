const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: Number,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    message: {
      type: String,
      default: null,
    },
    senderType: {
      type: String,
      enum: ["user", "driver"],
    },
    receiverType: {
      type: String,
      enum: ["user", "driver"],
    },
    messageType: {
      type: Number,
      enum: [1, 2, 3, 4], //1=>text,2=>image,3>audio,4=>video
      default: 1,
    },
    images: [],
    clearBy: [],
    seenBy: [],
    deletedBy: [],
    status: {
      type: Boolean,
      default: true,
    },
    callStatus: {
      type: String,
      enum: ["queued", "accepted", "rejected", "missed", "ended"],
    },
    duration: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("chatmessages", chatMessageSchema);
