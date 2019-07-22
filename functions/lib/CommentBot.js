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
const SiteConfig = require('./../siteConfig');
const SubscriptionsManager = require('./SubscriptionsManager');
const Transforms = require('./Transforms');
const config = require('./../config');

const CommentBot = function (parameters) {
  this.parameters = parameters;
  this.username = parameters.username;
  this.repository = parameters.repository;
  this.branch = parameters.branch;
  this.property = parameters.property;

  this.git = new GitHub({
    username: this.username,
    repository: this.repository,
    branch: this.branch
  });

  this.uid = uuidv1();

  this.rsa = new NodeRSA(config.get('rsaPrivateKey'));
};

CommentBot.prototype.logAndGetError = function (message) {
  console.error('Error:', message);
  return new Error(message);
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
          console.error('Error creating yml file:', error.message);
          return reject(error);
        }
      case 'frontmatter': {
        const transforms = this.siteConfig.get('transforms');

        const contentField = transforms && Object.keys(transforms).find(field => {
          return transforms[field] === 'frontmatterContent';
        });

        if (!contentField) {
          return reject(this.logAndGetError('Frontmatter error.'));
        }

        const content = fields[contentField];
        const attributeFields = Object.assign({}, fields);

        delete attributeFields[contentField];

        try {
          const output = `---\n${yaml.safeDump(attributeFields)}---\n${content}\n`;

          return resolve(output);
        } catch (error) {
          console.error('Frontmatter yml error:', error.message);
          return reject(error);
        }
      }
      default: {
        return reject(this.logAndGetError('Invalid file creation format.'));
      }
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

CommentBot.prototype._resolvePlaceholders = function (subject, baseObject) {
  const matches = subject.match(/{(.*?)}/g);

  if (!matches) {
    return subject;
  }

  matches.forEach(match => {
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

CommentBot.prototype._initializeSubscriptions = function () {
  const mailgun = Mailgun({
    apiKey: this.siteConfig.get('notifications.apiKey') || config.get('email.apiKey'),
    domain: this.siteConfig.get('notifications.domain') || config.get('email.domain')
  });

  return new SubscriptionsManager(this.parameters, this.git, mailgun);
};

CommentBot.prototype._initializeNotificationSubscriptions = function () {
  if (!this.siteConfig.get('notifications.enabled')) return null;

  return this._initializeSubscriptions();
};

CommentBot.prototype._validateConfig = function (config) {
  if (!config) {
    return this.logAndGetError('Missing config.');
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
    return this.logAndGetError(`Missing fields - ${missingFields}`);
  }

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
    return this.logAndGetError(`Missing required fields - ${missingRequiredFields}`);
  }

  if (invalidFields.length) {
    return this.logAndGetError(`Invalid fields - ${invalidFields}`);
  }

  return null;
};

CommentBot.prototype.decrypt = function (encrypted) {
  return this.rsa.decrypt(encrypted, 'utf8');
};

CommentBot.prototype.getParameters = function () {
  return this.parameters;
};

CommentBot.prototype.getSiteConfig = function (validateConfig = true) {
  if (this.siteConfig) {
    return Promise.resolve(this.siteConfig);
  }

  if (!this.configPath) {
    return this.logAndGetError('No config path.');
  }

  return this.git.readFile(this.configPath.file).then(data => {
    const config = objectPath.get(data, this.configPath.path);
    if (validateConfig) {
      const validationErrors = this._validateConfig(config);

      if (validationErrors) {
        return Promise.reject(validationErrors);
      }
    }

    this.siteConfig = SiteConfig(config, this.rsa);

    if (config.branch !== this.parameters.branch) {
      return Promise.reject(this.logAndGetError(`Branch mismatch: ${config.branch} ::: ${this.parameters.branch}`));
    }

    return this.siteConfig;
  });
};

CommentBot.prototype.processEntry = function (fields, options) {
  this.fields = Object.assign({}, fields);
  this.options = Object.assign({}, options);

  return this.getSiteConfig().then(() => {
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
    const subscriptions = this._initializeNotificationSubscriptions();
    const commitMessage = this._resolvePlaceholders(this.siteConfig.get('commitMessage'), {
      fields,
      options
    });

    if (subscriptions && options.parent && options.subscribe && this.fields[options.subscribe]) {
      // eslint-disable-next-line promise/no-nesting
      subscriptions.sendConfirmationRequestForEntry(this.parameters, this.fields[options.subscribe], options.parent, this.siteConfig);
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
      subscriptions.send(options.parent, options, this.siteConfig);
    }

    return this.git.writeFile(
      filePath,
      data,
      this.parameters.branch,
      commitMessage
    );
  }).then(() => {
    return {
      fields: fields,
      redirect: options.redirect ? options.redirect : false
    };
  }).catch(error => {
    console.error('Error processing entry:', error.message);
    return Promise.reject(error);
  });
};

CommentBot.prototype.processMerge = function (fields, options) {
  this.fields = Object.assign({}, fields);
  this.options = Object.assign({}, options);

  return this.getSiteConfig().then(() => {
    const subscriptions = this._initializeNotificationSubscriptions();

    return subscriptions.send(options.parent, options, this.siteConfig);
  }).catch(error => {
    console.error('Error processing merge:', error.message);
    return Promise.reject(error);
  });
};

CommentBot.prototype.processEmail = function (fields, options) {
  this.fields = Object.assign({}, fields);
  this.options = Object.assign({}, options);

  return this.getSiteConfig(false).then(() => {
    const subscriptions = this._initializeSubscriptions();
    const email = this.fields['email'];
    return subscriptions.sendConfirmationRequest(this.parameters, email, this.siteConfig);
  }).catch(error => {
    console.error('Error processing email:', error.message);
    return Promise.reject(error);
  });
};

CommentBot.prototype.confirmEmail = function(email, emailHash) {
  return this.getSiteConfig(false).then(() => {
    const subscriptions = this._initializeSubscriptions();
    const listAddress = this.siteConfig.get('mailingList');
    return subscriptions.confirmEmail(email, emailHash, listAddress);
  }).catch(error => {
    console.error('Error confirming email:', error.message);
    return Promise.reject(error);
  });
};

CommentBot.prototype.confirmEmailForEntry = function(entryHash, email, emailHash) {
  return this.getSiteConfig(false).then(() => {
    const subscriptions = this._initializeSubscriptions();
    return subscriptions.confirmEmailForEntry(entryHash, email, emailHash);
  }).catch(error => {
    console.error('Error confirming email for entry:', error.message);
    return Promise.reject(error);
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

module.exports = CommentBot;
