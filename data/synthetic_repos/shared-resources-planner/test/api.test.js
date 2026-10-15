'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { Store } = require('../src/store');

const config = {
  houseName: 'Test House',
  resources: [
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'shower', name: 'Shower Room' }
  ],
  users: ['Alice', 'Ben', 'Carla']
};

function freshApp() {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'srp-api-')), 'bookings.json');
  const store = new Store(filePath);
  // enforceLocalNetwork left at its default (true): supertest talks over the
  // loopback interface, which the network guard treats as private, so this
  // also exercises the guard on the happy path in every test below.
  return createApp(store, config);
}

test('GET /api/config returns resources and users', async () => {
  const app = freshApp();
  const res = await request(app).get('/api/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.houseName, 'Test House');
  assert.equal(res.body.resources.length, 2);
  assert.deepEqual(res.body.users, ['Alice', 'Ben', 'Carla']);
});

test('POST /api/bookings creates a one-off booking', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/bookings').send({
    resourceId: 'kitchen',
    userName: 'Alice',
    date: '2026-08-11',
    startTime: '17:00',
    endTime: '19:00',
    note: 'Cooking for friends'
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.booking.id);
  assert.equal(res.body.conflicts.length, 0);
});

test('POST /api/bookings rejects invalid input with 400', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/bookings').send({
    resourceId: 'nonexistent',
    userName: 'Alice',
    date: '2026-08-11',
    startTime: '17:00',
    endTime: '19:00'
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test('POST /api/bookings returns 409 with conflict details when another user already holds the slot', async () => {
  const app = freshApp();
  await request(app).post('/api/bookings').send({
    resourceId: 'shower', userName: 'Alice', date: '2026-08-11', startTime: '07:00', endTime: '07:30'
  });

  const res = await request(app).post('/api/bookings').send({
    resourceId: 'shower', userName: 'Ben', date: '2026-08-11', startTime: '07:15', endTime: '07:45'
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.conflicts.length, 1);
  assert.equal(res.body.conflicts[0].userName, 'Alice');
});

test('POST /api/bookings with force:true creates the booking despite a conflict', async () => {
  const app = freshApp();
  await request(app).post('/api/bookings').send({
    resourceId: 'shower', userName: 'Alice', date: '2026-08-11', startTime: '07:00', endTime: '07:30'
  });

  const res = await request(app).post('/api/bookings').send({
    resourceId: 'shower', userName: 'Ben', date: '2026-08-11', startTime: '07:15', endTime: '07:45', force: true
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.conflicts.length, 1);

  const list = await request(app).get('/api/bookings');
  assert.equal(list.body.bookings.length, 2);
});

test('GET /api/bookings/occurrences expands a recurring booking within the requested range', async () => {
  const app = freshApp();
  await request(app).post('/api/bookings').send({
    resourceId: 'shower',
    userName: 'Carla',
    recurring: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '07:30'
  });

  const res = await request(app).get('/api/bookings/occurrences?start=2026-08-10&end=2026-08-16');
  assert.equal(res.status, 200);
  // 2026-08-10 is a Monday, so Mon-Fri that week = 5 occurrences.
  assert.equal(res.body.occurrences.length, 5);
});

test('GET /api/bookings/occurrences rejects a missing/invalid date range', async () => {
  const app = freshApp();
  const res = await request(app).get('/api/bookings/occurrences?start=not-a-date&end=2026-08-16');
  assert.equal(res.status, 400);
});

test('DELETE /api/bookings/:id requires the owner\'s userName and succeeds when it matches', async () => {
  const app = freshApp();
  const created = await request(app).post('/api/bookings').send({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-08-11', startTime: '17:00', endTime: '19:00'
  });
  const id = created.body.booking.id;

  const wrongUser = await request(app).delete(`/api/bookings/${id}?userName=Ben`);
  assert.equal(wrongUser.status, 403);

  const noUser = await request(app).delete(`/api/bookings/${id}`);
  assert.equal(noUser.status, 403);

  const rightUser = await request(app).delete(`/api/bookings/${id}?userName=Alice`);
  assert.equal(rightUser.status, 204);

  const list = await request(app).get('/api/bookings');
  assert.equal(list.body.bookings.length, 0);
});

test('DELETE /api/bookings/:id returns 404 for an unknown id', async () => {
  const app = freshApp();
  const res = await request(app).delete('/api/bookings/does-not-exist?userName=Alice');
  assert.equal(res.status, 404);
});
