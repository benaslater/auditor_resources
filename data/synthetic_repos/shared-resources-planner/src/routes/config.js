'use strict';

const express = require('express');

function configRouter(config) {
  const router = express.Router();

  router.get('/config', (req, res) => {
    res.json({
      houseName: config.houseName || 'Shared House',
      resources: config.resources,
      users: config.users
    });
  });

  return router;
}

module.exports = { configRouter };
