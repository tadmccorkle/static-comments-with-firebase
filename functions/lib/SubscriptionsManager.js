/* eslint-disable consistent-return */
/* eslint-disable promise/always-return */
/* eslint-disable promise/no-nesting */
'use strict';

const md5 = require('md5');

const Notification = require('./Notification');

const SubscriptionsManager = function (parameters, dataStore, mailAgent) {
  this.parameters = parameters;
  this.dataStore = dataStore;
  this.mailAgent = mailAgent;
};

SubscriptionsManager.prototype._getListAddress = function (entryId) {
  const compoundId = md5(`${this.parameters.username}-${this.parameters.repository}-${entryId}`);

  return `${compoundId}@${this.mailAgent.domain}`;
};

SubscriptionsManager.prototype._get = function (entryId) {
  const listAddress = this._getListAddress(entryId);

  return new Promise((resolve, reject) => {
    this.mailAgent.lists(listAddress).info((error, value) => {
      if (error && (error.statusCode !== 404)) {
        return reject(error);
      }

      if (error || !value || !value.list) {
        return resolve(null);
      }

      return resolve(listAddress);
    });
  });
};

SubscriptionsManager.prototype.send = function (entryId, fields, options, siteConfig) {
  return this._get(entryId).then(list => {
    if (list) {
      const notifications = new Notification(this.mailAgent);

      return notifications.send(list, fields, options, {
        siteName: siteConfig.get('name')
      });
    }
  });
};

SubscriptionsManager.prototype.set = function (entryId, email) {
  const listAddress = this._getListAddress(entryId);

  return new Promise((resolve, reject) => {
    let queue = [];

    return this._get(entryId).then(list => {
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

      return Promise.all(queue).then(() => {
        this.mailAgent.lists(listAddress).members().create({
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

module.exports = SubscriptionsManager;
