'use strict';

const Recaptcha = require('express-recaptcha').RecaptchaV2;

const CommentBot = require('./../lib/CommentBot');

function checkRecaptcha (commentBot, request) {
  return new Promise((resolve, reject) => {
    commentBot.getSiteConfig().then(siteConfig => {
      if (!siteConfig.get('reCaptcha.enabled')) {
        return resolve(false);
      }

      const reCaptchaOptions = request.body.options && request.body.options.reCaptcha;

      if (!reCaptchaOptions || !reCaptchaOptions.siteKey || !reCaptchaOptions.secret) {
        return reject(commentBot.logAndGetError('Missing recaptcha credentials.'));
      }

      let decryptedSecret;

      try {
        decryptedSecret = commentBot.decrypt(reCaptchaOptions.secret);
      } catch (error) {
        console.error('Recaptcha decryption error:', error.message);
        return reject(error);
      }

      if (
        reCaptchaOptions.siteKey !== siteConfig.get('reCaptcha.siteKey') ||
        decryptedSecret !== siteConfig.get('reCaptcha.secret')
      ) {
        return reject(commentBot.logAndGetError('Recaptcha mismatch.'));
      }

      const reCaptcha = new Recaptcha(reCaptchaOptions.siteKey, decryptedSecret);
      reCaptcha.verify(request, error => {
        if (error) {
          console.error('Recaptcha verification error:', error.message);
          return reject(error);
        }

        return resolve(true);
      });

      return null;
    }).catch(error => {
      console.error('Recaptcha error:', error.message);
      reject(error);
    });
  });
}

function createConfigObject (property) {
  let remoteConfig = {};

  remoteConfig.file = '_comment-bot.yml';
  remoteConfig.path = property || '';

  return remoteConfig;
}

function process (commentBot, request, response) {
  const fields = request.query.fields || request.body.fields;
  const options = request.query.options || request.body.options || {};

  return commentBot.processEntry(fields, options).then(data => {
    return sendResponse(response, {
      redirect: data.redirect,
      fields: data.fields
    });
  });
}

function sendResponse (response, data) {
  const error = data && data.error;
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

  if (error) {
    if (error.message) {
      payload.message = error.message;
    }

    if (error.data) {
      payload.data = error.data;
    }

    if (error) {
      payload.rawError = error;
    }
  } else {
    payload.fields = data.fields;
  }

  return response.status(statusCode).send(payload);
}

module.exports = (request, response, next) => {
  const commentBot = new CommentBot(request.params);

  commentBot.setConfigPath();

  return checkRecaptcha(commentBot, request)
    .then(() => process(commentBot, request, response))
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
