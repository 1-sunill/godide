const mongoose = require("mongoose");

const userAddressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: "" },
    placeName: { type: String, default: "" },
    address: { type: String, default: "" },
    isDefault: {
      type: Number,
      default: 0,
      Comment: "1=>Default,0=>Not-default",
    },
    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserAddress", userAddressSchema);
