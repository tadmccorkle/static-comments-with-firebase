'use strict';

const request = require('request-promise');

const config = require('./../config');
const errorHandler = require('./ErrorHandler');

const requestGitHubAccessToken = (code, clientId, clientSecret, redirectUri) => {
  return request({
    headers: {
      'Accept': 'application/json'
    },
    json: true,
    method: 'POST',
    uri: config.get('githubAccessTokenUri'),
    qs: {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    }
  })
    .then(response => response.access_token)
    .catch(error => Promise.reject(errorHandler('GITHUB_AUTH_FAILED', {error})));
};

module.exports = requestGitHubAccessToken;
