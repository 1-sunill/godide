const { Validator } = require("node-input-validator");
const {
  serverError,
  validateFail,
  success,
  failed,
} = require("../../helper/response");
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const User = require("../../../models/User");
let BASE_URL = process.env.APP_URL;
const axios = require("axios");
const UserAccount = require("../../../models/UserAccount");
const { ObjectId } = require("mongodb");
const Wallet = require("../../../models/Wallet");
const { v4: uuidv4 } = require("uuid");
const Booking = require("../../../models/Booking");
const { performWalletTransaction } = require("../../helper/bookingHelper");

// const { encrypt, decrypt } = require("../../../services/");

module.exports = {
  banklist: async (req, res) => {
    try {
      const currency = "ZAR";

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
        console.log(error);
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
  createAccount: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        bank_code: "required",
        country_code: "required",
        account_number: "required",
        account_name: "required",
        // account_type: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      console.log("+++++++++++++++++++", requests);
      const {
        type,
        name,
        account_number,
        bank_code,
        currency,
        country_code,
        account_name,
        account_type,
        document_type,
        document_number,
      } = requests;

      const checkAccount = await UserAccount.findOne({
        userId: req.user._id,
        bankCode: bank_code,
        accountNumber: account_number,
        status: { $ne: 3 }, // Exclude deleted status
      });

      if (checkAccount) {
        return failed(res, "Account already exists.");
      }

      const requestData = {
        bank_code,
        country_code,
        account_number,
        account_name,
        account_type,
        document_type,
        document_number,
      };

      const headers = {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      };

      try {
        const data = { name, account_number, bank_code, currency };
        const createAccountResponse = await axios.post(
          "https://api.paystack.co/transferrecipient",
          data,
          { headers }
        );
        console.log(createAccountResponse, "createAccountResponse");
        requests.userId = req.user._id;
        requests.bankCode = bank_code;
        requests.accountNumber = account_number;
        requests.bankUserName = name;
        requests.bankName = createAccountResponse.data.data.details.bank_name;
        requests.recipientCode = createAccountResponse.data.data.recipient_code;
        requests.country = country_code;
        await User.updateOne({ _id: req.user._id }, { isBankAccount: 1 });

        await UserAccount(requests).save();
        return success(res, "Account added successfully.");
      } catch (error) {
        console.error("Error creating account:", error);
        return serverError(res, "Internal server error.");
      }
    } catch (error) {
      console.error("Error processing request:", error);
      return serverError(res, "Internal server error.");
    }
  },
  //Users added bank lists
  bankList: async (req, res) => {
    try {
      console.log("req.user._id", req.user);
      let list = await UserAccount.find({
        userId: req.user._id,
        status: {
          $ne: 3,
        },
      });
      return success(res, "Success", list);
    } catch (error) {
      req.logger.error(error);
      return serverError(res, "Internal server error.");
    }
  },
  deleteBank: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        bankId: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      let find = await UserAccount.findOne({
        _id: new ObjectId(requests.bankId),
        userId: req.user._id,
      });

      if (!find) {
        return failed(res, "Bank not found.");
      }

      if (find.status === 3) {
        return failed(res, "Account deleted successfully.");
      }

      await UserAccount.findOneAndUpdate(
        { _id: new ObjectId(requests.bankId), userId: req.user._id },
        { $set: { status: 3 } }
      );
      return success(res, "Account deleted successfully.");
    } catch (error) {
      console.log({ error });
      return serverError(res, "Internal server error.");
    }
  },
  transferAmountFromWalletToAccount: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        recipientCode: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }

      const {
        recipientCode = "",
        withdrwalAmount = 0,
        reason = "",
        getWayCharge = 3,
      } = requests;

      const userAccount = await UserAccount.findOne({
        recipientCode,
        userId: req.user._id,
      });
      if (!userAccount) {
        return failed(res, "Recipient code incorrect");
      }

      const businessUser = await User.findById(req.user._id);
      // const businessUserWalletAmount = parseFloat(
      //   await decrypter(businessUser.walletBalance)
      // );
      const businessUserWalletAmount = businessUser.walletBalance;
      if (
        withdrwalAmount <=
        parseInt(process.env.MINIMUM_BUSINESS_WITHDRAWAL_AMOUNT, 10)
      ) {
        const message = `Your minimum amount should be ${process.env.MINIMUM_BUSINESS_WITHDRAWAL_AMOUNT}.`;
        return failed(res, message);
      }

      const headers = {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      };

      let paystackBalance = 0;
      try {
        const { data, status } = await axios.get(
          `${PAYSTACK_BASE_URL}/balance`,
          { headers }
        );
        if (status !== 200 || data.status !== true) {
          return success(res, "Failed to fetch Paystack balance", data.message);
        }
        paystackBalance = data?.data[0]?.balance;
      } catch (error) {
        console.error("Error fetching Paystack balance:", error);
        return serverError(res, "Internal server error.");
      }

      if (withdrwalAmount > paystackBalance) {
        return failed(res, "Insufficient Paystack balance.");
      }

      const transferRequestData = {
        source: "balance",
        amount: withdrwalAmount * 100,
        recipient: recipientCode,
        reference: uuidv4(),
        reason:
          reason ||
          `Transfer the wallet amount ${withdrwalAmount} to the business owner's account.`,
        currency: "ZAR",
      };

      try {
        const { data, status } = await axios.post(
          `${PAYSTACK_BASE_URL}/transfer`,
          transferRequestData,
          { headers }
        );
        if (status !== 200 || data.status !== true) {
          console.error("Error initiating transfer:", data);
          return success(res, "Failed to initiate transfer", data.message);
        }

        const response = data?.data;

        let fetchTransfer = {};
        try {
          const { data, status } = await axios.get(
            `${PAYSTACK_BASE_URL}/transfer/${response.transfer_code}`,
            { headers }
          );
          if (status !== 200 || data.status !== true) {
            console.error("Error fetching transfer details:", data);
            return success(
              res,
              "Failed to fetch transfer details",
              data.message
            );
          }
          fetchTransfer = data?.data;
        } catch (error) {
          console.error("Error fetching transfer details:", error);
        }

        const walletTransactionObj = {
          userId: req.user._id,
          transactionId: response.transfer_code,
          paymentType: "withdrawal",
          amount: withdrwalAmount,
          transactionDate: response.createdAt,
          status: fetchTransfer.status === "success" ? true : response.status,
          accountTransferResponse: JSON.stringify(
            fetchTransfer.status !== undefined ? fetchTransfer : response
          ),
        };

        await Wallet.create(walletTransactionObj);

        const remainingWalletAmount =
          businessUserWalletAmount - withdrwalAmount;

        await User.findByIdAndUpdate(req.user._id, {
          walletBalance: remainingWalletAmount,
        });

        return success(res, "Amount transferred successfully.");
      } catch (error) {
        console.error("Error during transfer:", error);
        return serverError(res, "Internal server error.");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      return serverError(res, "Internal server error.");
    }
  },
  payment: async (req, res) => {
    try {
      const requests = await decrypter(req.body);

      //   console.log("++++++++++++++++++++",req.userData);
      const { payableAmount, bookingId } = requests;

      // Create Paystack transaction
      const transactionResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: req.userData.email,
          amount: payableAmount * 100,
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
          callback_url: `${BASE_URL}api/call-back?token=${req.headers.authorization}&bookingId=${bookingId}`,
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
      return res.json({ authorization_url, access_code });
      //   return success(res, "Success", response);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal server error.");
    }
  },
  callBack: async (req, res) => {
    try {
      const token = req.query.token;
      const tranId = req.query.trxref;
      const reference = req.query.reference;
      //   const bookingId = req.query.bookingId;

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
        return res.redirect(`${BASE_URL}/failed`);
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
      // Convert obj to JSON string
      const paymentObjJson = JSON.stringify(obj);

      // Check if the booking exists
      let bookingCheck = await Booking.findOne({ _id: bookingId });
      // Create booking transaction
      const booking = await Booking.updateOne(
        { _id: bookingId },
        { paymentObj: paymentObjJson, payStatus: 1 }
      );
      // Deduct user amount from wallet and manage wallet transaction amount
      if (booking.updatedAmount >= 1) {
        await performWalletTransaction(
          bookingCheck.userId, // assuming userId is part of bookingCheck
          parseFloat(requests.amount),
          2 // debit amount
        );
      }

      return res.redirect(`${BASE_URL}/success`);
    } catch (error) {
      console.error(error);
      //   req.logger.error(error)
      return res.redirect(`${BASE_URL}/failed`);
    }
  },
  addNewCard: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const validate = new Validator(requests, {
        amount: "required",
        cardNumber: "required",
        cvv: "required",
        expiry_month: "required",
        expiry_year: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      const { amount, cardNumber, cvv, expiry_month, expiry_year } = requests;
      const cardDetails = {
        number: cardNumber,
        cvv,
        expiry_month,
        expiry_year,
      };
      const response = await axios.post(
        "https://api.paystack.co/charge",
        {
          email: req.userData.email,
          amount: amount,
          card: cardDetails,
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
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (response.data.status) {
        console.log("Card added successfully:", response.data.data);
        return success(res, "success", response.data.data);
      } else {
        console.log("Failed to add card:", response.data.message);
        return null;
      }
    } catch (error) {
      console.error(error);
      return res.redirect(`${BASE_URL}/failed`);
    }
  },
  cardList: async (req, res) => {
    try {
      let user = await User.findOne({
        _id: req.user._id,
      });
      // console.log(user, "User email");
      // Fetch customer details
      const customerResponse = await axios.get(
        `https://api.paystack.co/customer/${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (!customerResponse.data.status) {
        console.log("Failed to fetch customer:", customerResponse.data.message);
        return [];
      }

      console.log("customerId", customerResponse.data.data.id);
      const customerId = customerResponse.data.data.id;
      // Fetch customer authorizations (cards)
      const authResponse = await axios.get(
        `https://api.paystack.co/customer/${customerId}/authorizations`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (authResponse.data.status) {
        console.log("Customer cards:", authResponse.data.data);
        return authResponse.data.data;
      } else {
        console.log("Failed to fetch cards:", authResponse.data.message);
        return [];
      }
    } catch (error) {
      console.error(
        "Error fetching cards:",
        error.response ? error.response.data : error.message
      );
      return [];
    }
  },
  failed: async (req, res) => {
    console.log("ssssssssss");
    return res.status(400).send({ success: false, message: "Payment Failed" });
  },
  success: async (req, res) => {
    console.log("ffffffffff");
    const userId = req.userData._id;

    await User.updateOne({ _id: userId }, { accCreated: true });
    return res.status(200).send({ success: true, message: "Payment Success" });
  },
};
