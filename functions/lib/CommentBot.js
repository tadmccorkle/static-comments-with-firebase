/* eslint-disable promise/no-nesting */
'use strict';

const Mailgun = require('mailgun-js');
const NodeRSA = require('node-rsa');
const markdownTable = require('markdown-table');
const moment = require('moment');
const objectPath = require('object-path');
const slugify = require('slug');
const uuidv1 = require('uuid/v1');
const yaml = require('js-yaml');

const GitHub = require('./GitHub');
const RSA = require('./RSA');
const SiteConfig = require('./../siteConfig');
const SubscriptionsManager = require('./SubscriptionsManager');
const Transforms = require('./Transforms');
const config = require('./../config');
const errorHandler = require('./ErrorHandler');

const CommentBot = function (parameters) {
  this.parameters = parameters;

  const {
    branch,
    repository,
    username
  } = parameters;

  this.git = new GitHub({
    branch,
    repository,
    username
  });

  this.uid = uuidv1();

  this.rsa = new NodeRSA();
  this.rsa.importKey(config.get('rsaPrivateKey'));
};

CommentBot.prototype._transforms = Transforms;

CommentBot.prototype._applyInternalFields = function (data) {
  let internalFields = {
    _id: this.uid
  };

  if (this.options.parent) {
    internalFields._parent = this.options.parent;
  }

  return Object.assign(internalFields, data);
};

CommentBot.prototype._applyGeneratedFields = function (data) {
  const generatedFields = this.siteConfig.get('generatedFields');

  if (!generatedFields) {
    return data;
  }

  Object.keys(generatedFields).forEach(field => {
    const generatedField = generatedFields[field];

    if ((typeof generatedField === 'object') && (!(generatedField instanceof Array))) {
      const options = generatedField.options || {};

      switch (generatedField.type) {
        case 'date':
          data[field] = this._createDate(options);
          break;
        case 'user':
          if (this.gitUser && typeof options.property === 'string') {
            data[field] = objectPath.get(this.gitUser, options.property);
          }
          break;
        case 'slugify':
          if (
            typeof options.field === 'string' &&
            typeof data[options.field] === 'string'
          ) {
            data[field] = slugify(data[options.field]).toLowerCase();
          }
          break;
      }
    } else {
      data[field] = generatedField;
    }
  });

  return data;
};

CommentBot.prototype._applyTransforms = function (fields) {
  const transforms = this.siteConfig.get('transforms');

  if (!transforms) return Promise.resolve(fields);

  Object.keys(transforms).forEach(field => {
    if (!fields[field]) return;

    let transformNames = [].concat(transforms[field]);

    transformNames.forEach(transformName => {
      let transformFn = this._transforms[transformName];

      if (transformFn) {
        fields[field] = transformFn(fields[field]);
      }
    });
  });

  return Promise.resolve(fields);
};

CommentBot.prototype._checkAuth = function () {
  if (!this.siteConfig.get('auth.required')) {
    return Promise.resolve(false);
  }

  if (!this.options['auth-token']) {
    return Promise.reject(errorHandler('AUTH_TOKEN_MISSING'));
  }

  const oauthToken = RSA.decrypt(this.options['auth-token']);

  if (!oauthToken) {
    return Promise.reject(errorHandler('AUTH_TOKEN_INVALID'));
  }

  const git = new GitHub({
    oauthToken
  });

  return git.getCurrentUser().then(user => {
    this.gitUser = user;

    return true;
  });
};

CommentBot.prototype._createDate = function (options) {
  options = options || {};

  const date = new Date();

  switch (options.format) {
    case 'timestamp':
      return date.getTime();
    case 'timestamp-seconds':
      return Math.floor(date.getTime() / 1000);
    case 'iso8601':
    default:
      return date.toISOString();
  }
};

CommentBot.prototype._createFile = function (fields) {
  return new Promise((resolve, reject) => {
    switch (this.siteConfig.get('format').toLowerCase()) {
      case 'json':
        return resolve(JSON.stringify(fields));
      case 'yaml':
      case 'yml':
        try {
          const output = yaml.safeDump(fields);

          return resolve(output);
        } catch (error) {
          return reject(error);
        }
      case 'frontmatter': {
        const transforms = this.siteConfig.get('transforms');

        const contentField = transforms && Object.keys(transforms).find(field => {
          return transforms[field] === 'frontmatterContent';
        });

        if (!contentField) {
          return reject(errorHandler('NO_FRONTMATTER_CONTENT_TRANSFORM'));
        }

        const content = fields[contentField];
        const attributeFields = Object.assign({}, fields);

        delete attributeFields[contentField];

        try {
          const output = `---\n${yaml.safeDump(attributeFields)}---\n${content}\n`;

          return resolve(output);
        } catch (error) {
          return reject(error);
        }
      }
      default:
        return reject(errorHandler('INVALID_FORMAT'));
    }
  });
};

CommentBot.prototype._generateReviewBody = function (fields) {
  let table = [
    ['Field', 'Content']
  ];

  Object.keys(fields).forEach(field => {
    table.push([field, fields[field]]);
  });

  let message = this.siteConfig.get('pullRequestBody') + markdownTable(table);

  if (this.siteConfig.get('notifications.enabled')) {
    const notificationsPayload = {
      configPath: this.configPath,
      fields,
      options: this.options,
      parameters: this.parameters
    };

    message += `\n\n<!--comment-bot_notification:${JSON.stringify(notificationsPayload)}-->`;
  }

  return message;
};

CommentBot.prototype._getNewFilePath = function (data) {
  const configFilename = this.siteConfig.get('filename');
  const filename = (configFilename && configFilename.length)
    ? this._resolvePlaceholders(configFilename, {
      fields: data,
      options: this.options
    })
    : this.uid;

  let path = this._resolvePlaceholders(this.siteConfig.get('path'), {
    fields: data,
    options: this.options
  });

  if (path.slice(-1) === '/') {
    path = path.slice(0, -1);
  }

  const extension = this.siteConfig.get('extension').length
    ? this.siteConfig.get('extension')
    : this._getExtensionForFormat(this.siteConfig.get('format'));

  return `${path}/${filename}.${extension}`;
};

CommentBot.prototype._getExtensionForFormat = function (format) {
  switch (format.toLowerCase()) {
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yml';
    case 'frontmatter':
      return 'md';
    default:
      return 'yml';
  }
};

CommentBot.prototype._initializeSubscriptions = function () {
  if (!this.siteConfig.get('notifications.enabled')) return null;

  const mailgun = Mailgun({
    apiKey: this.siteConfig.get('notifications.apiKey') || config.get('email.apiKey'),
    domain: this.siteConfig.get('notifications.domain') || config.get('email.domain')
  });

  return new SubscriptionsManager(this.parameters, this.git, mailgun);
};

CommentBot.prototype._resolvePlaceholders = function (subject, baseObject) {
  const matches = subject.match(/{(.*?)}/g);

  if (!matches) {
    return subject;
  }

  matches.forEach((match) => {
    const escapedMatch = match.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    const property = match.slice(1, -1);

    let newText;

    switch (property) {
      case '@timestamp':
        newText = new Date().getTime();
        break;
      case '@id':
        newText = this.uid;
        break;
      default: {
        const timeIdentifier = '@date:';
        if (property.indexOf(timeIdentifier) === 0) {
          const timePattern = property.slice(timeIdentifier.length);

          newText = moment().format(timePattern);
        } else {
          newText = objectPath.get(baseObject, property) || '';
        }
      }
    }

    subject = subject.replace(new RegExp(escapedMatch, 'g'), newText);
  });

  return subject;
};

CommentBot.prototype._validateConfig = function (config) {
  if (!config) {
    return errorHandler('MISSING_CONFIG_BLOCK');
  }

  const requiredFields = [
    'allowedFields',
    'branch',
    'format',
    'path'
  ];

  let missingFields = [];

  requiredFields.forEach(requiredField => {
    if (objectPath.get(config, requiredField) === undefined) {
      missingFields.push(requiredField);
    }
  });

  if (missingFields.length) {
    return errorHandler('MISSING_CONFIG_FIELDS', {
      data: missingFields
    });
  }

  this.siteConfig = SiteConfig(config, this.rsa);

  return null;
};

CommentBot.prototype._validateFields = function (fields) {
  let missingRequiredFields = [];
  let invalidFields = [];

  Object.keys(fields).forEach(field => {
    if ((this.siteConfig.get('allowedFields').indexOf(field) === -1) && (fields[field] !== '')) {
      invalidFields.push(field);
    }

    if (typeof fields[field] === 'string') {
      fields[field] = fields[field].trim();
    }
  });

  this.siteConfig.get('requiredFields').forEach(field => {
    if ((fields[field] === undefined) || (fields[field] === '')) {
      missingRequiredFields.push(field);
    }
  });

  if (missingRequiredFields.length) {
    return errorHandler('MISSING_REQUIRED_FIELDS', {
      data: missingRequiredFields
    });
  }

  if (invalidFields.length) {
    return errorHandler('INVALID_FIELDS', {
      data: invalidFields
    });
  }

  return null;
};

CommentBot.prototype.decrypt = function (encrypted) {
  return this.rsa.decrypt(encrypted, 'utf8');
};

CommentBot.prototype.getParameters = function () {
  return this.parameters;
};

CommentBot.prototype.getSiteConfig = function (force) {
  if (this.siteConfig && !force) {
    return Promise.resolve(this.siteConfig);
  }

  if (!this.configPath) {
    return Promise.reject(errorHandler('NO_CONFIG_PATH'));
  }

  return this.git.readFile(this.configPath.file).then(data => {
    const config = objectPath.get(data, this.configPath.path);
    const validationErrors = this._validateConfig(config);

    if (validationErrors) {
      return Promise.reject(validationErrors);
    }

    if (config.branch !== this.parameters.branch) {
      return Promise.reject(errorHandler('BRANCH_MISMATCH'));
    }

    return this.siteConfig;
  });
};

CommentBot.prototype.processEntry = function (fields, options) {
  this.fields = Object.assign({}, fields);
  this.options = Object.assign({}, options);

  this._initializeGit;

  return this.getSiteConfig().then(config => {
    return this._checkAuth();
  }).then(fields => {
    const fieldErrors = this._validateFields(fields);

    if (fieldErrors) {
      return Promise.reject(fieldErrors);
    }

    fields = this._applyGeneratedFields(fields);

    return this._applyTransforms(fields);
  }).then(transformedFields => {
    return this._applyInternalFields(transformedFields);
  }).then(extendedFields => {
    return this._createFile(extendedFields);
  }).then(data => {
    const filePath = this._getNewFilePath(fields);
    const subscriptions = this._initializeSubscriptions();
    const commitMessage = this._resolvePlaceholders(this.siteConfig.get('commitMessage'), {
      fields,
      options
    });

    if (subscriptions && options.parent && options.subscribe && this.fields[options.subscribe]) {
      subscriptions.set(options.parent, this.fields[options.subscribe]).catch(error => {
        console.log(error.stack || error);
      });
    }

    if (this.siteConfig.get('moderation')) {
      const newBranch = 'comment-bot_' + this.uid;

      return this.git.writeFileAndSendReview(
        filePath,
        data,
        newBranch,
        commitMessage,
        this._generateReviewBody(fields)
      );
    } else if (subscriptions && options.parent) {
      subscriptions.send(options.parent, fields, options, this.siteConfig);
    }

    return this.git.writeFile(
      filePath,
      data,
      this.parameters.branch,
      commitMessage
    );
  }).then(result => {
    return {
      fields: fields,
      redirect: options.redirect ? options.redirect : false
    };
  }).catch(error => {
    return Promise.reject(errorHandler('ERROR_PROCESSING_ENTRY', {
      error,
      instance: this
    }));
  });
};

CommentBot.prototype.processMerge = function (fields, options) {
  this.fields = Object.assign({}, fields);
  this.options = Object.assign({}, options);

  return this.getSiteConfig().then(config => {
    const subscriptions = this._initializeSubscriptions();

    return subscriptions.send(options.parent, fields, options, this.siteConfig);
  }).catch(error => {
    return Promise.reject(errorHandler('ERROR_PROCESSING_MERGE', {
      error,
      instance: this
    }));
  });
};

CommentBot.prototype.setConfigPath = function (configPath) {
  if (!configPath) {
    this.configPath = {
      file: '_comment-bot.yml',
      path: this.parameters.property || ''
    };

    return;
  }

  this.configPath = configPath;
};

CommentBot.prototype.setIp = function (ip) {
  this.ip = ip;
};

CommentBot.prototype.setUserAgent = function (userAgent) {
  this.userAgent = userAgent;
};

module.exports = CommentBot;