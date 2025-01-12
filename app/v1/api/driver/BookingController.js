const Booking = require("../../../../models/Booking");
const User = require("../../../../models/User");
const Pricing = require("../../../../models/RidePricing");
const Vehicle = require("../../../../models/Vehicle");
const VehicleCategory = require("../../../../models/VehicleCategory");
const Services = require("../../../../models/Services");
const UserDocuments = require("../../../../models/UserDocuments");

const Coupon = require("../../../../models/Coupon");
const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/response");
const {
  getDurationAndDistance,
  calculateDuration,
} = require("../../../helper/helpers");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");

module.exports = {
  bookingList: async (req, res) => {
    try {
      let driverId = new ObjectId(req.user._id);
      console.log({ driverId });
      const list = await Booking.aggregate([
        { $match: { driverId: driverId, status: 0 } },
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
            //unwind use for make array to object
            path: "$userDetails",
          },
        },
        {
          $project: {
            title: 1,
            userId: 1,
            source: 1,
            s_lat: 1,
            s_long: 1,
            destination: 1,
            d_lat: 1,
            d_long: 1,
            distance: 1,
            totalTime: 1,
            status: 1,
            userImage: 1,
            updatedAmount: 1,
            serviceType: 1,
            gender: 1,
            towingVehicle: 1,
            towVehicleImg: 1,
            "userDetails._id": 1,
            "userDetails.name": 1,
            "userDetails.email": 1,
            "userDetails.currentLat": 1,
            "userDetails.currentLong": 1,
          },
        },
      ]);

      success(res, "data_fetched_succesfully", list);
    } catch (error) {
      console.error({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Accept booking
  acceptBooking: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const driverId = req.user._id;

      const validate = new Validator(requests, {
        status: "required|in:accept,reject",
        userId: "required",
        bookingId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const bokingID = new ObjectId(requests.bookingId);

      const checkBooking = await Booking.aggregate([
        { $match: { _id: bokingID } },
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
            //unwind use for make array to object
            path: "$userDetails",
          },
        },
        {
          $project: {
            title: 1,
            userId: 1,
            source: 1,
            s_lat: 1,
            s_long: 1,
            destination: 1,
            d_lat: 1,
            d_long: 1,
            distance: 1,
            totalTime: 1,
            status: 1,
            userImage: 1,
            updatedAmount: 1,
            patientDetails: 1,
            serviceType: 1,
            date_of_booking: 1,
            gender: 1,
            towingVehicle: 1,
            towVehicleImg: 1,
            bookingType: 1,
            "userDetails._id": 1,
            "userDetails.name": 1,
            "userDetails.email": 1,
            "userDetails.currentLat": 1,
            "userDetails.currentLong": 1,
          },
        },
      ]);
      if (!checkBooking) {
        failed(res, "booking_not_found");
      }

      if (requests.status === "accept") {
        // if (checkBooking.status !== 5) {
        //   failed(res, "Please complete your pervious ride.");
        // }
        const randomOtp = Math.floor(1000 + Math.random() * 9000);
        const reqData = {
          status: 1,
          acceptTime: new Date().toLocaleTimeString("en-US", {
            hour12: false,
          }),
          otp: randomOtp,
        };
        // console.log(checkBooking[0].bookingType); return 1;
        if (checkBooking[0].bookingType == 2) {
          // Accept ride
          await Booking.updateOne(
            { _id: requests.bookingId },
            { $set: reqData }
          );
          //update user ongoing status
          // await User.updateOne({ _id: requests.userId }, { ongoingStatus: 1 });
          //update driver ongoing status
          //  await User.updateOne({ _id: driverId }, { ongoingStatus: 1 });

          // Delete all pending rides of the same user for all drivers
          await Booking.deleteMany({
            userId: requests.userId,
            status: 0,
          });

          // Delete all queue pending rides of the driver
          await Booking.deleteMany({
            driverId: driverId,
            status: 0,
          });
          // console.log(checkBooking[0]); return 1;
          success(
            res,
            `Your ride has been schdule on ${checkBooking[0].date_of_booking}.`,
            checkBooking[0]
          );
        } else {
          // Accept ride
          await Booking.updateOne(
            { _id: requests.bookingId },
            { $set: reqData }
          );
          //update user ongoing status
          await User.updateOne({ _id: requests.userId }, { ongoingStatus: 1 });
          //update driver ongoing status
          await User.updateOne({ _id: driverId }, { ongoingStatus: 1 });

          // Delete all pending rides of the same user for all drivers
          await Booking.deleteMany({
            userId: requests.userId,
            status: 0,
          });

          // Delete all queue pending rides of the driver
          await Booking.deleteMany({
            driverId: driverId,
            status: 0,
          });
        }
      } else if (requests.status === "reject") {
        // Reject ride
        await Booking.deleteOne({
          id: requests.bookingId,
        });
        success(res, "ride_status_updated_successfully");
      }

      success(res, "ride_status_updated_successfully", checkBooking[0]);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Update ride status
  updateStatus: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const driverId = req.user._id;
      const validate = new Validator(requests, {
        status: "required",
        bookingId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkBooking = await Booking.findOne({ _id: requests.bookingId });

      if (!checkBooking) {
        failed(res, "booking_not_found");
      }

      //update status
      await Booking.updateOne(
        { _id: requests.bookingId },
        { status: parseInt(requests.status) }
      );
      if (requests.status == 5) {
        //update user ongoing status
        await User.updateOne(
          { _id: checkBooking.userId },
          { ongoingStatus: 0 }
        );
        //update driver ongoing status
        await User.updateOne({ _id: driverId }, { ongoingStatus: 0 });
      }
      const bokingID = new ObjectId(requests.bookingId);

      const bookingDetail = await Booking.aggregate([
        { $match: { _id: bokingID } },
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
            //unwind use for make array to object
            path: "$userDetails",
          },
        },
        {
          $project: {
            title: 1,
            userId: 1,
            source: 1,
            s_lat: 1,
            s_long: 1,
            destination: 1,
            d_lat: 1,
            d_long: 1,
            distance: 1,
            totalTime: 1,
            status: 1,
            userImage: 1,
            updatedAmount: 1,
            serviceType: 1,
            patientDetails: 1,
            towingVehicle: 1,
            towVehicleImg: 1,
            "userDetails._id": 1,
            "userDetails.name": 1,
            "userDetails.email": 1,
            "userDetails.currentLat": 1,
            "userDetails.currentLong": 1,
          },
        },
      ]);

      success(res, "status_updated_successfully", bookingDetail[0]);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //verify otp
  verifyOtp: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        bookingId: "required",
        otp: "required|length:4",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkBooking = await Booking.findOne({ _id: requests.bookingId });
      if (!checkBooking) {
        failed(res, "booking_not_found");
      }
      if (checkBooking.otp == requests.otp) {
        const reqData = {
          title: "Confirmed",
          status: 4, //Start trip
          startTime: new Date().toLocaleTimeString("en-US", {
            hour12: false,
          }),
        };
        await Booking.updateOne({ _id: requests.bookingId }, { $set: reqData });
        const bokingID = new ObjectId(requests.bookingId);

        const bookingDetail = await Booking.aggregate([
          { $match: { _id: bokingID } },
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
              //unwind use for make array to object
              path: "$userDetails",
            },
          },
          {
            $project: {
              title: 1,
              userId: 1,
              source: 1,
              s_lat: 1,
              s_long: 1,
              destination: 1,
              d_lat: 1,
              d_long: 1,
              distance: 1,
              totalTime: 1,
              status: 1,
              userImage: 1,
              updatedAmount: 1,
              serviceType: 1,
              patientDetails: 1,
              towingVehicle: 1,
              towVehicleImg: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
        success(
          res,
          "verification_complete_ready_for_your_ride",
          bookingDetail[0]
        );
      } else {
        failed(res, "incorrect_otp_please_try_again");
      }
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //update live status
  isLiveStatus: async (req, res) => {
    try {
      const userId = req.user._id;

      const user = await User.findById(userId);

      if (!user) {
        return failed(res, "user_not_found");
      }
      if (user.verifyStatus == 0) {
        return failed(res, "your_profile_is_under_review");
      }
      if (user.verifyStatus == 2) {
        return failed(res, "your_profile_is_rejected_please_contact_to_admin");
      }
      user.live = user.live === 0 ? 1 : 0;
      await user.save();
      const userDetails = await User.findById(userId).select("live");

      success(res, "status_updated_successfully", userDetails);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //Driver details
  bookingDetail: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const userId = new ObjectId(req.user._id);
      const userDoc = await UserDocuments.findOne({
        vehicleServiceId: { $in: [new ObjectId("6603b370dc833aa9b0b72ee4"), new ObjectId("664c53fd49a12f6542026a50")] },
        userId: userId,
      });
      console.log({ userDoc });
      if (userDoc) {
        const bookingDetail = await Booking.aggregate([
          { $match: { driverId: userId, status: { $in: [1, 3, 4, 7] } } },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "userDetails",
            },
          },
          { $unwind: "$userDetails" },
          {
            $lookup: {
              from: "userdocuments",
              localField: "userId",
              foreignField: "userId",
              as: "vehicleDetail",
            },
          },
          {
            $unwind: {
              path: "$vehicleDetail",
              preserveNullAndEmptyArrays: true, // Preserve documents without vehicleDetail
            },
          },
          {
            $group: {
              _id: "$_id", // Group by the unique booking ID to eliminate duplicates
              bookingData: { $first: "$$ROOT" }, // Get the first occurrence of the booking data
            },
          },
          {
            $replaceRoot: { newRoot: "$bookingData" }, // Replace the root with the grouped data
          },
          {
            $project: {
              _id: 1,
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
              startTime: 1,
              endTime: 1,
              acceptTime: 1,
              rejectTime: 1,
              updatedAmount: 1,
              bookingType: 1,
              scheduleTime: 1,
              reason: 1,
              cancelCharge: 1,
              extraCharge: 1,
              reviewByUser: 1,
              reviewByDriver: 1,
              payStatus: 1,
              otp: 1,
              status: 1,
              scheduleEndDate: 1,
              passengers: 1,
              serviceType: 1,
              patientDetails: 1,
              towingVehicle: 1,
              towVehicleImg: 1,
              isUpcomingStatus: 1,
              roomId: 1,
              isRoundTrip: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.gender": 1,
              "userDetails.countryCode": 1,
              "userDetails.mobile": 1,
              "userDetails.roleType": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
              "userDetails.landMark": 1,
              "userDetails.userImage": 1,
              "userDetails.ongoingStatus": 1,
              "vehicleDetail.vehicleInsurance": 1,
              "userDetails.averageRating": 1,
              "vehicleDetail.drivingLicence": 1,
              "vehicleDetail._id": 1,
            },
          },
          { $sort: { createdAt: -1 } },
          // { $limit: 1 },
        ]);

        for (let i = 0; i < bookingDetail.length; i++) {
          const element = bookingDetail[i];
          const rideCharge = element.updatedAmount || 0;
          let discount = 0;

          if (element.couponCode) {
            const couponCodeData = await Coupon.findOne({
              couponId: element.couponCode,
            });
            discount = couponCodeData?.amount || 0;
          }

          const totalFare = (rideCharge * discount) / 100;

          bookingDetail[i].rideCharge = rideCharge;
          bookingDetail[i].discount = discount;
          bookingDetail[i].charges = 0;
          bookingDetail[i].totalFare = rideCharge - totalFare;
        }

        success(res, "user_detail_fetched_successfully", bookingDetail);
      } else {
        const CouponCode = requests.couponCode ? requests.couponCode : "";
        let couponCodeData;

        if (CouponCode) {
          couponCodeData = await Coupon.findOne({ couponId: CouponCode });
          if (!couponCodeData) {
            return failed(res, "coupon_is_not_valid");
          }
        }

        const bookingDetail = await Booking.aggregate([
          { $match: { driverId: userId, status: { $in: [1, 3, 4, 7] } } },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "userDetails",
            },
          },
          { $unwind: "$userDetails" },
          {
            $lookup: {
              from: "userdocuments",
              localField: "userId",
              foreignField: "userId",
              as: "vehicleDetail",
            },
          },
          {
            $unwind: {
              path: "$vehicleDetail",
              preserveNullAndEmptyArrays: true, // Preserve documents without vehicleDetail
            },
          },
          {
            $group: {
              _id: "$_id", // Group by the unique booking ID to eliminate duplicates
              bookingData: { $first: "$$ROOT" }, // Get the first occurrence of the booking data
            },
          },
          {
            $replaceRoot: { newRoot: "$bookingData" }, // Replace the root with the grouped data
          },
          {
            $project: {
              _id: 1,
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
              startTime: 1,
              endTime: 1,
              acceptTime: 1,
              rejectTime: 1,
              updatedAmount: 1,
              bookingType: 1,
              scheduleTime: 1,
              reason: 1,
              cancelCharge: 1,
              extraCharge: 1,
              reviewByUser: 1,
              reviewByDriver: 1,
              payStatus: 1,
              otp: 1,
              status: 1,
              scheduleEndDate: 1,
              passengers: 1,
              serviceType: 1,
              patientDetails: 1,
              towingVehicle: 1,
              towVehicleImg: 1,
              isUpcomingStatus: 1,
              roomId: 1,
              isRoundTrip: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.gender": 1,
              "userDetails.countryCode": 1,
              "userDetails.mobile": 1,
              "userDetails.roleType": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
              "userDetails.landMark": 1,
              "userDetails.userImage": 1,
              "userDetails.ongoingStatus": 1,
              "vehicleDetail.vehicleInsurance": 1,
              "userDetails.averageRating": 1,
              "vehicleDetail.drivingLicence": 1,
              "vehicleDetail._id": 1,
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ]);
        console.log("///////////////", bookingDetail);
        if (CouponCode) {
          if (bookingDetail[0]) {
            if (couponCodeData.amount > bookingDetail[0].updatedAmount) {
              return failed(res, "coupon_amount_is_greater_than_ride_amount.");
            }
          }
        }

        if (!bookingDetail || bookingDetail.length === 0) {
          return success(res, "no_booking_details_found");
        }

        const rideCharge = bookingDetail[0].updatedAmount || 0;
        const discount = couponCodeData?.amount || 0;
        // const totalFare = rideCharge - discount;
        const totalFare = (rideCharge * discount) / 100;

        bookingDetail[0].rideCharge = rideCharge;
        bookingDetail[0].discount = discount;
        bookingDetail[0].charges = 0;
        bookingDetail[0].totalFare = rideCharge - totalFare;

        success(res, "user_detail_fetched_successfully", bookingDetail[0]);
      }
    } catch (error) {
      console.log(error);
      serverError(res, "internal_server_error");
    }
  },
};
