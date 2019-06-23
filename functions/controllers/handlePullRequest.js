'use strict';

const CommentBot = require('./../lib/CommentBot');
const GitHub = require('./../lib/GitHub');

module.exports = (repo, data) => {
  if (!data.number) {
    return;
  }

  const github = new GitHub({
    username: data.repository.owner.login,
    repository: repo
  });

  // eslint-disable-next-line consistent-return
  return github.getReview(data.number).then(review => {
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
          // eslint-disable-next-line promise/no-nesting
          commentBot.processMerge(parsedBody.fields, parsedBody.options)
            .catch(error => Promise.reject(error));
        } catch (error) {
          console.error('Error processing merge:', error.message);
          return Promise.reject(error);
        }
      }
    }

    return github.deleteBranch(review.sourceBranch);
  }).catch(error => {
    console.error('Error getting review:', error.message);
    return Promise.reject(error);
  });
};
