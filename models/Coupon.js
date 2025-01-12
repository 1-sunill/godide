const mongoose = require("mongoose");

let couponSchema = new mongoose.Schema(
  {
    couponId: { type: String, default: "" },
    name: { type: String, default: "" },
    amount: { type: Number, default: "" },
    details: { type: String, default: "" },
    startDate: { type: Date, default: "" },
    endDate: { type: Date, default: "" },
    status: { type: Number, default: 1, Comment: "1=>Active, 0=>In-active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
