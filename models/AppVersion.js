const mongoose = require("mongoose");

let appVersionSchema = new mongoose.Schema(
  {
    type: { type: String, default: "user" },
    deviceType: { type: String, default: "android" },
    message: { type: String },
    version: { type: Number },
    force_update: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppVersion", appVersionSchema);
