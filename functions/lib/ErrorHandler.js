'use strict';

const { StatusCodeError, RequestError } = require('request-promise/errors');

class ApiError {
  constructor (message, statusCode = 500, smErrorCode = '') {
    this.message = message;
    this.statusCode = statusCode;
    this._smErrorCode = smErrorCode;
  }

  toJSON () {
    return {
      message: this.message,
      statusCode: this.statusCode
    };
  }
}

const ErrorHandler = function () {
  this.ERROR_MESSAGES = {
    'missing-input-secret': 'reCAPTCHA: The secret parameter is missing',
    'invalid-input-secret': 'reCAPTCHA: The secret parameter is invalid or malformed',
    'missing-input-response': 'reCAPTCHA: The response parameter is missing',
    'invalid-input-response': 'reCAPTCHA: The response parameter is invalid or malformed',
    'RECAPTCHA_MISSING_CREDENTIALS': 'Missing reCAPTCHA API credentials',
    'RECAPTCHA_FAILED_DECRYPT': 'Could not decrypt reCAPTCHA secret',
    'RECAPTCHA_CONFIG_MISMATCH': 'reCAPTCHA options do not match Comment Bot config',
    'PARSING_ERROR': 'Error whilst parsing config file',
    'GITHUB_AUTH_TOKEN_MISSING': 'The site requires a valid GitHub authentication token to be supplied in the `options[github-token]` field'
  };

  this.ERROR_CODE_ALIASES = {
    'missing-input-secret': 'RECAPTCHA_MISSING_INPUT_SECRET',
    'invalid-input-secret': 'RECAPTCHA_INVALID_INPUT_SECRET',
    'missing-input-response': 'RECAPTCHA_MISSING_INPUT_RESPONSE',
    'invalid-input-response': 'RECAPTCHA_INVALID_INPUT_RESPONSE'
  };
};

ErrorHandler.prototype.getErrorCode = function (error) {
  return this.ERROR_CODE_ALIASES[error] || error;
};

ErrorHandler.prototype.getMessage = function (error) {
  return this.ERROR_MESSAGES[error];
};

ErrorHandler.prototype.log = function (error, instance) {
  let parameters = {};
  let prefix = '';

  if (instance) {
    parameters = instance.getParameters();

    prefix += `${parameters.username}/${parameters.repository}`;
  }

  console.log(`${prefix}`, error);
};

ErrorHandler.prototype._save = function (errorCode, data = {}) {
  const {error} = data;

  if (error) {
    error._smErrorCode = error._smErrorCode || errorCode;

    // Re-wrap API request errors as these could expose
    // request/response details that the user should not
    // be allowed to see e.g. access tokens.
    // `request-promise` is the primary offender here,
    // but we similarly do not want others to leak too.
    if (
      error instanceof StatusCodeError ||
      error instanceof RequestError
    ) {
      const statusCode = error.statusCode || error.code;

      return new ApiError(error.message, statusCode, error._smErrorCode);
    }

    return error;
  }

  let payload = {
    _smErrorCode: errorCode
  };

  if (data.data) {
    payload.data = data.data;
  }

  return payload;
};

const errorHandler = new ErrorHandler();

module.exports = function () {
  return errorHandler._save.apply(errorHandler, arguments);
};

module.exports.getInstance = function () {
  return errorHandler;
};

module.exports.ApiError = ApiError;
