'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');

function tempFilePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'srp-store-')), 'bookings.json');
}

test('Store: creates the file with an empty bookings array if missing', () => {
  const filePath = tempFilePath();
  const store = new Store(filePath);
  assert.deepEqual(store.readAll(), []);
});

test('Store: mutate persists changes to disk', async () => {
  const filePath = tempFilePath();
  const store = new Store(filePath);
  await store.mutate((bookings) => [...bookings, { id: '1', note: 'test' }]);

  const reloaded = new Store(filePath);
  assert.deepEqual(reloaded.readAll(), [{ id: '1', note: 'test' }]);
});

test('Store: concurrent mutations are serialised, none are lost', async () => {
  const filePath = tempFilePath();
  const store = new Store(filePath);

  const mutations = [];
  for (let i = 0; i < 20; i++) {
    mutations.push(store.mutate((bookings) => [...bookings, { id: String(i) }]));
  }
  await Promise.all(mutations);

  assert.equal(store.readAll().length, 20);
});
