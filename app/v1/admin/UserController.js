const { Validator } = require("node-input-validator");
const Admin = require("../../../models/Admin");
const User = require("../../../models/User");
const {
  success,
  failed,
  serverError,
  validateFail,
} = require("../../helper/adminResponse");
const mail = require("../../helper/mail");
const bcrypt = require("bcryptjs");
const {
  base64Decode,
  base64Encode,
  sendNewNotification,
} = require("../../helper/helpers");
const { ObjectId } = require("mongodb");
module.exports = {
  // Users get by user type 1=>Rider, 2=>Driver
  usersList: async (req, res) => {
    try {
      const { type, search, page, limit } = req.query;

      // Validate request parameters
      const validate = new Validator(
        { type },
        {
          type: "required",
        }
      );
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }

      // Pagination parameters
      const pageNumber = page ? parseInt(page) : 1;
      const pageSize = limit
        ? parseInt(limit)
        : parseInt(process.env.PAGE_LIMIT);
      const skip = (pageNumber - 1) * pageSize;

      // Query parameters
      const query = { roleType: type };
      if (search) {
        query.name = { $regex: search, $options: "i" };
        query.mobile = { $regex: search, $options: "i" };
      }

      // Fetch users
      const totalItems = await User.countDocuments(query);
      const totalPages = Math.ceil(totalItems / pageSize);
      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

      // Send response
      success(res, "Data fetched successfully.", {
        users,
        totalPages,
        currentPage: pageNumber,
      });
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  //User or rider details using id
  userDetails: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        userId: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let userId = new ObjectId(req.query.userId);

      const checkUser = await User.aggregate([
        {
          $match: {
            _id: userId,
          },
        },
        {
          $lookup: {
            from: "accounts",
            localField: "_id",
            foreignField: "userId",
            as: "accountdetails",
          },
        },
        {
          $lookup: {
            from: "userdocuments",
            localField: "_id",
            foreignField: "userId",
            as: "userdocuments",
          },
        },
      ]);
      if (!checkUser) {
        failed(res, "User not found.");
      }
      success(res, "Data fetched successfully.", checkUser);
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  //Accept or reject the driver
  acceptRejectDriver: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        userId: "required",
        status: "required|in:1,2", //0=>Pending, 1=>Verified, 2=>Blocked
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkUser = await User.findById(req.body.userId);
      if (!checkUser) {
        failed(res, "User not found.");
      }
      checkUser.verifyStatus = req.body.status;
      if (req.body.status == 1) {
        //Send push notification
        let title = "Godide";
        let message = "Your account has been verified successfully";
        await sendNewNotification(req.body.userId, title, message);
      }
      await checkUser.save();
      success(res, "Status updated successfully.");
    } catch (error) {
      console.error(error);
      serverError(res, "Internal server error.");
    }
  },
  //update status
  statusUpdate: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        userId: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const checkUser = await User.findOne({ _id: req.body.userId });
      if (!checkUser) {
        failed(res, "User not found.");
      }
      checkUser.status = checkUser.status === 0 ? 1 : 0;
      await checkUser.save();
      success(res, "Status updated successfully.");
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
};
