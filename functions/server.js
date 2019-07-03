'use strict';

const GithubWebHook = require('express-github-webhook');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const objectPath = require('object-path');

const config = require('./config');

const API = function () {
  this.server = express();
  this.server.use(bodyParser.json());
  this.server.use(bodyParser.urlencoded({
    extended: true
  }));

  this.controllers = {
    home: require('./controllers/home'),
    encrypt: require('./controllers/encrypt'),
    handlePullRequest: require('./controllers/handlePullRequest'),
    process: require('./controllers/process'),
    processEmail: require('./controllers/processEmail')
  };

  const whitelist = [];
  config.get('allowedOrigins').forEach(item => {
    whitelist.push(item, `http://${item}`, `https://${item}`);
  });
  this.postCors = cors({
    origin: function (origin, callback) {
      if (whitelist.indexOf(origin) !== -1) {
        // eslint-disable-next-line callback-return
        callback(null, true);
      } else {
        // eslint-disable-next-line callback-return
        callback(new Error($`Invalid submission origin: ${origin}`));
      }
    }
  });

  this.initializeWebhookHandler();
  this.initializeCORS();
  this.initializeRoutes();
};

API.prototype.initializeWebhookHandler = function () {
  let webhookHandler;
  const webhookSecret = config.get('webhookSecret');

  if (webhookSecret !== '') {
    webhookHandler = GithubWebHook({
      path: '/webhook',
      secret: webhookSecret
    });
  } else {
    webhookHandler = GithubWebHook({
      path: '/webhook'
    });
  }

  webhookHandler.on('error', error => {
    if (error.message !== 'No signature found in the request') {
      console.error('Webhook error:', error.message);
    }
  });

  webhookHandler.on('pull_request', this.controllers.handlePullRequest);

  this.server.use(webhookHandler);
};

API.prototype.initializeCORS = function () {
  this.server.use((request, response, next) => {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    next();
  });
};

API.prototype.initializeRoutes = function () {
  this.server.get(
    '/',
    this.controllers.home
  );

  this.server.get(
    '/encrypt/:text',
    this.controllers.encrypt
  );

  // limit 5 comment submissions per IP per minute
  this.server.use('/entry/', rateLimit());
  this.server.post(
    '/entry/:username/:repository/:branch/:property',
    [this.postCors, this.requireParams(['fields'])],
    this.controllers.process
  );

  // limit 5 subscriptions per IP per hour
  // this.server.use('/email/', rateLimit({
  //   windowMs: 60 * 60 * 1000,
  //   max: 5
  // }));
  this.server.post(
    '/email/:username/:repository/:branch/:property',
    this.postCors,
    this.controllers.processEmail
  );
};

API.prototype.requireParams = function (params) {
  return function (request, response, next) {
    let missingParams = [];

    params.forEach(param => {
      if (
        objectPath.get(request.query, param) === undefined &&
        objectPath.get(request.body, param) === undefined
        ) {
        missingParams.push(param);
      }
    });

    if (missingParams.length) {
      return response.status(500).send({
        success: false,
        errorCode: 'MISSING_PARAMS',
        data: missingParams
      });
    }

    return next();
  };
};

module.exports = API;
