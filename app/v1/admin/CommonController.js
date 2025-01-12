const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../helper/adminResponse");
const CMS = require("../../../models/Cms");
const FAQ = require("../../../models/Faq");
const { Validator } = require("node-input-validator");
module.exports = {
  cmsList: async (req, res) => {
    try {
      const cms = await CMS.find();
      success(res, "Data fetched successfully.", cms);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error.");
    }
  },
  //Cms detail
  cmsDetail: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkCms = await CMS.findOne({ _id: req.query.id });
      if (!checkCms) {
        failed(res, "Cms not found");
      }
      success(res, "Detail fetched successfully.", checkCms);
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  cmsUpdate: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const checkCms = await CMS.findOne({ _id: req.body.id });
      if (!checkCms) {
        failed(res, "Cms not found");
      }
      const reqData = {
        title: req.body.title,
        description: req.body.description,
      };
      await CMS.updateOne({ _id: req.body.id }, { $set: reqData });
      success(res, "Detail updated successfully.");
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  //Add Faq
  addFaq: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        question: "required",
        answer: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }

      const reqData = {
        question: req.body.question,
        answer: req.body.answer,
      };
      await FAQ.create(reqData);
      success(res, "Faq saved successfully.", reqData);
    } catch (error) {
      console.log({ error });
      serverError(res, "Internal server error.");
    }
  },
  //List Faq
  listFaq: async (req, res) => {
    try {
      const list = await FAQ.find();
      success(res, "Data listed successfully.", list);
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },

  //Detail faq
  detailFaq: async (req, res) => {
    try {
      const validate = new Validator(req.query, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const detail = await FAQ.findOne({ _id: req.query.id });
      if (!detail) {
        failed(res, "Faq not found.");
      }
      success(res, "Data listed successfully.", detail);
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  updateFaq: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        id: "required",
      });
      const isValid = await validate.check();

      if (!isValid) {
        return validateFail(res, validate);
      }
      const detail = await FAQ.findOne({ _id: req.body.id });
      if (!detail) {
        failed(res, "Faq not found.");
      }
      let reqData = {
        question: req.body.question,
        answer: req.body.answer,
      };
      await FAQ.updateOne({ _id: req.body.id }, { $set: reqData });
      success(res, "Data updated successfully.");
    } catch (error) {
      serverError(res, "Internal server error.");
    }
  },
  deleteFaq: async (req, res) => {
    try {
      const validate = new Validator(req.params, {
        id: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const id = req.params.id;

      const faq = await FAQ.findOne({ _id: id });

      if (!faq) {
        return failed(res, "Faq not found.");
      }

      await FAQ.deleteOne({ _id: id });

      success(res, "Faq deleted successfully.");
    } catch (error) {
      console.log(error);
      serverError(res, "Internal server error.");
    }
  },
};
