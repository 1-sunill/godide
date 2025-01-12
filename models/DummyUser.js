const mongoose = require("mongoose");

let dummyUserSchema = new mongoose.Schema(
  {
    mobile: { type: String, default: "" },
    roleType: { type: Number, default: "" },
    otp: { type: Number, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DummyUsers", dummyUserSchema);
