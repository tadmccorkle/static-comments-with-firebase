'use strict';

const NodeRSA = require('node-rsa');

const config = require('./../config');

const key = new NodeRSA(config.get('rsaPrivateKey'));

module.exports.encrypt = text => {
  try {
    return key.encrypt(text, 'base64');
  } catch (error) {
    console.error('Error encrypting text:', error.message);
    return null;
  }
};

module.exports.decrypt = text => {
  try {
    return key.decrypt(text, 'utf8');
  } catch (error) {
    console.error('Error decrypting text:', error.message);
    return null;
  }
};
