'use strict';

const pkg = require('./../package.json');

module.exports = (request, response) => {
  response.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  response.send(`${pkg.description}`);
};
