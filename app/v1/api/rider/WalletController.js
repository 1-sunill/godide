const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/response");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const Wallet = require("../../../../models/Wallet");
const Coupon = require("../../../../models/Coupon");
const User = require("../../../../models/User");
const { performWalletTransaction } = require("../../../helper/bookingHelper");
let BASE_URL = process.env.APP_URL;
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const axios = require("axios");
const { stripePayment } = require("../../../../services/stripe");
module.exports = {
  walletTransactions: async (req, res) => {
    try {
      var requests = await decrypter(req.query);

      const userId = req.user._id;
      const page = requests.page ? parseInt(requests.page) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit) : 10;
      const skipIndex = (page - 1) * pageSize;
      let query = { userId: userId };

      const wallet = await Wallet.find(query)
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize);
      const walletCount = await Wallet.countDocuments({ userId: userId });
      const walletAmount = await User.findOne({ _id: userId });
      const newData = {
        walletHistory: wallet,
        totalCount: walletCount,
        walletAmount: walletAmount.walletBalance,
      };
      return success(res, "Data fetched successfully.", newData);
    } catch (error) {
      console.error(error);
      // Return an internal server error response in case of an exception
      return serverError(res, "Internal server error.");
    }
  },
  //Transfer amount account to the wallet
  creditWallet: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const userId = req.user._id;
      const validate = new Validator(requests, {
        amount: "required",
        transactionType: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const { amount } = requests;

      // Create Paystack transaction
      const transactionResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: req.userData.email,
          amount: amount * 100,
          metadata: {
            custom_fields: [
              {
                display_name: "Customer Id",
                variable_name: "customer_id",
                value: req.userData._id,
              },
              {
                display_name: "Customer Name",
                variable_name: "customer_name",
                value: req.userData.name,
              },
              {
                display_name: "Customer Email",
                variable_name: "customer_email",
                value: req.userData.email,
              },
              {
                display_name: "Customer Mobile",
                variable_name: "customer_mobile",
                value: req.userData.mobile,
              },
            ],
          },
          callback_url: `${BASE_URL}api/rider/call-back?token=${req.headers.authorization}&userId=${userId}&transactionType=${requests.transactionType}&amount=${amount}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const { authorization_url, access_code } = transactionResponse.data.data;

      // Handle payment with Paystack
      // Use a payment library or implement your payment logic here

      // For demonstration purposes, we'll just send the authorization_url to the client
      const reqData = {
        authorization_url,
        access_code,
      };
      return success(res, "Success", reqData);
      // return encrypter(res.json({ authorization_url, access_code }));
    } catch (error) {
      console.error(error);
      serverError(res, "Internal server error.");
    }
  },
  callBack: async (req, res) => {
    try {
      const token = req.query.token;
      const tranId = req.query.trxref;
      const reference = req.query.reference;
      const userId = req.query.userId;
      const transactionType = parseInt(req.query.transactionType);
      console.log("#############################", req.query);
      const options = {
        method: "GET",
        url: `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      };

      const transactionResponse = await axios(options);

      if (!transactionResponse.data.status) {
        // Checking the status inside the data object
        return res.redirect(`${BASE_URL}api/driver/payment/failed`);
      }

      const paymentData = transactionResponse.data.data;
      const { channel, currency } = paymentData;

      const obj = {
        currency,
        payBy: channel,
        transactionId: tranId,
        reference: reference,
        amount: paymentData.amount,
        gateway_response: paymentData.gateway_response,
        ip_address: paymentData.ip_address,
      };
      console.log("))))))))))))))))))))))))))", obj);
      const amount = obj.amount / 100;
      await performWalletTransaction(
        userId, // assuming userId is part of bookingCheck
        parseFloat(amount),
        transactionType
      );

      return res.redirect(`${BASE_URL}api/driver/payment/success`);
    } catch (error) {
      console.error(error);
      //   req.logger.error(error)
      return res.redirect(`${BASE_URL}/failed`);
    }
  },
  couponList: async (req, res) => {
    try {
      var requests = await decrypter(req.query);

      const userId = req.user._id;
      const page = requests.page ? parseInt(requests.page) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit) : 10;
      const skipIndex = (page - 1) * pageSize;
      const search = requests.search;
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { couponId: { $regex: search, $options: "i" } },
        ];
      }
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
          $skip: skipIndex,
        },
        {
          $limit: pageSize,
        },
      ]);
      const couponCount = await Coupon.countDocuments(query);

      const newData = {
        coupons,
        totalCount: couponCount,
      };
      return success(res, "Data fetched successfully.", newData);
    } catch (error) {
      console.log(error);
      return serverError(res, "Internal server error.");
    }
  },
};
