const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
let { success, failed, serverError } = require("../../app/helper/adminResponse");

///////////////Authenticating admin /////////////////
module.exports = function (req, res, next) {
  try {
    let token = "";
    let decoded = "";
    let userId = "";
    // if (process.env.ENCRYPTION == "false") {
      token =
        (req.headers.authorization
          ? req.headers.authorization.split(" ")[1]
          : "") ||
        (req.body && req.body.token) ||
        req.body.token ||
        req.query.token ||
        req.query.token ||
        req.headers["x-access-token"];
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      userId = decoded._id;
      req.user = decoded;
      next();
    // } else {
    //   var requestData = req.query.reqData || req.body.reqData;
    //   var string = requestData.replace(/ /g, "+");
    //   var bytes = CryptoJS.AES.decrypt(string, process.env.ENCRYPTION_SECRET);
    //   var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    //   if (!decryptedData && !decryptedData.token)
    //     return authFailed(res, "Session Expired.");
    //   decoded = jwt.verify(decryptedData.token, process.env.JWT_SECRET_KEY);
    //   if (!decoded.status)
    //     return authFailed(
    //       res,
    //       "Your account is deactivated,please connect to admin"
    //     );
    //   (userId = decoded._id), (req.user = decoded), next();
    // }
  } catch (error) {
    console.log(error);
    return serverError(res, "Session Expired.");
  }
};
