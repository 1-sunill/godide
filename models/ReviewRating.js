const mongoose = require("mongoose");

const { Schema } = mongoose;

const reviewRatingSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
    userId: { type: Schema.Types.ObjectId, ref: "Users" },
    driverId: { type: Schema.Types.ObjectId, ref: "Users" },
    rating: { type: Number, default: 0 },
    review: { type: String, default: "" },
    type: { type: Number, Comment: "1=>Rider,2=>Driver" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReviewRating", reviewRatingSchema);
