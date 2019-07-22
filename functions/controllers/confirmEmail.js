'use strict';

const CommentBot = require('./../lib/CommentBot');

module.exports = (request, response) => {
  request.connection.setTimeout(60 * 1000); // prevent duplicate requests

  const commentBot = new CommentBot(request.params);
  const emailHash = request.params.emailhash;
  const email = request.params.email;

  commentBot.setConfigPath();

  if (request.params.entry) {
    const entryHash = request.params.entry;

    return commentBot.confirmEmailForEntry(entryHash, email, emailHash).then(() => {
      return response.send('Your email has been confirmed.');
    }).catch(error => {
      console.error('Error confirming email for entry:', error.message);
      response.status(500).send('Could not confirm email.');
    });
  } else {
    return commentBot.confirmEmail(email, emailHash).then(() => {
      return response.send('Your email has been confirmed.');
    }).catch(error => {
      console.error('Error confirming email:', error.message);
      response.status(500).send('Could not confirm email.');
    });
  }
};
