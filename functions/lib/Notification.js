'use strict';

const config = require('./../config');

const Notification = function (mailAgent) {
  this.mailAgent = mailAgent;
};

Notification.prototype._buildMessage = function (fields, options, data) {
  return `
  <html>
    <body>
      Dear human,<br>
      <br>
      Someone replied to a comment you subscribed to${data.siteName ? ` on <strong>${data.siteName}</strong>` : ''}.
      <br><br>
      ${options.origin ? `<a href="${options.origin}">Click here</a> to see it.` : ''} If you do not wish to receive any further notifications for this thread, <a href="%mailing_list_unsubscribe_url%">click here</a>.
      <br><br>
      -Comment Bot
    </body>
  </html>
  `;
};

Notification.prototype.send = function (to, fields, options, data) {
  const subject = data.siteName ? `New reply on "${data.siteName}"` : 'New reply';

  return new Promise((resolve, reject) => {
    this.mailAgent.messages().send({
      from: `Comment Bot <${config.get('email.fromAddress')}>`,
      to,
      subject,
      html: this._buildMessage(fields, options, data)
    }, (error, response) => {
      if (error) {
        return reject(error);
      }

      return resolve(response);
    });
  });
};

module.exports = Notification;
