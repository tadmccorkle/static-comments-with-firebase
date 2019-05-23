/* eslint-disable no-empty */
/* eslint-disable no-catch-shadow */
/* eslint-disable promise/always-return */
'use strict';

const githubApi = require('@octokit/rest');
const jsonwebtoken = require('jsonwebtoken');
const yaml = require('js-yaml');

const Review = require('./models/Review');
const User = require('./models/User');
const config = require('./../config');
const errorHandler = require('./ErrorHandler');

const normalizeResponse = ({data}) => data;

class GitHub {
  constructor (options = {}) {
    this.username = options.username;
    this.repository = options.repository;
    this.branch = options.branch;

    this.api = githubApi({
      debug: config.get('env') === 'development',
      baseUrl: config.get('githubBaseUrl'),
      headers: {
        'user-agent': 'Comment Bot Agent'
      },
      timeout: 5000
    });

    const isAppAuth = config.get('githubAppID') &&
      config.get('githubPrivateKey');

    this.authentication = Promise.resolve();

    if (options.oauthToken) {
      this.api.authenticate({
        type: 'oauth',
        token: options.oauthToken
      });
    } else if (isAppAuth) {
      this.authentication = this._authenticate(
        options.username,
        options.repository
      );
    } else {
      throw new Error('Require an `oauthToken` option');
    }
  }

  _authenticate (username, repository) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now,
      exp: now + 60,
      iss: config.get('githubAppID')
    };
    const bearer = jsonwebtoken.sign(payload, config.get('githubPrivateKey'), {
      algorithm: 'RS256'
    });

    this.api.authenticate({
      type: 'app',
      token: bearer
    });

    return this.api.apps.findRepoInstallation({
      owner: username,
      repo: repository
    }).then(({data}) => {
      return this.api.apps.createInstallationToken({
        installation_id: data.id
      });
    }).then(({data}) => {
      this.api.authenticate({
        type: 'token',
        token: data.token
      });
    });
  }

  _pullFile (filePath, branch) {
    return this.authentication.then(() => this.api.repos.getContents({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      ref: branch
    }))
      .then(normalizeResponse)
      .catch(error => Promise.reject(errorHandler('GITHUB_READING_FILE', {error})));
  }

  _commitFile (filePath, contents, commitTitle, branch) {
    return this.authentication.then(() => this.api.repos.createFile({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      message: commitMessage,
      content,
      branch
    }))
      .then(normalizeResponse);
  }

  getBranchHeadCommit (branch) {
    return this.authentication.then(() => this.api.repos.getBranch({
      owner: this.username,
      repo: this.repository,
      branch
    }))
      .then(res => res.data.commit.sha);
  }

  createBranch (branch, sha) {
    return this.authentication.then(() => this.api.git.createRef({
      owner: this.username,
      repo: this.repository,
      ref: `refs/heads/${branch}`,
      sha
    }))
      .then(normalizeResponse);
  }

  deleteBranch (branch) {
    return this.authentication.then(() => this.api.git.deleteRef({
      owner: this.username,
      repo: this.repository,
      ref: `heads/${branch}`
    }));
  }

  createReview (commitTitle, branch, reviewBody) {
    return this.authentication.then(() => this.api.pullRequests.create({
      owner: this.username,
      repo: this.repository,
      title: reviewTitle,
      head: branch,
      base: this.branch,
      body: reviewBody
    }))
      .then(normalizeResponse);
  }

  getReview (reviewId) {
    return this.authentication.then(() => this.api.pullRequests.get({
      owner: this.username,
      repo: this.repository,
      number: reviewId
    }))
      .then(normalizeResponse)
      .then(({base, body, head, merged, state, title}) => new Review(
        title,
        body,
        (merged && state === 'closed') ? 'merged' : state,
        head.ref,
        base.ref
      ));
  }

  getCurrentUser () {
    return this.authentication.then(
      () => this.api.users.getAuthenticated({})
    )
      .then(normalizeResponse)
      .then(
        ({login, email, avatar_url, name, bio, company, blog}) => new User(
          'github', login, email, name, avatar_url, bio, blog, company
        ))
        .catch(err => Promise.reject(errorHandler('GITHUB_GET_USER', {err})));
  }

  readFile (filePath, getFullResponse) {
    return this._readFile(filePath, getFullResponse)
      .catch(err => Promise.reject(errorHandler('GITHUB_READING_FILE', {err})));
  }

  _readFile (filePath, getFullResponse) {
    const extension = filePath.split('.').pop();

    return this._pullFile(filePath, this.branch).then(response => {
      let content = Buffer.from(response.content, 'base64').toString();

      try {
        switch (extension) {
          case 'yml':
          case 'yaml':
            content = yaml.safeLoad(content, 'utf8');
            break;
          case 'json':
            content = JSON.parse(content);
            break;
        }

        return getFullResponse ? {
          content: content,
          file: {
            content: response.content
          }
        } : content;
      } catch (error) {
        let errorData = {
          error
        };

        if (error.message) {
          errorData.data = error.message;
        }

        return Promise.reject(errorHandler('PARSING_ERROR', errorData));
      }
    });
  }

  writeFile (filePath, data, targetBranch, commitTitle) {
    return this._writeFile(filePath, data, targetBranch, commitTitle).catch(error => {
      try {
        const message = error && error.message;

        if (message) {
          const parsedError = JSON.parse(message);

          if (
            parsedError &&
            parsedError.message &&
            parsedError.message.includes('"sha" wasn\'t supplied')
          ) {
            return Promise.reject(errorHandler('GITHUB_FILE_ALREADY_EXISTS', {error: error}));
          }
        }
      } catch (error) {}

      return Promise.reject(errorHandler('GITHUB_WRITING_FILE', {error: error}));
    });
  }

  _writeFile (filePath, data, branch = this.branch, commitTitle = 'Add Comment Bot file') {
    return this._commitFile(filePath, Buffer.from(data).toString('base64'), commitTitle, branch);
  }

  writeFileAndSendReview (filePath, data, branch, commitTitle, reviewBody) {
    return this._writeFileAndSendReview(filePath, data, branch, commitTitle, reviewBody)
      .catch(err => Promise.reject(errorHandler('GITHUB_CREATING_PR', {err})));
  }

  _writeFileAndSendReview (filePath, data, branch, commitTitle = 'Add Comment Bot file', reviewBody = '') {
    return this.getBranchHeadCommit(this.branch)
      .then(sha => this.createBranch(branch, sha))
      .then(() => this.writeFile(filePath, data, branch, commitTitle))
      .then(() => this.createReview(commitTitle, branch, reviewBody));
  }
}

module.exports = GitHub;
