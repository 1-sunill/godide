const { Validator } = require("node-input-validator");
const Card = require("../../../../models/Card");
const { success, validateFail, serverError } = require("../../../helper/response");

module.exports = {
    addCard: async (req, res) => {
        try {
          const requests = await decrypter(req.body);
          const userId = req.user._id;
          
          const validate = new Validator(requests, {
            cardHolderName: "required",
            cardNumber: "required",
            expiryDate: "required",
            cvv: "required",
          });
      
          const isValid = await validate.check();
          if (!isValid) {
            return validateFail(res, validate);
          }
      
          const { cardHolderName, cardNumber, expiryDate, cvv } = requests;
          const reqData = {
            userId,
            cardHolderName,
            cardNumber,
            expiryDate,
            cvv,
          };
      
          const newCard = await Card.create(reqData);
          success(res, "Detail added successfully.", newCard);
        } catch (error) {
          console.error(error);
          return serverError(res, "Internal server error.");
        }
      }
      
};
