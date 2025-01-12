const { Validator } = require("node-input-validator");
const {
  serverError,
  validateFail,
  success,
} = require("../../../helper/response");
var secretKey = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secretKey);
const User = require("../../../../models/User");
module.exports = {
  //Add new Card
  addStripeCard: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        cardToken: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const userId = req.user._id;
      const userDetails = await User.findById(userId);
      const customerSource = await stripe.customers.createSource(
        userDetails.stripeCustomerId,
        {
          source: requests.cardToken,
        }
      );
      return success(res, "Card added successfully.", customerSource);
    } catch (error) {
      return serverError(res, "Internal server error.");
    }
  },
  stripeCardList: async (req, res) => {
    try {
      const userId = req.user._id;
      const userDetails = await User.findById(userId);

      const paymentMethods = await stripe.paymentMethods.list({
        customer: userDetails.stripeCustomerId,
        type: "card",
      });
      return success(res, "Card added successfully.", paymentMethods);
    } catch (error) {
      return serverError(res, "Internal server error.");
    }
  },
};
