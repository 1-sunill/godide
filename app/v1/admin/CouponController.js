const { Validator } = require("node-input-validator");
const {
  serverError,
  validateFail,
  success,
  failed,
} = require("../../helper/adminResponse");
const { v4: uuidv4 } = require("uuid");
const Coupon = require("../../../models/Coupon");
const generateRandomAlphanumericString = (length) => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join("");
};
module.exports = {
  //Add new coupon
  addCoupon: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        name: "required",
        amount: "required",
        details: "required",
        startDate: "required",
        endDate: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const { name, amount, details, startDate, endDate } = req.body;
      // Check if a coupon with the same name already exists
      const existingCoupon = await Coupon.findOne({ name });
      if (existingCoupon) {
        return failed(res, "Coupon name must be unique.");
      }
      const randomAlphanumericString = generateRandomAlphanumericString(5); // Generate a random 5-character alphanumeric string
      const uniqueId = `Godide${randomAlphanumericString}`;
      const newData = {
        couponId: uniqueId,
        name,
        amount,
        details,
        startDate,
        endDate,
      };
      await Coupon.create(newData);
      return success(res, "Coupon added successfully.", newData);
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },

  //update status
  updateStatus: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const coupon = await Coupon.findOne({ _id: req.body.id });
      if (!coupon) {
        failed(res, "Coupon not found.");
      }
      coupon.status = coupon.status === 0 ? 1 : 0;
      await coupon.save();
      success(res, "Status updated successfully.");
    } catch (error) {
      return serverError(res, "Internal server error");
    }
  },

  //Coupon list
  couponList: async (req, res) => {
    try {
      const { search, page, limit } = req.query;
      // Query parameters
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { couponId: { $regex: search, $options: "i" } },
        ];
      }
      const pageNumber = page ? parseInt(page) : 1;
      const pageSize = limit
        ? parseInt(limit)
        : parseInt(process.env.PAGE_LIMIT);
      const skip = (pageNumber - 1) * pageSize;

      const coupons = await Coupon.aggregate([
        {
          $match: query,
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: pageSize,
        },
      ]);
      const couponCount = await Coupon.countDocuments(query);
      return success(res, "Coupon list fetched successfully.", {
        coupons,
        totalCount: couponCount,
      });
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error");
    }
  },
};
