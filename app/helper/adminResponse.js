const { response } = require("express");
const i18n = require("i18n");


// Response functions

// Failed response when any data search or conditions
exports.failed = function (res, message = "Failed") {
  const response = {
    code: 400,
    message: i18n.__(message),
  };
  res.json((response));
};

// Validation error
exports.validateFail = function (res, validate) {
  const errors = validate.errors;
  const errorKeys = Object.keys(errors)[0];
  const err = errors[errorKeys]["message"];
  const response = {
    code: 422,
    message: err,
  };
  res.status(422).json((response));
};

// When successfully data is retrieved
exports.success = function (res, message = "Success", data) {
  const response = {
    code: 200,
    message: i18n.__(message),
    data: data,
  };
 res.json((response));
};

// Catch error
exports.serverError = function (res, message = "Internal server error") {
  const response = {
    code: 500,
    message: i18n.__(message),
  };
  res.status(500).json((response));
};

// When User token expired or not found
exports.unauthorized = function (
  res,
  message = "Access denied, no token found."
) {
  const response = {
    code: 401,
    message: i18n.__(message),
  };
  res.status(401).json((response));
};
// When Admin Inactive the user status
exports.inActiveUser = function (
  res,
  message = "Your account is inactive.Please contact with admin."
) {
  const response = {
    code: 402,
    message: i18n.__(message),
  };
  res.status(402).json((response));
};
  