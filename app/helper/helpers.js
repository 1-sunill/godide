const axios = require("axios");
const Pricing = require("../../models/RidePricing");
const Notification = require("../../models/Notification");
const ReviewRating = require("../../models/ReviewRating");
const User = require("../../models/User");
const firebase = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const fetch = require("node-fetch");
const serviceAccount = require("../../config/firebase1.json");
const { ObjectId } = require("mongodb");
const https = require("https");
// Initialize Firebase app if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(
    {
      credential: firebase.credential.cert(serviceAccount),
    },
    "godideApp"
  );
}

const PROJECT_ID = "godide-driver";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const SCOPES = [MESSAGING_SCOPE];

async function getAccessToken() {
  const client = new GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });
  const accessToken = await client.getAccessToken();
  return accessToken;
}
exports.sendNewNotification = async (receiverId, message, title = "Godide") => {
  try {
    const accessToken = await getAccessToken();
    // console.log({ accessToken });
    const userDetails = await User.findOne({ _id: receiverId });
    console.log("Notification details", userDetails);
    if (!userDetails || !userDetails.deviceToken) {
      console.log("User details or FCM token not found");
      return false;
    }

    const notificationData = {
      userId: receiverId,
      message: message,
      title,
    };

    await Notification.create(notificationData);

    const { deviceToken } = userDetails;
    const payload = {
      message: {
        token: deviceToken,
        notification: {
          // sound: "default",
          title: title,
          body: message,
        },
        data: {
          type: "message",
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error sending message: ${error}`);
    }

    const responseData = await response.json();
    console.log("Response:", responseData);
    return true;
  } catch (error) {
    console.log("Error sending notification:", error);
    return false;
  }
};
exports.base64Encode = function (request) {
  var res = Buffer.from(request).toString("base64");
  return res;
};

exports.base64Decode = function (request) {
  var res = Buffer.from(request, "base64").toString("ascii");
  return res;
};

//get distance and duration using google api
exports.getDurationAndDistance = async (origin, destination) => {
  try {
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const response = await axios.get(baseUrl, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: process.env.GOOGLE_MAP_API_KEY,
      },
    });

    const { status, routes } = response.data;

    if (status === "OK" && routes.length > 0) {
      const { duration, distance } = routes[0].legs[0];
      // console.log(duration);
      // console.log(distance);

      return { duration: duration.text, distance: distance.text };
    } else {
      throw new Error("Unable to fetch duration.");
    }
  } catch (error) {
    console.error("Error:", error.message);
    return { duration: null, distance: null };
  }
};

const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

exports.calculateDuration = (
  startLat,
  startLon,
  endLat,
  endLon,
  averageSpeed
) => {
  const earthRadiusKm = 6371; // Earth's radius in kilometers
  const startLatRadians = degreesToRadians(startLat);
  const endLatRadians = degreesToRadians(endLat);
  const latDifferenceRadians = degreesToRadians(endLat - startLat);
  const lonDifferenceRadians = degreesToRadians(endLon - startLon);

  const a =
    Math.sin(latDifferenceRadians / 2) * Math.sin(latDifferenceRadians / 2) +
    Math.cos(startLatRadians) *
      Math.cos(endLatRadians) *
      Math.sin(lonDifferenceRadians / 2) *
      Math.sin(lonDifferenceRadians / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = earthRadiusKm * c; // Distance in kilometers
  // console.log({ distance });

  // Calculate duration based on distance and average speed
  const durationHours = distance / averageSpeed;
  const durationMinutes = Math.round(durationHours * 60); // Convert hours to minutes

  return { duration: durationMinutes, distance: Math.round(distance) };
};

exports.calculateDistanceShuttle = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180); // Convert latitude difference to radians
  const dLon = (lon2 - lon1) * (Math.PI / 180); // Convert longitude difference to radians
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Calculate the distance in kilometers

  const averageSpeed = 30; // Average speed in km/h
  const durationHours = distance / averageSpeed; // Calculate duration in hours
  const durationMinutes = Math.round(durationHours * 60); // Convert duration to minutes
  // console.log("########",  durationMinutes,  Math.round(distance));

  return { duration: durationMinutes, distance: Math.round(distance) }; // Return rounded distance and duration in minutes
};

//Pricing management

exports.pricingManage = async (
  kilometers,
  vehicleId,
  vehicleCatId = "",
  vehicleServiceId
) => {
  try {
    console.log("++++++++++++++", vehicleServiceId);
    // console.log("++++++++++++++", vehicleServiceId);

    let matchParams = {
      vehicleId: new ObjectId(vehicleId),
      serviceId: vehicleServiceId,
    };

    if (vehicleCatId) {
      matchParams.vehicleCategoryId = new ObjectId(vehicleCatId);
    }
    // matchParams.serviceId = vehicleServiceId;
    console.log({ matchParams });
    const vehicle = await Pricing.aggregate([
      {
        $match: matchParams,
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
          localField: "vehicleCatId",
          foreignField: "_id",
          as: "vehicleCategoryDetail",
        },
      },
      {
        $unwind: {
          path: "$vehicleCategoryDetail",
          preserveNullAndEmptyArrays: true, // Preserve documents even if there is no match
        },
      },
      {
        $project: {
          _id: 1,
          vehicleId: 1,
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

    console.log(vehicle, "++++++++++++++++++++");

    // if (vehicle.length === 0) {
    //   throw new Error("Vehicle not found");
    // }

    let totalPriceForVehicle = 0;
    let totalPrice = 0;
    console.log(vehicle[0]);
    if (vehicle[0].vehicleDetail.serviceType === 1) {
      for (const charge of vehicle[0].kmCharges) {
        if (
          parseFloat(kilometers) >= charge.from &&
          parseFloat(kilometers) <= charge.to
        ) {
          const distanceInRange = parseFloat(kilometers) - charge.from;
          //console.log("distanceInRange lisrrrt", charge.price);
          // console.log("distanceInRange lismmmt", distanceInRange);

          const priceForDistanceInRange = distanceInRange * charge.price;

          totalPriceForVehicle += priceForDistanceInRange;
          totalPrice = (totalPriceForVehicle + vehicle[0].baseFare).toFixed(2);
          // console.log("distanceInRange listtttt", totalPrice);

          break; // Break the loop once the price is found for this vehicle
        }
      }
      return {
        vehicle: vehicle[0].vehicleDetail,
        totalPrice: parseFloat(totalPrice),
        distance: kilometers,
      };
    } else {
      for (const charge of vehicle[0].kmCharges) {
        if (
          parseFloat(kilometers) >= charge.from &&
          parseFloat(kilometers) <= charge.to
        ) {
          const distanceInRange = parseFloat(kilometers) - charge.from;
          const priceForDistanceInRange =
            distanceInRange * charge.price + vehicle[0].baseFare;
          totalPriceForVehicle += priceForDistanceInRange;
          break; // Break the loop once the price is found for this vehicle
        }
      }
      return {
        vehicle: vehicle[0].vehicleDetail,
        totalPrice: totalPriceForVehicle,
        distance: kilometers,
      };
    }

    // If serviceType is not 1, handle other cases accordingly.
    // For now, let's return a default response
    // return {
    //   vehicle: vehicle[0].vehicleDetail,
    //   totalPrice: totalPriceForVehicle,
    //   distance: kilometers,
    // };
  } catch (error) {
    console.error("Error:", error.message);
    throw error; // Rethrow the error after logging it
  }
};

exports.updateDriverRating = async (driverId) => {
  try {
    const reviews = await ReviewRating.find({
      driverId: new ObjectId(driverId),
    });
    const totalRatings = reviews.length;
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings;

    await User.updateOne(
      { _id: new ObjectId(driverId) },
      {
        $set: {
          averageRating: averageRating,
        },
      }
    );
  } catch (error) {
    console.log({ error });
  }
};
exports.updateRiderRating = async (userId) => {
  try {
    // Fetch reviews for the given user
    const reviews = await ReviewRating.find({ userId: new ObjectId(userId) });
    const totalRatings = reviews.length;
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings;

    await User.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          averageRating: averageRating,
        },
      }
    );
    // If no reviews are found, set averageRating to 0
    // if (!reviews.length) {
    //   console.log(`No reviews found for userId: ${userId}`);
    //   await User.updateOne(
    //     { _id: new ObjectId(userId) },
    //     {
    //       $set: { averageRating: 0 },
    //     }
    //   );
    //   return;
    // }

    // Filter out reviews without valid numeric ratings
    // const validReviews = reviews.filter(
    //   (review) => typeof review.rating === "number" && !isNaN(review.rating)
    // );

    // // If no valid ratings are found, set averageRating to 0
    // if (!validReviews.length) {
    //   console.log(`No valid ratings found for userId: ${userId}`);
    //   await User.updateOne(
    //     { _id: new ObjectId(userId) },
    //     {
    //       $set: { averageRating: 0 },
    //     }
    //   );
    //   return;
    // }

    // // Calculate the average rating
    // const totalRatings = validReviews.length;
    // const averageRating = (
    //   validReviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings
    // ).toFixed(2); // Rounded to 2 decimal places

    // console.log(`Calculated averageRating: ${averageRating} for userId: ${userId}`);

    // // Update the user's average rating in the database
    // await User.updateOne(
    //   { _id: new ObjectId(userId) },
    //   {
    //     $set: { averageRating: parseFloat(averageRating) },
    //   }
    // );
  } catch (error) {
    console.error(`Error updating rider rating for userId: ${userId}`, error);
  }
};
exports.sendOTP = async (mobileNo, name, otp) => {
  console.log({ mobileNo });
  console.log({ name });
  console.log({ otp });

  // Construct the request body
  const mobileWithoutPlus = mobileNo.replace(/\+/g, "");
  const nameParts = name.split(" ");

  const firstName = nameParts[0];
  const capitalizedFirstName =
    firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const postData = JSON.stringify({
    VAR: capitalizedFirstName,
    OTP: otp,
  });
  // var senderId = "NDANYANA";
  // var flowId = "66fbd656d6fc0518f873ac42";
  const authKey = "418454ALszoueMlCL65f9813fP1";
  const templateId = "66ff8ff0d6fc052d497603c2";
  // Construct the request options
  const options = {
    method: "POST",
    hostname: "control.msg91.com",
    port: null,
    path: `/api/v5/otp?template_id=${templateId}&mobile=${mobileWithoutPlus}&authkey=${authKey}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };
  // Send the HTTP request
  const req = https.request(options, function (res) {
    const chunks = [];
    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      const body = Buffer.concat(chunks);
      console.log(body.toString());
    });
  });

  // Handle request errors
  req.on("error", function (err) {
    console.error("Error sending OTP request:", err);
  });

  // Write the request body and end the request
  req.write(postData);
  req.end();
};
