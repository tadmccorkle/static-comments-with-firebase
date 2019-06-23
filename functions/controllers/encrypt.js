'use strict';

const RSA = require('./../lib/RSA');

module.exports = (request, response) => {
  const encryptedText = RSA.encrypt(request.params.text);

  if (!encryptedText) {
    response.status(500).send('Could not encrypt text.');
  }

  response.send(encryptedText);
};
