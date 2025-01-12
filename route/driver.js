const express = require("express");
const router = express.Router();
const AuthController = require("../app/v1/api/driver/AuthController");
const BookingController = require("../app/v1/api/driver/BookingController");
const WalletController = require("../app/v1/api/driver/WalletController");
const PaymentController = require("../app/v1/api/driver/PaymentController");
const UserAuth = require("../app/Middleware/userAuth");

router.post("/save-vehicle-info", UserAuth, AuthController.saveVehicleInfo);
router.post("/save-bank-info", UserAuth, AuthController.saveBankInfo);
router.get("/bank-info", UserAuth, AuthController.bankInfo);

router.get("/vehicle-list", AuthController.vehicleList);
router.get("/vehicle-type", AuthController.vehicleType);
router.get("/services", AuthController.services);
router.post("/update-service", UserAuth, AuthController.updateService);
router.get("/banner-pricing-list", UserAuth, AuthController.bannerPricingList);
router.post("/banner-request", UserAuth, AuthController.bannerRequest);
router.post(
  "/update-driver-detail",
  UserAuth,
  AuthController.updateDriverDetail
);
router.post("/verify-email-otp", UserAuth, AuthController.verifyEmailOtp);

/******************** Booking **********************/
router.get("/booking-list", UserAuth, BookingController.bookingList);
router.post("/accept-ride", UserAuth, BookingController.acceptBooking);
router.post("/update-ride-status", UserAuth, BookingController.updateStatus);
router.post("/verify-booking-otp", UserAuth, BookingController.verifyOtp);
router.post("/update-live-status", UserAuth, BookingController.isLiveStatus);
router.get("/booking-detail", UserAuth, BookingController.bookingDetail);

/******************** Wallet Management **********************/
router.get(
  "/wallet-transactions",
  UserAuth,
  WalletController.walletTransactions
);
router.post("/amount-cashout", UserAuth, WalletController.cashOutWallet);

router.get("/my-earnings", UserAuth, WalletController.myEarningList);

router.post(
  "/create-account",
  UserAuth,
  PaymentController.connectAccount
);

router.get("/payment/success", PaymentController.success);
router.get("/payment/failed", PaymentController.failed);
module.exports = router;
