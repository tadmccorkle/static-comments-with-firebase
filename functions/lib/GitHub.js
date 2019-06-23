'use strict';

const Octokit = require('@octokit/rest');
const yaml = require('js-yaml');

const config = require('./../config');
const Review = require('./models/Review');

const normalizeResponse = ({ data }) => data;

class GitHub {
  constructor (options = {}) {
    this.username = options.username;
    this.repository = options.repository;
    this.branch = options.branch;

    this.git = Octokit({
      auth: config.get('githubToken'),
      userAgent: 'Comment Bot v1.0',
      baseUrl: config.get('githubBaseUrl')
    });
  }

  getBranchHeadCommit (branch) {
    return this.git.repos.getBranch({
      owner: this.username,
      repo: this.repository,
      branch
    })
      .then(res => res.data.commit.sha);
  }

  createBranch (branch, sha) {
    return this.git.git.createRef({
      owner: this.username,
      repo: this.repository,
      ref: `refs/heads/${branch}`,
      sha
    })
      .then(normalizeResponse);
  }

  deleteBranch (branch) {
    return this.git.git.deleteRef({
      owner: this.username,
      repo: this.repository,
      ref: `heads/${branch}`
    });
  }

  createReview (reviewTitle, branch, reviewBody) {
    return this.git.pulls.create({
      owner: this.username,
      repo: this.repository,
      title: reviewTitle,
      head: branch,
      base: this.branch,
      body: reviewBody
    })
      .then(normalizeResponse);
  }

  getReview (reviewId) {
    return this.git.pulls.get({
      owner: this.username,
      repo: this.repository,
      pull_number: reviewId
    })
      .then(normalizeResponse)
      .then(({base, body, head, merged, state, title}) => new Review(
        title,
        body,
        (merged && state === 'closed') ? 'merged' : state,
        head.ref,
        base.ref
      ));
  }

  readFile (filePath, getFullResponse) {
    return this._readFile(filePath, getFullResponse).catch(error => {
      console.error('Error reading file:', error.message);
    });
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

        console.error('Error formatting file contents:', error.message);

        return Promise.reject(errorData);
      }
    });
  }

  _pullFile (filePath, branch) {
    return this.git.repos.getContents({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      ref: branch
    })
      .then(normalizeResponse)
      .catch(error => {
        console.error('Error getting file contents:', error.message);
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
            console.error('Error - File already exists.');
          }
        }
      } catch (tryError) {
        console.error('Sha supplied.');
      }

      console.error('Error writing file:', error.message);

      return Promise.reject(error);
    });
  }

  _writeFile (filePath, data, branch = this.branch, commitTitle = 'Add Comment Bot file') {
    return this._commitFile(filePath, Buffer.from(data).toString('base64'), commitTitle, branch);
  }

  _commitFile (filePath, content, commitTitle, branch) {
    return this.git.repos.createOrUpdateFile({
      owner: this.username,
      repo: this.repository,
      path: filePath,
      message: commitTitle,
      content: content,
      branch: branch
    })
      .then(normalizeResponse);
  }

  writeFileAndSendReview (filePath, data, branch, commitTitle, reviewBody) {
    return this._writeFileAndSendReview(filePath, data, branch, commitTitle, reviewBody).catch(error => {
      console.error('Error writing file and submitting review:', error.message);
      return Promise.reject(error);
    });
  }

  _writeFileAndSendReview (filePath, data, branch, commitTitle = 'Add Comment Bot file', reviewBody = '') {
    return this.getBranchHeadCommit(this.branch)
      .then(sha => this.createBranch(branch, sha))
      .then(() => this.writeFile(filePath, data, branch, commitTitle))
      .then(() => this.createReview(commitTitle, branch, reviewBody));
  }
}

module.exports = GitHub;
