'use strict';

const NodeRSA = require('node-rsa');

const config = require('./../config');

const key = new NodeRSA();
key.importKey(config.get('rsaPrivateKey'));

module.exports.encrypt = text => {
  try {
    return key.encrypt(text, 'base64');
  } catch (e) {
    return null;
  }
};

module.exports.decrypt = text => {
  try {
    return key.decrypt(text, 'utf8');
  } catch (e) {
    return null;
  }
};
