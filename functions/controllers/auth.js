/* eslint-disable promise/always-return */
/* eslint-disable promise/no-nesting */
'use strict';

const CommentBot = require('./../lib/CommentBot');
const GitHub = require('./../lib/GitHub');
const RSA = require('./../lib/RSA');
const oauth = require('./../lib/OAuth');

module.exports = (request, response) => {
  const commentBot = new CommentBot(request.params);
  commentBot.setConfigPath();

  const requestAccessToken = siteConfig => oauth.requestGitHubAccessToken(
    request.query.code,
    siteConfig.get('githubAuth.clientId'),
    siteConfig.get('githubAuth.clientSecret'),
    siteConfig.get('githubAuth.redirectUri')
  );

  return commentBot.getSiteConfig()
    .then(requestAccessToken)
    .then((accessToken) => {
      const git = new GitHub({
        oauthToken: accessToken
      });

      return git.getCurrentUser()
        .then((user) => {
          response.send({
            accessToken: RSA.encrypt(accessToken),
            user
          });
        });
    })
    .catch((error) => {
      console.log('ERR:', error);

      const statusCode = error.statusCode || 401;

      response.status(statusCode).send({
        statusCode,
        message: error.message
      });
    });
};
