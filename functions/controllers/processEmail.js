'use strict';

const CommentBot = require('./../lib/CommentBot');
const CommonProcess = require('./../lib/CommonProcess');

function processEmail (commentBot, request, response) {
  const fields = request.query.fields || request.body.fields;
  const options = request.query.options || request.body.options || {};

  return commentBot.processEmail(fields, options).then(data => {
    return CommonProcess.sendResponse(response, {
      redirect: data.redirect,
      fields: data.fields
    });
  });
}

module.exports = (request, response, next) => {
  const commentBot = new CommentBot(request.params);

  commentBot.setConfigPath();

  return CommonProcess.checkRecaptcha(commentBot, request, false)
    .then(() => processEmail(commentBot, request, response))
    .catch(error => CommonProcess.sendResponse(response, {
      error: error,
      redirect: request.body.options && request.body.options.redirect,
      redirectError: request.body.options && request.body.options.redirectError
    }));
};

module.exports.processEmail = processEmail;
