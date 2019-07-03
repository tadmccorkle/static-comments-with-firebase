'use strict';

const Recaptcha = require('express-recaptcha').RecaptchaV2;

module.exports.checkRecaptcha = (commentBot, request, validateConfig = true) => {
  return new Promise((resolve, reject) => {
    commentBot.getSiteConfig(validateConfig).then(siteConfig => {
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
};

module.exports.createConfigObject = property => {
  let remoteConfig = {};

  remoteConfig.file = '_comment-bot.yml';
  remoteConfig.path = property || '';

  return remoteConfig;
};

module.exports.sendResponse = (response, data) => {
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
};
