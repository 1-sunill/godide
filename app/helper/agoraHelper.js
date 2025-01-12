const FCM = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const fetch = require("node-fetch");
const serviceAccount = require("../../config/firebase1.json");
const userModel = require("../../models/User");
const userNotificationModel = require("../../models/Notification");
const apn = require("apn");

// const service = new apn.Provider({
//     cert: "app.pem",
//     key: "app.pem",
// });
// Initialize Firebase app if not already initialized
if (!FCM.apps.length) {
  FCM.initializeApp(
    {
      credential: FCM.credential.cert(serviceAccount),
    },
    "godideApp"
  );
}

const PROJECT_ID = "godide-driver";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const SCOPES = [MESSAGING_SCOPE];

async function getAccessToken() {
  const client = new GoogleAuth({
    credentials: serviceAccount,
    scopes: SCOPES,
  });
  const accessToken = await client.getAccessToken();
  return accessToken;
}
var driverOptions = {
  token: {
    key: "AuthKey_QPX5PH8SWQ.p8",
    keyId: "29Q77J727Y",
    teamId: "DJSLJ3LVY3",
  },
  production: false,
  cert: "VOIP.pem",
  key: "VOIP.pem",
};
var riderOptions = {
  token: {
    key: "riderAuthKey.p8",
    keyId: "29Q77J727Y",
    teamId: "DJSLJ3LVY3",
  },
  production: false,
  cert: "VOIP.pem",
  key: "VOIP.pem",
};
const driverApnProvider = new apn.Provider(driverOptions);
const riderApnProvider = new apn.Provider(riderOptions);

// var service = new apn.Provider(options);
module.exports = {
  sendResponse: (
    msg,
    res,
    statusCode,
    data = null,
    customeCode = 0,
    requestfor = ""
  ) => {
    if (requestfor == "secure") {
      const resObj = {
        code: customeCode,
        message: msg,
        result: data == null ? {} : data,
      };
      let finalRes = encrypt(resObj);
      return res.status(statusCode).json(finalRes);
    }
    let finalData = {
      code: customeCode,
      message: msg,
      result: data == null ? {} : data,
    };
    return res.status(statusCode).json(finalData);
  },
  sendNotification: async (
    message,
    userId,
    senderId = null,
    notificationType = "",
    role = "user",
    data = {},
    notificationFrom = "",
    subject = ""
  ) => {
    try {
      const accessToken = await getAccessToken();
      const user = await userModel.findOne({ _id: userId });

      if (!user) {
        console.log("User not found");
        return 0;
      }

      let userNotifyObj = {
        sender: role === "user" ? senderId : null,
        receiver: userId,
        notificationType: notificationType,
        notificationFrom: notificationFrom,
        title: "Agora",
        description: message,
        subject: subject,
      };
      console.log(user.deviceType, "user.deviceType");
      console.log(user.voipToken, "user.voipToken");
      console.log(notificationFrom, "notificationFrom");
      console.log(user, "userInfo");

      if (data) {
        data.userType = notificationFrom;
      }

      let saveNotification = new userNotificationModel(userNotifyObj);
      await saveNotification.save();

      try {
        if (
          notificationFrom === "agoraToken" &&
          user.voipToken &&
          user.deviceType === "ios"
        ) {
          if (user.roleType == 1) {
            //Rider
            await sendApnNotificationToIosRider(
              message,
              "BasicBell.mp3",
              data,
              user.voipToken
            );
          } else if (user.roleType == 2) {
            //Driver
            await sendApnNotificationToIosDriver(
              message,
              "BasicBell.mp3",
              data,
              user.voipToken
            );
          }
        }
      } catch (error) {
        console.log("Error in sending VoIP token notification:", error);
      }
      console.log(user);
      if (user.deviceToken && user.deviceToken.length > 0) {
        const payload = {
          message: {
            token: user.deviceToken,
            notification: {
              title: "Godide",
              body: message,
            },
            data: {
              type: notificationType,
              customData: JSON.stringify(data),
            },
          },
        };
        console.log({ payload });

        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        const responseData = await response.json();
        console.log("0000000000000000", responseData);

        return responseData.successCount && responseData.successCount > 0
          ? 1
          : 0;
      } else {
        console.log("User device token not found");
        return 0;
      }
    } catch (error) {
      console.error("Error in sending notification:", error.message);
      return 0;
    }
  },
};

async function sendApnNotificationToIosRider(
  message = "apn notification",
  sound,
  data = {},
  voipToken
) {
  try {
    let note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 60;
    note.badge = 3;
    note.sound = sound || "ping.aiff";
    note.alert = message;
    note.payload = { messageFrom: message, viopData: data };
    note.topic = "com.ripenapps.GodideRider.voip";
    note.priority = 10;
    note.pushType = "voip";

    const result = await riderApnProvider.send(note, voipToken);
    console.log(JSON.stringify(result), "result with stringify");
  } catch (error) {
    console.log("Error part", error);
  }
}
async function sendApnNotificationToIosDriver(
  message = "apn notification",
  sound,
  data = {},
  voipToken
) {
  try {
    let note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 60;
    note.badge = 3;
    note.sound = sound || "ping.aiff";
    note.alert = message;
    note.payload = { messageFrom: message, viopData: data };
    note.topic = "com.ripenapps.GodideDriveIos.voip";
    note.priority = 10;
    note.pushType = "voip";

    const result = await driverApnProvider.send(note, voipToken);
    console.log(JSON.stringify(result), "result with stringify");
  } catch (error) {
    console.log("Error part", error);
  }
}
