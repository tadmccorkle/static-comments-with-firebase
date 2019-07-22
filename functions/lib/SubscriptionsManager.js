'use strict';

const md5 = require('md5');

const config = require('./../config');
const Notification = require('./Notification');

const SubscriptionsManager = function (parameters, dataStore, mailAgent) {
  this.parameters = parameters;
  this.dataStore = dataStore;
  this.mailAgent = mailAgent;
};

SubscriptionsManager.prototype._getListAddress = function (entryIdHash) {
  const compoundId = md5(`${this.parameters.username}-${this.parameters.repository}-${entryIdHash}`);

  return `${compoundId}@${this.mailAgent.domain}`;
};

SubscriptionsManager.prototype._get = function (list) {
  return new Promise((resolve, reject) => {
    this.mailAgent.lists(list).info((error, value) => {
      if (error && (error.statusCode !== 404)) {
        return reject(error);
      }

      if (error || !value || !value.list) {
        return resolve(null);
      }

      return resolve(list);
    });
  });
};

SubscriptionsManager.prototype._getFromEntryId = function (entryIdHash) {
  const listAddress = this._getListAddress(entryIdHash);

  return this._get(listAddress);
};

SubscriptionsManager.prototype.sendConfirmationRequest = function (parameters, email, siteConfig) {
  const notifications = new Notification(this.mailAgent);

  return notifications.sendConfirmationRequest(parameters, email, {
    siteName: siteConfig.get('notifications.name'),
    fromAddress: siteConfig.get('notifications.fromAddress')
  });
};

SubscriptionsManager.prototype.sendConfirmationRequestForEntry = function (parameters, email, entry, siteConfig) {
  const notifications = new Notification(this.mailAgent);

  return notifications.sendConfirmationRequestForEntry(parameters, email, entry, {
    siteName: siteConfig.get('notifications.name'),
    fromAddress: siteConfig.get('notifications.fromAddress')
  });
};

SubscriptionsManager.prototype.send = function (entryId, options, siteConfig) {
  const entryIdHash = md5(entryId);

  return this._getFromEntryId(entryIdHash).then(list => {
    if (list) {
      const notifications = new Notification(this.mailAgent);

      return notifications.send(list, options, {
        siteName: siteConfig.get('notifications.name'),
        fromAddress: siteConfig.get('notifications.fromAddress'),
        commentSectionID: siteConfig.get('notifications.commentSectionID')
      });
    }
    return null;
  });
};

SubscriptionsManager.prototype.set = function (entryIdHash, email) {
  const listAddress = this._getListAddress(entryIdHash);

  return new Promise((resolve, reject) => {
    let queue = [];

    return this._getFromEntryId(entryIdHash).then(list => {
      if (!list) {
        queue.push(new Promise((resolve, reject) => {
          this.mailAgent.lists().create({
            address: listAddress
          }, (error, result) => {
            if (error) {
              return reject(error);
            }

            return resolve(result);
          });
        }));
      }

      // eslint-disable-next-line promise/no-nesting
      return Promise.all(queue).then(() => {
        return this.mailAgent.lists(listAddress).members().create({
          address: email
        }, (error, result) => {
          if (error && (error.statusCode !== 400)) {
            return reject(error);
          }

          return resolve(result);
        });
      });
    });
  });
};

SubscriptionsManager.prototype.addSiteSubscription = function (email, listAddress) {
  return new Promise((resolve, reject) => {
    let queue = [];

    return this._get(listAddress).then(list => {
      if (!list) {
        queue.push(new Promise((resolve, reject) => {
          this.mailAgent.lists().create({
            address: listAddress
          }, (error, result) => {
            if (error) {
              return reject(error);
            }

            return resolve(result);
          });
        }));
      }

      // eslint-disable-next-line promise/no-nesting
      return Promise.all(queue).then(() => {
        return this.mailAgent.lists(listAddress).members().create({
          address: email
        }, (error, result) => {
          if (error && (error.statusCode !== 400)) {
            return reject(error);
          }

          return resolve(result);
        });
      });
    });
  });
};

SubscriptionsManager.prototype.confirmEmail = function (email, emailHash, listAddress) {
  if (md5(`${email}${config.get('emailHashSalt')}`) === emailHash) {
    this.addSiteSubscription(email, listAddress);
  } else {
    throw Error('Email does not match hash.');
  }
};

SubscriptionsManager.prototype.confirmEmailForEntry = function (entryHash, email, emailHash) {
  if (md5(`${email}${config.get('emailHashSalt')}`) === emailHash) {
    this.set(entryHash, email);
  } else {
    throw Error('Entry email does not match hash.');
  }
};

module.exports = SubscriptionsManager;
