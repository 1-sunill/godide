var mongoose = require("mongoose");
require("dotenv").config();

//use env variable here.. /;
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const server = process.env.DB_SERVER;
const dbport = process.env.DB_PORT;
const database = process.env.DB_NAME;

// connect database code /;

//
class Database {
  constructor() {
    this._connect();
  }
  _connect() {
    mongoose
      .connect(`mongodb://${server}:${dbport}/${database}`, {
        auth: {
          username: username,
          password: password,
        },
        useUnifiedTopology: true,
        useNewUrlParser: true,
        // seCreateIndex: true,
        keepAlive: true,
        //useFindAndModify: false,
      })
      .then(() => {
        console.log(
          "Database connected successfully==" +
            `mongodb://${server}:${dbport}/${database}`
        );
      })
      .catch((err) => {
        console.error("Database connection error::" + err);
      });
  }
}
module.exports = new Database();
