const mongoose = require("mongoose");

const userDocumentsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    vehicleCatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleCategory",
    },
    vehicleServiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Services" },
    vehicleName: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    drivingLicence: { type: String, default: "" },
    vehicleInsurance: { type: String, default: "" },
    //Shuttle case start
    source: { type: String, default: "", comment: "In shuttle case" },
    destination: { type: String, default: "", comment: "In shuttle case" },
    startLocationLat: { type: String, default: "", comment: "In shuttle case" },
    startLocationLong: {
      type: String,
      default: "",
      comment: "In shuttle case",
    },
    dropLocationLat: { type: String, default: "", comment: "In shuttle case" },
    dropLocationLong: { type: String, default: "", comment: "In shuttle case" },
    routes: [
      {
        lat: { type: String, default: "" },
        long: { type: String, default: "" },
        destination: { type: String, default: "" },
      },
    ],
    startTime: {
      type: String,
      default: "",
    },
    endTime: {
      type: String,
      default: "",
    },
    noOfSeat: { type: Number, default: 0 },
    //Shuttle Case end
    bootSpace: {
      type: Number,
      default: 0,
      Comment: "0=>No, 1=>yes",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDocuments", userDocumentsSchema);
