const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    gender: { type: Number, Comment: "1=>Male, 2=>Female" },
    dob: { type: String, default: "" },
    countryCode: { type: String, default: "" },
    mobile: { type: String, default: "" },
    cityId: { type: Number, default: 0 },
    roleType: { type: Number, default: 0, Comment: "1=>Rider,2=>Driver" },
    // currentLocation: { type: String, default: "" },
    currentLat: { type: String, default: "" },
    currentLong: { type: String, default: "" },
    address: { type: String, default: "" },
    landMark: { type: String, default: "" },
    govtIdImage: { type: String, default: "" },
    // lat: { type: String, default: "" },
    // long: { type: String, default: "" },
    userImage: { type: String, default: "" },
    isAlsoOther: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    deviceToken: { type: String, default: "" },
    voipToken: { type: String, default: "" },
    status: { type: Number, default: 1, Comment: "1=>Active, 0=>Inactive" },
    live: { type: Number, default: 0, Comment: "1=>Online, 0=>Offline" },
    ongoingStatus: {
      type: Number,
      default: 0,
      Comment: "1=>Ongoing, 0=>Not Ongoing",
    },
    otp: { type: Number, default: "" },
    otpTime: { type: Date },
    walletBalance: { type: Number, default: 0 },
    language: { type: String, default: "en" },
    verifyStatus: {
      type: Number,
      default: 0,
      Comment: "0=>Pending, 1=>Verified, 2=>Reject",
    },
    isBankAccount: {
      type: Number,
      default: 0,
      Comment: "0=>Not Submitted, 1=>Submitted",
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    isLicence: {
      type: Number,
      default: 0,
      Comment: "0=>Not Submitted, 1=>Submitted",
    },
    isOnline: {
      type: Boolean,
      default: true, // Default value is true (active)
      comment: "true=>online,false=>offilne",
    },
    stripeCustomerId: { type: String, default: "" },
    stripeAccountId: { type: String, default: "" },
    accCreated: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
  { description: "User Information" }
);

// Override find, findOne, and other query methods to exclude soft-deleted records
userSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});
userSchema.methods.generateToken = async function () {
  const secret = process.env.JWT_SECRET_KEY; // Replace with your own secret key
  const token = jwt.sign(
    {
      _id: this._id,
      status: this.status,
    },
    secret,
    {
      expiresIn: "7d",
    }
  );
  return token;
};
module.exports = mongoose.model("Users", userSchema);
