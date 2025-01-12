const mongoose = require("mongoose");

const servicesSchema = new mongoose.Schema(
  {
    serviceName: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Services", servicesSchema);
