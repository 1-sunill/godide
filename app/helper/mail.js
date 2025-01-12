const nodemailer = require("nodemailer");
const USER = process.env.MAIL_USER;
const PASSWORD = process.env.MAIL_PASSWORD;
const mail = (req) => {
  // console.log(req.to); return 1;
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: USER,
      pass: PASSWORD,
    },
  });
  var mailOptions = {
    from: USER,
    to: req.to,
    subject: req.subject ? req.subject : "Test Subject",
    text: req.text ? req.text : "Test Body",
    html: req.html ? req.html : "<h1>Test HTML</h1>",
  };

  let resp = false;

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      resp = false;
    } else {
      console.log(2);
      resp = true;
    }
  });
  return resp;
};

module.exports = mail;
