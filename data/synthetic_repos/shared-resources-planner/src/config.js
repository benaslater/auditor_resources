'use strict';

const fs = require('fs');

function loadConfig(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const config = JSON.parse(raw);
  if (!Array.isArray(config.resources) || config.resources.length === 0) {
    throw new Error('config.json must define at least one resource');
  }
  if (!Array.isArray(config.users) || config.users.length === 0) {
    throw new Error('config.json must define at least one user');
  }
  return config;
}

module.exports = { loadConfig };
