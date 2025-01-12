const mongoose = require("mongoose");

const { Schema } = mongoose;

const ridePricingSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    vehicleCategoryId: { type: Schema.Types.ObjectId, ref: "VehicleCategory" },
    serviceId: { type: Schema.Types.ObjectId, ref: "Services" },
    baseFare: { type: Number, default: 0 },
    extraFare: { type: Number, default: 0 },
    nightTime: { type: Number, default: 0, comment: "In percent" },
    currency: { type: String, default: "" },
    hourlyCharges: { type: Number, default: 0 },
    kmCharges: [
      {
        from: { type: Number, default: 0 },
        to: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("RidePricing", ridePricingSchema);
