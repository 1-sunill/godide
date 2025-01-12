const CryptoJS = require("crypto-js");
const { dump } = require("./logs");
const { success, failed, serverError } = require("./response");
module.exports = {
  encrypter: (data) => {
    console.log("fffffffff");
    if (process.env.ENCRYPTION == "true") {
      var ciphertext = CryptoJS.AES.encrypt(
        JSON.stringify(data),
        process.env.ENCRYPTION_SECRET
      ).toString();
      return ciphertext;
    } else {
      return data;
    }
  },
};
