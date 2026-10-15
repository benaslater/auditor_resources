'use strict';

const express = require('express');
const path = require('path');
const { localNetworkOnly } = require('./lib/networkGuard');
const { configRouter } = require('./routes/config');
const { bookingsRouter } = require('./routes/bookings');

/**
 * Builds the Express app. Kept separate from server.js (which actually
 * starts listening) so tests can exercise the app in-process without
 * binding a real network port.
 *
 * @param {Store} store
 * @param {Object} config
 * @param {Object} [options]
 * @param {boolean} [options.enforceLocalNetwork=true] - set false in tests
 *   that don't care about the network guard, to avoid depending on the
 *   test runner's socket address.
 */
function createApp(store, config, options = {}) {
  const { enforceLocalNetwork = true } = options;
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  if (enforceLocalNetwork) {
    app.use(localNetworkOnly);
  }

  app.use('/api', configRouter(config));
  app.use('/api', bookingsRouter(store, config));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

module.exports = { createApp };
