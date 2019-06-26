'use strict';

const config = require('./../config');

const Notification = function (mailAgent) {
  this.mailAgent = mailAgent;
};

Notification.prototype._buildMessage = function (options, data) {
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

Notification.prototype.send = function (to, options, data) {
  const subject = data.siteName ? `New reply on "${data.siteName}"` : 'New reply';
  const fromAddress = data.fromAddress ? data.fromAddress : config.get('email.fromAddress');

  return new Promise((resolve, reject) => {

    this.mailAgent.messages().send({
      from: `Comment Bot <${fromAddress}>`,
      to,
      subject,
      html: this._buildMessage(options, data)
    }, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
};

module.exports = Notification;
