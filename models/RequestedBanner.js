const mongoose = require("mongoose");

let requestedBannerSchema = new mongoose.Schema(
  {
    userId: { type:  mongoose.Schema.Types.ObjectId, ref: "Users" },
    bannerPriceId: { type: mongoose.Schema.Types.ObjectId, ref: "BannerPrice" },
    bannerImage: { type: String, default: "" },
    requestedDate: { type: Date, default: Date.now },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    noOfDays: { type: Number, default: "" },
    status: {
      type: Number,
      default: 0,
      enum: [0, 1, 2],
      comment: "0=>pending,1=>accepted,2=>rejected",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RequestedBanner", requestedBannerSchema);
