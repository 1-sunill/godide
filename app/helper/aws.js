const AWS = require("aws-sdk");
const { S3 } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const path = require("path");
const { v4 } = require("uuid");
const fs = require("fs");

exports.aws = async function (file, folderName = null) {
  try {
    // console.log(process.env.AWS);
    if (process.env.AWS == "true") {
      const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        region: process.env.AWS_BUCKET_REGION || "ap-south-1",
      });

      const ext = path.extname(file.name);
      let imgPath = "";

      if (folderName) {
        imgPath = "godide/" + folderName + "/" + Date.now() + ext;
      } else {
        imgPath = "godide/" + Date.now() + ext;
      }

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: imgPath,
        Body: file.data,
      };

      return new Promise((resolve, reject) => {
        s3.upload(params, function (err, data) {
          if (err) {
            console.log("Error uploading to S3:", err);
            return reject(err);
          }
          console.log("File uploaded successfully:", data.Location);
          resolve(data);
        });
      });
    } else {
      var ext = path.extname(file.name);

      let fileName = v4() + Date.now() + ext;
      var base_path = __basedir;
      const folderPath = path.join(base_path, "uploads", "images", folderName);

      // Check if the folder exists, and create it if it doesn't
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      file.mv(base_path + `/uploads/images/${folderName}/` + fileName);
      // file.mv(base_path + "/storage/images/" + fileName);

      return {
        Key: folderName + "/" + fileName,
      };
    }
    // const getObjectResult = await client.getObject({
    //     Bucket: process.env.AWS_BUCKET_NAME,
    //     Key: "svr/" + Date.now() + ext,
    //     Body: file.data
    // });
    // return new Promise((resolve, reject) => {
    //     s3.upload(params, function (err, data) {
    //         if (err) {
    //             return Promise.reject(err);
    //         }
    //         return resolve(data);
    //     });
    // }).catch((err) => {
    //     console.log(err);
    //     return Promise.reject(err);
    // });
  } catch (error) {
    console.log("error", error);
  }
};
