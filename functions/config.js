'use strict';

const convict = require('convict');

const schema = {
  allowedOrigins: {
    doc: 'When allowedOrigins is defined, only submissions sent from one of the domains listed will be accepted.',
    docExample: 'allowedOrigins: ["localhost", "eduardoboucas.com"]',
    format: Array,
    default: ['*']
  },
  apiOrigin: {
    doc: 'The origin of this firebase functions API.',
    docExample: 'https://your-app.firebaseapp.com',
    format: String,
    default: '',
    env: 'API_ORIGIN'
  },
  emailHashSalt: {
    doc: 'The salt to be used in the hash for email verifications.',
    docExample: 'YOUR_EMAIL_KEY',
    format: String,
    default: '',
    env: 'HASH_SALT'
  },
  email: {
    apiKey: {
      doc: 'Mailgun API key to be used for email notifications. Will be overridden by a `notifications.apiKey` parameter in the site config, if one is set.',
      format: String,
      default: '',
      env: 'EMAIL_API_KEY'
    },
    domain: {
      doc: 'Domain to be used with Mailgun for email notifications. Will be overridden by a `notifications.domain` parameter in the site config, if one is set.',
      format: String,
      default: '',
      env: 'EMAIL_DOMAIN'
    },
    fromAddress: {
      doc: 'Email address used to send notifications. Will be overridden by a `notifications.fromAddress` parameter in the site config, if one is set.',
      format: String,
      default: 'no_reply@mailgun.com',
      env: 'EMAIL_FROM'
    }
  },
  env: {
    doc: 'The applicaton environment.',
    format: ['production', 'development', 'test'],
    default: 'production',
    env: 'NODE_ENV'
  },
  githubBaseUrl: {
    doc: 'Base URL for the GitHub API.',
    format: String,
    default: 'https://api.github.com',
    env: 'GITHUB_BASE_URL'
  },
  rsaPrivateKey: {
    doc: 'RSA private key to encrypt sensitive configuration parameters.',
    docExample: 'rsaPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\\nkey\\n-----END RSA PRIVATE KEY-----"',
    format: String,
    default: null,
    env: 'RSA_PRIVATE_KEY'
  },
  webhookSecret: {
    doc: 'Secret used to validate GitHub webhook. Use to ensure webhooks are from the expected repo.',
    docExample: 'webhookSecret: "totallysecret"',
    format: String,
    default: '',
    env: 'WEBHOOK_SECRET'
  },

  // remove if updated to no longer use personal access token
  githubToken: {
    doc: 'Access token to the GitHub account.',
    format: String,
    default: null,
    env: 'GITHUB_TOKEN'
  }

  // not used with current implementation - may be used in future
  // githubAppID: {
  //   doc: 'ID of the GitHub App.',
  //   format: String,
  //   default: null,
  //   env: 'GITHUB_APP_ID'
  // },
  // githubPrivateKey: {
  //   doc: 'Private key of the GitHub App.',
  //   format: String,
  //   default: null,
  //   env: 'GITHUB_PRIVATE_KEY'
  // },
  // githubAccessTokenUri: {
  //   doc: 'URI for the GitHub authentication provider.',
  //   format: String,
  //   default: 'https://github.com/login/oauth/access_token',
  //   env: 'GITHUB_ACCESS_TOKEN_URI'
  // }
};

let config;

try {
  config = convict(schema);
  config.loadFile('./config.' + config.get('env') + '.json');
  config.validate();
} catch (error) {
  console.error('Error loading local config file:', error.message);
}

module.exports = config;
module.exports.schema = schema;
