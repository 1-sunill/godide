const express = require("express");
const router = express.Router();
const CommonController = require("../app/v1/api/CommonController");
const PaymentController = require("../app/v1/api/PaymentController");
const UserAuth = require("../app/Middleware/userAuth");

router.post("/decrypter", CommonController.decrypter);
router.post("/encrypter", CommonController.encrypter1);

router.post("/send-otp", CommonController.sendOtp);
router.post("/verify-otp", CommonController.verifyOtp);
router.post("/sign-up", CommonController.signup);
router.get("/user-detail", UserAuth, CommonController.userDetail);
router.get("/term-condition", CommonController.termCondition);
router.get("/privacy-policy", CommonController.privacyPolicy);
router.get("/list-faq", CommonController.listFaq);

//Ride cancelled

router.post("/cancel-ride", UserAuth, CommonController.cancelRide);
router.post("/update-lat-long", UserAuth, CommonController.updateLatLong);
router.get("/booking-history", UserAuth, CommonController.bookingHistory);
router.get(
  "/shuttle-booking-history",
  UserAuth,
  CommonController.shuttleBookingHistory
);

router.post("/review-rating", UserAuth, CommonController.reviewRating);
router.post("/delete-account", UserAuth, CommonController.deleteAccount);
router.get("/notification-list", UserAuth, CommonController.notificationList);
router.post("/send-notification", CommonController.sendNotifcation);
router.post("/help-support", UserAuth, CommonController.helpSupport);

//Payment
router.post("/bank-list", UserAuth, PaymentController.banklist);
router.post("/create-account", UserAuth, PaymentController.createAccount);
router.post("/account-detail", UserAuth, PaymentController.bankList);
router.post("/delete-bank", UserAuth, PaymentController.deleteBank);
router.post(
  "/wallet-to-account",
  UserAuth,
  PaymentController.transferAmountFromWalletToAccount
);
router.post("/add-new-card", UserAuth, PaymentController.addNewCard);
router.get("/cards-list", UserAuth, PaymentController.cardList);
router.post("/make-payment", UserAuth, PaymentController.payment);
router.get("/call-back", PaymentController.callBack);

router.get("/force-update", CommonController.forceUpdate);

module.exports = router;
