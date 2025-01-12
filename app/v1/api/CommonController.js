const {
  success,
  failed,
  serverError,
  validateFail,
} = require("../../helper/response");
const { dump } = require("../../helper/logs");
const { Validator } = require("node-input-validator");
const DummyUser = require("../../../models/DummyUser");
const VehicleCategory = require("../../../models/Vehicle");
const { aws } = require("../../helper/aws");
const User = require("../../../models/User");
const bcrypt = require("bcryptjs");
const Admin = require("../../../models/Admin");
const Banner = require("../../../models/BannerPrice");
const { ObjectId } = require("mongodb");
const CryptoJS = require("crypto-js");
const CMS = require("../../../models/Cms");
const FAQ = require("../../../models/Faq");
const Address = require("../../../models/UserAddress");
const Booking = require("../../../models/Booking");
const ReviewRating = require("../../../models/ReviewRating");
const Notification = require("../../../models/Notification");
const HelpSupport = require("../../../models/HelpSupport");
const Coupon = require("../../../models/Coupon");
const UserSession = require("../../../models/UserSessions");
const AppVersion = require("../../../models/AppVersion");
const {
  updateDriverRating,
  sendNewNotification,
  updateRiderRating,
  sendOTP,
} = require("../../../app/helper/helpers");
const moment = require("moment");
const UserDocuments = require("../../../models/UserDocuments");
const Services = require("../../../models/Services");
const { lowerCase } = require("lodash");
var msg91 = require("msg91-api")(process.env.MSG91_API_KEY);
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000); // Generates a random 4-digit number between 1000 and 9999
};
// const { decrypter1,encrypter } = require("../../helper/crypto");
module.exports = {
  decrypter: async (req, res) => {
    try {
      var bytes = CryptoJS.AES.decrypt(
        req.body.reqData,
        process.env.ENCRYPTION_SECRET
      );
      var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      res.json(decryptedData);
    } catch (error) {
      console.log({ error });
    }
  },

  encrypter1: async (req, res) => {
    try {
      var ciphertext = CryptoJS.AES.encrypt(
        JSON.stringify(req.body),
        process.env.ENCRYPTION_SECRET
      ).toString();
      res.json(ciphertext);
    } catch (error) {
      console.log({ error });
    }
  },
  //Send Otp
  sendOtp: async (req, res) => {
    var requests = await decrypter(req.body);
    const validate = new Validator(requests, {
      mobile: "required",
      roleType: "required|in:1,2", //1=>Rider,2=>Driver
    });

    const matched = await validate.check();
    if (!matched) {
      return validateFail(res, validate);
    }
    const { mobile, roleType } = requests;
    const mobileOtp = generateOtp();
    const user = await User.findOne({ mobile: mobile, roleType: roleType });
    if (user) {
      await user.updateOne({ otp: mobileOtp });
    } else {
      const dummyUser = await DummyUser.findOne({ mobile });
      if (dummyUser) {
        await DummyUser.updateOne(
          { mobile },
          { otp: mobileOtp, roleType: roleType }
        );
      } else {
        const reqData = {
          mobile,
          otp: mobileOtp,
          roleType: roleType,
        };
        await DummyUser.create(reqData);
      }
    }
    var senderId = "NDANYANA";
    var flowId = "66fbd656d6fc0518f873ac42";
    var args = {
      flow_id: flowId,
      sender: senderId,
      mobiles: "91" + mobile,
      name: "user",
    };
    await sendOTP(mobile, "User", mobileOtp);

    return success(res, "otp_send_successfully.");
  },
  //Verify Otp
  verifyOtp: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        mobile: "required",
        otp: "required",
        roleType: "required|in:1,2", //1=>Rider,2=>Driver
      });

      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }
      const { mobile, otp, roleType, deviceToken, deviceType, agoraToken } =
        requests;
      //Check user exist or not
      const user = await User.findOne({
        mobile: mobile,
        roleType: roleType,
        isDeleted: false,
      });
      // if (user?.isDeleted === true) {
      //   return failed(res, "Your account has been deleted.");
      // }
      //Generate jwt token
      if (user) {
        let token = await user.generateToken();

        if (user.otp !== parseInt(otp)) {
          return failed(res, "otp_is_not_valid");
        }
        //After verify update otp null

        await user.updateOne({
          otp: "",
          deviceToken,
          deviceType,
          voipToken: agoraToken,
        });
        const existingSession = await UserSession.findOne({ userId: user._id });

        if (existingSession) {
          await UserSession.deleteOne({ userId: user._id });
        }
        // Create a new session
        await UserSession.create({
          userId: user._id,
          token,
        });
        //get user service data
        const userdoc = await UserDocuments.findOne({ userId: user._id });
        let service;
        if (userdoc) {
          service = await Services.findOne({
            _id: userdoc.vehicleServiceId,
          });
          console.log(service, "++++++++++++");
        }

        const responseData = {
          user: user,
          service,
          token: token,
        };
        return success(res, "otp_verified_successfully", responseData);
      } else {
        // Find user by mobile number
        const dummyUser = await DummyUser.findOne({ mobile });

        if (!dummyUser) {
          return failed(res, "mobile_number_is_not_valid");
        }

        if (dummyUser.otp !== parseInt(otp)) {
          return failed(res, "otp_is_not_valid");
        }
        await dummyUser.deleteOne();
        return success(res, "otp_verified_successfully");
      }
    } catch (error) {
      console.log(error);
      return serverError(res, "internal_server_error");
    }
  },

  //Signup user(rider) and driver
  signup: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let validate;
      if (requests.roleType == 2) {
        validate = new Validator(requests, {
          name: "required",
          email: "required|email",
          gender: "required",
          dob: "required",
          cityId: "required",
          currentLat: "required",
          currentLong: "required",
          mobile: "required",
          roleType: "required",
        });
      } else {
        validate = new Validator(requests, {
          name: "required",
          email: "required|email",
          mobile: "required",
          roleType: "required",
        });
      }

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const {
        name,
        email,
        gender,
        dob,
        countryCode,
        mobile,
        cityId,
        roleType,
        currentLat,
        currentLong,
        landMark,
        address,
        deviceToken,
        deviceType,
        agoraToken,
      } = requests;
      //Check user exist or not
      const checkUserMobile = await User.findOne({
        mobile: mobile,
        roleType: roleType,
        isDeleted: false,
      });
      const checkUserEmail = await User.findOne({
        email: email,
        roleType: roleType,
        isDeleted: false,
      });

      if (checkUserEmail) {
        return failed(res, "user_email_already_exists");
      }
      if (checkUserMobile) {
        return failed(res, "user_mobile_no_already_exists");
      }

      let reqData = {
        name,
        email,
        gender,
        dob,
        countryCode,
        mobile,
        cityId,
        roleType,
        currentLat,
        currentLong,
        landMark,
        address,
        deviceToken,
        deviceType,
        voipToken: agoraToken,
      };

      // console.log(req.files);
      if (req.files && req.files.userImage) {
        let userImageFileName = await aws(req.files.userImage, "users");
        reqData = Object.assign(reqData, {
          userImage: userImageFileName.Location,
        });
      }
      if (req.files && req.files.govtIdImage) {
        let govtIdImageFileName = await aws(req.files.govtIdImage, "govtId");
        reqData = Object.assign(reqData, {
          govtIdImage: govtIdImageFileName.Location,
        });
      }

      let user = await User.create(reqData);
      // if (requests.address) {
      //   const reqData = {
      //     userId: user._id,
      //     address: requests.address,
      //     isDefault: 1, // Set the new address as default
      //     longitude: requests.longitude,
      //     latitude: requests.latitude,
      //   };
      //   await Address.create(reqData);
      // }
      let token = await user.generateToken();
      const responseData = {
        user: user,
        token: token,
      };
      return success(res, "user_signup_successfully", responseData);
    } catch (error) {
      console.log(error);
      return serverError(res, "internal_server_error");
    }
  },
  //user Detail
  userDetail: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      let userId = new ObjectId(req.user._id);
      console.log({ userId });

      let user = await User.aggregate([
        {
          $match: { _id: userId, isDeleted: false },
        },
        {
          $lookup: {
            from: "accountss",
            localField: "_id",
            foreignField: "userId",
            as: "bankDetail",
          },
        },
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "userDocuments",
          },
        },
      ]);
      const currentDate = new Date();
      // CommonController.jsrrentDate.setHours(0, 0, 0, 0); // Set time to beginning of the day

      // Query bookings created on the current date
      const bookings = await Booking.find({
        createdAt: { $gte: currentDate },
        driverId: userId,
      });

      // Calculate total number of rides and sum of updated amounts
      let totalRides = bookings.length;
      let totalUpdatedAmount = bookings.reduce(
        (sum, booking) => sum + booking.updatedAmount,
        0
      );

      // Assign computed values to the user object
      if (user.length > 0) {
        user[0].totalRide = totalRides;
        user[0].totalEarning = parseFloat(totalUpdatedAmount.toFixed(2));
      }
      const userDocuments = await UserDocuments.findOne({
        userId: user[0]._id,
      });
      console.log("userDocuments____________", userDocuments);
      if (userDocuments && userDocuments.vehicleServiceId) {
        const service = await Services.findOne({
          _id: userDocuments.vehicleServiceId,
        });
        if (service) {
          user[0].serviceType = lowerCase(service.serviceName);
        } else {
          user[0].serviceType = "";
        }
      } else {
        user[0].serviceType = "";
      }

      // const newData = {
      //   user: user[0],
      //   totalRide: 3,
      //   totalEarning: 123,
      // };
      // Return the first user document from the array
      return success(res, "user_detail_fetched_successfully", user[0]);
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  //term & condition
  termCondition: async (req, res) => {
    try {
      const data = await CMS.findOne({ _id: "6603fd36e39b75de5c006424" });
      success(res, "data_fetched_successfully", data);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //Privacy Policy
  privacyPolicy: async (req, res) => {
    try {
      const data = await CMS.findOne({ _id: "6603fd544360f4112d4f7b6f" });
      success(res, "data_fetched_successfully", data);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //List Faq
  listFaq: async (req, res) => {
    try {
      const list = await FAQ.find();
      success(res, "data_listed_successfully", list);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //Cancel your ride
  cancelRide: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = new ObjectId(req.user._id);

      const validate = new Validator(requests, {
        bookingId: "required",
        reason: "required",
        status: "required|in:6",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const reqData = {
        reason: requests.reason,
        title: "Cancelled",
        status: parseInt(requests.status),
      };
      // Ensure the user can only cancel their own booking
      const booking = await Booking.findOne({
        _id: requests.bookingId,
      });

      if (!booking) {
        return failed(res, "booking_not_found_or_unauthorized_to_cancel");
      }

      await Booking.updateOne({ _id: requests.bookingId }, { $set: reqData });
      console.log();
      //update driver ongoing status
      await User.updateOne({ _id: booking.driverId }, { ongoingStatus: 0 });

      //update rider ongoing status
      await User.updateOne({ _id: booking.userId }, { ongoingStatus: 0 });

      success(res, "ride_cancelled_successfully");
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //update Lat long
  updateLatLong: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = new ObjectId(req.user._id);

      const validate = new Validator(requests, {
        currentLat: "required",
        currentLong: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const reqData = {
        currentLat: requests.currentLat,
        currentLong: requests.currentLong,
      };
      console.log("Update lat long", reqData);
      const user = await User.findOne({
        _id: userId,
      });

      if (!user) {
        return failed(res, "user_not_found_or_unauthorized");
      }
      await User.updateOne({ _id: userId }, { $set: reqData });
      success(res, "your_lat_long_updated_successfully");
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  // bookings history user and driver both
  bookingHistory: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const userId = new ObjectId(req.user._id);

      console.log({ userId });

      const validate = new Validator(requests, {
        type: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const { page, limit } = req.query;
      const pageNumber = page ? parseInt(page) : 1;
      const pageSize = limit
        ? parseInt(limit)
        : parseInt(process.env.PAGE_LIMIT);
      const skip = (pageNumber - 1) * pageSize;
      let dateFilter = {};

      if (requests.selectedDate) {
        const selectedDate = moment(requests.selectedDate);
        const selectedendDate = moment(requests.selectedDate);

        dateFilter = {
          createdAt: {
            $gte: selectedDate.startOf("day").toDate(),
            $lte: selectedendDate.endOf("day").toDate(),
          },
        };
      }
      const checkUser = await User.findById(userId);
      if (!checkUser) {
        return failed(res, "User not found.");
      }
      const user = await User.findOne({ _id: userId });
      // console.log({ user });
      let countQuery;
      if (user.roleType == 2) {
        countQuery = { driverId: userId };
      } else {
        countQuery = { userId: userId };
      }

      let bookings, count;
      const now = new Date();

      const baseQuery = {
        date_of_booking: { $gte: now },
      };
      // console.log()
      if (requests.type == 0) {
        // Upcoming

        bookings = await Booking.aggregate([
          {
            $match: {
              ...countQuery,
              isUpcomingStatus: 1,
              status: { $in: [1, 3,7] },
              ...dateFilter,
              // ...baseQuery,
            },
          },
          ...buildCommonPipeline(skip, pageSize),
        ]);

        // console.log({ countQuery });

        count = await Booking.countDocuments({
          ...countQuery,
          isUpcomingStatus: 1,
          status: { $in: [1, 3,7] },
          // ...baseQuery,
          ...dateFilter,
        });
      } else if (requests.type == 1) {
        // Complete
        bookings = await Booking.aggregate([
          {
            $match: {
              ...countQuery,
              ...dateFilter,
              status: 5,
              // ...baseQuery,
            },
          },
          ...buildCommonPipeline(skip, pageSize),
        ]);

        count = await Booking.countDocuments({
          ...countQuery,
          status: 5,
          ...dateFilter,
          // ...baseQuery,
        });
      } else if (requests.type == 2) {
        // Cancelled
        bookings = await Booking.aggregate([
          {
            $match: {
              ...countQuery,
              status: { $in: [2, 6] },
              ...dateFilter,

              // ...baseQuery,
            },
          },
          ...buildCommonPipeline(skip, pageSize),
        ]);
        // console.log({ countQuery });
        count = await Booking.countDocuments({
          ...countQuery,
          status: { $in: [2, 6] },
          ...dateFilter,

          // ...baseQuery,
        });
      } else {
        return failed(res, "invalid_type_specified");
      }
      for (let i = 0; i < bookings.length; i++) {
        const element = bookings[i];
        let CouponCode = element.couponCode;
        let couponCodeData;

        if (CouponCode) {
          couponCodeData = await Coupon.findOne({ couponId: CouponCode });
          // if (!couponCodeData) {
          //   return failed(res, "Coupon is not valid.");
          // }
        }
        const rideCharge = element.updatedAmount || 0;
        const discount = couponCodeData?.amount || 0;
        // const totalFare = rideCharge - discount;
        const totalFare = (rideCharge * discount) / 100;

        element.rideCharge = rideCharge;
        element.discount = discount;
        element.charges = 0;
        element.totalFare = rideCharge - totalFare;
      }

      return success(res, "booking_history_retrieved_successfully", {
        bookings,
        total: count,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  shuttleBookingHistory: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const userId = new ObjectId(req.user._id);

      console.log({ userId });

      const validate = new Validator(requests, {
        type: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const { page, limit } = req.query;
      const pageNumber = page ? parseInt(page) : 1;
      const pageSize = limit
        ? parseInt(limit)
        : parseInt(process.env.PAGE_LIMIT);
      const skip = (pageNumber - 1) * pageSize;
      let dateFilter = {};

      if (requests.selectedDate) {
        const selectedDate = moment(requests.selectedDate);
        const selectedendDate = moment(requests.selectedDate);

        dateFilter = {
          createdAt: {
            $gte: selectedDate.startOf("day").toDate(),
            $lte: selectedendDate.endOf("day").toDate(),
          },
        };
      }

      const checkUser = await User.findById(userId);
      if (!checkUser) {
        return failed(res, "User not found.");
      }

      const user = await User.findOne({ _id: userId });

      let countQuery;
      if (user.roleType == 2) {
        countQuery = { driverId: userId };
      } else {
        countQuery = { userId: userId };
      }

      let bookings, count;
      const now = new Date();

      const baseQuery = {
        date_of_booking: { $gte: now },
      };

      const matchStage = {
        ...countQuery,
        ...dateFilter,
      };

      if (requests.type == 0) {
        // Upcoming
        matchStage.isUpcomingStatus = 1;
        matchStage.status = { $in: [1, 3] };
      } else if (requests.type == 1) {
        // Complete
        matchStage.status = 5;
      } else if (requests.type == 2) {
        // Cancelled
        matchStage.status = { $in: [2, 6] };
      } else {
        return failed(res, "invalid_type_specified");
      }

      bookings = await Booking.aggregate([
        {
          $match: matchStage,
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true, // Keep bookings even if user details are missing
          },
        },
        {
          $project: {
            _id: 1,
            bookingId: 1,
            title: 1,
            userId: 1,
            driverId: 1,
            source: 1,
            s_lat: 1,
            s_long: 1,
            destination: 1,
            d_lat: 1,
            d_long: 1,
            distance: 1,
            totalTime: 1,
            date_of_booking: 1,
            time_of_booking: 1,
            couponCode: 1,
            startTime: 1,
            endTime: 1,
            acceptTime: 1,
            rejectTime: 1,
            updatedAmount: 1,
            totalFare: 1,
            bookingType: 1,
            bootSpace: 1,
            isRoundTrip: 1,
            scheduleEndDate: 1,
            scheduleTime: 1,
            scheduleEndTime: 1,
            reason: 1,
            cancelCharge: 1,
            extraCharge: 1,
            reviewByUser: 1,
            reviewByDriver: 1,
            isUpcomingStatus: 1,
            isShuttleBooking: 1,
            isCarpoolBooking: 1,
            payStatus: 1,
            otp: 1,
            status: 1,
            serviceType: 1,
            passengers: 1,
            patientDetails: 1,
            towingVehicle: 1,
            towVehicleImg: 1,
            roomId: 1,
            paymentObj: 1,
            createdAt: 1,
            updatedAt: 1,
            "userDetails.name": 1,
            "userDetails.userImage": 1,
            "userDetails.averageRating": 1,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            bookings: { $push: "$$ROOT" },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: pageSize,
        },
      ]);

      count = await Booking.countDocuments(matchStage);

      for (let i = 0; i < bookings.length; i++) {
        const group = bookings[i].bookings;
        for (let j = 0; j < group.length; j++) {
          const element = group[j];
          let CouponCode = element.couponCode;
          let couponCodeData;

          if (CouponCode) {
            couponCodeData = await Coupon.findOne({ couponId: CouponCode });
          }

          const rideCharge = element.updatedAmount || 0;
          const discount = couponCodeData?.amount || 0;
          const totalFare = (rideCharge * discount) / 100;

          element.rideCharge = rideCharge;
          element.discount = discount;
          element.charges = 0;
          element.totalFare = rideCharge - totalFare;
        }
      }
      const driverRoute = await UserDocuments.findOne({ userId: userId });
      return success(res, "booking_history_retrieved_successfully", {
        driverRoute,
        bookings,
        total: count,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  //Review rating both Side
  reviewRating: async (req, res) => {
    try {
      console.log("w424234234");
      const requests = await decrypter(req.body);
      const userId = new ObjectId(req.user._id);

      const validate = new Validator(requests, {
        bookingId: "required",
        type: "required",
        rating: "required|integer|min:1|max:5",
        review: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let reqData;

      if (requests.type == 1) {
        // Rider
        reqData = {
          bookingId: requests.bookingId,
          userId: userId,
          driverId: requests.driverId,
          rating: requests.rating,
          review: requests.review,
          type: requests.type,
        };

        await Booking.updateOne(
          { _id: requests.bookingId },
          { $set: { reviewByUser: 1 } }
        );

        //update rider rating
        await updateDriverRating(requests.driverId);
      } else {
        // Driver
        reqData = {
          bookingId: requests.bookingId,
          userId: requests.userId,
          driverId: userId,
          rating: requests.rating,
          review: requests.review,
          type: requests.type,
        };

        await Booking.updateOne(
          { _id: requests.bookingId },
          { $set: { reviewByDriver: 1 } }
        );

        await updateRiderRating(requests.userId);
      }
      //update driver rating
      await ReviewRating.create(reqData);

      return success(res, "your_review_is_submitted_successfully", reqData);
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  deleteAccount: async (req, res) => {
    try {
      const userId = new ObjectId(req.user._id);
      const user = await User.findOne({ _id: userId });
      if (!user) {
        return failed(res, "user_not_found");
      }

      // Soft delete: Set isDeleted field to true
      await User.updateOne({ _id: userId }, { $set: { isDeleted: true } });

      return success(res, "account_deleted_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  notificationList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);

      let page = requests.page ? parseInt(requests.page) : 1;
      let pageSize = requests.limit ? parseInt(requests.limit) : 10;
      let skipIndex = (page - 1) * pageSize;
      const userId = req.user._id;
      const notification = await Notification.find({ userId: userId })
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize);
      const notificationCount = await Notification.countDocuments({
        userId: userId,
      });

      return success(res, "data_fetched_successfully", {
        notification,
        notificationCount,
      });
    } catch (error) {
      console.log({ error });
      return response(res, 500, i18n.__("Internal_Error"));
    }
  },
  sendNotifcation: async (req, res) => {
    try {
      const { title, message } = req.body;
      let users;
      console.log("##########", req.body);
      const userId = "669928c662ac07a5c5a69856";
      await sendNewNotification(userId, title, message);
      return success(res, "notification_send_successfully");
    } catch (error) {
      return serverError(
        res,
        {},
        "Something wents wrong ,please try again",
        500
      );
    }
  },
  helpSupport: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = req.user._id;
      console.log(req.user);
      const validate = new Validator(requests, {
        subject: "required",
        message: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const reqData = {
        userId: userId,
        subject: requests.subject,
        message: requests.message,
      };
      await HelpSupport.create(reqData);
      return success(res, "data_added_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  deleteAccount: async (req, res) => {
    try {
      const getData = await CMS.findOne({ _id: "66755a38039dc346b990fbd9" });
      return success(res, "data_added_successfully", getData);
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  forceUpdate: async (req, res) => {
    try {
      // Decrypt the request query parameters
      const requests = await decrypter(req.query);

      // Validate the incoming request parameters
      const validate = new Validator(requests, {
        deviceType: "required",
        userType: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        // Return validation failure response if the parameters are invalid
        return validateFail(res, validate);
      }
      console.log("requests.deviceType", requests.deviceType);
      console.log("requests.userType", requests.userType);

      // Fetch the application version based on the deviceType and userType
      const appVersion = await AppVersion.findOne({
        deviceType: requests.deviceType,
        type: requests.userType,
      });

      if (!appVersion) {
        // Return a failure response if no matching data is found
        return failed(res, "data_not_found");
      }

      // Return a success response with the fetched data
      return success(res, "data_fetched_successfully", appVersion);
    } catch (error) {
      // Log the error for debugging purposes
      console.error("Error in forceUpdate:", error);

      // Return a generic server error response
      return serverError(res, "internal_server_error");
    }
  },
};
// Function to build common aggregation pipeline stages
const buildCommonPipeline = (skip, pageSize) => [
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userDetails",
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "driverId",
      foreignField: "_id",
      as: "driverDetails",
    },
  },
  {
    $lookup: {
      from: "reviewratings",
      let: { bookingId: "$_id", driverId: "$driverId" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$bookingId", "$$bookingId"] }, // Match specific booking
                { $eq: ["$driverId", "$$driverId"] }, // Match driver
                { $eq: ["$type", 2] }, // Filter for driver reviews
              ],
            },
          },
        },
      ],
      as: "driverRating",
    },
  },
  {
    $lookup: {
      from: "reviewratings",
      let: { bookingId: "$_id", userId: "$userId" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$bookingId", "$$bookingId"] }, // Match specific booking
                { $eq: ["$userId", "$$userId"] }, // Match user
                { $eq: ["$type", 1] }, // Filter for user reviews
              ],
            },
          },
        },
      ],
      as: "userRating",
    },
  },
  {
    $lookup: {
      from: "userdocuments",
      localField: "userId",
      foreignField: "userId",
      as: "userDocuments",
    },
  },
  {
    $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: { path: "$driverDetails", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: { path: "$driverRating", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: { path: "$userRating", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: { path: "$userDocuments", preserveNullAndEmptyArrays: true },
  },
  {
    $group: {
      _id: "$_id",
      title: { $first: "$title" },
      date_of_booking: { $first: "$date_of_booking" },
      userId: { $first: "$userId" },
      driverId: { $first: "$driverId" },
      source: { $first: "$source" },
      s_lat: { $first: "$s_lat" },
      s_long: { $first: "$s_long" },
      destination: { $first: "$destination" },
      d_lat: { $first: "$d_lat" },
      d_long: { $first: "$d_long" },
      distance: { $first: "$distance" },
      totalTime: { $first: "$totalTime" },
      createdAt: { $first: "$createdAt" },
      updatedAmount: { $first: "$updatedAmount" },
      bookingType: { $first: "$bookingType" },
      isRoundTrip: { $first: "$isRoundTrip" },
      userName: { $first: "$userDetails.name" },
      userImage: { $first: "$userDetails.userImage" },
      userAverageRating: { $first: "$userRating.rating" },
      driverName: { $first: "$driverDetails.name" },
      driverImage: { $first: "$driverDetails.userImage" },
      driverAverageRating: { $first: "$driverDetails.averageRating" },
      drivingLicence: { $first: "$userDocuments.drivingLicence" },
    },
  },
  { $sort: { createdAt: -1 } },
  { $skip: skip },
  { $limit: pageSize },
];
