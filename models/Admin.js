const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

let adminSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    profileImg: { type: String, default: "" },
    profileImg: { type: String, default: "" },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);
adminSchema.methods.generateToken = async function () {
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
module.exports = mongoose.model("Admin", adminSchema);
