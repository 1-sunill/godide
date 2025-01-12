const mongoose = require("mongoose");

const helpSupport = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    subject: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("helpSupport", helpSupport);
