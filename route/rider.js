const express = require("express");
const router = express.Router();
const AuthController = require("../app/v1/api/rider/AuthController");
const UserAuth = require("../app/Middleware/userAuth");
const BookingController = require("../app/v1/api/rider/BookingController");
const WalletController = require("../app/v1/api/rider/WalletController");
const CardController = require("../app/v1/api/rider/CardController");
const PaymentController = require("../app/v1/api/rider/PaymentController");

router.get("/home", UserAuth, AuthController.home);
router.post("/add-address", UserAuth, AuthController.addAddress);
router.get("/address-list", UserAuth, AuthController.addressList);
router.post("/update-rider-detail", UserAuth, AuthController.updateRiderDetail);
router.get("/services", AuthController.services);
router.post("/verify-email-otp", UserAuth, AuthController.verifyEmailOtp);
router.post("/save-vehicle-info", UserAuth, AuthController.saveVehicleInfo);

/******************** Booking management ***************************/
router.get("/book-vehicle-list", UserAuth, BookingController.vehicleList);
router.post("/book-ride", UserAuth, BookingController.bookRide);
router.get("/booking-detail", UserAuth, BookingController.driverDetail);
router.get(
  "/nearest-drivers-list",
  UserAuth,
  BookingController.nearestDriversList
);

//Travel
router.get(
  "/travel-vehicle-list",
  UserAuth,
  BookingController.travelVehicleList
);
router.post("/book-travel", UserAuth, BookingController.travelBooking);

//Rental
router.get(
  "/rental-booking-list",
  UserAuth,
  BookingController.rentalBookingList
);
router.post("/book-rentals", UserAuth, BookingController.bookRental);

//Shuttle
router.get("/shuttles-list", UserAuth, BookingController.shuttlesList);
router.post("/shuttle-booking", UserAuth, BookingController.bookShuttle);

//Carpool
router.get("/carpool-list", UserAuth, BookingController.carpoolList);
router.post("/book-carpool", UserAuth, BookingController.bookCarPool);

router.post("/apply-coupon", UserAuth, BookingController.applyCoupon);
router.post("/make-payment", UserAuth, BookingController.makePayment);

/******************** Wallet Management **********************/
router.get(
  "/wallet-transactions",
  UserAuth,
  WalletController.walletTransactions
);
router.post("/credit-amount", UserAuth, WalletController.creditWallet);
router.get("/call-back", WalletController.callBack);

/******************** Card Management **********************/
router.post("/add-card", UserAuth, PaymentController.addStripeCard);
router.get("/cards-list", UserAuth, PaymentController.stripeCardList);

router.get("/coupon-list", UserAuth, WalletController.couponList);

module.exports = router;
