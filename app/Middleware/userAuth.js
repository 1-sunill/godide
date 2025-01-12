const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
let {
  success,
  failed,
  serverError,
  unauthorized,
} = require("../../app/helper/response");
const User = require("./../../models/User");
const UserSession = require("./../../models/UserSessions");

///////////////Authenticating admin /////////////////
module.exports = async (req, res, next) => {
  try {
    let token = "";
    let decoded = "";
    let userId = "";
    if (process.env.ENCRYPTION == "false") {
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
      // console.log(decoded);
      userId = decoded._id;
      const user = await User.findOne({ _id: userId });
      // console.log(user);
      if (user.isDeleted == true) {
        return failed(res, "Your account has been deleted.");
      }
      const userSession = await UserSession.findOne({
        token: token,
      });
      if (!userSession) {
        return unauthorized(res, "Invalid session or user not logged in.");
      }
      console.log("userSessoin", userSession );
      req.user = decoded;
      req.userData = user;
      next();
    } else {
      console.log("+++++++++", req.query);

      var requestData = req.query.reqData || req.body.reqData;

      var string = requestData.replace(/ /g, "+");
      var bytes = CryptoJS.AES.decrypt(string, process.env.ENCRYPTION_SECRET);
      var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      if (!decryptedData && !decryptedData.token)
        return unauthorized(res, "Session Expired.");
      decoded = jwt.verify(decryptedData.token, process.env.JWT_SECRET_KEY);
      // console.log({ decoded });
      const user = await User.findOne({ _id: decoded._id });
      // console.log(user);
      if (user.isDeleted == true) {
        return failed(res, "Your account has been deleted.");
      }

      
      const userSession = await UserSession.findOne({
        token: decryptedData.token,
      });
      if (!userSession) {
        return unauthorized(res, "Invalid session or user not logged in.");
      }
      // console.log("+++++++++", user);
      if (user.status !== 1)
        return unauthorized(
          res,
          "Your account is deactivated,please connect to admin"
        );
      req.userData = user;

      (userId = decoded._id), (req.user = decoded), next();
    }
  } catch (error) {
    console.error(error);
    return serverError(res, "Session Expired.");
  }
};
