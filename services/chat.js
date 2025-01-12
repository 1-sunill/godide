const User = require("../models/User");
const Admin = require("../models/Admin");
const Chat = require("../models/Chat");
const ChatMessage = require("../models/ChatMessage");
const mongoose = require("mongoose");
const {
  RtcTokenBuilder,
  RtmTokenBuilder,
  RtcRole,
  RtmRole,
} = require("agora-token");
const helper = require("../app/helper/agoraHelper");
const query = require("../app/helper/dbQuery");
require("dotenv").config();
const secretKey = process.env.JWT_SECRET_KEY;
const { APP_ID, APP_CERTIFICATE } = process.env;
const { sendNewNotification } = require("../app/helper/helpers");

const ObjectId = mongoose.Types.ObjectId;
module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log(socket.handshake.query);
    // Store user ID when a user connects
    socket.userId = socket.handshake.query.userId;
    // Store user type when a user connects
    socket.userType = socket.handshake.query.userType;
    console.log("socket", socket.userId, "$$$$$$$$$$$$", socket.userType);
    console.log("User connected: " + socket.userId, socket.userType);

    if (socket.userId && socket.userType) {
      if (socket.userType == "user") {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: true,
          lastSeen: new Date(),
        });
      } else {
        await Admin.findByIdAndUpdate(socket.userId, {
          isOnline: true,
          lastSeen: new Date(),
        });
      }
      //update sidebar while user connect

      updateUserSideBar({
        userId: socket.userId,
      });
    } else {
      // socket.emit('error', 'Invalid user ID');
      // // Disconnect the socket
      // socket.disconnect();
      // return;
      socket.join(socket.userId);
      // io.to(socket.userId).emit("invalidData", {
      //   status: 200,
      //   message: "Please send required data",
      //   result: {},
      // });
      console.log("connection");
    }
    //handle user list chat
    socket.on("chatList", async (data) => {
      console.log(data, 'chatList');
      updateUserSideBar(data);
    });
    //send message
    socket.on("sendMessage", async (data) => {
      console.log("message", data.message);
      if (
        !data.userId ||
        !data.receiverId ||
        !data.senderType ||
        !data.receiverType ||
        !data.messageType ||
        !data.message
      ) {
        socket.join(data.userId);
        io.to(data.userId).emit("invalidData", {
          status: 200,
          message: "Please send required data",
          result: [],
        });
      }
      if (data.messageType == 1) {
        await ChatMessage.create({
          roomId: data.roomId,
          senderId: data.userId,
          receiverId: data.receiverId,
          senderType: data.senderType,
          receiverType: data.receiverType,
          message: data.message,
          ticketId: data.ticketId,
          supportType: data.supportType,
          messageType: data.messageType,
        });
        await Chat.findOneAndUpdate(
          {
            roomId: data.roomId,
          },
          {
            lastMessage: data.message,
            updatedAt: new Date(),
            messageType: data.messageType,
          }
        );
      } else {
        await ChatMessage.create({
          roomId: data.roomId,
          senderId: data.userId,
          receiverId: data.receiverId,
          senderType: data.senderType,
          receiverType: data.receiverType,
          // message: Array.isArray(data.images) ? data.images[0] : data.images,
          images: data.images,
          ticketId: data.ticketId,
          supportType: data.supportType,
          messageType: data.messageType,
        });
        await Chat.findOneAndUpdate(
          {
            roomId: data.roomId,
          },
          {
            lastMessage: Array.isArray(data.images)
              ? data.images[0]
              : data.images,
            updatedAt: new Date(),
            messageType: data.messageType,
          }
        );

        //data.images = images
      }

      let sender = await User.findById(data.userId);

      if (sender.isOnline === false) {
        await sendNewNotification(sender._id, data.message, "Godide");
      }

      let receiver = await User.findById(data.receiverId);

      if (receiver.isOnline === false) {
        await sendNewNotification(receiver._id, data.message, "Godide");
      }

      senderOnline = await User.findOne({
        _id: data.userId,
        isOnline: false,
      });
      console.log("senderOnline", senderOnline);
      if (senderOnline) {
        await sendPushNotification(
          senderOnline._id,
          "Green house",
          data.message
        );
      }
      data.sender = {
        senderId: sender._id,
        name: sender.name,
        email: sender.email,
        isOnline: sender.isOnline,
        lastSeen: sender.lastSeen,
        profileImage: sender.profileImage ? sender.profileImage : null,
        createdAt: new Date(),
      };
      data.receiver = {
        receiverId: data.receiverId,
        name: sender.name,
        email: sender.email,
        isOnline: sender.isOnline,
        lastSeen: sender.lastSeen,
        profileImage: sender.profileImage ? sender.profileImage : null,
        createdAt: new Date(),
      };
      socket.join(data.roomId);
      io.to(data.roomId).emit("receiveMessage", {
        status: 200,
        message: "Mesage data",
        result: [data],
        createdAt: new Date(),
      });
      //update both sender and receiver chat list
      if (data.receiverType == "user" || data.senderType == "user") {
        updateUserSideBar({
          userId: data.userId,
          userType: "user",
        });
      } else {
        updateUserSideBar({
          userId: data.userId,
        });
      }
      // updateUserSideBar({
      //     userId: data.receiverId
      // })
    });
    //get chat messages
    socket.on("chatMessage", async (data) => {
      console.log(data, "chatMessage");
      await User.updateOne({ _id: data.userId }, { isOnline: true });

      let chatMessage = await ChatMessage.aggregate([
        {
          $match: {
            roomId: data.roomId,
            message: {
              $ne: "",
            },
          },
        },
        {
          $project: {
            _id: 1,
            roomId: 1,
            message: 1,
            images: 1,
            senderType: 1,
            messageType: 1,
            receiverId: 1,
            createdAt: 1,
            status: 1,
          },
        },
      ]);
      socket.join(data.roomId);
      io.to(data.roomId).emit("receiveMessages", {
        status: 200,
        message: "Message list data",
        result: chatMessage,
      });
      console.log("msg data", chatMessage);
    });
    //initiate chat  and return room id and receiver details
    socket.on("initiateChat", async (data) => {
      try {
        if (
          !data.userId ||
          !data.receiverId ||
          !data.senderType ||
          !data.receiverType
        ) {
          socket.join(data.userId);
          io.to(data.userId).emit("invalidData", {
            status: 200,
            message: "Please send required data",
            result: {},
          });
          console.log("Please send required data");
          return false;
        }
        let chatExist = await Chat.findOne({
          $or: [
            {
              senderId: data.userId,
              receiverId: data.receiverId,
            },
            {
              receiverId: data.userId,
              senderId: data.receiverId,
            },
          ],
        });
        var chatData = {};
        if (chatExist) {
          let receiverInfo = {
            receiverId: "",
            receiverType: "",
          };
          if (chatExist.senderId == data.userId) {
            receiverInfo.receiverId = chatExist.receiverId;
            receiverInfo.receiverType = chatExist.receiverType;
          } else {
            receiverInfo.receiverId = chatExist.senderId;
            receiverInfo.receiverType = chatExist.senderType;
          }
          let receiver = {};
          if (receiverInfo.receiverType == "user") {
            receiver = await User.findById(receiverInfo.receiverId);
          } else {
            receiver = await Admin.findById(receiverInfo.receiverId);
          }

          // console.log("+++++++++++++", receiver);
          // console.log("############", receiverInfo);

          chatData = {
            receiver: {
              receiverId: receiver._id,
              name: receiver.name,
              email: receiver.email,
              isOnline: receiver.isOnline,
              lastSeen: receiver.lastSeen,
              profileImage: receiver.profileImage
                ? receiver.profileImage
                : null,
            },
            roomId: chatExist.roomId,
            lastMessage: chatExist.lastMessage,
            receiverId: receiverInfo.receiverId,
            receiverType: receiverInfo.receiverType,
          };
        } else {
          data.senderId = data.userId;
          let created = await Chat.create(data);
          if (created) {
            let chatExist = await Chat.findById(created._id);
            if (chatExist) {
              let receiverInfo = {
                receiverId: "",
                receiverType: "",
              };
              if (chatExist.senderId == data.userId) {
                receiverInfo.receiverId = chatExist.receiverId;
                receiverInfo.receiverType = chatExist.receiverType;
              } else {
                receiverInfo.receiverId = chatExist.senderId;
                receiverInfo.receiverType = chatExist.senderType;
              }
              let receiver = {};
              if (receiverInfo.receiverType == "user") {
                receiver = await User.findById(receiverInfo.receiverId);
              } else {
                receiver = await Admin.findById(receiverInfo.receiverId);
              }
              chatData = {
                receiver: {
                  receiverId: receiver._id,
                  name: receiver.name,
                  email: receiver.email,
                  isOnline: receiver.isOnline,
                  lastSeen: receiver.lastSeen,
                  profileImage: receiver.profileImage
                    ? receiver.profileImage
                    : null,
                },
                roomId: chatExist.roomId,
                lastMessage: chatExist.lastMessage,
                receiverId: receiverInfo.receiverId,
                receiverType: receiverInfo.receiverType,
              };
            }
          }
        }

        socket.join(data.userId);

        io.to(data.userId).emit("getRoomId", {
          status: 200,
          message: "Room details",
          result: chatData,
        });
      } catch (error) {
        console.log(error);
        socket.join(data.userId);
        io.to(data.userId).emit("invalidData", {
          status: 200,
          message: "Please send required data",
          result: [],
        });
      }
    });
    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("User disconnected: " + socket.userId);
      await User.updateOne({ _id: socket.userId }, { isOnline: false });
    });
    // update all user list
    async function updateUserSideBar(data) {
      try {
        let params = {};
        if (data.userType && data.userType != "") {
          if (data.userType != "admin") {
            params = Object.assign(params, {
              isNormalChat: false,
              // lastMessage: {
              //     $ne: null
              // },
              $or: [
                {
                  senderId: new ObjectId(data.userId),
                },
                {
                  receiverId: new ObjectId(data.userId),
                },
                {
                  ticketId: data.ticketId,
                },
              ],
              $or: [
                {
                  senderType: data.userType,
                },
                {
                  receiverType: data.userType,
                },
              ],
            });
          } else {
            params = Object.assign(params, {
              isNormalChat: false,
              // lastMessage: {
              //     $ne: null
              // },
              $or: [
                {
                  senderId: new ObjectId(data.userId),
                },
                {
                  receiverId: new ObjectId(data.userId),
                },
                {
                  ticketId: data.ticketId,
                },
              ],
            });
          }
        }
        let chatList = await Chat.find(params).lean();
        let list = [];
        for (let i = 0; i < chatList.length; i++) {
          let receiverInfo = {
            receiverId: "",
            receiverType: "",
          };
          if (chatList[i].senderId == data.userId) {
            receiverInfo.receiverId = chatList[i].receiverId;
            receiverInfo.receiverType = chatList[i].receiverType;
          } else {
            receiverInfo.receiverId = chatList[i].senderId;
            receiverInfo.receiverType = chatList[i].senderType;
          }
          // console.log(receiverInfo);
          let receiver;
          if (receiverInfo.receiverType == "user") {
            receiver = await User.findById(receiverInfo.receiverId);
          } else {
            receiver = await User.findById(receiverInfo.receiverId);
          }
          // console.log("+++++++++++++", receiverInfo);
          // console.log("#########", receiver._id);
          if (receiver) {
            list.push({
              receiverId: receiver._id,
              name: receiver.name,
              email: receiver.email,
              isOnline: receiver.isOnline,
              lastSeen: receiver.lastSeen,
              profileImage: receiver.profileImage
                ? receiver.profileImage
                : null,
              receiverType: receiverInfo.receiverType,
              roomId: chatList[i].roomId,
              messageType: chatList[i].messageType,
              lastMessage: chatList[i].lastMessage,
            });
          }
        }
        // console.log(list);
        //join login user with socket
        socket.join(data.userId);
        // console.log(chatUsers);
        io.to(data.userId).emit("chatUserList", {
          status: 200,
          message: "user chat list",
          result: list,
        });
      } catch (error) {
        console.log(error);
      }
    }

    /************************ Agora Start ************************************/
    socket.on("agoraTokennew", async (data) => {
      try {
        console.log("3432424234++++++++++++++++++++++++++++++++");

        // io.to(data.roomId).emit("agoraToken", response(1, "Success", data));
      } catch (error) {
        console.log("error message", error.message);
        socket.join(socket.userId);
        io.to(socket.userId).emit(
          "internalServer_error",
          response(500, error.message)
        );
      }
    });
    socket.on("agoraToken", async (data) => {
      try {
        console.log("3432424234++++++++++++++++++++++++++++++++");

        data.senderId = socket.userId;
        const { userId, receiverId, roomId, messageType, uid = "0" } = data;
        if (receiverId == "" || roomId == "") {
          socket.join(socket.userId);
          io.to(socket.userId).emit(
            "invalidData",
            response(0, "All field is required")
          );
        }
        console.log("data messages Type",data);
        // 3->audio, 4->video
        // if (![3, 4].includes(messageType)) {
        //   socket.join(socket.userId);
        //   io.to(socket.userId).emit(
        //     "invalidData",
        //     response(0, "please send valid massage type")
        //   );
        // }
        const channelName = "Godide" + Math.floor(Math.random() * 1000000 + 1);
        const role = messageType === 4 ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

        const token = await generateRtcToken(
          APP_ID,
          APP_CERTIFICATE,
          channelName,
          role,
          uid
        );
        console.log("Tokennnnnnnnnnnnnnnnnnnnnn", token);
        console.log("channelNameeeeeeeeeeeeeeee", channelName);

        const blockUser = await Chat.findOne({ roomId: roomId });

        const chatMessageId = await query.saveMessage(data, blockUser);
        const sender = await query.findSender(socket.userId);
        const reciver = await query.findSender(receiverId);
        console.log("3333333333333333333333", reciver);
        console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@", sender);

        data.chatMessageId = chatMessageId._id;
        data.senderId = {
          senderId: sender._id,
          name: sender.name,
          image: sender.image ? sender.image : "",
        };
        data.reciverData = {
          reciverId: reciver._id,
          name: reciver.name,
          image: reciver.image ? sender.image : "",
        };
        let msg = {
          callStatus: "queued",
          duration: 0,
          channelName,
          callToken: token,
          senderName: sender.name,
          senderImage: sender.userImage ? sender.userImage : "",
          recieverName: reciver.name,
          recieverImage: reciver.userImage ? reciver.userImage : "",
        };
        console.log("%%%%%%%%%%%%%%%%%%%%%", msg);
        data = { ...msg, ...data };

        // if (blockUser) {
        //   socket.join(socket.userId);
        //   io.to(socket.userId).emit(
        //     "invalidData",
        //     response(0, "The user you blocked cannot send messages")
        //   );
        // }

        try {
          // console.log("socket users", data);
          await helper.sendNotification(
            "Incoming call",
            receiverId,
            socket.userId,
            "Call",
            "user",
            data,
            "agoraToken"
          );
        } catch (error) {
          console.log("error in send notification in agora token", error);
        }

        socket.join(data.roomId);
        io.to(data.roomId).emit("agoraToken", response(1, "Success", data));
      } catch (error) {
        console.log("error message", error.message);
        socket.join(socket.userId);
        io.to(socket.userId).emit(
          "internalServer_error",
          response(500, error.message)
        );
      }
    });
    socket.on("acceptedCall", async (data) => {
      try {
        let { chatMessageId, roomId, messageType } = data;
        console.log(socket.handshake.query.userId, "data+++++++");
        const userId = socket.handshake.query.userId;
        if (chatMessageId == "" || roomId == "") {
          socket.join(userId);
          io.to(userId).emit("invalidData", {
            status: 422,
            message: "All field is required",
          });
        }
        console.log("data messages Type",data);
        
        // if (![3, 4].includes(messageType)) {
        //   socket.join(userId);
        //   io.to(userId).emit(
        //     "invalidData",
        //     response(0, "please send valid massage type")
        //   );
        // }
        await query.updateCallMessage(
          chatMessageId,
          roomId,
          "accepted",
          messageType
        );
        socket.join(data.roomId);
        io.to(data.roomId).emit(
          "acceptedCall",
          {
            status: 200,
            message: "Call accepted",
          }
          // response(1, "Call accepted")
        );
      } catch (error) {
        socket.join(userId);
        io.to(userId).emit(
          "internalServer_error",
          {
            status: 500,
            message: error.message,
          }
          // response(500, error.message)
        );
        console.log(error.message);
      }
    });
    socket.on("rejectCall", async (data) => {
      try {
        const { chatMessageId, roomId, rejectedBy = "", receiverId } = data;

        if (chatMessageId == "" || roomId == "") {
          socket.join(socket.userId);
          io.to(socket.userId).emit(
            "invalidData",
            response(0, "All field is required")
          );
        }

        await query.updateCallMessage(chatMessageId, roomId, "rejected");

        let chat = await Chat.findOne({ roomId: roomId }).lean();

        try {
          let userId =
            chat.senderId.toString() === receiverId
              ? chat.senderId
              : chat.receiverId; //: chat.senderId
          let senderId =
            chat.senderId.toString() === receiverId
              ? chat.senderId
              : chat.receiverId;
          await helper.sendNotification(
            `You have a missed call`,
            userId,
            senderId,
            "Call",
            "user"
          );
        } catch (error) {
          console.log("error in send notification in agora token", error);
        }

        socket.join(data.roomId);

        io.to(data.roomId).emit("acceptedCall", response(4, "Call   "));
      } catch (error) {
        socket.join(socket.userId);
        io.to(socket.userId).emit(
          "internalServer_error",
          response(500, error.message)
        );
      }
    });
    socket.on("noAnswerCall", async (data) => {
      try {
        const { chatMessageId, receiverId, userId, roomId } = data;

        if (chatMessageId == "" || roomId == "") {
          socket.join(socket.userId);
          io.to(socket.userId).emit(
            "invalidData",
            response(0, "All field is required")
          );
        }

        await query.updateCallMessage(chatMessageId, roomId, "missed");

        let messageList = await query.chatMessageList(data);
        messageList.forEach((data) => {
          if (data.senderId.image !== "") {
            data.senderId.image = data.senderId.image
              ? data.senderId.image
              : "";
          }
        });
        const sender = await query.findSender(socket.userId);
        try {
          await helper.sendNotification(
            `You have a missed call from ${sender.name}`,
            receiverId,
            socket.userId,
            "Call",
            "user"
          );
        } catch (error) {
          console.log("error in send notification in agora token", error);
        }

        socket.join(roomId);

        io.to(roomId).emit(
          "receiveMessages",
          response(1, "chat message list", { message: messageList })
        );
      } catch (error) {
        socket.join(socket.userId);
        io.to(socket.userId).emit(
          "internalServer_error",
          response(500, error.message)
        );
      }
    });
    socket.on("endedCall", async (data) => {
      try {
        const { chatMessageId, receiverId, roomId } = data;

        if (chatMessageId == "" || roomId == "") {
          socket.join(socket.userId);
          io.to(socket.userId).emit(
            "invalidData",
            response(0, "All field is required")
          );
        }

        await query.updateCallMessage(chatMessageId, roomId, "ended");

        try {
          await helper.sendNotification(
            `Call ended`,
            receiverId,
            socket.userId,
            "Call",
            "user"
          );
          await helper.sendNotification(
            `Call ended`,
            socket.userId,
            receiverId,
            "Call",
            "user"
          );
        } catch (error) {
          console.log("error in send notification in agora token", error);
        }

        socket.join(roomId);

        io.to(roomId).emit("endedCall", response(5, "chat message list", {}));
      } catch (error) {
        socket.join(socket.userId);
        io.to(socket.userId).emit(
          "internalServer_error",
          response(500, error.message)
        );
      }
    });
  });
};
const response = (status, message, data = {}) => {
  return {
    status: status,
    message: message,
    result: data,
  };
};
const generateRtcToken = async (
  appId,
  appCertificate,
  channelName,
  role,
  uid
) => {
  // Rtc Examples
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  // Build token with uid
  const tokenA = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    expirationTimeInSeconds,
    privilegeExpiredTs
  );
  return tokenA;
};
