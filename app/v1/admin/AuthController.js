const { Validator } = require("node-input-validator");
const Admin = require("../../../models/Admin");
const User = require("../../../models/User");
const {
  success,
  failed,
  serverError,
  validateFail,
} = require("../../helper/adminResponse");
const mail = require("../../helper/mail");
const bcrypt = require("bcryptjs");
const { base64Decode, base64Encode } = require("../../helper/helpers");
const { ObjectId } = require("mongodb");

module.exports = {
  //admin login
  adminLogin: async (req, res) => {
    try {
      // Validate request body
      let validate = new Validator(req.body, {
        email: "required",
        password: "required",
      });
      const isValid = await validate.check();
      if (!isValid) {
        return validateFail(res, validate);
      }

      // Find admin by email
      const admin = await Admin.findOne({ email: req.body.email });
      if (!admin) {
        return failed(res, "Email is not valid.");
      }

      // Compare passwords
      const isPasswordValid = await bcrypt.compare(
        req.body.password,
        admin.password
      );
      if (!isPasswordValid) {
        return failed(res, "Password is not valid.");
      }
      // Generate JWT token
      const token = await admin.generateToken();

      // Return success response with token
      const data = {
        admin,
        access_token: token,
      };
      return success(res, "Admin login successfully.", data);
    } catch (error) {
      console.error(error);
      return serverError(res, "Internal server error.");
    }
  },
  //forgot password
  forgotPassword: async (req, res) => {
    try {
      // Validate request body
      let validate = new Validator(req.body, {
        email: "required",
      });
      const isValid = await validate.check();
      if (!isValid) {
        return validateFail(res, validate);
      }

      // Find admin by email
      const admin = await Admin.findOne({ email: req.body.email });
      if (!admin) {
        return failed(res, "Email is not valid.");
      }

      if (admin) {
        const url =
          process.env.ADMIN_RESET_PASSWORD +
          base64Encode(admin.email.toLowerCase());
        var mailData = {
          to: req.body.email,
          subject: "Change Password Request",
          text: url,
          html: `<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Password</title>
            </head>
            <body>
              <p>Hi ${admin.name},</p>
            
              <p>To reset your password, please click on the link below:</p>
              <p><a href="${url}">Reset Password Link</a></p>
            
              <p>Thanks & Regards<br>Godide Admin</p>
            </body>
          </html>`,
        };

        mail(mailData);

        success(res, "Password reset email sent.", mailData);
      }
    } catch (error) {
      console.log(error);
      return serverError(res, "Internal server error");
    }
  },
  //Change password
  changePassword: async (req, res) => {
    try {
      const validate = new Validator(req.body, {
        key: "required",
        newPassword: "required",
        confirmPassword: "required|same:newPassword",
      });
      const matched = await validate.check();

      if (!matched) {
        return validateFail(res, validate);
      }

      const { key, newPassword } = req.body;
      const decodedEmail = base64Decode(key);

      const admin = await Admin.findOne({ email: decodedEmail });

      if (!admin) {
        return failed(res, "Email not found.");
      }

      const salt = await bcrypt.genSalt(8);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await Admin.updateOne(
        { email: decodedEmail },
        { password: hashedPassword }
      );

      return success(res, "Password updated successfully.");
    } catch (error) {
      console.error(error); // Log the error for debugging purposes
      return serverError(res, "Internal server error.");
    }
  }
};
   