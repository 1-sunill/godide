const mongoose = require("mongoose");
const { Schema } = mongoose;
const userSessionSchema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Users" },

    token: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSession", userSessionSchema);
