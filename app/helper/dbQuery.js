const userModel = require("../../models/User");
const chatModel = require("../../models/Chat");
const chatMessageModel = require("../../models/ChatMessage");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
require("dotenv").config();
module.exports = {
  findChat: async (data) => {
    try {
      return await chatModel
        .findOne({
          $or: [
            {
              senderId: data.senderId,
              receiverId: data.receiverId,
            },
            {
              receiverId: data.senderId,
              senderId: data.receiverId,
            },
          ],
        })
        .populate("senderId", { name: 1, image: 1, role: 1 })
        .populate("receiverId", { name: 1, image: 1, role: 1 });
    } catch (error) {
      throw new Error(error.message);
    }
  },
  chatList: async (data) => {
    try {
      let Query = {};
      const { userId, isRequestedChatList = false } = data;
      Query = {
        $or: [
          {
            senderId: new ObjectId(userId),
          },
          {
            receiverId: new ObjectId(userId),
          },
        ],
        lastMessage: { $ne: null },
        status: 1,
      };
      if (isRequestedChatList) {
        Query = {
          receiverId: new ObjectId(userId),
          isAccepeted: false,
          status: 1,
        };
      }
      return await chatModel
        .find(Query)
        .populate("senderId", { name: 1, image: 1, role: 1 })
        .populate("receiverId", { name: 1, image: 1, role: 1 })
        .sort({ updatedAt: -1 });
    } catch (error) {
      console.log("error chatList query", error);
      throw new Error(error.message);
    }
  },
  acceptRejectChat: async (data) => {
    try {
      const { roomId, userId, isAccept } = data;
      if (isAccept)
        await chatModel.findOneAndUpdate(
          { _id: roomId, receiverId: userId },
          { $set: { isAccepeted: isAccept } }
        );
      if (!isAccept)
        await chatModel.deleteOne({ _id: roomId, receiverId: userId });
      return isAccept;
    } catch (error) {
      console.log("error in accept Reject Chat query", error);
      throw new Error(error.message);
    }
  },
  saveMessage: async (data, blockUser) => {
    try {
      let { messageType, message, file = [] } = data;

      // Try to parse the file if it's not already an array
      try {
        if (typeof file === "string" && file.length) file = JSON.parse(file);
        data.file = file;
      } catch (error) {
        console.log("File parsing error:", error);
      }

      // Set message for audio (3) and video (4) types
      if ([3, 4].includes(messageType)) {
        data.message = file.length ? file[0] : "";
        message = data.message;
      }

      // Ensure blockUser is an array before using includes method
      if (!Array.isArray(blockUser)) {
        blockUser = [];
      }

      //   console.log(
      //     blockUser.includes(data.senderId.toString()),
      //     ")))))))))))))))))"
      //   );
      //   console.log(data, ")))))))))))))))))");

      // Check if the user is blocked
      // if (blockUser.includes(data.senderId.toString())) {
      //   data.blockUser = [data.senderId];
      // }

      // Create the message in the database
      const createData = await chatMessageModel.create(data);

      // Update the chat with the last message and its details
      await chatModel.findOneAndUpdate(
        { roomId: data.roomId },
        {
          $set: {
            lastMessage: message,
            messageType: messageType,
            seenBy: [data.senderId],
            deletedBy: [],
          },
        }
      );

      return createData;
    } catch (error) {
      console.log("Error in saveMessage:", error);
      throw new Error(error.message);
    }
  },

  findSender: async (_id) => {
    return await userModel.findOne(
      { _id: _id },
      { name: 1, email: 1, image: 1 }
    );
  },
  chatMessageList: async (data) => {
    try {

      // Fetch chat messages that are not deleted by the user
      const message = await chatMessageModel
        .find({
          roomId: data.roomId,
          deletedBy: { $nin: data.userId },
        })
        .populate({
          path: "senderId",
          select: "name image role",
          model: "Users", // Ensure that the model name is correct
        });

    //   // Update seenBy in chatMessageModel
    //   await chatMessageModel.updateMany(
    //     { roomId: data.roomId, seenBy: { $nin: data.userId } },
    //     { $addToSet: { seenBy: data.userId } }
    //   );

    //   // Update seenBy in chatModel
    //   await chatModel.updateOne(
    //     { roomId: data.roomId, seenBy: { $nin: data.userId } },
    //     { $addToSet: { seenBy: data.userId } }
    //   );

      return message;
    } catch (error) {
      console.error("Error in chatMessageList query", error);
      throw new Error(error.message);
    }
  },

  deleteChat: async (data) => {
    try {
      const { roomId, userId } = data;
      await chatMessageModel.updateMany(
        { roomId: new ObjectId(roomId), deletedBy: { $ne: userId } },
        { $addToSet: { deletedBy: userId } }
      );
      await chatModel.findOneAndUpdate(
        { _id: new ObjectId(roomId) },
        { $addToSet: { deletedBy: userId } }
      );
      return true;
    } catch (error) {
      console.log("error in accept Reject Chat query", error);
      throw new Error(error.message);
    }
  },
  updateCallMessage: async (msgId, roomId, callStatus, duration = 0) => {
    try {
      if (callStatus === "ended") {
        const chatData = await chatMessageModel.findOne({
          _id: msgId,
          roomId: roomId,
        });

        duration =
          parseInt((new Date() - new Date(chatData.updatedAt)) / 1000) || 0;
      }

      const update = { callStatus: callStatus, duration: duration };
      console.log("update", roomId);
      console.log("update", msgId);

      await chatMessageModel.findOneAndUpdate(
        { _id: msgId, roomId: roomId },
        update
      );

      return true;
    } catch (error) {
      console.log("error in update Call Message query", error);
      throw new Error(error.message);
    }
  },
};
