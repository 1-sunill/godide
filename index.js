const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
require("dotenv").config();
const port = process.env.PORT;
const fileUpload = require("express-fileupload");
const bodyParser = require("body-parser");
app.use(bodyParser.json());
const config = require("./config/dbconnect");
const expressWinston = require("express-winston");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const i18n = require("i18n");
const acceptLanguageParser = require("accept-language-parser");
const swaggerUI = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");

app.use(express.urlencoded({ extended: false }));
// Middleware
//*****Swagger api doc***/
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Godide",
      version: "1.0.0",
    },
    servers: [
      {
        url: process.env.BASE_URL,
      },
    ],
  },
  apis: ["./routes/*.js"], //your route folder
};

// Set the views folder and use EJS as the template engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const swaggerDocument = require("./driver-swagger.json");
const swaggerDocumentProvider = require("./rider-swagger-provider.json");
app.use(
  "/driver-api-docs",
  function (req, res, next) {
    swaggerDocument.host = req.get("host");
    req.swaggerDoc = swaggerDocument;
    next();
  },
  swaggerUI.serveFiles(swaggerDocument, options),
  swaggerUI.setup()
);
app.use(
  "/rider-api-docs",
  function (req, res, next) {
    swaggerDocumentProvider.host = req.get("host");
    req.swaggerDoc = swaggerDocumentProvider;
    next();
  },
  swaggerUI.serveFiles(swaggerDocumentProvider, options),
  swaggerUI.setup()
);
app.use("/uploads", express.static("uploads"));

app.use(cors());
app.use(async (req, res, next) => {
  const languages = acceptLanguageParser.parse(req.headers["accept-language"]);

  const language = languages && languages.length ? languages[0].code : "en";
  console.log(language);
  // Set the locale for the request
  await i18n.configure({
    locales: [
      "zu",
      "af",
      "sw",
      "pt",
      "ar",
      "fr",
      "zh-CN",
      "ru",
      "es",
      "bn",
      "ja",
      "id",
      "de",
      "vi",
      "te",
      "tr",
      "mr",
      "st",
      "pcm",
      "ta",
      "ro",
      "pl",
      "uk",
      "it",
      "ko",
      "th",
      "fil",
      "nl",
      "en",
      "hi",
    ],
    directory: __dirname + "/locales",
    defaultLocale: language,
  });

  next(); // Proceed to the next middleware
});
// Routes
// app.use(express.json());
app.use(fileUpload());
//Start logger code
// const requestLogger = expressWinston.logger({
//   transports: [
//     new winston.transports.Console(), // Log to the console for development
//     new DailyRotateFile({
//       filename: "logs/%DATE%/info.log",
//       datePattern: "YYYY-MM-DD",
//       zippedArchive: true,
//       maxSize: "20m",
//       maxFiles: "14d",
//       level: "info",
//     }),
//     new DailyRotateFile({
//       filename: "logs/%DATE%/error.log",
//       datePattern: "YYYY-MM-DD",
//       zippedArchive: true,
//       maxSize: "20m",
//       maxFiles: "14d",
//       level: "error",
//     }),
//     new DailyRotateFile({
//       filename: "logs/%DATE%/warn.log",
//       datePattern: "YYYY-MM-DD",
//       zippedArchive: true,
//       maxSize: "20m",
//       maxFiles: "14d",
//       level: "warn",
//     }),
//   ],
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   meta: true, // Disable logging metadata (such as response time)
//   msg: "HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}}",
//   expressFormat: true,
//   colorize: false,
//   // skip: skipLoggerForBaseURL, // Skip logging for base URL
// });

// // Attach the request logger middleware to all routes
// app.use(requestLogger);
//end logger code

require("./route/index")(app);

require("./app/helper/globalCrypto");
// Start server
// app.listen(port, function () {
//   console.log(`Server is started, port: ${port}`);
//   config();
// });

var httpsServer = require("http").createServer(app);
const socket = require("socket.io");
const io = socket(httpsServer, {
  cors: {
    origin: "*",
  },
});
require("./services/booking")(io);
require("./services/chat")(io);

httpsServer.listen(process.env.PORT, () => {
  console.log(
    "HTTP Server is up and running on port numner " + process.env.PORT
  );
});
