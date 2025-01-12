const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    vehicleName: { type: String, default: "" },
    vehicleImage: { type: String, default: "" },
    isHide: { type: Number, default: 0, Comment: "0=>notHide,1=>hide" },
    seats: { type: Number, defualt: 0 },
    serviceType: {
      type: Number,
      default: 1,
      Comment: "1=>general,2=>emergency",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
