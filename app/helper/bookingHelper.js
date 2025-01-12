const Wallet = require("../../models/Wallet");
const User = require("../../models/User");
// calculate prices for normal service type
exports.calculatePrices = (
  vehicle,
  duration,
  totalPriceForVehicle,
  driverData
) => {
  // console.log("vehicle",vehicle);
  for (const charge of vehicle.kmCharges) {

    if (
      parseFloat(duration.distance) >= charge.from &&
      parseFloat(duration.distance) <= charge.to
    ) {
      const distanceInRange = parseFloat(duration.distance) - charge.from;
      const priceForDistanceInRange = distanceInRange * charge.price;
      totalPriceForVehicle += priceForDistanceInRange;
      const totalPrice = (totalPriceForVehicle + vehicle.baseFare).toFixed(2);

      return {
        totalPrice: parseFloat(totalPrice),
        duration: driverData[0].duration, // Arrival time (in minutes) of driver
      };
    }
  }
  return null;
};

exports.calculateTotalHourPrice = (vehicle, duration, totalPriceForVehicle) => {
  let ratePerHour;
  ratePerHour = vehicle.hourlyCharges;
  // Calculate total price based on rate per hour and duration
  const totalPrice = ratePerHour * duration;
  // console.log(totalPrice); return 1;
  return totalPrice;
};

//Wallet management
exports.performWalletTransaction = async (
  userId,
  amount,
  transactionType,
  bookingId = ""
) => {
  try {
    console.log("++++++++++++", transactionType);

    console.log("++++++++++++", amount);
    console.log("++++++++++++", userId);

    const user = await User.findById(userId);

    if (!user) {
      return null; // Or handle the case where the user is not found
    }

    const beforeWalletAmount = user.walletBalance;

    let afterWalletAmount;

    switch (transactionType) {
      case 1: // Credit
        afterWalletAmount = parseFloat(beforeWalletAmount) + parseFloat(amount);

        break;
      case 2: // Debit
        afterWalletAmount = parseFloat(beforeWalletAmount) - parseFloat(amount);
        break;
      default:
        // Handle unknown transaction types
        throw new Error(`Unknown transactionType: ${transactionType}`);
    }

    let newTransaction;

    newTransaction = await Wallet.create({
      userId: userId,
      transactionType: transactionType === 1 ? 1 : 2, //1=>Credit,2=>Debit
      amount: amount,
      bookingNo: bookingId,
    });
    console.log({ afterWalletAmount });
    await user.updateOne({
      walletBalance: parseFloat(afterWalletAmount),
    });

    return newTransaction;
  } catch (error) {
    console.error(error);
    throw new Error("Error performing wallet transaction.");
  }
};

//Generate random booking id
exports.generateBookingID = async () => {
  const digits = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const getRandomChar = (characters) => {
    return characters.charAt(Math.floor(Math.random() * characters.length));
  };

  // Create an array to hold the parts of the booking ID
  const parts = [
    getRandomChar(digits),
    getRandomChar(digits),
    getRandomChar(digits),
    getRandomChar(letters),
    getRandomChar(letters),
    getRandomChar(digits),
    getRandomChar(digits),
    getRandomChar(digits),
  ];

  // Join the parts into a single string
  return parts.join("");
};
