const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../helper/adminResponse");
const RidePricing = require("../../../models/RidePricing");
const Services = require("../../../models/Services");
const { Validator } = require("node-input-validator");
const { ObjectId } = require("mongodb");

module.exports = {
  pricingList: async (req, res) => {
    try {
      const data = await RidePricing.aggregate([
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
            "vehicleDetail.vehicleImage": 1,
            "vehicleDetail.seats": 1,
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      success(res, "Data listed successfully.", data);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error.");
    }
  },
  //Pricing details
  pricingDetail: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkPricing = await RidePricing.findOne({ _id: req.query.id });
      if (!checkPricing) {
        failed(res, "Data not found.");
      }
      let pricingId = new ObjectId(req.query.id);

      const detail = await RidePricing.aggregate([
        { $match: { _id: pricingId } },
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
            path: "$vehicleCategoryDetail",
            preserveNullAndEmptyArrays: true,
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
            "vehicleCategoryDetail.categoryName": 1,
            "vehicleCategoryDetail.categoryImage": 1,
            "vehicleCategoryDetail.seats": 1,
          },
        },
      ]);
      success(res, "Data fetched successfully", detail);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error.");
    }
  },
  //add pricing
  updatePricing: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkPricing = await RidePricing.findOne({ _id: req.body.id });
      if (!checkPricing) {
        failed(res, "Data not found.");
      }
      let reqData = {
        baseFare: req.body.baseFare,
        extraFare: req.body.extraFare,
        nightTime: req.body.nightTime,
        currency: "USD",
      };
      const kmCharges = req.body.kmCharges;

      for (let i = 0; i < kmCharges.length; i++) {
        const element = kmCharges[i];

        const kmChargeData = {
          from: element.from,
          to: element.to,
          price: element.price,
        };

        if (element.id) {
          // If the element has an ID, update the corresponding kmCharge in RidePricing
          await RidePricing.updateOne(
            { _id: req.body.id, "kmCharges._id": element.id },
            { $set: { "kmCharges.$": kmChargeData } }
          );
        } else {
          // If the element does not have an ID, create a new kmCharge in RidePricing
          await RidePricing.findByIdAndUpdate(req.body.id, {
            $push: { kmCharges: kmChargeData },
          });
        }
      }
      await RidePricing.updateOne(
        { _id: req.body.id },
        { $set: reqData },
        { $unset: { kmCharges: "" } }
      );
      success(res, "Data updated successfully.");
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error.");
    }
  },
  //remove pricing
  removePricing: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
        pricingId: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkPricing = await RidePricing.findOne({ _id: req.body.id });
      if (!checkPricing) {
        failed(res, "Data not found.");
      }
      await RidePricing.findOneAndUpdate(
        { _id: req.body.id },
        { $pull: { kmCharges: { _id: req.body.pricingId } } },
        { new: true }
      );

      success(res, "Data removed successfully.");
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },

  //services
  services: async (req, res) => {
    try {
      const services = await Services.find();
      success(res, "Data fetched successfully.", services);
    } catch (error) {
      return serverError(res, "Internal server error.");
    }
  },
  vehiclePricingDetail: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        serviceId: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkServices = await Services.findOne({
        _id: req.query.serviceId,
      });
      if (!checkServices) {
        failed(res, "Data not found.");
      }
      const data = await Services.aggregate([
        { $match: { _id: new ObjectId(req.query.serviceId) } },
        {
          $lookup: {
            from: "ridepricings",
            localField: "_id",
            foreignField: "serviceId",
            as: "pricingDetails",
          },
        },
        {
          $unwind: "$pricingDetails",
        },
        {
          $lookup: {
            from: "vehicles",
            localField: "pricingDetails.vehicleId",
            foreignField: "_id",
            as: "vehicleDetails",
          },
        },
        {
          $unwind: "$vehicleDetails",
        },

        {
          $project: {
            _id: 1,
            // serviceName: 1,
            "vehicleDetails._id": 1,  
            "vehicleDetails.vehicleName": 1,
            "vehicleDetails.vehicleImage": 1,
            "vehicleDetails.serviceType": 1,
            "pricingDetails._id": 1,
            "pricingDetails.baseFare": 1,
            "pricingDetails.extraFare": 1,
            "pricingDetails.nightTime": 1,
            "pricingDetails.currency": 1,
            "pricingDetails.hourlyCharges": 1,
            "pricingDetails.kmCharges": 1,
          },
        },
      ]);
      return success(res, "Data fetched suceessfully.", data);
    } catch (error) {
      return serverError(res, "Internal server error.");
    }
  },
};
