'use strict';

const CommentBot = require('./../lib/CommentBot');
const CommonProcess = require('./../lib/CommonProcess');

module.exports = (request, response, next) => {
  const commentBot = new CommentBot(request.params);
  const fields = request.query.fields || request.body.fields;
  const options = request.query.options || request.body.options || {};

  commentBot.setConfigPath();

  return commentBot.processEmail(fields, options).then(data => {
    return CommonProcess.sendResponse(response, {
      redirect: data.redirect,
      fields: data.fields
    });
  }).catch(error => CommonProcess.sendResponse(response, {
    error: error,
    redirect: request.body.options && request.body.options.redirect,
    redirectError: request.body.options && request.body.options.redirectError
  }));
};
