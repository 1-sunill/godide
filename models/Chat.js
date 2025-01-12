const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId },
    roomId: {
      type: Number,
      default: function () {
        // Combine timestamp with a random number to ensure uniqueness
        return Date.now() + Math.floor(Math.random() * 1000);
      },
      unique: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessage: {
      type: String,
      default: null,
    },
    messageType: {
      type: Number,
      enum: [1], //1=>text
      default: 1,
    },
    isNormalChat: {
      type: Boolean,
      default: 1, //1=>normal chat
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("chats", chatSchema);
