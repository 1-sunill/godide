const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, default: "" },
    title: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    driverId: { type: mongoose.Schema.Types.ObjectId, default: null },
    source: { type: String, default: "", comment: "Source Address" },
    s_lat: { type: String, default: "", comment: "Source Latitude" },
    s_long: { type: String, default: "", comment: "Source Longitude" },
    destination: { type: String, default: "", comment: "Destination Address" },
    d_lat: { type: String, default: "", comment: "Destination Latitude" },
    d_long: { type: String, default: "", comment: "Destination Longitude" },
    distance: { type: String, default: "", comment: "Distance in km" },
    totalTime: { type: String, default: "", comment: "Total time in minutes" },
    date_of_booking: {
      type: Date,
      default: "",
      comment: "Booking date  : (In UTC)",
    },
    time_of_booking: {
      type: String,
      default: "",
      comment: "Time of booking",
    },
    couponCode: { type: String, default: "" },
    startTime: { type: String, default: "", comment: "Start ride time" },
    endTime: { type: Date, default: "", comment: "End ride time" },
    acceptTime: { type: String, default: "", comment: "Accept ride time" },
    rejectTime: { type: String, default: "", comment: "Reject ride time" },
    updatedAmount: {
      type: Number,
      default: "",
      comment: "Updated amount after ride",
    },
    totalFare: {
      type: Number,
      default: "",
      comment: "total amount",
    },
    bookingType: {
      type: Number,
      default: 1,
      comment: "1=Normal Booking, 2=Schedule Booking",
    },
    bootSpace: {
      type: Number,
      default: 0,
      comment: "1=yes, 2=No",
    },
    isRoundTrip: {
      type: Number,
      default: 0,
      comment: "1=yes, 2=No",
    },
    scheduleEndDate: {
      type: Date,
      default: "",
      comment: "End Of Booking date : (In UTC)",
    },
    scheduleTime: {
      type: String,
      default: "",
      comment: "Scheduled booking time",
    },
    scheduleEndTime: {
      type: String,
      default: "",
      comment: "Scheduled end booking time",
    },
    reason: { type: String, default: "", comment: "Cancel reason" },
    cancelCharge: { type: Number, default: "", comment: "Cancellation charge" },
    extraCharge: { type: Number, default: "", comment: "Extra charge, if any" },
    reviewByUser: {
      type: Number,
      default: 0,
      comment: "0=>not-reviewed, 1=>reviewed",
    },
    reviewByDriver: {
      type: Number,
      default: 0,
      comment: "0=>not-reviewed, 1=>reviewed",
    },
    isUpcomingStatus: {
      type: Number,
      default: 0,
      comment: "0=>Not-upcoming, 1=>upcoming",
    },
    isShuttleBooking: {
      type: Number,
      default: 0,
      comment: "0=>No, 1=>yes",
    },
    isCarpoolBooking: {
      type: Number,
      default: 0,
      comment: "0=>No, 1=>yes",
    },
    payStatus: { type: Number, default: 0, comment: "0=>Unpaid, 1=>Paid" },
    otp: {
      type: Number,
      default: "",
      comment: "One-time password for verification",
    },
    status: {
      type: Number,
      default: 0,
      comment:
        "0=Pending, 1=Accepted, 2=Canceled By User, 3=Reached at location, 4=Ongoing (Start trip), 5=Completed, 6=Canceled By Driver,7=>Reach on destination",
    },
    serviceType: {
      type: String,
      default: "",
    },
    passengers: {
      type: Number,
      default: 0,
    },
    patientDetails: {
      patientName: { type: String, default: "" },
      age: { type: Number, default: 0 },
      gender: { type: Number, Comment: "1=>Male, 2=>Female" },
      reason: { type: String, default: "" },
    },
    towingVehicle: { type: String, default: "" },
    towVehicleImg: { type: String, default: "" },
    roomId: { type: Number, default: "" },
    paymentObj: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
