const {
  success,
  serverError,
  failed,
  validateFail,
} = require("../../../helper/response");
// const { decrypter } = require("../../../helper/crypto");
const { dump } = require("../../../helper/logs");
const { Validator } = require("node-input-validator");
const { aws } = require("../../../helper/aws");
const User = require("../../../../models/User");
const UserDocuments = require("../../../../models/UserDocuments");
const UserAccount = require("../../../../models/UserAccount");
const Vehicle = require("../../../../models/Vehicle");
const VehicleType = require("../../../../models/VehicleCategory");
const Services = require("../../../../models/Services");
const BannerPrice = require("../../../../models/BannerPrice");
const RequestedBanner = require("../../../../models/RequestedBanner");
const { ObjectId } = require("mongodb");
const mail = require("../../../helper/mail");
let baseUrl = process.env.APP_URL;

module.exports = {
  //Driver Vehicle info
  saveVehicleInfo: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      console.log("Save vehicle info++", requests);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        vehicleId: "required",
        // vehicleCatId: "required",
        // vehicleServiceId: "required",
        vehicleName: "required",
        vehicleNumber: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      if (!req.files || !req.files.drivingLicence) {
        return validateFail(res, "driving_licence_is_mandatory");
      }

      if (!req.files || !req.files.vehicleInsurance) {
        return validateFail(res, "vehicle_insurance_is_mandatory");
      }
      //Only one driver can have only one vehicle (vehicleNumber)
      const checkVehicleDoc = await UserDocuments.findOne({
        vehicleNumber: requests.vehicleNumber,
      });

      if (checkVehicleDoc) {
        return failed(res, "this_vehicle_already_added");
      }
      // let serviceType = requests.vehicleServiceId
      //   ? requests.vehicleServiceId
      //   : {};
      let serviceType = requests.vehicleServiceId || null;
      if (!serviceType) {
        const getVehicle = await Vehicle.findOne({
          _id: requests.vehicleId,
        });

        if (getVehicle) {
          const getService = await Services.findOne({
            serviceName: new RegExp(getVehicle.vehicleName, "i"),
          });

          if (getService) {
            serviceType = getService._id;
          }
        }
      }
      // console.log("_______________", serviceType);

      // return 1;

      let reqData = {
        userId: userId,
        vehicleId: requests.vehicleId,
        vehicleCatId: requests.vehicleCatId,
        vehicleServiceId: serviceType,
        vehicleName: requests.vehicleName,
        vehicleNumber: requests.vehicleNumber,
        bootSpace: requests.bootSpace,
        startLocationLat: requests.startLocationLat,
        startLocationLong: requests.startLocationLong,
        dropLocationLat: requests.dropLocationLat,
        dropLocationLong: requests.dropLocationLong,
        routes: requests.routes,
        startTime: requests.startTime,
        endTime: requests.endTime,
        noOfSeat: requests.noOfSeat,
        source: requests.source,
        destination: requests.destination,
      };
      if (req.files && req.files.vehicleInsurance) {
        let vehicleInsuranceFileName = await aws(
          req.files.vehicleInsurance,
          "vehicleInsurance"
        );
        reqData = Object.assign(reqData, {
          vehicleInsurance: vehicleInsuranceFileName.Location,
        });
      }
      if (req.files && req.files.drivingLicence) {
        let drivingLicenceFileName = await aws(
          req.files.drivingLicence,
          "drivingLicence"
        );
        reqData = Object.assign(reqData, {
          drivingLicence: drivingLicenceFileName.Location,
        });
      }
      await UserDocuments.create(reqData);
      //update licence is save successfully
      await User.updateOne({ _id: userId }, { isLicence: 1 });
      return success(res, "licence_saved_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  //Save driver Account details
  saveBankInfo: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;

      const validate = new Validator(requests, {
        bankName: "required",
        accountNumber: "required",
        ifscCode: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkAccount = await UserAccount.findOne({
        userId: userId,
        accountNumber: requests.accountNumber,
      });

      if (checkAccount) {
        return failed(res, "this_account_already_exists_for_this_driver.");
      }

      let reqData = {
        userId: userId,
        bankName: requests.bankName,
        accountNumber: requests.accountNumber,
        ifscCode: requests.ifscCode,
      };
      await UserAccount.create(reqData);

      //update bank status in user table
      await User.updateOne({ _id: userId }, { isBankAccount: 1 });

      return success(res, "user_bank_detail_saved_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
  //Bank info
  bankInfo: async (req, res) => {
    try {
      let userId = req.user._id;
      const accounts = await UserAccount.findOne({
        userId: userId,
      });
      success(res, "data_listed_successfully", accounts);
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  vehicleList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      console.log("Save vehicle info++", requests);
      // let userId = req.user._id;
      const validate = new Validator(requests, {
        type: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let vehicleList;
      if (requests.type == 1) {
        const data = await Vehicle.aggregate([
          {
            $lookup: {
              from: "vehiclecategories",
              localField: "_id",
              foreignField: "vehicleId",
              as: "vehicleCategoryDetail",
            },
          },
          {
            $unwind: {
              path: "$vehicleCategoryDetail",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              vehicleId: 1, // Include vehicleId in the projection
              vehicleName: 1,
              serviceType: 1,
              vehicleImage: 1,
              seats: 1,
              "vehicleCategoryDetail._id": 1,
              "vehicleCategoryDetail.categoryName": 1,
              "vehicleCategoryDetail.categoryImage": 1,
              "vehicleCategoryDetail.seats": 1,
            },
          },
        ]);
        // console.log(data)
        vehicleList = [];

        for (const vehicle of data) {
          const vehicleInfo = {
            _id: vehicle._id,
            vehicleId: vehicle.vehicleId,
            vehicleName: vehicle.vehicleName,
            serviceType: vehicle.serviceType,
            vehicleImage: `${baseUrl}uploads/vehicleImages/${vehicle.vehicleImage}`,

            seats: vehicle.seats,
            categoryId: "",
            categoryImage: "",
            // vehicleImage:""
          };

          if (vehicle.vehicleCategoryDetail && vehicle.serviceType === 1) {
            vehicleInfo.vehicleImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;

            vehicleInfo.vehicleName =
              vehicle.vehicleCategoryDetail.categoryName;
            vehicleInfo.categoryId = vehicle.vehicleCategoryDetail._id;
            vehicleInfo.categoryImage = `${baseUrl}uploads/vehicleImages/${vehicle.vehicleCategoryDetail.categoryImage}`;
            vehicleInfo.seats = vehicle.vehicleCategoryDetail.seats;
          }
          if (vehicle.serviceType === 1) {
            vehicleList.push(vehicleInfo);
          }
        }
      } else {
        vehicleList = await Vehicle.aggregate([
          {
            $project: {
              _id: 1,
              vehicleName: 1,
              serviceType: 1,
              vehicleImage: {
                $concat: [baseUrl, "uploads/vehicleImages/", "$vehicleImage"],
              },
              seats: 1,
            },
          },
        ]);
      }

      success(res, "data_fetched_successfully", vehicleList);
    } catch (error) {
      console.log(error);
      return serverError(res, "internal_server_error");
    }
  },
  vehicleType: async (req, res) => {
    try {
      const type = await VehicleType.aggregate([
        {
          $project: {
            _id: 1,
            vehicleId: 1,
            categoryName: 1,
            categoryImage: {
              $concat: [baseUrl, "uploads/vehicleImages/", "$categoryImage"],
            },
            isHide: 1,
            seats: 1,
            timeStamp: 1,
          },
        },
      ]);

      success(res, "data_fetched_successfully", type);
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  // services: async (req, res) => {
  //   try {
  //     let services;mvikas_local
  //     if (req.query.type == "normal") {
  //       services = await Services.aggregate([
  //         {
  //           $match: {
  //             serviceName: {
  //               $in: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     } else if (req.query.type == "Shuttle") {
  //       services = await Services.aggregate([
  //         {
  //           $match: {
  //             serviceName: {
  //               $in: ["Shuttle"],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     }else if (req.query.type == "Ambulance") {
  //       services = await Services.aggregate([
  //         {
  //           $match: {
  //             serviceName: {
  //               $in: ["Ambulance"],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     }else if (req.query.type == "Towing") {
  //       services = await Services.aggregate([
  //         {
  //           $match: {
  //             serviceName: {
  //               $in: ["Towing"],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     } else if (req.query.type == "Fire Fighting") {
  //       services = await Services.aggregate([
  //         {
  //           $match: {
  //             serviceName: {
  //               $in: ["Fire Fighting"],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     } else {
  //       services = await Services.aggregate([
  //         {
  //           $project: {
  //             _id: 1,
  //             serviceName: 1,
  //             image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
  //           },
  //         },
  //       ]);
  //     }

  //     success(res, "data_fetched_successfully", services);
  //   } catch (error) {
  //     return serverError(res, "internal_server_error");
  //   }
  // },
  services: async (req, res) => {
    try {
      const request = (await decrypter(req.query)) || {};

      const serviceTypes = {
        ride: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
        travel: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
        reserve: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
        carpool: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
        rentals: ["Ride", "Travel", "Reserve", "Carpool", "Rentals"],
        shuttle: ["Shuttle"],
        ambulance: ["Ambulance"],
        towing: ["Towing"],
        "fire fighting": ["Fire Fighting"],
      };

      const type = request.type;
      const userType = request.userType ? request.userType : "rider";
      const matchCondition =
        type && serviceTypes[type]
          ? { serviceName: { $in: serviceTypes[type] } }
          : {};
      let services;
      if (userType == "driver") {
        services = await Services.aggregate([
          { $match: matchCondition },
          {
            $project: {
              _id: 1,
              serviceName: 1,
              image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
            },
          },
          {
            $limit: 5, 
          },
        ]);
      } else {
        services = await Services.aggregate([
          { $match: matchCondition },
          {
            $project: {
              _id: 1,
              serviceName: 1,
              image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
            },
          },
        ]);
      }

      return success(res, "data_fetched_successfully", services);
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },

  //update service for driver
  updateService: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const validate = new Validator(requests, {
        serviceId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkService = await Services.findOne({
        _id: requests.serviceId,
      });
      if (!checkService) {
        failed(res, "service_not_found");
      }
      await UserDocuments.updateOne(
        { userId: userId },
        { vehicleServiceId: requests.serviceId }
      );
      success(res, "driver_service_updated_successfully");
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  //pricing list of banner
  bannerPricingList: async (req, res) => {
    try {
      const list = await BannerPrice.find();
      success(res, "data_fetched_successfully", list);
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  //request for banner
  bannerRequest: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;

      const validate = new Validator(requests, {
        bannerPriceId: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const bannerPrice = await BannerPrice.findById(requests.bannerPriceId);
      if (!bannerPrice) {
        failed(res, "Data not found.");
      }
      let reqData = {
        userId: userId,
        bannerPriceId: requests.bannerPriceId,
        noOfDays: bannerPrice.noOfDays,
      };
      if (req.files && req.files.bannerImage) {
        let bannerImageFileName = await aws(req.files.bannerImage, "banners");
        reqData = Object.assign(reqData, {
          bannerImage: bannerImageFileName.Location,
        });
      }
      await RequestedBanner.create(reqData);
      success(res, "your_request_submitted_successfully", reqData);
    } catch (error) {
      return serverError(res, "internal_server_error");
    }
  },
  //update driver detail
  updateDriverDetail: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;
      const existingUser = await User.findOne({
        _id: userId,
      });
      let reqData = {
        name: requests.name,
        // email: requests.email,
        gender: requests.gender,
        dob: requests.dob,
        otp: 1234,
      };
      if (req.files && req.files.govtIdImage) {
        let govtIdImageFileName = await aws(req.files.govtIdImage, "govtId");
        reqData = Object.assign(reqData, {
          govtIdImage: govtIdImageFileName.Location,
        });
      }
      if (req.files && req.files.userImage) {
        let userImageFileName = await aws(req.files.userImage, "users");
        reqData = Object.assign(reqData, {
          userImage: userImageFileName.Location,
        });
      }
      if (requests.email) {
        var mailData = {
          to: requests.email,
          subject: "Change Email Request",
          html: `<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Password</title>
            </head>
            <body>
              <p>Hi ${existingUser.name},</p>
            
              <p>Your Otp is : 1234</p>
            
              <p>Thanks & Regards<br>Godide Texi</p>
            </body>
          </html>`,
        };

        mail(mailData);
      }
      await User.updateOne({ _id: userId }, { $set: reqData });
      success(res, "data_updated_successfully");
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  verifyEmailOtp: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;

      const validate = new Validator(requests, {
        otp: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let checkUser = await User.findOne({ _id: userId });
      console.log(checkUser.otp);
      if (checkUser.otp !== parseInt(requests.otp)) {
        failed(res, "otp_is_incorrect");
      }
      await User.updateOne({ _id: userId }, { email: requests.email, otp: "" });
      success(res, "email_updated_successfully");
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
};
