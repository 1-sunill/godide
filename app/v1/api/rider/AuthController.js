// const { decrypter, encrypter } = require("../../../helper/crypto");
const {
  success,
  failed,
  serverError,
  validateFail,
} = require("../../../helper/response");
const { dump } = require("../../../helper/logs");
const { Validator } = require("node-input-validator");
const RequestedBanner = require("../../../../models/RequestedBanner");
const Vehicle = require("../../../../models/Vehicle");
const Address = require("../../../../models/UserAddress");
const User = require("../../../../models/User");
const mail = require("../../../helper/mail");
const { aws } = require("../../../helper/aws");
const Services = require("../../../../models/Services");
const UserDocuments = require("../../../../models/UserDocuments");
let baseUrl = process.env.APP_URL;

module.exports = {
  //Home
  home: async (req, res) => {
    try {
      let userId = req.user._id;

      const advBanners = await RequestedBanner.find().limit(10);
      const emergencyServices = await Services.aggregate([
        {
          $match: {
            serviceName: { $in: ["Ambulance", "Towing", "Fire Fighting"] },
          },
        },
        {
          $project: {
            _id: 1,
            serviceName: 1,
            image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
          },
        },
      ]);
      const walletAmount = await User.findById(userId);
      const reqData = {
        banners: advBanners,
        walletAmount: walletAmount.walletBalance,
        emergencyServices: emergencyServices,
      };
      success(res, "home_data_fetched_successfully", reqData);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //Add address
  addAddress: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      let userId = req.user._id;

      const validate = new Validator(requests, {
        placeName: "required",
        address: "required",
        longitude: "required",
        latitude: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      // Check if the user already has a default address
      const existingDefaultAddress = await Address.findOne({
        userId,
        isDefault: 1,
      });
      if (existingDefaultAddress) {
        await Address.updateOne(
          { _id: existingDefaultAddress._id },
          { isDefault: 0 }
        );
      }

      const reqData = {
        userId,
        placeName: requests.placeName,
        address: requests.address,
        isDefault: 1, // Set the new address as default
        longitude: requests.longitude,
        latitude: requests.latitude,
      };
      const data = await Address.create(reqData);
      success(res, "address_saved_successfully", data);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  //Address list
  addressList: async (req, res) => {
    try {
      let userId = req.user._id;

      const list = await Address.find({ userId: userId })
        .sort({ createdAt: -1 })
        .limit(10);
      success(res, "data_fetched_successfully", list);
    } catch (error) {
      serverError(res, "internal_server_error");
    }
  },
  //update user details
  updateRiderDetail: async (req, res) => {
    try {
      var requests = await decrypter(req.body);
      console.log("UPdate your profile +++++++++", requests);
      let userId = req.user._id;
      const existingUser = await User.findOne({
        _id: userId,
      });

      let reqData = {
        name: requests.name,
        email: requests.email,
        otp: 1234,
      };
      if (req.files && req.files.userImage) {
        console.log("+++++++++++++++++++++++++++", req.files);
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
      const userDetail = await User.findOne({ _id: userId });
      success(res, "data_fetched_successfully", userDetail);
    } catch (error) {
      console.log({ error });
      serverError(res, "internal_server_error");
    }
  },
  services: async (req, res) => {
    try {
      const services = await Services.aggregate([
        {
          $project: {
            _id: 1,
            serviceName: 1,
            image: { $concat: [baseUrl, "uploads/vehicleImages/", "$image"] },
          },
        },
      ]);

      success(res, "data_fetched_successfully", services);
    } catch (error) {
      return serverError(res, "internal_server_error");
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
  //Driver Vehicle info
  saveVehicleInfo: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      console.log("Save vehicle info++", requests);

      const userId = req.user._id;

      // Validate files
      const validate = new Validator(req.files, {
        drivingLicence: "required",
        vehicleInsurance: "required",
      });

      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      // Check if vehicle already exists
      const checkVehicleDoc = await UserDocuments.findOne({
        vehicleNumber: requests.vehicleNumber,
      });

      if (checkVehicleDoc) {
        return failed(res, "this_vehicle_already_added");
      }

      // Prepare request data
      let reqData = {
        userId: userId,
        vehicleId: requests.vehicleId,
        vehicleCatId: requests.vehicleCatId,
        vehicleServiceId: requests.vehicleServiceId,
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

      // Upload files to AWS
      if (req.files && req.files.vehicleInsurance) {
        const vehicleInsuranceFileName = await aws(
          req.files.vehicleInsurance,
          "vehicleInsurance"
        );
        reqData.vehicleInsurance = vehicleInsuranceFileName.Location;
      }
      if (req.files && req.files.drivingLicence) {
        const drivingLicenceFileName = await aws(
          req.files.drivingLicence,
          "drivingLicence"
        );
        reqData.drivingLicence = drivingLicenceFileName.Location;
      }

      // Save the vehicle info
      await UserDocuments.create(reqData);

      // Update user's licence status
      await User.updateOne({ _id: userId }, { isLicence: 1 });

      return success(res, "licence_saved_successfully");
    } catch (error) {
      console.log({ error });
      return serverError(res, "internal_server_error");
    }
  },
};
