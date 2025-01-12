const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    cardHolderName: {
      type: String,
      default: null,
    },
    cardNumber: {
      type: Number,
      default: "",
    },
    expiryDate: {
      type: Date,
      default: "",
    },
    cvv: {
      type: Number,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("cards", cardSchema);
