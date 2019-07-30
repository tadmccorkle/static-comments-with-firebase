'use strict';

const md5 = require('md5');

const config = require('./../config');

const Notification = function (mailAgent) {
  this.mailAgent = mailAgent;
};

const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
<head>
<meta name="viewport" content="width=device-width" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>Actionable emails e.g. reset password</title>


<style type="text/css">
img {
max-width: 100%;
}
body {
-webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none; width: 100% !important; height: 100%; line-height: 1.6em;
}
body {
background-color: #f6f6f6;
}
@media only screen and (max-width: 640px) {
  body {
    padding: 0 !important;
  }
  h1 {
    font-weight: 800 !important; margin: 20px 0 5px !important;
  }
  h2 {
    font-weight: 800 !important; margin: 20px 0 5px !important;
  }
  h3 {
    font-weight: 800 !important; margin: 20px 0 5px !important;
  }
  h4 {
    font-weight: 800 !important; margin: 20px 0 5px !important;
  }
  h1 {
    font-size: 22px !important;
  }
  h2 {
    font-size: 18px !important;
  }
  h3 {
    font-size: 16px !important;
  }
  .container {
    padding: 0 !important; width: 100% !important;
  }
  .content {
    padding: 0 !important;
  }
  .content-wrap {
    padding: 10px !important;
  }
  .invoice {
    width: 100% !important;
  }
}
</style>
</head>

<body itemscope itemtype="http://schema.org/EmailMessage" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none; width: 100% !important; height: 100%; line-height: 1.6em; background-color: #f6f6f6; margin: 0;" bgcolor="#f6f6f6">

<table class="body-wrap" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; width: 100%; background-color: #f6f6f6; margin: 0;" bgcolor="#f6f6f6">
<tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
<td style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0;" valign="top"></td>
<td class="container" width="600" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; display: block !important; max-width: 600px !important; clear: both !important; margin: 0 auto;" valign="top">
<div class="content" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; max-width: 600px; display: block; margin: 0 auto; padding: 20px;">
<table class="main" width="100%" cellpadding="0" cellspacing="0" itemprop="action" itemscope itemtype="http://schema.org/ConfirmAction" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; border-radius: 3px; background-color: #fff; margin: 0; border: 1px solid #e9e9e9;" bgcolor="#fff">
<tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
<td class="content-wrap" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 20px;" valign="top">
  <meta itemprop="name" content="Confirm Email" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;" />
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
    <tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
      <td class="content-block" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 0 0 20px;" valign="top">
        {{CONTENT_ONE}}
      </td>
    </tr>
    <tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
      <td class="content-block" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 0 0 20px;" valign="top">
        {{CONTENT_TWO}}
      </td>
    </tr>
    {{CONFIRM}}
    <tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
      <td class="content-block" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 0 0 20px;" valign="top">
        {{SIGNATURE}}
      </td>
    </tr>
  </table>
</td>
</tr>
</table>
{{LOWER_TEXT}}
</div>
</td>
<td style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0;" valign="top"></td>
</tr>
</table>
</body>
</html>
`;

const button = `
<tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
  <td class="content-block" itemprop="handler" itemscope itemtype="http://schema.org/HttpActionHandler" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; vertical-align: top; margin: 0; padding: 0 0 20px;" valign="top">
    <a href="{{URL}}" class="btn-primary" itemprop="url" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; color: #FFF; text-decoration: none; line-height: 2em; font-weight: bold; text-align: center; cursor: pointer; display: inline-block; border-radius: 5px; text-transform: capitalize; background-color: #348eda; margin: 0; border-color: #348eda; border-style: solid; border-width: 10px 20px;">Confirm email address</a>
  </td>
</tr>
`;

const unsubscribe = `
<div class="footer" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; width: 100%; clear: both; color: #999; margin: 0; padding: 20px;">
  <table width="100%" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
    <tr style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 14px; margin: 0;">
      <td class="aligncenter content-block" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 12px; vertical-align: top; color: #999; text-align: center; margin: 0; padding: 0 0 20px;" align="center" valign="top">
        <a href="%mailing_list_unsubscribe_url%" style="font-family: 'Helvetica Neue',Helvetica,Arial,sans-serif; box-sizing: border-box; font-size: 12px; color: #999; text-decoration: underline; margin: 0;">
          unsubscribe from this list
        </a>
      </td>
    </tr>
  </table>
</div>
`;

const signature = '&mdash; Comment Bot';

Notification.prototype._buildConfirmationRequestMessage = function (parameters, to, data) {
  let msg = html.replace('{{CONTENT_ONE}}', `Your email was submitted to receive notifications${data.siteName ? ` from <strong>${data.siteName}</strong>` : ''}.`);
  msg = msg.replace('{{CONTENT_TWO}}', `If this was you, click the link below to confirm your email address. If you did not submit your email, please disregard this request.`);
  msg = msg.replace('{{CONFIRM}}', button.replace('{{URL}}', `${config.get('apiOrigin')}/confirm/${parameters.username}/${parameters.repository}/${parameters.branch}/${parameters.property}/${to}/${md5(`${to}${config.get('emailHashSalt')}`)}`));
  msg = msg.replace('{{SIGNATURE}}', signature);
  msg = msg.replace('{{LOWER_TEXT}}', '');
  
  return msg;
};

Notification.prototype._buildConfirmationRequestMessageForEntry = function (parameters, to, entry, data) {
  let msg = html.replace('{{CONTENT_ONE}}', `Your email was submitted to receive notifications${data.siteName ? ` from <strong>${data.siteName}</strong>` : ''}.`);
  msg = msg.replace('{{CONTENT_TWO}}', `If this was you, click the link below to confirm your email address. If you did not submit your email, please disregard this request.`);
  msg = msg.replace('{{CONFIRM}}', button.replace('{{URL}}', `${config.get('apiOrigin')}/confirmForEntry/${parameters.username}/${parameters.repository}/${parameters.branch}/${parameters.property}/${md5(entry)}/${to}/${md5(`${to}${config.get('emailHashSalt')}`)}`));
  msg = msg.replace('{{SIGNATURE}}', signature);
  msg = msg.replace('{{LOWER_TEXT}}', '');
  
  return msg;
};

Notification.prototype._buildPostNotificationMessage = function (options, data) {
  let msg = html.replace('{{CONTENT_ONE}}', `Someone commented on a post you subscribed to${data.siteName ? ` on <strong>${data.siteName}</strong>` : ''}.`);
  msg = msg.replace('{{CONTENT_TWO}}', `${options.origin ? `<a href="${options.origin}${data.commentSectionID ? `#${data.commentSectionID}` : ''}">Click here</a> to see it.` : ''} Thanks!`);
  msg = msg.replace('{{CONFIRM}}', '');
  msg = msg.replace('{{SIGNATURE}}', signature);
  msg = msg.replace('{{LOWER_TEXT}}', unsubscribe);
  
  return msg;
};

Notification.prototype.sendConfirmationRequest = function (parameters, to, data) {
  const fromAddress = data.fromAddress ? data.fromAddress : config.get('email.fromAddress');

  return new Promise((resolve, reject) => {
    this.mailAgent.messages().send({
      from: `Comment Bot <${fromAddress}>`,
      to,
      subject: 'Confirm Your Email Address',
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
      subject: 'Confirm Your Email Address',
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
