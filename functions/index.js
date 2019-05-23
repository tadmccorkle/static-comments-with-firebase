'use strict';

const functions = require('firebase-functions');
const API = require('./server');
const api = new API();

exports.app = functions.https.onRequest(api.server);
