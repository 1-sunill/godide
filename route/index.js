const rider = require("../route/rider");
const driver = require("../route/driver");
const admin = require("../route/admin");
const other = require("../route/other");
module.exports = function (app) {
  app.use("/api/rider", rider);
  app.use("/api/driver", driver);
  app.use("/api", other);
  app.use("/admin", admin);
};
