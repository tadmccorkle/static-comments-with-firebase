/* eslint-disable promise/always-return */
'use strict';

const reCaptcha = require('express-recaptcha');
const universalAnalytics = require('universal-analytics');

const CommentBot = require('./../lib/CommentBot');
const config = require('./../config');
const errorHandler = require('./../lib/ErrorHandler');

function checkRecaptcha (commentBot, request) {
  return new Promise((resolve, reject) => {
    commentBot.getSiteConfig().then(siteConfig => {
      if (!siteConfig.get('reCaptcha.enabled')) {
        return resolve(false);
      }

      const reCaptchaOptions = request.body.options && request.body.options.reCaptcha;

      if (!reCaptchaOptions || !reCaptchaOptions.siteKey || !reCaptchaOptions.secret) {
        return reject(errorHandler('RECAPTCHA_MISSING_CREDENTIALS'));
      }

      let decryptedSecret;

      try {
        decryptedSecret = commentBot.decrypt(reCaptchaOptions.secret);
      } catch (error) {
        return reject(errorHandler('RECAPTCHA_CONFIG_MISMATCH'));
      }

      if (
        reCaptchaOptions.siteKey !== siteConfig.get('reCaptcha.siteKey') ||
        decryptedSecret !== siteConfig.get('reCaptcha.secret')
      ) {
        return reject(errorHandler('RECAPTCHA_CONFIG_MISMATCH'));
      }

      reCaptcha.init(reCaptchaOptions.siteKey, decryptedSecret);
      reCaptcha.verify(request, error => {
        if (error) {
          return reject(errorHandler(error));
        }

        return resolve(true);
      });
    }).catch(error => reject(error));
  });
}

function createConfigObject (property) {
  let remoteConfig = {};

  remoteConfig.file = '_comment-bot.yml';
  remoteConfig.path = property || '';

  return remoteConfig;
}

function process (commentBot, request, response) {
  const ua = config.get('analytics.uaTrackingId')
    ? universalAnalytics(config.get('analytics.uaTrackingId'))
    : null;
  const fields = request.query.fields || request.body.fields;
  const options = request.query.options || request.body.options || {};

  return commentBot.processEntry(fields, options).then(data => {
    sendResponse(response, {
      redirect: data.redirect,
      fields: data.fields
    });

    if (ua) {
      ua.event('Entries', 'New entry').send();
    }
  });
}

function sendResponse (response, data) {
  const error = data && data.err;
  const statusCode = error ? 500 : 200;

  if (!error && data.redirect) {
    return response.redirect(data.redirect);
  }

  if (error && data.redirectError) {
    return response.redirect(data.redirectError);
  }

  let payload = {
    success: !error
  };

  if (error && error._smErrorCode) {
    const errorCode = errorHandler.getInstance().getErrorCode(error._smErrorCode);
    const errorMessage = errorHandler.getInstance().getMessage(error._smErrorCode);

    if (errorMessage) {
      payload.message = errorMessage;
    }

    if (error.data) {
      payload.data = error.data;
    }

    if (error) {
      payload.rawError = error;
    }

    payload.errorCode = errorCode;
  } else {
    payload.fields = data.fields;
  }

  response.status(statusCode).send(payload);
}

module.exports = (request, response, next) => {
  const commentBot = new CommentBot(request.params);

  commentBot.setConfigPath();
  commentBot.setIp(request.headers['x-forwarded-for'] || request.connection.remoteAddress);
  commentBot.setUserAgent(request.headers['user-agent']);

  return checkRecaptcha(commentBot, request)
    .then(usedRecaptcha => process(commentBot, request, response))
    .catch(error => sendResponse(response, {
      error: error,
      redirect: request.body.options && request.body.options.redirect,
      redirectError: request.body.options && request.body.options.redirectError
    }));
};

module.exports.checkRecaptcha = checkRecaptcha;
module.exports.createConfigObject = createConfigObject;
module.exports.process = process;
module.exports.sendResponse = sendResponse;
