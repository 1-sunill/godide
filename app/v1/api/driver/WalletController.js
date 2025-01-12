const {
  serverError,
  success,
  validateFail,
  failed,
} = require("../../../helper/response");
const { ObjectId } = require("mongodb");
const { Validator } = require("node-input-validator");
const Wallet = require("../../../../models/Wallet");
const { performWalletTransaction } = require("../../../helper/bookingHelper");
const Booking = require("../../../../models/Booking");
const User = require("../../../../models/User");
const moment = require("moment");

module.exports = {
  //Transaction list
  walletTransactions: async (req, res) => {
    try {
      var requests = await decrypter(req.query);
      const userId = req.user._id;
      console.log({ userId });
      const page = requests.page ? parseInt(requests.page) : 1;
      const pageSize = requests.limit ? parseInt(requests.limit) : 10;
      const skipIndex = (page - 1) * pageSize;
      let query = { userId: userId };
      const user = await User.findOne({ _id: userId });
      const wallet = await Wallet.find(query)
        .sort({ createdAt: -1 })
        .skip(skipIndex)
        .limit(pageSize);
      const walletCount = await Wallet.countDocuments({ userId: userId });

      const newData = {
        walletHistory: wallet,
        totalCount: walletCount,
        walletAmount: user.walletBalance,
      };
      return success(res, "data_fetched_successfully", newData);
    } catch (error) {
      console.error(error);
      // Return an internal server error response in case of an exception
      return serverError(res, "internal_server_error");
    }
  },
  //Transfer amount wallet to the account
  cashOutWallet: async (req, res) => {
    try {
      const requests = await decrypter(req.body);
      const driverId = req.user._id;
      const validate = new Validator(requests, {
        amount: "required",
        // accountId: "required",
        transactionType: "required",
      });
      const matched = await validate.check();
      if (!matched) {
        return validateFail(res, validate);
      }
      //   console.log( (requests.transactionType) );
      await performWalletTransaction(
        driverId,
        parseFloat(requests.amount),
        parseInt(requests.transactionType)
      );
      if (parseInt(requests.transactionType) == 1) {
        return success(res, "wallet_amount_credited_successfully");
      } else {
        return success(res, "wallet_amount_debited_successfully");
      }
    } catch (error) {
      console.error(error);
      serverError(res, "internal_server_error");
    }
  },
  //My earning list
  myEarningList: async (req, res) => {
    try {
      const requests = await decrypter(req.query);
      const userId = req.user._id;

      const page = parseInt(requests.page) || 1;
      const pageSize = parseInt(requests.limit) || 10;
      const skipIndex = (page - 1) * pageSize;

      let dateFilter = {};

      if (requests.selectedDate && requests.filterType) {

        const selectedDate = moment(requests.selectedDate);
        const selectedEndDate = moment(requests.selectedDate);

        dateFilter = {
          createdAt: {
            $gte: selectedDate.startOf("day").toDate(),
            $lte: selectedEndDate.endOf("day").toDate(),
          },
        };
        
        const currentDate = moment();
        switch (requests.filterType) {
          case "monthly":
            dateFilter = {
              createdAt: {
                $gte: selectedDate.startOf("month").toDate(),
                $lte: selectedDate.endOf("month").toDate(),
              },
            };
            break;
          case "weekly":
            dateFilter = {
              createdAt: {
                $gte: currentDate.startOf("week").toDate(),
                $lte: currentDate.endOf("week").toDate(),
              },
            };
            break;
          case "daily":
            dateFilter = {
              createdAt: {
                $gte: selectedDate.startOf("day").toDate(),
                $lte: selectedDate.endOf("day").toDate(),
              },
            };
            break;
          default:
            break;
        }
      console.log("++++++++", dateFilter );

      } else if (requests.selectedDate) {
        const selectedDate = moment(requests.selectedDate);
        const selectedEndDate = moment(requests.selectedDate);

        dateFilter = {
          createdAt: {
            $gte: selectedDate.startOf("day").toDate(),
            $lte: selectedEndDate.endOf("day").toDate(),
          },
        };
      } else if (requests.filterType) {
        const currentDate = moment();
        switch (requests.filterType) {
          case "monthly":
            dateFilter = {
              createdAt: {
                $gte: currentDate.startOf("month").toDate(),
                $lte: currentDate.endOf("month").toDate(),
              },
            };
            break;
          case "weekly":
            dateFilter = {
              createdAt: {
                $gte: currentDate.startOf("week").toDate(),
                $lte: currentDate.endOf("week").toDate(),
              },
            };
            break;
          case "daily":
            dateFilter = {
              createdAt: {
                $gte: currentDate.startOf("day").toDate(),
                $lte: currentDate.endOf("day").toDate(),
              },
            };
            break;
          default:
            break;
        }
      }
      const walletQuery = {
        userId: userId,
        transactionType: 1,
        ...dateFilter,
      };
      console.log(walletQuery);

      const wallet = await Wallet.find(walletQuery)
        .skip(skipIndex)
        .limit(pageSize)
        .sort({ createdAt: -1 })

      const walletCount = await Wallet.countDocuments(walletQuery);

      let totalEarning = 0;
      let totalMinutes = 0;
      let totalKilometers = 0;

      for (let i = 0; i < wallet.length; i++) {
        const element = wallet[i];
        totalEarning += element.amount;

        if (element.bookingNo) {
          const booking = await Booking.findOne({
            bookingId: element.bookingNo,
          });

          if (booking) {
            const [timeValue, timeUnit] = booking.totalTime.split(" ");
            const minutes = parseInt(timeValue);
            if (timeUnit === "mins" && !isNaN(minutes)) {
              totalMinutes += minutes;
            }

            const [distanceValue, distanceUnit] = booking.distance.split(" ");
            const kilometers = parseFloat(distanceValue);
            if (distanceUnit === "km" && !isNaN(kilometers)) {
              totalKilometers += kilometers;
            }
          }
        }
      }
      const totalMiles = parseFloat((totalKilometers * 0.621371).toFixed(2));
      const totalHours = totalMinutes / 60;
      const newData = {
        walletHistory: wallet,
        totalCount: walletCount,
        totalEarning,
        totalMiles,
        totalHours: parseFloat(totalHours.toFixed(2)),
      };

      return success(res, "data_fetched_successfully", newData);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      return serverError(res, "internal_server_error");
    }
  },
};
