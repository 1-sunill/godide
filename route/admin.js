const express = require("express");
const router = express.Router();
const AuthController = require("../app/v1/admin/AuthController");
const UserController = require("../app/v1/admin/UserController");
const AdminAuth = require("../app/Middleware/adminAuth");
const BannerController = require("../app/v1/admin/BannerController");
const CommonController = require("../app/v1/admin/CommonController");
const PricingController = require("../app/v1/admin/PricingController");
const CouponController = require("../app/v1/admin/CouponController");

router.post("/login", AuthController.adminLogin);

router.post("/forgot-password", AuthController.forgotPassword);
router.post("/change-password", AuthController.changePassword);

/******************* User Management ******************/
router.get("/driver-rider-list", AdminAuth, UserController.usersList);
router.post(
  "/accept-reject-driver",
  AdminAuth,
  UserController.acceptRejectDriver
);
router.post("/update-user-status", AdminAuth, UserController.statusUpdate);
router.get("/user-detail", AdminAuth, UserController.userDetails);

/******************* Banner Management ******************/
router.get("/banner-list", AdminAuth, BannerController.bannerList);
router.get("/banner-prices", AdminAuth, BannerController.bannerPricing);
router.get("/banner-detail", AdminAuth, BannerController.bannerDetail);
router.get("/banner-pricing", AdminAuth, BannerController.bannerPricing);
router.post(
  "/update-banner-price",
  AdminAuth,
  BannerController.updateBannerPrice
);
router.post("/accept-decline", AdminAuth, BannerController.acceptDecline);

/******************* Content Management ******************/
router.get("/cms-list", AdminAuth, CommonController.cmsList);
router.get("/cms-detail", CommonController.cmsDetail);
router.post("/cms-update", AdminAuth, CommonController.cmsUpdate);
router.get("/list-faq", AdminAuth, CommonController.listFaq);
router.post("/add-faq", AdminAuth, CommonController.addFaq);
router.get("/detail-faq", AdminAuth, CommonController.detailFaq);
router.post("/update-faq", AdminAuth, CommonController.updateFaq);
router.delete("/delete-faq/:id", AdminAuth, CommonController.deleteFaq);

/******************* Pricing Management ******************/
router.get("/pricing-list", AdminAuth, PricingController.pricingList);
router.get("/pricing-detail", AdminAuth, PricingController.pricingDetail);
router.post("/update-pricing", AdminAuth, PricingController.updatePricing);
router.post("/remove-price", AdminAuth, PricingController.removePricing);
router.get("/services", AdminAuth, PricingController.services);
router.get(
  "/vehicles-pricing-detail",
  AdminAuth,
  PricingController.vehiclePricingDetail
);

/******************* Coupon (Promo code) Management ******************/
router.post("/add-coupon", AdminAuth, CouponController.addCoupon);
router.post("/coupon-status", AdminAuth, CouponController.updateStatus);
router.get("/coupons-list", AdminAuth, CouponController.couponList);


module.exports = router;
