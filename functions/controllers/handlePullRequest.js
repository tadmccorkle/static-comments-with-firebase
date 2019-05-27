/* eslint-disable promise/no-nesting */
/* eslint-disable consistent-return */
'use strict';

const CommentBot = require('./../lib/CommentBot');
const GitHub = require('./../lib/GitHub');
const config = require('./../config');

module.exports = (repo, data) => {
  if (!data.number) {
    return;
  }

  const github = new GitHub({
    username: data.repository.owner.login,
    repository: data.repository.name,
    token: config.get('githubToken')
  });

  return github.getReview(data.number).then((review) => {
    if (review.sourceBranch.indexOf('comment-bot_')) {
      return null;
    }

    if (review.state !== 'merged' && review.state !== 'closed') {
      return null;
    }

    if (review.state === 'merged') {
      const bodyMatch = review.body.match(/(?:.*?)<!--comment-bot_notification:(.+?)-->(?:.*?)/i);

      if (bodyMatch && (bodyMatch.length === 2)) {
        try {
          const parsedBody = JSON.parse(bodyMatch[1]);
          const commentBot = new CommentBot(parsedBody.parameters);

          commentBot.setConfigPath(parsedBody.configPath);
          commentBot.processMerge(parsedBody.fields, parsedBody.options)
            .catch(error => Promise.reject(error));
        } catch (error) {
          return Promise.reject(error);
        }
      }
    }

    return github.deleteBranch(review.sourceBranch);
  }).then(response => {
    return response;
  }).catch(error => {
    console.log(error.stack || error);

    return Promise.reject(error);
  });
};
