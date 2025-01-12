const User = require("../models/User");
const Booking = require("../models/Booking");
const Pricing = require("../models/RidePricing");
const UserDocuments = require("../models/UserDocuments");
const Chat = require("../models/Chat");
const ChatMessage = require("../models/ChatMessage");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ObjectId = mongoose.Types.ObjectId;
const { Validator } = require("node-input-validator");

const {
  getDurationAndDistance,
  calculateDuration,
  pricingManage,
} = require("../app/helper/helpers");
const {
  calculatePrices,
  calculateTotalHourPrice,
  generateBookingID,
} = require("../app/helper/bookingHelper");
var joinedDrivers = [];
module.exports = (io) => {
  // io.use(async (socket, next) => {
  //   try {
  //     let token = socket.handshake.auth.token;
  //     if (!token) {
  //       socket.emit('authentication_error', 'Token missing');
  //       return next(new Error('Authentication error: Token missing'));
  //     }
  //     const decoded = jwt.verify(token.replace("Bearer ", ""),process.env.JWT_SECRET_KEY);
  //     socket.userId = decoded.userId;
  //     return next();
  //   } catch (error) {
  //     socket.emit('authentication_error', 'Invalid token');
  //     return next(new Error('Authentication error: Invalid token'));
  //   }
  // });
  io.on("connection", async (socket) => {
    try {
      let token = socket.handshake.query.token;
      console.log(token, "connection token");
      // console.log(socket.handshake);
      // console.log(
      //   "socket.handshake.query.userType",
      //   socket.handshake.query.userType,
      //   socket.handshake.query
      // );

      if (!token) {
        socket.emit("authentication_error", "Token missing");
        return;
      }
      const decoded = jwt.verify(
        token.replace("Bearer ", ""),
        process.env.JWT_SECRET_KEY
      );
      socket.userId = decoded._id;
      // return next();

      // socket.userId = socket.handshake.query.userId;
      // Store user type when a user connects
      socket.userType = socket.handshake.query.userType;
      console.log(token, decoded, "connection stablished");
      socket.join(decoded._id);
      joinedDrivers.push(decoded._id);
      if (socket.userType == "driver") {
        console.log("inner");
        joinedDrivers.push(decoded._id);
      } else {
        console.log("outer");
      }
    } catch (error) {
      console.log(error.message);
      socket.emit("authentication_error", "Invalid token");
      return;
    }
    //This event call when user reuqest for ride booking
    socket.on("bookRide", async (data) => {
      try {
        console.log("RRRRRRRRRRRRRRRRRRRRR", data);
        const validate = new Validator(data, {
          s_lat: "required",
          s_lng: "required",
          d_lat: "required",
          d_long: "required",
          vehicleId: "required",
          // vehicleCatId: "required",
          source: "required",
          bookingType: "required",
          destination: "required",
        });
        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
        let params = {
          roleType: 2, //driver
          ongoingStatus: 0, //driver is free
          verifyStatus: 1,
          live: 1, //is online
          status: 1, //active status
        };
        // console.log({ params });
        const userId = socket.userId;
        console.log({
          userId,
        });
        if (data.vehicleId) {
          params["userDocument.vehicleId"] = new ObjectId(data.vehicleId);
        }

        if (data.vehicleCatId) {
          params["userDocument.vehicleCatId"] = new ObjectId(data.vehicleCatId);
        }
        if (data.serviceType === "normal") {
          const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ede");
          params = Object.assign(params, {
            "userDocument.vehicleServiceId": vehicleServiceId,
          });
        }
        if (data.serviceType === "reserve") {
          const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee2");
          params = Object.assign(params, {
            "userDocument.vehicleServiceId": vehicleServiceId,
          });
        }
        const checkOngoingStatus = await User.findOne({
          _id: userId,
        });
        console.log(
          checkOngoingStatus,
          "jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj"
        );
        if (checkOngoingStatus.ongoingStatus == 1) {
          socket.emit("error", {
            status: 400,
            message: "You are already on your way.",
            result: {},
          });
          return;
        }

        if (checkOngoingStatus.walletBalance < 100) {
          socket.emit("error", {
            status: 400,
            message: "Your wallet balance is below ₹100.",
            result: {},
          });
          return;
        }
        //Random booking id
        const bookingID = await generateBookingID();

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
        console.log({
          drivers,
        });
        const averageSpeedKmPerHour = 30;
        const origin = {
          lat: parseFloat(data.s_lat),
          lng: parseFloat(data.s_lng),
        };
        const destination = {
          lat: parseFloat(data.d_lat),
          lng: parseFloat(data.d_long),
        };
        const distanceTime = await getDurationAndDistance(origin, destination);

        const distances = [];
        for (const driver of drivers) {
          const driverOrigin = {
            lat: parseFloat(driver.currentLat),
            lng: parseFloat(driver.currentLong),
          };
          const driverDistance = await calculateDuration(
            parseFloat(data.s_lat),
            parseFloat(data.s_lng),
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
          .filter(({ duration }) => duration !== null && duration <= 5000)
          .map(({ driver }) => driver);

        const priceing = await pricingManage(
          parseFloat(distanceTime.distance),
          data.vehicleId,
          data.vehicleCatId
        );

        let patientDetails, towing, towVehicleImg, scheduleTime;

        if (data.serviceType === "ambulance") {
          patientDetails = {
            patientName: data.patientName,
            age: data.age,
            gender: data.gender,
            reason: data.reason,
          };
        } else if (data.serviceType === "towing") {
          towing = data.towingVehicle;
          towVehicleImg = data.towVehicleImg;
        } else if (data.serviceType === "reserve") {
          scheduleTime = data.scheduleTime;
        }

        for (const element of nearbyDrivers) {
          // const existingBooking = await Booking.findOne({
          //   userId: userId,
          //   driverId: element._id,
          //   status: 0, // Assuming status 0 indicates an existing pending booking
          // });

          // if (!existingBooking) {
          // console.log("++++++++++++", existingBooking);
          const reqData = {
            bookingId: bookingID,
            userId: userId,
            driverId: element._id,
            source: data.source,
            s_lat: data.s_lat,
            s_long: data.s_lng,
            destination: data.destination,
            d_lat: data.d_lat,
            d_long: data.d_long,
            distance: distanceTime.distance,
            totalTime: distanceTime.duration,
            date_of_booking: data.bookingDate,
            time_of_booking: data.bookingTime,
            bookingType: data.bookingType,
            updatedAmount: priceing.totalPrice,
            patientDetails: patientDetails,
            serviceType: data.serviceType,
            bootSpace: data.bootSpace,
            towingVehicle: towing,
            scheduleTime: scheduleTime,
            towVehicleImg: towVehicleImg,
          };
          //create booking for all nearby drivers
          await Booking.create(reqData);
          // }
        }
        console.log(nearbyDrivers, "nnnnnnnnnnnnnnnnnnnnnnn", joinedDrivers);
        nearbyDrivers.forEach(async (driver) => {
          const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
          // //console.log(objectIdToCheck);

          if (joinedDrivers.length && joinedDrivers.includes(objectIdToCheck)) {
            const index = joinedDrivers.findIndex(
              (driver) => driver === objectIdToCheck
            );
            let driverId = new ObjectId(joinedDrivers[index]);
            // console.log({
            //   driverId
            // });
            const list = await Booking.aggregate([
              {
                $match: {
                  driverId: driverId,
                  status: 0,
                },
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
                  date_of_booking: 1,
                  scheduleTime: 1,
                  "userDetails._id": 1,
                  "userDetails.name": 1,
                  "userDetails.email": 1,
                  "userDetails.currentLat": 1,
                  "userDetails.currentLong": 1,
                },
              },
            ]);
            //send request on nearby drivers
            io.to(joinedDrivers[index]).emit("rideRequestList", {
              status: 200,
              message: "Ride request list",
              result: list,
            });
          }
        });
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Travel Booking
    socket.on("bookTravel", async (data) => {
      try {
        console.log("TTTTTTTTTTTTTTT", data);
        const validate = new Validator(data, {
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
          // scheduleEndDate: "required",
        });
        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
        let params = {
          roleType: 2, //driver
          ongoingStatus: 0, //driver is free
          verifyStatus: 1,
          live: 1, //is online
          status: 1, //active status
        };
        // console.log({ params });
        const userId = socket.userId;
        console.log({
          userId,
        });
        if (data.vehicleId) {
          params["userDocument.vehicleId"] = new ObjectId(data.vehicleId);
        }

        if (data.vehicleCatId) {
          params["userDocument.vehicleCatId"] = new ObjectId(data.vehicleCatId);
        }
        //Service => Travel
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee0");
        params = Object.assign(params, {
          "userDocument.vehicleServiceId": vehicleServiceId,
        });
        const checkOngoingStatus = await User.findOne({
          _id: userId,
        });

        if (checkOngoingStatus.ongoingStatus == 1) {
          socket.emit("error", {
            status: 400,
            message: "You are already on your way.",
            result: {},
          });
          return;
        }
        if (checkOngoingStatus.status == 2) {
          socket.emit("error", {
            status: 400,
            message: "You have already book your ride.",
            result: {},
          });
          return;
        }
        if (checkOngoingStatus.walletBalance < 100) {
          socket.emit("error", {
            status: 400,
            message: "Your wallet balance is below ₹100.",
            result: {},
          });
          return;
        }
        //Random booking id
        const bookingID = await generateBookingID();
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
        console.log("PPPPPPPPPPPPPPPP", drivers);
        console.log("PArams", params);

        // Handle the drivers array as needed
        const averageSpeedKmPerHour = 30;
        const origin = {
          lat: parseFloat(data.s_lat),
          lng: parseFloat(data.s_lng),
        };
        const destination = {
          lat: parseFloat(data.d_lat),
          lng: parseFloat(data.d_long),
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
            parseFloat(data.s_lat),
            parseFloat(data.s_lng),
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
        const pricing = await pricingManage(
          parseFloat(distanceTime.distance),
          data.vehicleId,
          data.vehicleCatId
        );
        filteredDrivers = [];
        for (let i = 0; i < nearbyDrivers.length; i++) {
          const element = nearbyDrivers[i];
          // Find unreserved drivers
          const filterScheduledBooking = await Booking.find({
            driverId: element._id,
            date_of_booking: { $gte: data.bookingDate },
            scheduleEndDate: { $lt: data.scheduleEndDate },
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
              bookingId: bookingID,
              userId: userId,
              driverId: element.driverId, // Use driverId from filtered drivers
              source: data.source,
              s_lat: data.s_lat,
              s_long: data.s_lng,
              destination: data.destination,
              d_lat: data.d_lat,
              d_long: data.d_long,
              distance: distanceTime.distance,
              totalTime: distanceTime.duration,
              date_of_booking: data.bookingDate,
              time_of_booking: data.bookingTime,
              bookingType: data.bookingType, // 1=Normal Booking, 2=Schedule Booking
              updatedAmount: pricing.totalPrice, // Corrected spelling
              serviceType: data.serviceType,
              scheduleEndDate: data.scheduleEndDate,
              bootSpace: data.bootSpace,
              status: 1,
            };
            // Send notification to the driver (uncomment if needed)
            // sendNotification(
            //   driver.email,
            //   "New Ride Request",
            //   "A new ride request is available."
            // );
            await Booking.create(reqData);
          }
          filteredDrivers.forEach(async (driver) => {
            const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
            // //console.log(objectIdToCheck);

            if (
              joinedDrivers.length &&
              joinedDrivers.includes(objectIdToCheck)
            ) {
              const index = joinedDrivers.findIndex(
                (driver) => driver === objectIdToCheck
              );
              let driverId = new ObjectId(joinedDrivers[index]);
              // console.log({
              //   driverId
              // });
              const list = await Booking.aggregate([
                {
                  $match: {
                    driverId: driverId,
                    status: 0,
                  },
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
                    date_of_booking: 1,
                    scheduleTime: 1,
                    scheduleEndDate: 1,
                    "userDetails._id": 1,
                    "userDetails.name": 1,
                    "userDetails.email": 1,
                    "userDetails.currentLat": 1,
                    "userDetails.currentLong": 1,
                  },
                },
              ]);
              //send request on nearby drivers
              io.to(joinedDrivers[index]).emit("rideRequestList", {
                status: 200,
                message: "Ride request list",
                result: list,
              });
            }
          });
        } else {
          // Notify all drivers about the new ride request
          for (let i = 0; i < nearbyDrivers.length; i++) {
            const element = nearbyDrivers[i];
            const reqData = {
              userId: userId,
              driverId: element._id, // Use driverId from nearby drivers
              source: data.source,
              s_lat: data.s_lat,
              s_long: data.s_lng,
              destination: data.destination,
              d_lat: data.d_lat,
              d_long: data.d_long,
              distance: distanceTime.distance,
              totalTime: distanceTime.duration,
              date_of_booking: data.bookingDate,
              time_of_booking: data.bookingTime,
              bookingType: data.bookingType, // 1=Normal Booking, 2=Schedule Booking
              updatedAmount: pricing.totalPrice, // Corrected spelling
              serviceType: data.serviceType,
              scheduleEndDate: data.scheduleEndDate,

              bootSpace: data.bootSpace,
            };
            // Send notification to the driver (uncomment if needed)
            // sendNotification(
            //   driver.email,
            //   "New Ride Request",
            //   "A new ride request is available."
            // );
            await Booking.create(reqData);
          }
          nearbyDrivers.forEach(async (driver) => {
            const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
            // //console.log(objectIdToCheck);

            if (
              joinedDrivers.length &&
              joinedDrivers.includes(objectIdToCheck)
            ) {
              const index = joinedDrivers.findIndex(
                (driver) => driver === objectIdToCheck
              );
              let driverId = new ObjectId(joinedDrivers[index]);
              // console.log({
              //   driverId
              // });
              const list = await Booking.aggregate([
                {
                  $match: {
                    driverId: driverId,
                    status: 0,
                  },
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
                    date_of_booking: 1,
                    scheduleTime: 1,
                    scheduleEndDate: 1,
                    "userDetails._id": 1,
                    "userDetails.name": 1,
                    "userDetails.email": 1,
                    "userDetails.currentLat": 1,
                    "userDetails.currentLong": 1,
                  },
                },
              ]);
              //send request on nearby drivers
              io.to(joinedDrivers[index]).emit("rideRequestList", {
                status: 200,
                message: "Ride request list",
                result: list,
              });
            }
          });
        }
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Rental Booking
    socket.on("bookRental", async (data) => {
      try {
        console.log("RRRRRRRRRRRRRRRRRRRRR", data);
        const validate = new Validator(data, {
          s_lat: "required",
          s_lng: "required",
          vehicleId: "required",
          vehicleCatId: "required",
          bookingDate: "required",
          hours: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        let params = {
          roleType: 2, //driver
          ongoingStatus: 0, //driver is free
          verifyStatus: 1,
          live: 1, //is online
          status: 1, //active status
        };
        const userId = socket.userId;

        console.log({
          userId,
        });
        if (data.vehicleId) {
          params["userDocument.vehicleId"] = new ObjectId(data.vehicleId);
        }

        if (data.vehicleCatId) {
          params["userDocument.vehicleCatId"] = new ObjectId(data.vehicleCatId);
        }
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee6");
        params["userDocument.vehicleServiceId"] = vehicleServiceId;
        const checkOngoingStatus = await User.findOne({
          _id: userId,
        });
        if (checkOngoingStatus.ongoingStatus == 1) {
          socket.emit("error", {
            status: 400,
            message: "You are already on your way.",
            result: {},
          });
          return;
        }
        if (checkOngoingStatus.walletBalance < 100) {
          socket.emit("error", {
            status: 400,
            message: "Your wallet balance is below ₹100.",
            result: {},
          });
          return;
        }
        //Random booking id
        const bookingID = await generateBookingID();
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
        // console.log({
        //   drivers,
        // });

        const averageSpeedKmPerHour = 30;
        const origin = {
          lat: parseFloat(data.s_lat),
          lng: parseFloat(data.s_lng),
        };

        const distances = [];
        for (const driver of drivers) {
          const driverOrigin = {
            lat: parseFloat(driver.currentLat),
            lng: parseFloat(driver.currentLong),
          };
          const driverDistance = await calculateDuration(
            parseFloat(data.s_lat),
            parseFloat(data.s_lng),
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

        const bookingStartDateTime = new Date(data.bookingDate);
        const bookingEndDateTime = new Date(
          bookingStartDateTime.getTime() + parseInt(data.hours) * 60 * 60 * 1000
        );
        const bookingCheck = await Booking.findOne({
          status: { $in: [1, 3, 4] },
          date_of_booking: data.bookingDate,
        });

        //Price calculation
        let updatedAmount = 0; // Assuming a fixed amount for updatedAmount

        const price = await Pricing.findOne({
          vehicleId: data.vehicleId,
          vehicleCategoryId: data.vehicleCatId,
        });

        updatedAmount = calculateTotalHourPrice(price, parseInt(data.hours), 0);
        console.log({ updatedAmount });

        if (bookingCheck) {
          socket.emit("error", {
            status: 400,
            message: `You have already book your ride on ${bookingCheck.date_of_booking}.`,
            result: {},
          });
          return;
        }

        const filteredDrivers = [];
        for (const element of nearbyDrivers) {
          const filterScheduledBooking = await Booking.find({
            driverId: element._id,
            status: { $in: [1, 3, 4] },
            date_of_booking: { $gte: data.bookingDate },
            scheduleEndDate: { $lte: bookingEndDateTime },
          });
          // console.log(filterScheduledBooking);
          if (filterScheduledBooking.length === 0) {
            // No overlapping bookings found for this driver, so add to filteredDrivers
            filteredDrivers.push(element);
          }
        }
        console.log({ filteredDrivers });
        if (filteredDrivers.length > 0) {
          // Notify nearby drivers about the new ride request
          for (let i = 0; i < filteredDrivers.length; i++) {
            const element = filteredDrivers[i];
            // console.log(element);
            const reqData = {
              bookingId: bookingID,
              userId: userId,
              driverId: element._id, // Use driverId from filtered drivers
              source: data.source,
              s_lat: data.s_lat,
              s_long: data.s_lng,
              destination: data.destination,
              d_lat: data.d_lat,
              d_long: data.d_long,
              totalTime: data.hours,
              date_of_booking: data.bookingDate,
              time_of_booking: data.bookingTime,
              bookingType: 2, // 1=Normal Booking, 2=Schedule Booking
              updatedAmount: updatedAmount, // Corrected spelling
              serviceType: data.serviceType,
              scheduleEndDate: bookingEndDateTime,
              bootSpace: data.bootSpace,
            };
            // Send notification to the driver (uncomment if needed)
            // sendNotification(
            //   driver.email,
            //   "New Ride Request",
            //   "A new ride request is available."
            // );
            await Booking.create(reqData);
          }
          filteredDrivers.forEach(async (driver) => {
            const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
            // console.log(objectIdToCheck);

            if (
              joinedDrivers.length &&
              joinedDrivers.includes(objectIdToCheck)
            ) {
              const index = joinedDrivers.findIndex(
                (driver) => driver === objectIdToCheck
              );
              let driverId = new ObjectId(joinedDrivers[index]);
              console.log({
                driverId,
              });
              const list = await Booking.aggregate([
                {
                  $match: {
                    driverId: driverId,
                    status: 0,
                  },
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
                    date_of_booking: 1,
                    scheduleTime: 1,
                    "userDetails._id": 1,
                    "userDetails.name": 1,
                    "userDetails.email": 1,
                    "userDetails.currentLat": 1,
                    "userDetails.currentLong": 1,
                  },
                },
              ]);
              console.log(123456);
              //send request on nearby drivers
              io.to(joinedDrivers[index]).emit("rideRequestList", {
                status: 200,
                message: "Ride request list",
                result: list,
              });
            }
          });
        } else {
          // Notify all drivers about the new ride request
          for (let i = 0; i < nearbyDrivers.length; i++) {
            const element = nearbyDrivers[i];
            const reqData = {
              userId: userId,
              driverId: element._id, // Use driverId from nearby drivers
              source: data.source,
              s_lat: data.s_lat,
              s_long: data.s_lng,
              destination: data.destination,
              d_lat: data.d_lat,
              d_long: data.d_long,
              totalTime: data.hours,
              date_of_booking: data.bookingDate,
              time_of_booking: data.bookingTime,
              bookingType: 2, // 1=Normal Booking, 2=Schedule Booking
              updatedAmount: updatedAmount, // Corrected spelling
              serviceType: data.serviceType,
              scheduleEndDate: bookingEndDateTime,
              bootSpace: data.bootSpace,
            };
            // Send notification to the driver (uncomment if needed)
            // sendNotification(
            //   driver.email,
            //   "New Ride Request",
            //   "A new ride request is available."
            // );
            await Booking.create(reqData);
          }
          nearbyDrivers.forEach(async (driver) => {
            const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
            // //console.log(objectIdToCheck);

            if (
              joinedDrivers.length &&
              joinedDrivers.includes(objectIdToCheck)
            ) {
              const index = joinedDrivers.findIndex(
                (driver) => driver === objectIdToCheck
              );
              let driverId = new ObjectId(joinedDrivers[index]);
              // console.log({
              //   driverId
              // });
              const list = await Booking.aggregate([
                {
                  $match: {
                    driverId: driverId,
                    status: 0,
                  },
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
                    date_of_booking: 1,
                    scheduleTime: 1,
                    "userDetails._id": 1,
                    "userDetails.name": 1,
                    "userDetails.email": 1,
                    "userDetails.currentLat": 1,
                    "userDetails.currentLong": 1,
                  },
                },
              ]);
              //send request on nearby drivers
              io.to(joinedDrivers[index]).emit("rideRequestList", {
                status: 200,
                message: "Ride request list",
                result: list,
              });
            }
          });
        }
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Carpool booking
    socket.on("bookCarpool", async (data) => {
      try {
        const requests = data;
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
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        let params = {
          roleType: 2, //driver
          verifyStatus: 1,
          live: 1, //is online
          status: 1, //active status
        };
        let bookingParams = {};
        const userId = socket.userId;

        console.log({
          userId,
        });
        if (requests.vehicleId) {
          params["userDocument.vehicleId"] = new ObjectId(requests.vehicleId);
        }

        if (requests.vehicleCatId) {
          params["userDocument.vehicleCatId"] = new ObjectId(
            requests.vehicleCatId
          );
        }
        const vehicleServiceId = new ObjectId("6603b370dc833aa9b0b72ee4");
        params["userDocument.vehicleServiceId"] = vehicleServiceId;

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

        bookingParams.date_of_booking = {
          $gte: new Date(requests.bookingDate),
        };
        bookingParams.isCarpoolBooking = 1;
        bookingParams.status = { $nin: [5, 2, 6] }; // 5=>Completed, [2,6] => Cancelled
        //Random booking id
        const bookingID = await generateBookingID();
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
          console.log("++++++++++++++++++++++++++22222222222");

          for (const group of relatedRouteBookings) {
            const driverDetails = group.driverDetails;
            const totalPassengers = group.totalPassengers;
            const bookings = group.bookings;
            // console.log(totalPassengers);
            for (const element of bookings) {
              let availableSeats =
                element.vehicleDetailsData.seats - totalPassengers;
              // console.log(element.vehicleDetailsData.seats);
              if (availableSeats >= requests.noOfPerson) {
                const reqData = {
                  bookingId: bookingID,
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

                await Booking.create(reqData);

                completeData.push({
                  driver: driverDetails,
                  reqData,
                });
              }
            }
            driversArray.push(driverDetails);
          }
        } else {
          // console.log("++++++++++++++++++++++++++111111111");

          let params = {
            roleType: 2,
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
          // console.log({ drivers });
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
        // else {
        //   socket.emit("error", {
        //     status: 400,
        //     message:
        //       "This vehicle is not available this time.Please try agian after sometime.",
        //     result: {},
        //   });
        //   return;
        // }
        if (driversArray[0].length > 0) {
          driversArray[0].forEach(async (driver) => {
            // console.log("drivers", driver);
            const objectIdToCheck = driver._id.toString(); // Convert ObjectId to string
            // console.log(joinedDrivers);

            if (
              joinedDrivers.length &&
              joinedDrivers.includes(objectIdToCheck)
            ) {
              const index = joinedDrivers.findIndex(
                (driver) => driver === objectIdToCheck
              );
              let driverId = new ObjectId(joinedDrivers[index]);

              const list = await Booking.aggregate([
                {
                  $match: {
                    driverId: driverId,
                    status: 0,
                  },
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
                    date_of_booking: 1,
                    scheduleTime: 1,
                    "userDetails._id": 1,
                    "userDetails.name": 1,
                    "userDetails.email": 1,
                    "userDetails.currentLat": 1,
                    "userDetails.currentLong": 1,
                  },
                },
              ]);
              // console.log({
              //   driverId
              // });
              //send request on nearby drivers
              io.to(joinedDrivers[index]).emit("rideRequestList", {
                status: 200,
                message: "Ride request list",
                result: list,
              });
            }
          });
        }
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Shuttle Booking
    socket.on("shuttleBooking", async (data) => {
      try {
        const validate = new Validator(data, {
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
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        const userId = socket.userId;

        const shuttles = await UserDocuments.find({
          vehicleId: data.vehicleId,
        });

        const origin = {
          lat: parseFloat(data.s_lat),
          lng: parseFloat(data.s_lng),
        };
        const destination = {
          lat: parseFloat(data.d_lat),
          lng: parseFloat(data.d_long),
        };
        let distanceTime = await getDurationAndDistance(origin, destination);

        // console.log({ duration }); return 1;
        let vehicle = await Pricing.findOne({
          vehicleId: data.vehicleId,
        });
        const priceing = await pricingManage(
          parseFloat(distanceTime.distance),
          data.vehicleId
        );
        //Random booking id
        const bookingID = await generateBookingID();
        // console.log({priceing}) ;return  1;

        const reqData = {
          bookingId: bookingID,
          userId: userId,
          driverId: data.driverId,
          source: data.source,
          s_lat: data.s_lat,
          s_long: data.s_lng,
          destination: data.destination,
          d_lat: data.d_lat,
          d_long: data.d_long,
          distance: distanceTime.distance,
          totalTime: distanceTime.duration,
          date_of_booking: data.bookingDate,
          bookingType: data.bookingType, //1=Normal Booking, 2=Schedule Booking
          updatedAmount: priceing.totalPrice * parseFloat(data.noOfPerson),
          serviceType: data.serviceType,
          passengers: data.noOfPerson,
          status: 1, //Accept
          isShuttleBooking: 1,
          isUpcomingStatus: 1,
        };
        console.log("reqData of booking", reqData);
        await Booking.create(reqData);

        // nearbyDrivers.forEach(async (driver) => {
        const objectIdToCheck = data.driverId; // Convert ObjectId to string
        // //console.log(objectIdToCheck);

        console.log("##############", objectIdToCheck);
        console.log("##############!!!!!!!!!!!!!", joinedDrivers);

        if (joinedDrivers.length && joinedDrivers.includes(objectIdToCheck)) {
          const index = joinedDrivers.findIndex(
            (driver) => driver === objectIdToCheck
          );

          let driverId = new ObjectId(joinedDrivers[index]);
          console.log({
            driverId,
          });
          const list = await Booking.aggregate([
            {
              $match: {
                driverId: driverId,
                status: 1,
                isShuttleBooking: 1,
              },
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
                isShuttleBooking: 1,
                userImage: 1,
                updatedAmount: 1,
                serviceType: 1,
                gender: 1,
                towingVehicle: 1,
                towVehicleImg: 1,
                date_of_booking: 1,
                scheduleTime: 1,
                passengers: 1,
                isUpcomingStatus: 1,
                "userDetails._id": 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
                "userDetails.currentLat": 1,
                "userDetails.currentLong": 1,
              },
            },
          ]);

          //send request on nearby drivers
          io.to(joinedDrivers[index]).emit("rideRequestList", {
            status: 200,
            message: "Ride request list",
            result: list,
          });
          // socket.join(userId);
          // io.to(userId).emit("qwertyuiop", {
          //   status: 200,
          //   message: "Booking fetched successfully.",
          //   result: reqData,
          // });
          getBookingDetails(userId, driverId);
        }
        // });
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    socket.on("acceptRejectRide", async (data) => {
      try {
        console.log("Accept reject ride", data);
        const requests = data;
        const validate = new Validator(requests, {
          status: "required|in:accept,reject",
          userId: "required",
          driverId: "required",
          bookingId: "required",
        });
    
        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
    
        const driverId = new ObjectId(requests.driverId);
        const bookingId = new ObjectId(requests.bookingId);
        const userId = new ObjectId(requests.userId);
    
        let params = {
          userId: userId,
          driverId: driverId,
          _id: bookingId,
        };
        console.log("Accept params", params);
        const checkBooking = await Booking.aggregate([
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
            },
          },
          {
            $match: params,
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
              gender: 1,
              towingVehicle: 1,
              towVehicleImg: 1,
              bookingType: 1,
              isUpcomingStatus: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
    
        if (!checkBooking || checkBooking.length === 0) {
          socket.emit("error", {
            status: 422,
            message: "Booking not found",
            result: {},
          });
          return;
        }
    
        console.log("checkBooking", checkBooking);
        console.log("checkBooking with index", checkBooking[0]);
    
        if (requests.status === "accept") {
          const randomOtp = Math.floor(1000 + Math.random() * 9000);
          const reqData = {
            status: 1,
            acceptTime: new Date().toLocaleTimeString("en-US", {
              hour12: false,
            }),
            otp: randomOtp,
            isUpcomingStatus: 1,
          };
    
          // Accept ride
          await Booking.updateOne(
            { _id: requests.bookingId },
            { $set: reqData }
          );
    
          // Update user and driver ongoing status
          await User.updateOne({ _id: requests.userId }, { ongoingStatus: 1 });
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
    
          socket.emit("rideStatus", {
            status: 200,
            message: "Ride accepted successfully",
            result: checkBooking[0],
          });
        } else if (requests.status === "reject") {
          // Reject ride
          await Booking.deleteOne({
            _id: requests.bookingId,
          });
    
          socket.emit("rideStatus", {
            status: 202,
            message: "Ride rejected successfully",
            result: {},
          });
        }
    
        // Retrieve the updated list for each driver
        for (let driver of joinedDrivers) {
          const list = await Booking.aggregate([
            {
              $match: {
                driverId: new ObjectId(driver),
                status: 0,
              },
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
                isUpcomingStatus: 1,
                "userDetails._id": 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
                "userDetails.currentLat": 1,
                "userDetails.currentLong": 1,
              },
            },
          ]);
    
          console.log("=======================", list);
          socket.join(driver);
          io.to(driver).emit("rideRequestList", {
            status: 200,
            message: "Ride request list",
            result: list,
          });
        }
    
        initiateChat(requests.userId, driverId);
        getBookingDetailsData(requests.userId, driverId);
      } catch (error) {
        console.log({ error });
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    socket.on("updateAcceptedRideStatus", async (data) => {
      try {
        const requests = data;
        console.log(requests, "updateAcceptedRideStatus request");
        const validate = new Validator(requests, {
          status: "required",
          bookingId: "required",
          driverId: "required",
          userId: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
        const driverId = requests.driverId;
        console.log("driverId", driverId);
        const checkBooking = await Booking.findOne({
          _id: requests.bookingId,
        });

        if (!checkBooking) {
          socket.emit("error", {
            status: 422,
            message: "Booking not found",
            result: {},
          });
          return;
        }

        //update status
        await Booking.updateOne(
          {
            _id: requests.bookingId,
          },
          {
            status: parseInt(requests.status),
            isUpcomingStatus: 0,
          }
        );
        if (requests.status == 5) {
          //update user ongoing status
          await User.updateOne(
            {
              _id: checkBooking.userId,
            },
            {
              ongoingStatus: 0,
            }
          );
          //update driver ongoing status
          await User.updateOne(
            {
              _id: driverId,
            },
            {
              ongoingStatus: 0,
            }
          );
        } else {
          //update user ongoing status
          await User.updateOne(
            {
              _id: checkBooking.userId,
            },
            {
              ongoingStatus: 1,
            }
          );
          //update driver ongoing status
          await User.updateOne(
            {
              _id: driverId,
            },
            {
              ongoingStatus: 1,
            }
          );
        }
        const bokingID = new ObjectId(requests.bookingId);
        console.log("bokingID", bokingID);

        const bookingDetail = await Booking.aggregate([
          {
            $match: {
              _id: bokingID,
            },
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
              isUpcomingStatus: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
        console.log("bookingDetail", bookingDetail);

        // success(res, "Status updated successfully.", bookingDetail[0]);
        //update reached status when driver reached to user location
        socket.join(requests.userId);
        socket.join(requests.driverId);
        let driverUser = [requests.userId, requests.driverId];
        console.log(driverUser, "rider user");
        // Assuming userIds is an array of user IDs you want to emit to
        driverUser.forEach((userId) => {
          io.to(userId).emit("getAcceptedRideStatus", {
            status: 200,
            message: "Status updated successfully",
            result: bookingDetail[0],
          });
        });

        // io.to(requests.userId).emit("getAcceptedRideStatus", {
        //   status: 200,
        //   message: "Status updated successfully",
        //   result: bookingDetail[0],
        // });
        // socket.join(checkBooking.driverId);
        // io.to(checkBooking.driverId).emit("getAcceptedRideStatus", {
        //   status: 200,
        //   message: "Status updated successfully",
        //   result: bookingDetail[0],
        // });
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    socket.on("verifyBookingOtp", async (data) => {
      try {
        const requests = data;
        console.log("requests++++++++++++++", requests);
        const validate = new Validator(requests, {
          userId: "required",
          driverId: "required",
          bookingId: "required",
          otp: "required",
        });
        const matched = await validate.check();
        if (!matched) {
          const errors = validate.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys][0];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        const checkBooking = await Booking.findOne({
          _id: requests.bookingId,
        });
        // console.log({checkBooking})

        if (!checkBooking) {
          failed(res, "Booking not found");
          return;
        }

        if (checkBooking.otp !== requests.otp) {
          console.log("#################### Check OTP", requests);

          socket.join(requests.driverId);
          io.to(requests.driverId).emit("error", {
            status: 400,
            message: "Invailed OTP.",
            result: {},
          });
          return;
        }

        const reqData = {
          title: "Confirmed",
          status: 4, // Start trip
          startTime: new Date().toLocaleTimeString("en-US", {
            hour12: false,
          }),
        };
        await Booking.updateOne(
          {
            _id: requests.bookingId,
          },
          {
            $set: reqData,
          }
        );
        const bokingID = new ObjectId(requests.bookingId);

        const bookingDetail = await Booking.aggregate([
          {
            $match: {
              _id: bokingID,
            },
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
              isUpcomingStatus: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
        console.log("checkBooking.userId", checkBooking.userId);
        console.log("checkBooking.driverId", checkBooking.driverId);

        socket.join(requests.userId);
        io.to(requests.userId).emit("verifyBookingOtpStatus", {
          status: 200,
          message: "Verification Complete. Ready for your ride!",
          result: bookingDetail[0],
        });

        // socket.join(requests.driverId);
        // io.to(requests.driverId).emit("verifyBookingOtpStatus", {
        //   status: 200,
        //   message: "Verification Complete. Ready for your ride!",
        //   result: bookingDetail[0],
        // });
        // getBookingDetails(requests.userId, requests.driverId);
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
      }
    });
    //Carpool Accept ride with all user list
    socket.on("verifyBookingOtpCarpool", async (data) => {
      try {
        const requests = data;
        console.log("requests++++++++++++++", requests);
        const validate = new Validator(requests, {
          userId: "required",
          driverId: "required",
          bookingId: "required",
          otp: "required",
        });
        const matched = await validate.check();
        if (!matched) {
          const errors = validate.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys][0];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        const checkBooking = await Booking.findOne({
          _id: requests.bookingId,
        });
        // console.log({checkBooking})

        if (!checkBooking) {
          failed(res, "Booking not found");
          return;
        }

        if (checkBooking.otp !== requests.otp) {
          console.log("#################### Check OTP", requests);

          socket.join(requests.driverId);
          io.to(requests.driverId).emit("error", {
            status: 400,
            message: "Invailed OTP.",
            result: {},
          });
          return;
        }

        const reqData = {
          title: "Confirmed",
          status: 4, // Start trip
          startTime: new Date().toLocaleTimeString("en-US", {
            hour12: false,
          }),
        };
        await Booking.updateOne(
          {
            _id: requests.bookingId,
          },
          {
            $set: reqData,
          }
        );
        const bokingID = new ObjectId(requests.bookingId);

        const bookingDetail = await Booking.aggregate([
          {
            $match: {
              status: 4,
              driverId: new ObjectId(requests.driverId),
            },
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
              isUpcomingStatus: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
        console.log("checkBooking.userId", checkBooking.userId);
        console.log("bookingDetail", bookingDetail);

        socket.join(requests.userId);
        io.to(requests.userId).emit("verifyBookingOtpStatus", {
          status: 200,
          message: "Verification Complete. Ready for your ride!",
          result: bookingDetail,
        });

        // socket.join(requests.driverId);
        // io.to(requests.driverId).emit("verifyBookingOtpStatus", {
        //   status: 200,
        //   message: "Verification Complete. Ready for your ride!",
        //   result: bookingDetail[0],
        // });
        // getBookingDetails(requests.userId, requests.driverId);
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
      }
    });
    //Carpool ride status
    socket.on("updateAcceptedRideStatusCarpool", async (data) => {
      try {
        const requests = data;
        console.log(requests, "updateAcceptedRideStatus request");
        const validate = new Validator(requests, {
          status: "required",
          bookingId: "required",
          driverId: "required",
          userId: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
        const driverId = requests.driverId;
        console.log("driverId", driverId);
        const checkBooking = await Booking.findOne({
          _id: requests.bookingId,
        });

        if (!checkBooking) {
          socket.emit("error", {
            status: 422,
            message: "Booking not found",
            result: {},
          });
          return;
        }

        //update status
        await Booking.updateOne(
          {
            _id: requests.bookingId,
          },
          {
            status: parseInt(requests.status),
            isUpcomingStatus: 0,
          }
        );
        if (requests.status == 5) {
          //update user ongoing status
          await User.updateOne(
            {
              _id: checkBooking.userId,
            },
            {
              ongoingStatus: 0,
            }
          );
          //update driver ongoing status
          await User.updateOne(
            {
              _id: driverId,
            },
            {
              ongoingStatus: 0,
            }
          );
        } else {
          //update user ongoing status
          await User.updateOne(
            {
              _id: checkBooking.userId,
            },
            {
              ongoingStatus: 1,
            }
          );
          //update driver ongoing status
          await User.updateOne(
            {
              _id: driverId,
            },
            {
              ongoingStatus: 1,
            }
          );
        }
        const bokingID = new ObjectId(requests.bookingId);
        console.log("bokingID", bokingID);

        const bookingDetail = await Booking.aggregate([
          {
            $match: {
              status: 4,
              driverId: new ObjectId(driverId),
            },
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
              isUpcomingStatus: 1,
              "userDetails._id": 1,
              "userDetails.name": 1,
              "userDetails.email": 1,
              "userDetails.currentLat": 1,
              "userDetails.currentLong": 1,
            },
          },
        ]);
        // console.log("bookingDetail", bookingDetail);
        const objectIdToCheck = data.driverId;
        if (joinedDrivers.length && joinedDrivers.includes(objectIdToCheck)) {
          const index = joinedDrivers.findIndex(
            (driver) => driver === objectIdToCheck
          );

          let driverId = new ObjectId(joinedDrivers[index]);
          console.log({
            driverId,
          });
          const today = new Date();
          const todayStr = today.toISOString().split("T")[0];
          // Define the match stage conditionally based on serviceType
          let match;
          if (data.serviceType === "shuttle") {
            match = {
              $match: {
                driverId: driverId,
                status: 1,
                isShuttleBooking: 1,
                $expr: {
                  $eq: [
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$date_of_booking",
                      },
                    },
                    todayStr,
                  ],
                },
              },
            };
          } else {
            match = {
              $match: {
                driverId: driverId,
                status: 4,
                isShuttleBooking: 1,
              },
            };
          }
          const list = await Booking.aggregate([
            match,
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
                isShuttleBooking: 1,
                userImage: 1,
                updatedAmount: 1,
                serviceType: 1,
                gender: 1,
                towingVehicle: 1,
                towVehicleImg: 1,
                date_of_booking: 1,
                scheduleTime: 1,
                passengers: 1,
                isUpcomingStatus: 1,
                "userDetails._id": 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
                "userDetails.currentLat": 1,
                "userDetails.currentLong": 1,
              },
            },
          ]);
          //send request on nearby drivers
          io.to(joinedDrivers[index]).emit("rideRequestList", {
            status: 200,
            message: "Ride request list",
            result: list,
          });
          // socket.join(userId);
          // io.to(userId).emit("qwertyuiop", {
          //   status: 200,
          //   message: "Booking fetched successfully.",
          //   result: reqData,
          // });
          getBookingDetails(requests.userId, driverId);
        }
        // success(res, "Status updated successfully.", bookingDetail[0]);
        //update reached status when driver reached to user location
        socket.join(requests.userId);
        // socket.join(requests.driverId);
        let driverUser = [requests.userId, requests.driverId];
        console.log(driverUser, "rider user");
        // Assuming userIds is an array of user IDs you want to emit to
        driverUser.forEach((userId) => {
          io.to(userId).emit("getAcceptedRideStatus", {
            status: 200,
            message: "Status updated successfully",
            result: bookingDetail[0],
          });
        });

        // io.to(requests.userId).emit("getAcceptedRideStatus", {
        //   status: 200,
        //   message: "Status updated successfully",
        //   result: bookingDetail[0],
        // });
        console.log(bookingDetail, "@@@@@@@@@@@@@@@");
        socket.join(requests.driverId);
        io.to(requests.driverId).emit("getAcceptedRideStatus", {
          status: 200,
          message: "Status updated successfully",
          result: bookingDetail,
        });
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Cancel Ride
    socket.on("cancelRide", async (data) => {
      try {
        const requests = data;
        console.log("***********************", requests);

        const validate = new Validator(requests, {
          bookingId: "required",
          userId: "required",
          driverId: "required",
          reason: "required",
          status: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
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
          socket.emit("error", {
            status: 400,
            message: "Booking not found or unauthorized to cancel.",
            result: {},
          });
          return;
        }

        await Booking.updateOne(
          {
            _id: requests.bookingId,
          },
          {
            $set: reqData,
          }
        );
        console.log();
        //update driver ongoing status
        await User.updateOne(
          {
            _id: requests.driverId,
          },
          {
            ongoingStatus: 0,
          }
        );

        //update rider ongoing status
        await User.updateOne(
          {
            _id: requests.userId,
          },
          {
            ongoingStatus: 0,
          }
        );
        // booking.forEach(async (driver) => {
        const objectIdToCheck = booking.driverId.toString(); // Convert ObjectId to string
        // //console.log(objectIdToCheck);

        if (joinedDrivers.length && joinedDrivers.includes(objectIdToCheck)) {
          const index = joinedDrivers.findIndex(
            (driver) => driver === objectIdToCheck
          );
          let driverId = new ObjectId(joinedDrivers[index]);

          const list = await Booking.aggregate([
            {
              $match: {
                driverId: driverId,
                status: 4,
              },
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
                date_of_booking: 1,
                scheduleTime: 1,
                "userDetails._id": 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
                "userDetails.currentLat": 1,
                "userDetails.currentLong": 1,
              },
            },
          ]);
          console.log("@@@@@@@@@@@@@@@@@@@@@@@@", list);
          //send request on nearby drivers
          io.to(joinedDrivers[index]).emit("rideRequestList", {
            status: 200,
            message: "Ride request list",
            result: list,
          });
        }
        // });
        socket.join(requests.userId);
        io.to(requests.userId).emit("cancelBooking", {
          status: 200,
          message: "Your ride cancelled successfully.",
        });
        // success(res, "Detail fetched successfully.", bookingDetail[0]);
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    // Delete Ride when booking is pending
    socket.on("deletePendingRide", async (data) => {
      try {
        const requests = data;
        console.log("***********************", requests);

        const validate = new Validator(requests, {
          userId: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }

        const booking = await Booking.aggregate([
          {
            $match: {
              userId: new ObjectId(requests.userId),
              status: 0,
            },
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
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
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

        if (!booking || booking.length === 0) {
          socket.emit("error", {
            status: 400,
            message: "Booking not found or unauthorized to cancel.",
            result: {},
          });
          return;
        }

        let finalList = [];

        for (let i = 0; i < booking.length; i++) {
          const element = booking[i];
          console.log("requests.userId", element);

          const newData = await Booking.aggregate([
            {
              $match: {
                userId: element.driverId,
                status: 0,
              },
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
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
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

          for (let j = 0; j < newData.length; j++) {
            const elementNew = newData[j];
            if (elementNew.userId.toString() !== requests.userId) {
              console.log({
                elementNew,
              });
              finalList.push(elementNew);
            }
          }
        }

        console.log("++++++++++++++++++", finalList);

        socket.join(requests.userId);
        io.to(requests.userId).emit("deleteBooking", {
          status: 200,
          message: "Your ride cancelled successfully.",
        });

        if (finalList.length > 0) {
          for (let k = 0; k < finalList.length; k++) {
            socket.join(finalList[k].driverId.toString());
            io.to(finalList[k].driverId.toString()).emit("rideRequestList", {
              status: 200,
              message: "Ride request list",
              result: finalList,
            });
          }
        } else {
          // Emit "rideRequestList" with an empty array as result
          io.to(requests.userId).emit("rideRequestList", {
            status: 200,
            message: "Ride request list",
            result: [],
          });
          for (let t = 0; t < booking.length; t++) {
            const drivers = booking[t];
            io.to(drivers.driverId.toString()).emit("rideRequestList", {
              status: 200,
              message: "Ride request list",
              result: [],
            });
          }
          console.log("No finalList available");
        }

        // Delete the user's booking with userId and status 0
        await Booking.deleteMany({
          userId: requests.userId,
          status: 0,
        });
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    //Driver details
    socket.on("driverDetails", async (data) => {
      try {
        console.log("***********************");
        const requests = data;
        const validate = new Validator(requests, {
          userId: "required",
        });

        const matched = await validate.check();
        if (!matched) {
          const errors = matched.errors;
          const errorKeys = Object.keys(errors)[0];
          const err = errors[errorKeys]["message"];
          socket.emit("validation_error", {
            status: 422,
            message: err,
            result: {},
          });
          return;
        }
        getDriverDetails(requests);

        // success(res, "Detail fetched successfully.", bookingDetail[0]);
      } catch (error) {
        socket.emit("server_error", {
          status: 500,
          message: error.message,
          result: {},
        });
        return;
      }
    });
    // Handle disconnection
    socket.on("disconnect", async () => {
      //console.log("User disconnected: " + socket.userId);
      //console.log({ joinedDrivers });

      joinedDrivers.pop(socket.userId);
      // if (joinedDrivers.includes(socket.userId)) {
      //   joinedDrivers.includes(socket.userId).remove();
      // }
      //console.log({ joinedDrivers });
    });
    //Initial new chat
    async function initiateChat(userId, receiverId) {
      try {
        if (!userId || !receiverId) {
          socket.join(data.userId);
          io.to(data.userId).emit("invalidData", {
            status: 200,
            message: "Please send required data",
            result: {},
          });
          console.log("Please send required data");
          return false;
        }
        let data = {
          senderId: "",
          receiverId: "",
        };
        let chatExist = await Chat.findOne({
          $or: [
            {
              senderId: userId,
              receiverId: receiverId,
            },
            {
              receiverId: userId,
              senderId: receiverId,
            },
          ],
        });
        var chatData = {};
        if (chatExist) {
          let receiverInfo = {
            receiverId: "",
          };
          if (chatExist.senderId == data.userId) {
            receiverInfo.receiverId = chatExist.receiverId;
          } else {
            receiverInfo.receiverId = chatExist.senderId;
          }
          let receiver = {};
          if (receiverInfo.receiverType == "rider") {
            receiver = await User.findById(receiverInfo.receiverId);
          } else {
            receiver = await User.findById(receiverInfo.receiverId);
          }
          chatData = {
            receiver: {
              receiverId: receiver._id,
              name: receiver.name,
              email: receiver.email,
              isOnline: receiver.isOnline,
              lastSeen: receiver.lastSeen,
              profileImage: receiver.profileImage
                ? receiver.profileImage
                : null,
            },
            roomId: chatExist.roomId,
            lastMessage: chatExist.lastMessage,
            receiverId: receiverInfo.receiverId,
          };
        } else {
          data.senderId = userId;
          data.receiverId = receiverId;

          let created = await Chat.create(data);
          if (created) {
            let chatExist = await Chat.findById(created._id);
            if (chatExist) {
              let receiverInfo = {
                receiverId: "",
              };
              if (chatExist.senderId == userId) {
                receiverInfo.receiverId = chatExist.receiverId;
              } else {
                receiverInfo.receiverId = chatExist.senderId;
              }
              let receiver = {};
              if (receiverInfo.receiverType == "user") {
                receiver = await User.findById(receiverInfo.receiverId);
              } else {
                receiver = await User.findById(receiverInfo.receiverId);
              }
              chatData = {
                receiver: {
                  receiverId: receiver._id,
                  name: receiver.name,
                  email: receiver.email,
                  isOnline: receiver.isOnline,
                  lastSeen: receiver.lastSeen,
                  profileImage: receiver.profileImage
                    ? receiver.profileImage
                    : null,
                },
                roomId: chatExist.roomId,
                lastMessage: chatExist.lastMessage,
                receiverId: receiverInfo.receiverId,
              };
            }
          }
        }
        socket.join(userId);
        io.to(userId).emit("getRoomId", {
          status: 200,
          message: "Room details",
          result: chatData,
        });
      } catch (error) {
        console.log(error);
        socket.join(userId);
        io.to(userId).emit("invalidData", {
          status: 200,
          message: "Please send required data",
          result: [],
        });
      }
    }
    //Booking details
    async function getBookingDetails(riderId, driverId) {
      let userId = riderId;
      console.log("###############");
      const bookingDetail = await Booking.aggregate([
        {
          $match: {
            driverId: new ObjectId(driverId),
            userId: new ObjectId(riderId),
            status: {
              $in: [1, 3, 4],
            },
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
            isUpcomingStatus: 1,

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
      console.log({
        bookingDetail,
      });
      console.log("++++++++++++", userId);

      socket.join(userId);
      io.to(userId).emit("driverDetailsss", {
        status: 200,
        message: "Detail fetched successfully.",
        result: bookingDetail[0],
      });
    }
    async function getBookingDetailsData(riderId, driverId) {
      let userId = riderId;
      console.log("###############");
      const bookingDetail = await Booking.aggregate([
        {
          $match: {
            driverId: new ObjectId(driverId),
            userId: new ObjectId(riderId),
            status: {
              $in: [1, 2, 3, 4],
            },
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
            isUpcomingStatus: 1,

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
      console.log({
        bookingDetail,
      });
      console.log("++++++++++++", userId);

      socket.join(userId);
      io.to(userId).emit("driverDetailsss", {
        status: 200,
        message: "Detail fetched successfully.",
        result: bookingDetail[0],
      });
    }
    //common function for driver details
    async function getDriverDetails(data) {
      let userId = data.userId;
      const bookingDetail = await Booking.aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
            status: {
              $in: [1, 2, 3, 4],
            },
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
      socket.emit("driverDetails", {
        status: 200,
        message: "Detail fetched successfully.",
        result: bookingDetail[0],
      });
    }
  });
};
