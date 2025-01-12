const mongoose = require("mongoose");

let faqSchema = new mongoose.Schema(
  {
    question: { type: String, default: "" },
    answer: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FAQ", faqSchema);
