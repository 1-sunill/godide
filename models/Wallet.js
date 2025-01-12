const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccounts" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    bookingNo: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    transactionType: {
      type: Number,
      defualt: 0,
      Comment: "1=>Credit,2=>Debit",
    },
    transactionId: { type: String, default: "" },
    status:{ type: String, default: "" },
    accountTransferResponse:{ type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Wallet", walletSchema);
