const {
  success,
  serverError,
  failed,
  validateFail,
} = require("../../helper/adminResponse");
const { Validator } = require("node-input-validator");
const BannerPrice = require("../../../models/BannerPrice");
const RequestedBanner = require("../../../models/RequestedBanner");
const User = require("../../../models/User");
const { ObjectId } = require("mongodb");

module.exports = {
  //Get Banner pricing
  bannerPricing: async (req, res) => {
    try {
      const bannerPrices = await BannerPrice.find();
      success(res, "Data fetched successfully.", bannerPrices);
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },
  updateBannerPrice: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
        price: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }

      const id = req.body.id;
      const price = parseFloat(req.body.price);
      const checkBannerPriceId = await BannerPrice.findById(id);
      if (!checkBannerPriceId) {
        failed(res, "Data not found.");
      }
      await BannerPrice.updateOne({ _id: id }, { price: price });
      success(res, "Price updated successfully.");
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },
  //Banner list
  bannerList: async (req, res) => {
    try {
      const { search, page, limit } = req.query;
      const pageNumber = page ? parseInt(page) : 1;
      const pageSize = limit
        ? parseInt(limit)
        : parseInt(process.env.PAGE_LIMIT);
      const skip = (pageNumber - 1) * pageSize;
      const banners = await RequestedBanner.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetail",
          },
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
      success(res, "Data fetched successfully", banners);
    } catch (error) {
      console.error({ error });
      serverError(res, "Internal server error");
    }
  },
  //Banner detail
  bannerDetail: async (req, res) => {
    try {
      // Validate request parameters
      const validate = new Validator(req.query, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      let bannerId = new ObjectId(req.query.id);

      const banner = await RequestedBanner.aggregate([
        { $match: { _id: bannerId } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetail",
          },
        },
      ]);
      console.log(req.query.id);
      if (!banner) {
        return failed(res, "Data not found.");
      }

      success(res, "Data fetched successfully.", banner);
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },

  //Accept decline
  acceptDecline: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
        status: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const banner = await RequestedBanner.findById(req.body.id);
      if (!banner) {
        failed(res, "Data not found.");
      }
      await RequestedBanner.updateOne({ _id: req.body.id }, { status: req.body.status });

      success(res, "Advertisment status updated successfully.");
    } catch (error) {
      serverError(res, "Internal server error");
    }
  },
};
