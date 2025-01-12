const { Validator } = require("node-input-validator");
const {
  serverError,
  validateFail,
  success,
} = require("../../../helper/response");
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const User = require("../../../../models/User");
let baseUrl = process.env.APP_URL;

module.exports = {
  banklist: async (req, res) => {
    try {
      const { currency = "ZAR" } = req.query;

      try {
        const { data, status } = await axios.get(
          `${PAYSTACK_BASE_URL}/bank?currency=${currency}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        if (status === 200) {
          const bank = data.data;
          const total = bank.length;
          return success(res, "Success", { total, bank });
        } else {
          return success(res, "Success", { total: 0, bank: [] });
        }
      } catch (error) {
        return serverError(res, { total: 0, bank: [] });
      }
    } catch (error) {
      req.logger.error(error);
      return sendResponse(
        i18n.__("INTERNAL_ERROR"),
        res,
        constant.CODE.INTERNAL_SERVER_ERROR,
        {},
        0
      );
    }
  },
  connectAccount: async (req, res) => {
    try {
      const account = await stripe.accounts.create({
        type: "express", // or 'standard' based on your needs
      });
      const userId = req.user._id;

      await User.updateOne({ _id: userId }, { stripeAccountId: account.id });
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: baseUrl + "api/driver/payment/failed",
        return_url: baseUrl + "api/driver/payment/status",
        type: "account_onboarding",
      });
      //   console.log("Connect account created:", account.id);
      return success(res, "Success", accountLink);
    } catch (error) {
      console.error("Error creating Connect account:", error);
      return serverError(res, "Internal server error.");
    }
  },

  failed: async (req, res) => {
    return res.status(400).send({ success: false, message: "Payment Failed" });
  },
  success: async (req, res) => {
    
    return res.status(200).send({ success: true, message: "Payment Success" });
  },
};
