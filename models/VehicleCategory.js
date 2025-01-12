const mongoose = require("mongoose");

const vehicleCatSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    categoryName: { type: String, default: "" },
    categoryImage: { type: String, default: "" },
    seats: { type: Number, defualt: 0 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VehicleCategory", vehicleCatSchema);
