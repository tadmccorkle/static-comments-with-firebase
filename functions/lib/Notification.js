'use strict';

const md5 = require('md5');

const config = require('./../config');

const Notification = function (mailAgent) {
  this.mailAgent = mailAgent;
};

Notification.prototype._buildConfirmationRequestMessage = function (parameters, to, data) {
  return `
  <html>
    <body>
      Dear human,<br>
      <br>
      Your email was submitted to receive notifications${data.siteName ? ` from <strong>${data.siteName}</strong>` : ''}.
      <br><br>
      If this was you, <a href="${config.get('apiOrigin')}/confirm/${parameters.username}/${parameters.repository}/${parameters.branch}/${parameters.property}/${to}/${md5(`${to}${config.get('emailHashSalt')}`)}">click here</a> to verify your email address. If you did not submit your email, please disregard this request.
      <br><br>
      -Comment Bot
    </body>
  </html>
  `;
};

Notification.prototype._buildConfirmationRequestMessageForEntry = function (parameters, to, entry, data) {
  return `
  <html>
    <body>
      Dear human,<br>
      <br>
      Your email was submitted to receive notifications${data.siteName ? ` from <strong>${data.siteName}</strong>` : ''}.
      <br><br>
      If this was you, <a href="${config.get('apiOrigin')}/confirmForEntry/${parameters.username}/${parameters.repository}/${parameters.branch}/${parameters.property}/${md5(entry)}/${to}/${md5(`${to}${config.get('emailHashSalt')}`)}">click here</a> to verify your email address. If you did not submit your email, please disregard this request.
      <br><br>
      -Comment Bot
    </body>
  </html>
  `;
};

Notification.prototype._buildPostNotificationMessage = function (options, data) {
  return `
  <html>
    <body>
      Dear human,<br>
      <br>
      Someone commented on a post you subscribed to${data.siteName ? ` on <strong>${data.siteName}</strong>` : ''}.
      <br><br>
      ${options.origin ? `<a href="${options.origin}${data.commentSectionID ? `#${data.commentSectionID}` : ''}">Click here</a> to see it.` : ''} If you do not wish to receive any further notifications for this thread, <a href="%mailing_list_unsubscribe_url%">click here</a>.
      <br><br>
      -Comment Bot
    </body>
  </html>
  `;
};

Notification.prototype.sendConfirmationRequest = function (parameters, to, data) {
  const fromAddress = data.fromAddress ? data.fromAddress : config.get('email.fromAddress');

  return new Promise((resolve, reject) => {
    this.mailAgent.messages().send({
      from: `Comment Bot <${fromAddress}>`,
      to,
      subject: 'Verify Your Email Address',
      html: this._buildConfirmationRequestMessage(parameters, to, data)
    }, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
};

Notification.prototype.sendConfirmationRequestForEntry = function (parameters, to, entry, data) {
  const fromAddress = data.fromAddress ? data.fromAddress : config.get('email.fromAddress');

  return new Promise((resolve, reject) => {
    this.mailAgent.messages().send({
      from: `Comment Bot <${fromAddress}>`,
      to,
      subject: 'Verify Your Email Address',
      html: this._buildConfirmationRequestMessageForEntry(parameters, to, entry, data)
    }, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
};

Notification.prototype.send = function (to, options, data) {
  const subject = data.siteName ? `New reply on "${data.siteName}"` : 'New reply';
  const fromAddress = data.fromAddress ? data.fromAddress : config.get('email.fromAddress');

  return new Promise((resolve, reject) => {
    this.mailAgent.messages().send({
      from: `Comment Bot <${fromAddress}>`,
      to,
      subject,
      html: this._buildPostNotificationMessage(options, data)
    }, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
};

module.exports = Notification;
