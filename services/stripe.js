var secretKey = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secretKey);
const mongoose = require("mongoose");
let User = require("../models/User");

module.exports = {
  
  stripePayment: async (paymentData) => {
    try {
      let authUser = await User.findOne({
        _id: paymentData.userId,
      });

      if (!authUser) {
        return { status: "unauthorize", data: {} };
      }

      let stripeCustomerId = "";
      if (
        authUser &&
        authUser.stripeCustomerId &&
        authUser.stripeCustomerId != ""
      ) {
        stripeCustomerId = authUser.stripeCustomerId;
        await stripe.customers.update(stripeCustomerId, {
          metadata: {
            name: authUser.name ? authUser.name : "",
            email: authUser.email ? authUser.email : "",
          },
        });
      } else {
        let createCustomer = await stripe.customers.create({
          name: authUser.name ? authUser.name : "",
          email: authUser.email ? authUser.email : "",
        });
        stripeCustomerId = createCustomer.id;
      }

      const getCustomer = await stripe.customers.retrieve(stripeCustomerId);

    //   let cardToken = paymentData.cardToken;
    //   let newCard = paymentData.newCard;
    //   let savedCard = paymentData.savedCard;
    //   let cardId = paymentData.cardId;
    //   let paidAmount = paymentData.paidAmount;
      let cardToken = "tok_visa"
      let newCard = true
      let savedCard = false
      let cardId = ""
      let paidAmount = 10
      let amount = parseInt(paidAmount) * 100;
      let customerSource = "";
      let paymentDetail = "";
      if (newCard) {
        customerSource = await stripe.customers.createSource(stripeCustomerId, {
          source: cardToken,
        });

        paymentDetail = await stripe.charges.create({
          amount: amount,
          currency: "USD",
          card: customerSource.id,
          customer: getCustomer.id,
        });
      } else if (savedCard) {
        paymentDetail = await stripe.charges.create({
          amount: amount,
          currency: "USD",
          card: cardId,
          customer: getCustomer.id,
        });
      }
      auth;

      if (paymentDetail.status == "succeeded") {
        return { status: "success", data: paymentDetail };
      } else {
        return { status: "failed", data: {} };
      }
    } catch (error) {
      return {
        status: "failed",
        code: error.decline_code,
        message: error.message,
      };
    }
  },

  createPaymentIntent: async (resdata) => {
    try {
      var requests = resdata;

      let authUser = await User.findOne({
        // _id: new ObjectId("661f9e07119f99a9db8f930e")
        _id: requests.authUser._id,
      });

      if (!authUser) {
        return { status: "unauthorise", data: {} };
      }

      let paidAmount = requests.paidAmount ? requests.paidAmount : "0";
      const paymentIntent = await stripe.paymentIntents.create({
        customer: authUser.stripeCustomerId,
        amount: parseInt(paidAmount) * 100,
        currency: "USD",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return { status: "success", data: paymentIntent, message: "" };
    } catch (error) {
      log({ error });
      return { status: "failed", data: {}, message: error };
    }
  },

  getIntent: async (data) => {
    try {
      var requests = data;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        requests.intentId
      );
      let status = paymentIntent.status;
      if (status == "succeeded") {
        return { status: "success", data: paymentIntent, message: "" };
      } else {
        return { status: "failed", data: paymentIntent, message: "" };
      }
    } catch (error) {
      log({ error });
      return { status: "failed", data: {}, message: error };
    }
  },

  createRefundUsingIntentId: async (data) => {
    // createRefundByPaymentId: async (req, res) => {
    try {
      // var requests = decrypter(req.body);
      // let paymentIntentId = requests.paymentIntentId
      // let amount = parseFloat(requests.amount) * 100

      let paymentIntentId = data.paymentIntentId;
      let amount = parseFloat(data.amount) * 100;

      // Create a refund using the Payment Intent ID
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount, // Amount should be in the smallest currency unit (e.g., cents for USD)
      });

      if (refund.status == "succeeded") {
        return { status: "success", data: refund, message: "" };
      } else {
        return { status: "failed", data: refund, message: "" };
      }
    } catch (error) {
      log({ error });
      return { status: "failed", data: {}, message: error };
    }
  },

  createRefundByCharge: async (data) => {
    // createRefundByCharge: async (req, res) => {
    try {
      // var requests = decrypter(req.body);
      let chargeId = data.chargeId;
      let amount = parseFloat(data.amount) * 100;

      // let chargeId = requests.chargeId
      // let amount = parseFloat(requests.amount) * 100
      // Create a refund using the Charge ID
      const refund = await stripe.refunds.create({
        charge: chargeId,
        amount: amount,
      });

      if (refund.status == "succeeded") {
        return { status: "success", data: refund, message: "" };
      } else {
        return {
          status: "failed",
          data: refund,
          message: "Something went wrong. Please try again later.",
        };
      }
    } catch (error) {
      log({ error });
      return { status: "failed", data: {}, message: error };
    }
  },
};
