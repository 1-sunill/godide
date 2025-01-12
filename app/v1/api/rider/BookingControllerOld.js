const Booking = require("../../../../models/Booking");
const User = require("../../../../models/User");
const Pricing = require("../../../../models/RidePricing");
const Vehicle = require("../../../../models/Vehicle");
const VehicleCategory = require("../../../../models/VehicleCategory");
const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/response");
const {
  getDurationAndDistance,
  calculateDuration,
  pricingManage,
} = require("../../../helper/helpers");
const {
  calculateNormalPrices,
  calculateAmbulancePrices,
} = require("../../../helper/bookingHelper");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");

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
        serviceType: ["required", "in:normal,ambulance,fireFighting,towing"],
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
      // console.log({ duration });
      const pricesPerVehicle = [];

      for (const vehicle of data) {
        let totalPriceForVehicle = 0;
        const vehicleInfo = {
          _id: vehicle.vehicleDetail._id, // Assuming this field exists in both vehicleDetail and vehicleCategoryDetail
          vehicleId: vehicle.vehicleDetail.vehicleId,
          vehicleName: vehicle.vehicleDetail.vehicleName,
          serviceType: vehicle.vehicleDetail.serviceType,
          vehicleImage: vehicle.vehicleDetail.vehicleImage,
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
          vehicleInfo.categoryImage =
            vehicle.vehicleCategoryDetail.categoryImage;
          vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
        }
        let calculatedPrices = null;
        if (requests.serviceType === "normal") {
          if (vehicle.vehicleDetail.serviceType == 1) {
            calculatedPrices = calculateNormalPrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData
            );
          }
        } else if (requests.serviceType === "ambulance") {
          if (
            vehicle.vehicleDetail.serviceType == 2 &&
            vehicle.vehicleDetail.vehicleName === "Ambulance"
          ) {
            let reqData = {
              patientName: requests,
            };
            calculatedPrices = calculateAmbulancePrices(
              vehicle,
              duration,
              totalPriceForVehicle,
              driverData,
              reqData
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

      return success(res, "Data fetched succesfully.", pricesPerVehicle);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error");
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
        bookingType: "required",
        vehicleId: "required",
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
      const checkOngoingStatus = await User.findOne({ _id: userId });
      // console.log({checkOngoingStatus}); return 1;
      // if (checkOngoingStatus.verifyStatus !== 1) {
      //   failed(res, "Your account blocked. Please contact to the admin");
      // }
      if (checkOngoingStatus.ongoingStatus == 1) {
        failed(res, "You're already on your way.");
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
      const priceing = await pricingManage(
        parseFloat(distanceTime.distance),
        requests.categoryId,
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
          date_of_booking: new Date(),
          time_of_booking: new Date().toLocaleTimeString("en-US", {
            hour12: false,
          }),
          bookingType: requests.bookingType, //1=Normal Booking, 2=Schedule Booking
          updatedAmount: priceing.totalPrice,
          patientDetails: patientDetails,
          serviceType: requests.serviceType,
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
      serverError(res, "Internal server error.");
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
      serverError(res, "Internal server error");
    }
  },
  //Driver details
  driverDetail: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = new ObjectId(req.user._id);

      const bookingDetail = await Booking.aggregate([
        { $match: { userId: userId, status: { $ne: 5 } } },
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
            "driverDetails._id": 1,
            "driverDetails.name": 1,
            "driverDetails.gender": 1,
            "driverDetails.countryCode": 1,
            "driverDetails.mobile": 1,
            "driverDetails.roleType": 1,
            "driverDetails.currentLat": 1,
            "driverDetails.currentLong": 1,
            "driverDetails.landMark": 1,
            "driverDetails.userImage": 1,
            "driverDetails.ongoingStatus": 1,
            "vehicleDetail.vehicleName": 1,
            "vehicleDetail.vehicleNumber": 1,
            "vehicleDetail._id": 1,
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $limit: 1,
        },
      ]);
      success(res, "Detail fetched successfully.", bookingDetail);
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },
};
