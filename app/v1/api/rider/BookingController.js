const Booking = require("../../../../models/Booking");
const User = require("../../../../models/User");
const Pricing = require("../../../../models/RidePricing");
const Vehicle = require("../../../../models/Vehicle");
const VehicleCategory = require("../../../../models/VehicleCategory");
const Coupon = require("../../../../models/Coupon");
const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/response");
const {
  getDurationAndDistance,
  calculateDistanceShuttle,
  calculateDuration,
  pricingManage,
} = require("../../../helper/helpers");
const {
  calculatePrices,
  calculateTotalHourPrice,
} = require("../../../helper/bookingHelper");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const UserDocuments = require("../../../../models/UserDocuments");
let baseUrl = process.env.APP_URL;
module.exports = {
  //Veihcle list
  vehicleList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        serviceType: [
          "required",
          "in:normal,ambulance,fireFighting,towing,reserve",
        ],
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const vehicles = await Vehicle.find();
      const vehicleCategories = await VehicleCategory.find();
      const drivers = await User.find(
        { roleType: 2 }, // Match condition
        { _id: 1, currentLat: 1, currentLong: 1 } // Projection object
      );

      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      let minDuration = Infinity; // Set initial value to Infinity to ensure any duration will be smaller
      let minDurationDriver = null;
      // console.log("+++++++++++",origin.lat)
      // Iterate through the drivers array to find the driver with the shortest duration
      for (const driver of drivers) {
        const durationFormula = calculateDuration(
          origin.lat,
          origin.lng,
          driver.currentLat,
          driver.currentLong,
          averageSpeedKmPerHour
        );
        // Update the minimum duration and corresponding driver if the current driver has a shorter duration
        if (durationFormula.duration < minDuration) {
          minDuration = durationFormula.duration;
          minDurationDriver = driver;
        }
      }
      // console.log(minDuration);

      // After iterating through all drivers, if a minimum duration driver was found, push it into the driverData array
      let driverData = null;
      if (minDurationDriver) {
        driverData = [
          {
            driver: minDurationDriver,
            duration: minDuration.duration,
          },
        ];
      }
      // consosssle.log(driverData[0].duration);
      const data = await Pricing.aggregate([
        {
          $match: {
            serviceId: new ObjectId(requests.serviceId),
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleId",
            foreignField: "_id",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $lookup: {
            from: "vehiclecategories",
            localField: "vehicleCategoryId",
            foreignField: "_id",
            as: "vehicleCategoryDetail",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$vehicleCategoryDetail",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $project: {
            _id: 1,
            baseFare: 1,
            extraFare: 1,
            nightTime: 1,
            currency: 1,
            kmCharges: 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.serviceType": 1,
            "vehicleDetail._id": 1,
            "vehicleDetail.vehicleImage": 1,
            "vehicleDetail.seats": 1,
            "vehicleCategoryDetail._id": 1,
            "vehicleCategoryDetail.vehicleId": 1,
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      const duration = await getDurationAndDistance(origin, destination);
      console.log({ duration });
      const pricesPerVehicle = [];

      for (const vehicle of data) {
        let totalPriceForVehicle = 0;
        const vehicleInfo = {
          _id: vehicle.vehicleDetail._id, // Assuming this field exists in both vehicleDetail and vehicleCategoryDetail
          vehicleId: vehicle.vehicleDetail.vehicleId,
          vehicleName: vehicle.vehicleDetail.vehicleName,
          serviceType: vehicle.vehicleDetail.serviceType,
          vehicleImage: `${baseUrl}uploads/vehicleImages/${vehicle.vehicleDetail.vehicleImage}`,
          seats: vehicle.vehicleDetail.seats,
          categoryId: "",
          categoryImage: "",
        };

        if (
          vehicle.vehicleCategoryDetail &&
          vehicle.vehicleDetail.serviceType == 1
        ) {
          vehicleInfo.vehicleName = vehicle.vehicleCategoryDetail.categoryName;
          vehicleInfo.categoryId = vehicle.vehicleCategoryDetail._id;
          vehicleInfo.categoryImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;
          vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
        }

        let calculatedPrices = null;
        if (
          requests.serviceType === "normal" ||
          requests.serviceType === "reserve"
        ) {
          if (vehicle.vehicleDetail.serviceType == 1) {
            // console.log( driverData );

            calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
            console.log(calculatedPrices);
          }
        } else if (requests.serviceType === "ambulance") {
          if (
            vehicle.vehicleDetail.serviceType == 2 &&
            vehicle.vehicleDetail.vehicleName === "Ambulance"
          ) {
            calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
          }
        } else if (requests.serviceType === "fireFighting") {
          if (
            vehicle.vehicleDetail.serviceType == 2 &&
            vehicle.vehicleDetail.vehicleName === "Fire fighting"
          ) {
            calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
          }
        } else if (requests.serviceType === "towing") {
          if (
            vehicle.vehicleDetail.serviceType == 2 &&
            vehicle.vehicleDetail.vehicleName === "Towing"
          ) {
            calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
          }
        }

        if (calculatedPrices) {
          pricesPerVehicle.push({
            vehicle: vehicleInfo,
            totalPrice: calculatedPrices.totalPrice,
            duration: calculatedPrices.duration,
          });
        }
      }
      let userId = req.user._id;

      const user = await User.findOne({ _id: userId });
      const walletBalance = user.walletBalance;
      return success(res, "data_fetched_successfully", {
        pricesPerVehicle,
        walletBalance,
      });
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Book ride
  bookRide: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        source: "required",
        destination: "required",
        bookingType: "required|in:1,2",
        vehicleId: "required",
        bookingDate: "required",
        // bookingTime: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      let params = {
        roleType: 2,
        ongoingStatus: 0,
        verifyStatus: 1,
        live: 1,
        status: 1,
      };

      if (requests.vehicleId) {
        const vehicleId = new ObjectId(requests.vehicleId);
        params = Object.assign(params, {
          "userDocument.vehicleId": vehicleId,
        });
      }

      if (requests.vehicleCatId) {
        const vehicleCatId = new ObjectId(requests.vehicleCatId);
        params = Object.assign(params, {
          "userDocument.vehicleCatId": vehicleCatId,
        });
      }
      //Service type
      if (requests.serviceType === "normal") {
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ede");
        params = Object.assign(params, {
          "userDocument.vehicleServiceId": vehicleServiceId,
        });
      }
      if (requests.serviceType === "reserve") {
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee2");
        params = Object.assign(params, {
          "userDocument.vehicleServiceId": vehicleServiceId,
        });
      }
      const checkOngoingStatus = await User.findOne({ _id: userId });
      // console.log({checkOngoingStatus}); return 1;
      // if (checkOngoingStatus.verifyStatus !== 1) {
      //   failed(res, "Your account blocked. Please contact to the admin");
      // }
      if (checkOngoingStatus.ongoingStatus == 1) {
        failed(res, "youre_already_on_your_way.");
      }
      // Find all available drivers within a certain radius (e.g., 5 km) from the user's location
      const drivers = await User.aggregate([
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "userDocument",
          },
        },
        {
          $unwind: {
            path: "$userDocument",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $match: params,
        },
      ]);

      // Handle the drivers array as needed
      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      const distanceTime = await getDurationAndDistance(origin, destination);

      //Calculate user location to driver location distances
      const distances = [];
      for (const driver of drivers) {
        const driverOrigin = {
          lat: parseFloat(driver.currentLat),
          lng: parseFloat(driver.currentLong),
        };
        console.log({ requests });

        const driverDistance = await calculateDuration(
          parseFloat(requests.s_lat),
          parseFloat(requests.s_lng),
          driverOrigin.lat,
          driverOrigin.lng,
          averageSpeedKmPerHour
        );

        const distanceString = driverDistance.distance;
        const distanceFloat = parseFloat(distanceString);
        distances.push({
          driver,
          distance: distanceFloat,
          duration: driverDistance.duration,
        });
      }

      //Get nearest location drivers
      const nearbyDrivers = distances
        .filter(({ distance, duration }) => {
          return duration !== null && distance <= 5000;
        })
        .map(({ driver }) => driver);
      //distance Amt
      const priceing = await pricingManage(
        parseFloat(distanceTime.distance),
        requests.vehicleId,
        requests.vehicleCatId
      );
      let patientDetails;
      if (requests.serviceType === "ambulance") {
        patientDetails = {
          patientName: requests.patientName,
          age: requests.age,
          gender: requests.gender,
          reason: requests.reason,
        };
      }
      let towing;
      let towVehicleImg;
      if (requests.serviceType === "towing") {
        towing = requests.towingVehicle;
        towVehicleImg = requests.towVehicleImg;
      }
      let scheduleTime;
      if (requests.serviceType === "reserve") {
        scheduleTime = requests.scheduleTime;
        scheduleTime = requests.scheduleTime;
      }

      // Notify nearby drivers about the new ride request
      for (let i = 0; i < nearbyDrivers.length; i++) {
        const element = nearbyDrivers[i];
        const reqData = {
          userId: userId,
          driverId: element._id,
          source: requests.source,
          s_lat: requests.s_lat,
          s_long: requests.s_lng,
          destination: requests.destination,
          d_lat: requests.d_lat,
          d_long: requests.d_long,
          distance: distanceTime.distance,
          totalTime: distanceTime.duration,
          date_of_booking: requests.bookingDate,
          time_of_booking: requests.bookingTime,
          bookingType: requests.bookingType, //1=Normal Booking, 2=Schedule Booking
          updatedAmount: priceing.totalPrice,
          patientDetails: patientDetails,
          serviceType: requests.serviceType,
          towingVehicle: towing,
          scheduleTime: scheduleTime,
          towVehicleImg: towVehicleImg,
        };
        // Send notification to the driver (uncomment if needed)
        // sendNotification(
        //   driver.email,
        //   "New Ride Request",
        //   "A new ride request is available."
        // );
        await Booking.create(reqData);
      }

      success(res, "Nearby drivers searched successfully.", {
        nearbyDrivers,
        distanceTime: distanceTime.distance,
        durationTime: distanceTime.duration,
      });
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error.");
    }
  },
  nearestDriversList: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        vehicleId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let params = {
        roleType: 2,
        ongoingStatus: 0,
        // verifyStatus: 1,
        // live: 1,
        status: 1,
      };

      if (requests.vehicleId) {
        const vehicleId = new ObjectId(requests.vehicleId);
        params = Object.assign(params, {
          "vehicleDetail.vehicleId": vehicleId,
        });
      }

      if (requests.vehicleCatId) {
        const vehicleCatId = new ObjectId(requests.vehicleCatId);
        params = Object.assign(params, {
          "vehicleDetail.vehicleCatId": vehicleCatId,
        });
      }
      const userId = new ObjectId(req.user._id);
      const averageSpeedKmPerHour = 30;

      const list = await User.aggregate([
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $match: params,
        },
        {
          $project: {
            _id: 1,
            name: 1,
            gender: 1,
            countryCode: 1,
            mobile: 1,
            roleType: 1,
            currentLat: 1,
            currentLong: 1,
            landMark: 1,
            userImage: 1,
            ongoingStatus: 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.vehicleId": 1,
            "vehicleDetail.vehicleNumber": 1,
            "vehicleDetail._id": 1,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);
      // console.log({list})
      const distances = [];
      for (const driver of list) {
        const driverOrigin = {
          lat: parseFloat(driver.currentLat),
          lng: parseFloat(driver.currentLong),
        };
        const driverDistance = await calculateDuration(
          parseFloat(requests.s_lat),
          parseFloat(requests.s_lng),
          driverOrigin.lat,
          driverOrigin.lng,
          averageSpeedKmPerHour
        );
        const distanceFloat = parseFloat(driverDistance.distance);
        if (driverDistance.duration !== null && distanceFloat <= 5) {
          distances.push({
            driver,
            distance: distanceFloat,
            duration: driverDistance.duration,
          });
        }
      }

      // Get nearby drivers
      const nearbyDrivers = distances.map(({ driver }) => driver);
      success(res, "Detail fetched successfully.", nearbyDrivers);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Driver details
  driverDetail: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = new ObjectId(req.user._id);
      // console.log("RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR");
      const bookingDetail = await Booking.aggregate([
        { $match: { userId: userId, status: { $in: [1, 3, 4, 7] } } },
        {
          $lookup: {
            from: "users",
            localField: "driverId",
            foreignField: "_id",
            as: "driverDetails",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$driverDetails",
          },
        },
        {
          $lookup: {
            from: "userdocuments",
            localField: "driverId",
            foreignField: "userId",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleDetail.vehicleId",
            foreignField: "_id",
            as: "vehicleInfo",
          },
        },
        {
          $unwind: "$vehicleInfo",
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
            serviceType: 1,
            reason: 1,
            cancelCharge: 1,
            extraCharge: 1,
            reviewByUser: 1,
            reviewByDriver: 1,
            payStatus: 1,
            otp: 1,
            status: 1,
            isUpcomingStatus: 1,
            couponCode: 1,
            createdAt: 1,
            updatedAt: 1,
            roomId: 1,
            "driverDetails._id": 1,
            "driverDetails.name": 1,
            "driverDetails.gender": 1,
            "driverDetails.countryCode": 1,
            "driverDetails.mobile": 1,
            "driverDetails.roleType": 1,
            "driverDetails.currentLat": 1,
            "driverDetails.currentLong": 1,
            "driverDetails.averageRating": 1,
            "driverDetails.landMark": 1,
            "driverDetails.userImage": 1,
            "driverDetails.ongoingStatus": 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.vehicleNumber": 1,
            "vehicleDetail._id": 1,
            "vehicleInfo.vehicleImage": {
              $concat: [
                `${baseUrl}uploads/vehicleImages/`,
                "$vehicleInfo.vehicleImage",
              ],
            },
          },
        },
        {
          $sort: {
            updatedAt: -1,
          },
        },
        {
          $limit: 1,
        },
      ]);
      if (bookingDetail[0]) {
        let couponCodeData = null;
        if (bookingDetail[0].couponCode) {
          couponCodeData = await Coupon.findOne({
            couponId: bookingDetail[0].couponCode,
          });

          if (
            couponCodeData &&
            couponCodeData.amount > bookingDetail[0].updatedAmount
          ) {
            return failed(res, "coupon_amount_is_greater_than_ride_amount");
          }
        }

        const rideCharge = bookingDetail[0].updatedAmount || 0;
        const discount = couponCodeData?.amount || 0;
        // const totalFare = rideCharge - discount;
        const totalFare = (rideCharge * discount) / 100;

        bookingDetail[0].rideCharge = rideCharge;
        bookingDetail[0].discount = discount;
        bookingDetail[0].charges = 0;
        bookingDetail[0].totalFare = rideCharge - totalFare;
      }

      success(res, "detail_fetched_successfully", bookingDetail[0]);
    } catch (error) {
      console.log(error);
      serverError(res, "internal_server_error");
    }
  },
  //Travel Veihcle list
  travelVehicleList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        // startDate: "required",
        // startTime: "required",
        // endDate: "required",
        // endTime: "required",
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        // serviceType: ["required", "in:travel"],
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const drivers = await User.find(
        { roleType: 2 }, // Match condition
        { _id: 1, currentLat: 1, currentLong: 1 } // Projection object
      );

      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      let minDuration = Infinity; // Set initial value to Infinity to ensure any duration will be smaller
      let minDurationDriver = null;
      // console.log("+++++++++++",origin.lat)
      // Iterate through the drivers array to find the driver with the shortest duration
      for (const driver of drivers) {
        const durationFormula = calculateDuration(
          origin.lat,
          origin.lng,
          driver.currentLat,
          driver.currentLong,
          averageSpeedKmPerHour
        );
        // Update the minimum duration and corresponding driver if the current driver has a shorter duration
        if (durationFormula.duration < minDuration) {
          minDuration = durationFormula.duration;
          minDurationDriver = driver;
        }
      }
      // console.log(minDuration);

      // After iterating through all drivers, if a minimum duration driver was found, push it into the driverData array
      let driverData = null;
      if (minDurationDriver) {
        driverData = [
          {
            driver: minDurationDriver,
            duration: minDuration.duration,
          },
        ];
      }
      // console.log(driverData[0].duration);
      const data = await Pricing.aggregate([
        {
          $match: {
            serviceId: new ObjectId(requests.serviceId),
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleId",
            foreignField: "_id",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $lookup: {
            from: "vehiclecategories",
            localField: "vehicleCategoryId",
            foreignField: "_id",
            as: "vehicleCategoryDetail",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$vehicleCategoryDetail",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $project: {
            _id: 1,
            baseFare: 1,
            extraFare: 1,
            nightTime: 1,
            currency: 1,
            kmCharges: 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.serviceType": 1,
            "vehicleDetail._id": 1,
            "vehicleDetail.vehicleImage": 1,
            "vehicleDetail.seats": 1,
            "vehicleCategoryDetail._id": 1,
            "vehicleCategoryDetail.vehicleId": 1,
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      const duration = await getDurationAndDistance(origin, destination);
      console.log("+++++++++++++++", duration);
      const pricesPerVehicle = [];

      for (const vehicle of data) {
        let totalPriceForVehicle = 0;
        const vehicleInfo = {
          _id: vehicle.vehicleDetail._id, // Assuming this field exists in both vehicleDetail and vehicleCategoryDetail
          vehicleId: vehicle.vehicleDetail.vehicleId,
          vehicleName: vehicle.vehicleDetail.vehicleName,
          serviceType: vehicle.vehicleDetail.serviceType,
          vehicleImage: `${baseUrl}uploads/vehicleImages/${vehicle.vehicleDetail.vehicleImage}`,
          seats: vehicle.vehicleDetail.seats,
          categoryId: "",
          categoryImage: "",
        };

        if (
          vehicle.vehicleCategoryDetail &&
          vehicle.vehicleDetail.serviceType == 1
        ) {
          vehicleInfo.vehicleName = vehicle.vehicleCategoryDetail.categoryName;
          vehicleInfo.categoryId = vehicle.vehicleCategoryDetail._id;
          vehicleInfo.categoryImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;
          vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
          vehicleInfo.scheduleEndDate = requests.scheduleEndDate;
          vehicleInfo.scheduleEndTime = requests.scheduleEndTime;
        }
        let calculatedPrices = null;
        if (requests.serviceType === "travel") {
          if (vehicle.vehicleDetail.serviceType == 1) {
            calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
          }
        }

        if (calculatedPrices && vehicle.vehicleCategoryDetail) {
          pricesPerVehicle.push({
            vehicle: vehicleInfo,
            totalPrice: calculatedPrices.totalPrice,
            duration: calculatedPrices.duration,
          });
        }
      }
      let userId = req.user._id;

      const user = await User.findOne({ _id: userId });
      const walletBalance = user.walletBalance;
      const newData = {
        pricesPerVehicle: pricesPerVehicle,
        walletBalance,
      };

      return success(res, "data_fetched_succesfully", newData);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Travel Booking
  travelBooking: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        source: "required",
        destination: "required",
        bookingType: "required|in:1,2",
        vehicleId: "required",
        vehicleCatId: "required",
        bookingDate: "required",
        bookingTime: "required",
        scheduleEndDate: "required",
        scheduleEndTime: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      let params = {
        roleType: 2,
        ongoingStatus: 0,
        verifyStatus: 1,
        live: 1,
        status: 1,
      };

      if (requests.vehicleId) {
        const vehicleId = new ObjectId(requests.vehicleId);
        params = Object.assign(params, {
          "userDocument.vehicleId": vehicleId,
        });
      }

      if (requests.vehicleCatId) {
        const vehicleCatId = new ObjectId(requests.vehicleCatId);
        params = Object.assign(params, {
          "userDocument.vehicleCatId": vehicleCatId,
        });
      }
      //Service => Travel
      const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee0");
      params = Object.assign(params, {
        "userDocument.vehicleServiceId": vehicleServiceId,
      });
      const checkOngoingStatus = await User.findOne({ _id: userId });

      if (checkOngoingStatus.ongoingStatus == 1) {
        failed(res, "youre_already_on_your_way");
      }
      // Find all available drivers within a certain radius (e.g., 5 km) from the user's location
      const drivers = await User.aggregate([
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "userDocument",
          },
        },
        {
          $unwind: {
            path: "$userDocument",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $match: params,
        },
      ]);

      // Handle the drivers array as needed
      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      const distanceTime = await getDurationAndDistance(origin, destination);

      //Calculate user location to driver location distances
      const distances = [];
      for (const driver of drivers) {
        const driverOrigin = {
          lat: parseFloat(driver.currentLat),
          lng: parseFloat(driver.currentLong),
        };
        const driverDistance = await calculateDuration(
          parseFloat(requests.s_lat),
          parseFloat(requests.s_lng),
          driverOrigin.lat,
          driverOrigin.lng,
          averageSpeedKmPerHour
        );
        const distanceString = driverDistance.distance;
        const distanceFloat = parseFloat(distanceString);
        distances.push({
          driver,
          distance: distanceFloat,
          duration: driverDistance.duration,
        });
      }

      //Get nearest location drivers
      const nearbyDrivers = distances
        .filter(({ distance, duration }) => {
          return duration !== null && distance <= 5000;
        })
        .map(({ driver }) => driver);

      //distance Amt
      console.log(requests.vehicleId);
      const pricing = await pricingManage(
        parseFloat(distanceTime.distance),
        requests.vehicleId,
        requests.vehicleCatId
      );
      console.log({ pricing });

      filteredDrivers = [];
      for (let i = 0; i < nearbyDrivers.length; i++) {
        const element = nearbyDrivers[i];
        // Find unreserved drivers
        const filterScheduledBooking = await Booking.find({
          driverId: element._id,
          date_of_booking: { $gte: requests.bookingDate },
          status: { $in: [1, 3, 4] },
        });

        if (filterScheduledBooking.length > 0) {
          filteredDrivers.push(...filterScheduledBooking);
        }
      }
      if (filteredDrivers.length > 0) {
        // Notify nearby drivers about the new ride request
        for (let i = 0; i < filteredDrivers.length; i++) {
          const element = filteredDrivers[i];
          const reqData = {
            userId: userId,
            driverId: element.driverId, // Use driverId from filtered drivers
            source: requests.source,
            s_lat: requests.s_lat,
            s_long: requests.s_lng,
            destination: requests.destination,
            d_lat: requests.d_lat,
            d_long: requests.d_long,
            distance: distanceTime.distance,
            totalTime: distanceTime.duration,
            date_of_booking: requests.bookingDate,
            time_of_booking: requests.bookingTime,
            bookingType: requests.bookingType, // 1=Normal Booking, 2=Schedule Booking
            updatedAmount: pricing.totalPrice, // Corrected spelling
            serviceType: requests.serviceType,
            scheduleEndDate: requests.scheduleEndDate,
            scheduleEndTime: requests.scheduleEndTime,
            bootSpace: requests.bootSpace,
          };
          // Send notification to the driver (uncomment if needed)
          // sendNotification(
          //   driver.email,
          //   "New Ride Request",
          //   "A new ride request is available."
          // );
          await Booking.create(reqData);
        }
      } else {
        // console.log({ pricing });
        // return 1;

        // Notify all drivers about the new ride request
        for (let i = 0; i < nearbyDrivers.length; i++) {
          const element = nearbyDrivers[i];
          const reqData = {
            userId: userId,
            driverId: element._id, // Use driverId from nearby drivers
            source: requests.source,
            s_lat: requests.s_lat,
            s_long: requests.s_lng,
            destination: requests.destination,
            d_lat: requests.d_lat,
            d_long: requests.d_long,
            distance: distanceTime.distance,
            totalTime: distanceTime.duration,
            date_of_booking: requests.bookingDate,
            time_of_booking: requests.bookingTime,
            bookingType: requests.bookingType, // 1=Normal Booking, 2=Schedule Booking
            updatedAmount: pricing.totalPrice, // Corrected spelling
            serviceType: requests.serviceType,
            scheduleEndDate: requests.scheduleEndDate,
            scheduleEndTime: requests.scheduleEndTime,
            bootSpace: requests.bootSpace,
          };
          // Send notification to the driver (uncomment if needed)
          // sendNotification(
          //   driver.email,
          //   "New Ride Request",
          //   "A new ride request is available."
          // );
          await Booking.create(reqData);
        }
      }

      success(res, "nearby_drivers_searched_successfully", {
        nearbyDrivers,
        distanceTime: distanceTime.distance,
        durationTime: distanceTime.duration,
      });
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error.");
    }
  },
  //Rental vehicles
  rentalBookingList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        serviceType: ["required", "in:rentals"],
        hours: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const data = await Pricing.aggregate([
        {
          $match: {
            serviceId: new ObjectId(requests.serviceId),
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleId",
            foreignField: "_id",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $lookup: {
            from: "vehiclecategories",
            localField: "vehicleCategoryId",
            foreignField: "_id",
            as: "vehicleCategoryDetail",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$vehicleCategoryDetail",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $project: {
            _id: 1,
            baseFare: 1,
            extraFare: 1,
            nightTime: 1,
            currency: 1,
            kmCharges: 1,
            hourlyCharges: 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.serviceType": 1,
            "vehicleDetail._id": 1,
            "vehicleDetail.vehicleImage": 1,
            "vehicleDetail.seats": 1,
            "vehicleCategoryDetail._id": 1,
            "vehicleCategoryDetail.vehicleId": 1,
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      const pricesPerVehicle = [];

      for (const vehicle of data) {
        let totalPriceForVehicle = 0;
        const vehicleInfo = {
          _id: vehicle.vehicleDetail._id, // Assuming this field exists in both vehicleDetail and vehicleCategoryDetail
          vehicleId: vehicle.vehicleDetail.vehicleId,
          vehicleName: vehicle.vehicleDetail.vehicleName,
          serviceType: vehicle.vehicleDetail.serviceType,
          vehicleImage: `${baseUrl}uploads/vehicleImages/${vehicle.vehicleDetail.vehicleImage}`,
          seats: vehicle.vehicleDetail.seats,
          categoryId: "",
          categoryImage: "",
        };

        if (
          vehicle.vehicleCategoryDetail &&
          vehicle.vehicleDetail.serviceType == 1
        ) {
          vehicleInfo.vehicleName = vehicle.vehicleCategoryDetail.categoryName;
          vehicleInfo.categoryId = vehicle.vehicleCategoryDetail._id;
          vehicleInfo.categoryImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;
          vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
          vehicleInfo.scheduleEndDate = requests.scheduleEndDate;
          vehicleInfo.scheduleEndTime = requests.scheduleEndTime;
        }
        let calculatedPrices = null;
        if (requests.serviceType === "rentals") {
          if (vehicle.vehicleDetail.serviceType == 1) {
            //Hourly based price
            calculatedPrices = calculateTotalHourPrice(
              vehicle,
              parseInt(requests.hours),
              totalPriceForVehicle
            );
          }
        }

        if (calculatedPrices && vehicle.vehicleCategoryDetail) {
          pricesPerVehicle.push({
            vehicle: vehicleInfo,
            totalPrice: calculatedPrices,
            duration: parseInt(requests.hours),
          });
        }
      }
      let userId = req.user._id;

      const user = await User.findOne({ _id: userId });
      const walletBalance = user.walletBalance;
      const newData = {
        pricesPerVehicle: pricesPerVehicle,
        walletBalance,
      };
      return success(res, "data_fetched_succesfully", newData);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error.");
    }
  },
  // Book rental vehicles
  bookRental: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = req.user._id;
      console.log({ userId });
      const validate = new Validator(requests, {
        vehicleId: "required",
        vehicleCatId: "required",
        bookingDate: "required",
        bookingTime: "required",
        hours: "required",
      });
      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }

      let params = {
        roleType: 2,
        ongoingStatus: 0,
        verifyStatus: 1,
        live: 1,
        status: 1,
      };

      if (requests.vehicleId) {
        params["userDocument.vehicleId"] = new ObjectId(requests.vehicleId);
      }

      if (requests.vehicleCatId) {
        params["userDocument.vehicleCatId"] = new ObjectId(
          requests.vehicleCatId
        );
      }

      const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee6");
      params["userDocument.vehicleServiceId"] = vehicleServiceId;

      //Check your ongoing status
      const checkOngoingStatus = await User.findOne({ _id: userId });
      if (checkOngoingStatus.ongoingStatus == 1) {
        return failed(res, "You're already on your way.");
      }
      //Driver data with vehicle info
      const drivers = await User.aggregate([
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "userDocument",
          },
        },
        {
          $unwind: {
            path: "$userDocument",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: params,
        },
      ]);

      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };

      const distances = [];
      for (const driver of drivers) {
        const driverOrigin = {
          lat: parseFloat(driver.currentLat),
          lng: parseFloat(driver.currentLong),
        };
        const driverDistance = await calculateDuration(
          parseFloat(requests.s_lat),
          parseFloat(requests.s_lng),
          driverOrigin.lat,
          driverOrigin.lng,
          averageSpeedKmPerHour
        );
        const distanceFloat = parseFloat(driverDistance.distance);
        distances.push({
          driver,
          distance: distanceFloat,
          duration: driverDistance.duration,
        });
      }

      const nearbyDrivers = distances
        .filter(
          ({ duration, distance }) => duration !== null && distance <= 5000
        )
        .map(({ driver }) => driver);

      const bookingStartDateTime = new Date(requests.bookingDate);
      const bookingEndDateTime = new Date(
        bookingStartDateTime.getTime() +
          parseInt(requests.hours) * 60 * 60 * 1000
      );
      const bookingCheck = await Booking.findOne({
        status: { $in: [1, 3, 4] },
        date_of_booking: requests.bookingDate,
      });
      //Price calculation
      let updatedAmount = 0; // Assuming a fixed amount for updatedAmount

      const price = await Pricing.findOne({
        vehicleId: requests.vehicleId,
        vehicleCategoryId: requests.vehicleCatId,
      });
      updatedAmount = calculateTotalHourPrice(
        price,
        parseInt(requests.hours),
        0
      );
      // console.log( updatedAmount);
      // return 1;
      if (bookingCheck) {
        return failed(
          res,
          `You have already book your ride on ${bookingCheck.date_of_booking}.`
        );
      }

      const filteredDrivers = [];
      for (const element of nearbyDrivers) {
        const filterScheduledBooking = await Booking.find({
          driverId: element._id,
          status: { $in: [1, 3, 4] },
          date_of_booking: { $gte: requests.bookingDate },
          scheduleEndDate: { $lte: bookingEndDateTime },
        });
        // console.log("++++++++++++++++",filterScheduledBooking)
        if (filterScheduledBooking.length === 0) {
          // No overlapping bookings found for this driver, so add to filteredDrivers
          filteredDrivers.push(element);
        }
      }
      console.log(filteredDrivers);

      if (filteredDrivers.length > 0) {
        // Notify nearby drivers about the new ride request
        for (let i = 0; i < filteredDrivers.length; i++) {
          const element = filteredDrivers[i];
          const reqData = {
            userId: userId,
            driverId: element.driverId, // Use driverId from filtered drivers
            source: requests.source,
            s_lat: requests.s_lat,
            s_long: requests.s_lng,
            destination: requests.destination,
            d_lat: requests.d_lat,
            d_long: requests.d_long,
            totalTime: requests.hours,
            date_of_booking: requests.bookingDate,
            time_of_booking: requests.bookingTime,
            bookingType: 2, // 1=Normal Booking, 2=Schedule Booking
            updatedAmount: updatedAmount, // Corrected spelling
            serviceType: requests.serviceType,
            scheduleEndDate: bookingEndDateTime,
            bootSpace: requests.bootSpace,
          };
          // Send notification to the driver (uncomment if needed)
          // sendNotification(
          //   driver.email,
          //   "New Ride Request",
          //   "A new ride request is available."
          // );
          await Booking.create(reqData);
        }
      } else {
        // Notify all drivers about the new ride request
        for (let i = 0; i < nearbyDrivers.length; i++) {
          const element = nearbyDrivers[i];
          const reqData = {
            userId: userId,
            driverId: element._id, // Use driverId from nearby drivers
            source: requests.source,
            s_lat: requests.s_lat,
            s_long: requests.s_lng,
            destination: requests.destination,
            d_lat: requests.d_lat,
            d_long: requests.d_long,
            totalTime: requests.hours,
            date_of_booking: requests.bookingDate,
            time_of_booking: requests.bookingTime,
            bookingType: 2, // 1=Normal Booking, 2=Schedule Booking
            updatedAmount: updatedAmount, // Corrected spelling
            serviceType: requests.serviceType,
            scheduleEndDate: bookingEndDateTime,
            bootSpace: requests.bootSpace,
          };
          // Send notification to the driver (uncomment if needed)
          // sendNotification(
          //   driver.email,
          //   "New Ride Request",
          //   "A new ride request is available."
          // );
          await Booking.create(reqData);
        }
      }

      return success(res, "nearby_drivers_searched_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error.");
    }
  },
  //Shuttle
  shuttlesList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        serviceType: ["required", "in:shuttle"],
        noOfPerson: "required",
        bookingDate: "required",
        // vehicleId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const shuttles = await UserDocuments.find({
        vehicleId: "65faedda66e9b4299260b349",
      });

      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      let duration = await getDurationAndDistance(origin, destination);

      // console.log({ duration });
      let vehicle = await Pricing.findOne({
        serviceId: new ObjectId(requests.serviceId),
        vehicleId: "65faedda66e9b4299260b349",
      });
      // return success(res, "data_fetched_succesfully", {
      //   vehicle
      // });
      const maxDistance = 15; // Maximum allowed distance in km
      let availableShuttles = [];
      let totalPriceForVehicle = 0;
      for (let i = 0; i < shuttles.length; i++) {
        const selectedRoute = shuttles[i];
        // Calculate distance to shuttle start and end locations
        let distanceToStart = calculateDistanceShuttle(
          requests.s_lat,
          requests.s_lng,
          selectedRoute.startLocationLat,
          selectedRoute.startLocationLong
        );
        // console.log(
        //   "distanceToStart+++++++++++",
        //   i + 1,
        //   "===========",
        //   distanceToStart.duration
        // );
        const distanceToEnd = calculateDistanceShuttle(
          requests.d_lat,
          requests.d_long,
          selectedRoute.dropLocationLat,
          selectedRoute.dropLocationLong
        );
        let durationData = distanceToEnd.duration;
        // console.log("distanceToEnd+++++++++++", parseFloat(durationData));
        // console.log("++++++++++++++++++++", maxDistance);

        // Check if the user's start and drop locations are within range
        if (
          distanceToStart.distance <= maxDistance &&
          distanceToEnd.distance <= maxDistance
        ) {
          // console.log("distanceToStart.distance",selectedRoute)
          // console.log(durationData, "distanceDuration");

          // console.log(i + 1);

          let closestPickupPoint = null;
          let closestPickupDistance = Infinity;
          // Find the closest pickup point to the user's start location
          for (const pickupPoint of selectedRoute.routes) {
            if (pickupPoint.lat && pickupPoint.long) {
              const pickupDistance = calculateDistanceShuttle(
                requests.s_lat,
                requests.s_lng,
                pickupPoint.lat,
                pickupPoint.long
              );
              // console.log("pickupDistance.distance", pickupPoint);
              // console.log("closestPickupDistance", closestPickupDistance);

              if (pickupDistance.distance < closestPickupDistance) {
                closestPickupPoint = pickupPoint;
                closestPickupDistance = pickupDistance;
              }
            }

            let availableSeats;
            let totalPassengers;

            if (closestPickupPoint) {
              // Check shuttle availability
              const bookings = await Booking.find({
                driverId: selectedRoute.userId,
                status: { $nin: [2, 6, 5] }, //Ongoing status
              });
              // totalPassengers = bookings.reduce(
              //   (total, booking) =>
              //     booking.driverId === selectedRoute.userId
              //       ? total + passengers
              //       : total,
              //   0
              // );
              let totalPassengers = 0;
              let totalCount = 0;
              for (let i = 0; i < bookings.length; i++) {
                const element = bookings[i];
                console.log(element._id, "bookings.driverId");

                if (element.driverId.equals(selectedRoute.userId)) {
                  // console.log(element.passengers, "totalCount");
                  totalCount += parseInt(element.passengers);
                }
              }
              // console.log("totalCount+++++++++++", totalCount);
              // console.log("totalPassengers+++++++++++", totalPassengers);

              // console.log("totalPassengers+++++++++++", selectedRoute);
              // console.log("totalPassengers+++++++++++", totalCount);

              availableSeats = selectedRoute.noOfSeat - totalCount;
            }

            let calculatedPrices = calculatePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              [selectedRoute]
            );

            if (requests.noOfPerson <= availableSeats) {
              const routeIdExists = availableShuttles.some(
                (shuttle) => shuttle.routes._id === selectedRoute._id
              );

              if (!routeIdExists) {
                availableShuttles.push({
                  routes: selectedRoute,
                  closestPickupPoint,
                  availableSeats,
                  pricePerPassenger: calculatedPrices.totalPrice,
                  passengers: parseInt(requests.noOfPerson),
                  bookingDate: requests.bookingDate,
                  duration: durationData,
                  userSource: { s_lat: requests.s_lat, s_lng: requests.s_lng },
                  userDestination: {
                    d_lat: requests.d_lat,
                    d_lng: requests.d_long,
                  },
                });
              }
            }
          }
        }
      }
      let userId = req.user._id;

      const user = await User.findOne({ _id: userId });
      let walletBalance = parseFloat(user.walletBalance || 0).toFixed(2);
      walletBalance = parseFloat(walletBalance);
      // if (availableShuttles.length === 0) {
      //   return res.status(404).json({ error: "No available shuttles found" });
      // }

      // res.json({ availableShuttles });
      return success(res, "data_fetched_succesfully", {
        availableShuttles,
        walletBalance,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error.");
    }
  },
  bookShuttle: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        source: "required",
        destination: "required",
        bookingType: "required|in:2",
        vehicleId: "required",
        bookingDate: "required",
        noOfPerson: "required",
        driverId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const shuttles = await UserDocuments.find({
        vehicleId: requests.vehicleId,
      });
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      let distanceTime = await getDurationAndDistance(origin, destination);
      // console.log({ duration }); return 1;
      let vehicle = await Pricing.findOne({
        vehicleId: requests.vehicleId,
      });
      const priceing = await pricingManage(
        parseFloat(distanceTime.distance),
        requests.vehicleId
      );
      // console.log({priceing}) ;return  1;
      const reqData = {
        userId: userId,
        driverId: requests.driverId,
        source: requests.source,
        s_lat: requests.s_lat,
        s_long: requests.s_lng,
        destination: requests.destination,
        d_lat: requests.d_lat,
        d_long: requests.d_long,
        distance: distanceTime.distance,
        totalTime: distanceTime.duration,
        date_of_booking: requests.bookingDate,
        bookingType: requests.bookingType, //1=Normal Booking, 2=Schedule Booking
        updatedAmount: priceing.totalPrice,
        serviceType: "shuttle",
        passengers: requests.noOfPerson,
        status: 1, //Accept
      };
      // Send notification to the driver (uncomment if needed)
      // sendNotification(
      //   driver.email,
      //   "New Ride Request",
      //   "A new ride request is available."
      // );
      await Booking.create(reqData);
      success(res, "shuttle_booked_successfully", {
        reqData,
        distanceTime: distanceTime.distance,
        durationTime: distanceTime.duration,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error.");
    }
  },
  //Car pool booking
  carpoolList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        noOfPerson: "required",
        // vehicleId: "required",
        // vehicleCatId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      const data = await Pricing.aggregate([
        {
          $match: {
            serviceId: new ObjectId(requests.serviceId),
          },
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "vehicleId",
            foreignField: "_id",
            as: "vehicleDetail",
          },
        },
        {
          $unwind: "$vehicleDetail", // Unwind the array created by $lookup
        },
        {
          $lookup: {
            from: "vehiclecategories",
            localField: "vehicleCategoryId",
            foreignField: "_id",
            as: "vehicleCategoryDetail",
          },
        },
        {
          $unwind: {
            //unwind use for make array to object
            path: "$vehicleCategoryDetail",
            preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
          },
        },
        {
          $project: {
            _id: 1,
            baseFare: 1,
            extraFare: 1,
            nightTime: 1,
            currency: 1,
            kmCharges: 1,
            hourlyCharges: 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.serviceType": 1,
            "vehicleDetail._id": 1,
            "vehicleDetail.vehicleImage": 1,
            "vehicleDetail.seats": 1,
            "vehicleCategoryDetail._id": 1,
            "vehicleCategoryDetail.vehicleId": 1,
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      const duration = await getDurationAndDistance(origin, destination);

      // console.log(data)
      const pricesPerVehicle = [];

      for (const vehicle of data) {
        let totalPriceForVehicle = 0;
        const vehicleInfo = {
          _id: vehicle.vehicleDetail._id, // Assuming this field exists in both vehicleDetail and vehicleCategoryDetail
          vehicleId: vehicle.vehicleDetail.vehicleId,
          vehicleName: vehicle.vehicleDetail.vehicleName,
          serviceType: vehicle.vehicleDetail.serviceType,
          vehicleImage: `${baseUrl}uploads/vehicleImages/${vehicle.vehicleDetail.vehicleImage}`,
          seats: vehicle.vehicleDetail.seats,
          categoryId: "",
          categoryImage: "",
        };

        if (
          vehicle.vehicleCategoryDetail &&
          vehicle.vehicleDetail.serviceType == 1
        ) {
          vehicleInfo.vehicleName = vehicle.vehicleCategoryDetail.categoryName;
          vehicleInfo.categoryId = vehicle.vehicleCategoryDetail._id;
          vehicleInfo.categoryImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;
          vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
          vehicleInfo.scheduleEndDate = requests.scheduleEndDate;
          vehicleInfo.scheduleEndTime = requests.scheduleEndTime;
        }
        let calculatedPrices = null;

        calculatedPrices = calculatePrices(
          vehicle,
          duration,
          totalPriceForVehicle,
          [vehicle]
        );

        if (calculatedPrices && vehicle.vehicleCategoryDetail) {
          pricesPerVehicle.push({
            vehicle: vehicleInfo,
            totalPrice: calculatedPrices.totalPrice,
          });
        }
      }
      let userId = req.user._id;

      const user = await User.findOne({ _id: userId });
      const walletBalance = user.walletBalance;
      const newData = {
        pricesPerVehicle: pricesPerVehicle,
        walletBalance,
      };
      success(res, "carpool_listed_successfully", newData);
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error.");
    }
  },
  bookCarPool: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        s_lat: "required",
        s_lng: "required",
        d_lat: "required",
        d_long: "required",
        noOfPerson: "required",
        vehicleId: "required",
        vehicleCatId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let bookingParams = {};

      if (requests.vehicleId) {
        const vehicleId = new ObjectId(requests.vehicleId);
        bookingParams["vehicleDetail.vehicleId"] = vehicleId;
      }

      if (requests.vehicleCatId) {
        const vehicleCatId = new ObjectId(requests.vehicleCatId);
        bookingParams["vehicleDetail.vehicleCatId"] = vehicleCatId;
      }
      const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee4");
      bookingParams = Object.assign(bookingParams, {
        "vehicleDetail.vehicleServiceId": vehicleServiceId,
      });
      // Handle the drivers array as needed
      const averageSpeedKmPerHour = 30;
      const origin = {
        lat: parseFloat(requests.s_lat),
        lng: parseFloat(requests.s_lng),
      };
      const destination = {
        lat: parseFloat(requests.d_lat),
        lng: parseFloat(requests.d_long),
      };
      const distanceTime = await getDurationAndDistance(origin, destination);

      bookingParams.date_of_booking = { $gte: new Date(requests.bookingDate) };
      bookingParams.isCarpoolBooking = 1;
      bookingParams.status = { $nin: [5, 2, 6] }; // 5=>Completed, [2,6] => Cancelled

      const relatedRouteBookings = await Booking.aggregate([
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
            from: "userdocuments",
            localField: "driverId",
            foreignField: "userId",
            as: "vehicleDetail",
          },
        },
        { $unwind: "$vehicleDetail" },
        {
          $lookup: {
            from: "vehiclecategories",
            let: { vehicleCatId: "$vehicleDetail.vehicleCatId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$vehicleCatId"] } } },
            ],
            as: "vehicleDetailsData",
          },
        },
        { $unwind: "$vehicleDetailsData" },
        { $unwind: "$driverDetails" },
        { $match: bookingParams },
        {
          $group: {
            _id: "$driverId",
            driverDetails: { $first: "$driverDetails" },
            totalPassengers: { $sum: "$passengers" },
            bookings: { $push: "$$ROOT" },
          },
        },
      ]);

      const priceing = await pricingManage(
        parseFloat(distanceTime.distance),
        requests.vehicleId,
        requests.vehicleCatId
      );
      // console.log(relatedRouteBookings);
      let completeData = [];
      let driversArray = [];

      if (relatedRouteBookings.length > 0) {
        for (const group of relatedRouteBookings) {
          console.log("++++++++++++++++++++++++++22222222222");
          const driverDetails = group.driverDetails;
          const totalPassengers = group.totalPassengers;
          const bookings = group.bookings;
          console.log("+++++++++++++", totalPassengers);
          for (const element of bookings) {
            let availableSeats =
              element.vehicleDetailsData.seats - totalPassengers;
            console.log(totalPassengers);
            if (availableSeats >= requests.noOfPerson) {
              const reqData = {
                userId: userId,
                driverId: element.driverId,
                source: requests.source,
                s_lat: requests.s_lat,
                s_long: requests.s_lng,
                destination: requests.destination,
                d_lat: requests.d_lat,
                d_long: requests.d_long,
                distance: distanceTime.distance,
                totalTime: distanceTime.duration,
                date_of_booking: requests.bookingDate,
                bookingType: requests.bookingType, //1=Normal Booking, 2=Schedule Booking
                updatedAmount: priceing.totalPrice,
                serviceType: requests.serviceType,
                passengers: requests.noOfPerson,
                isCarpoolBooking: 1,
              };

              // await Booking.create(reqData);

              completeData.push({
                driver: driverDetails,
                reqData,
              });
            } else {
              return failed(res, "Seats are not available");
            }
          }
          driversArray.push(driverDetails);
        }
      } else {
        console.log("++++++++++++++++++++++++++111111111");

        let params = {
          roleType: 2,
          ongoingStatus: 0,
          verifyStatus: 1,
          live: 1,
          status: 1,
        };

        if (requests.vehicleId) {
          const vehicleId = new ObjectId(requests.vehicleId);
          params["vehicleDetail.vehicleId"] = vehicleId;
        }

        if (requests.vehicleCatId) {
          const vehicleCatId = new ObjectId(requests.vehicleCatId);
          params["vehicleDetail.vehicleCatId"] = vehicleCatId;
        }
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee4");
        params = Object.assign(params, {
          "vehicleDetail.vehicleServiceId": vehicleServiceId,
        });
        const drivers = await User.aggregate([
          {
            $lookup: {
              from: "userdocuments",
              localField: "_id",
              foreignField: "userId",
              as: "vehicleDetail",
            },
          },
          {
            $unwind: {
              path: "$vehicleDetail",
              preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
            },
          },
          {
            $match: params,
          },
        ]);
        for (let i = 0; i < drivers.length; i++) {
          const element = drivers[i];
          const reqData = {
            userId: userId,
            driverId: element._id,
            source: requests.source,
            s_lat: requests.s_lat,
            s_long: requests.s_lng,
            destination: requests.destination,
            d_lat: requests.d_lat,
            d_long: requests.d_long,
            distance: distanceTime.distance,
            totalTime: distanceTime.duration,
            date_of_booking: requests.bookingDate,
            time_of_booking: requests.bookingTime,
            bookingType: requests.bookingType, //1=Normal Booking, 2=Schedule Booking
            updatedAmount: priceing.totalPrice,
            serviceType: requests.serviceType,
            passengers: requests.noOfPerson,
            isCarpoolBooking: 1,
          };
          // Send notification to the driver (uncomment if needed)
          // sendNotification(
          //   driver.email,
          //   "New Ride Request",
          //   "A new ride request is available."
          // );
          await Booking.create(reqData);
          completeData.push({
            driver: element,
            reqData,
          });
        }
        driversArray.push(drivers);
      }
      // console.log({ driversArray });
      success(res, "Carpool listed successfully.", {
        relatedRouteBookings,
        completeData,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error.");
    }
  },
  //apply coupon
  applyCoupon: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = req.user._id;

      const validate = new Validator(requests, {
        couponCode: "required",
        amount: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const couponCheck = await Coupon.findOne({
        couponId: requests.couponCode,
      });

      if (!couponCheck) {
        return failed(res, "Coupon code does not exist.");
      }

      if (couponCheck.endDate < new Date()) {
        return failed(res, "Given promo code has expired!");
      }

      const remainingAmount = parseFloat(requests.amount) - couponCheck.amount;
      const newData = {
        bookingAmount: parseFloat(requests.amount),
        couponAmount: couponCheck.amount,
        totalAmount: remainingAmount,
      };

      return success(res, "Updated ride amount", newData);
    } catch (error) {
      console.error("Error applying coupon:", error);
      return serverError(res, "internal_server_error");
    }
  },
  //make Payment
  makePayment: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = req.user._id;

      const validate = new Validator(requests, {
        amount: "required",
        bookingId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const booking = await Booking.findOne({
        _id: requests.bookingId,
        userId: userId,
      });

      if (!booking) {
        return failed(res, "Booking not found.");
      }
      await booking.updateOne({ payStatus: 1 });

      return success(res, "Payment success");
    } catch (error) {
      console.error("Error making payment:", error); // Log the error for debugging
      return serverError(res, "internal_server_error");
    }
  },
};
