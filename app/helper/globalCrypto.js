const CryptoJS = require("crypto-js");
const { dump } = require("./logs");
const { success, failed, serverError } = require("./response");
// module.exports = {
global.encrypter = function (data) {
  if (process.env.ENCRYPTION == "true") {
    var ciphertext = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      process.env.ENCRYPTION_SECRET
    ).toString();
    return ciphertext;
  } else {
    return data;
  }
};
global.decrypter = async function (data) {
  try {
    if (process.env.ENCRYPTION == "true") {
      if (data.reqData) {
        var string = data.reqData;
        var a = string.replace(/ /g, "+");

        var bytes = CryptoJS.AES.decrypt(a, process.env.ENCRYPTION_SECRET);
        var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        console.log({decryptedData})
        if (decryptedData) {
          return decryptedData;
        } else {
          return false;
        }
      } else if (data) {
        var string = data;
        var a = string.replace(/ /g, "+");

        var bytes = CryptoJS.AES.decrypt(a, process.env.ENCRYPTION_SECRET);
        var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        if (decryptedData) {
          return decryptedData;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      return data;
    }
  } catch (error) {
    dump("error", error);
  }
};
// };
