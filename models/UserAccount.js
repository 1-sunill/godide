const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: "" },

    // type: {
    //   type: String,
    //   enum: ["basa", "nuban", "ghipss", "mobile_money"],
    //   require: true,
    // },
    bankCode: {
      type: String,
      require: true,
    },
    bankName: {
      type: String,
      require: true,
    },
    accountNumber: {
      type: String,
      require: true,
    },
    currency: {
      type: String,
      enum: ["ZAR", "NGN", "GHS"],
    },
    bankUserName: {
      type: String,
    },
    recipientCode: {
      type: String,
    },
    country: {
      type: String,
      require: true,
    },
    status: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
      Comment: "1=>Active,2=>Block,3=>delete",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Account", accountSchema);
