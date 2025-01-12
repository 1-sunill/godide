const mongoose = require("mongoose");

let bannerPriceSchema = new mongoose.Schema(
  {
    noOfDays: { type: Number, default: 0 },
    price: { type: Number, default: 0 }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("BannerPrice", bannerPriceSchema);
