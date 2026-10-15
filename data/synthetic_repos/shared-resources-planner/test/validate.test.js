'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBookingInput, ValidationError } = require('../src/lib/validate');

const config = {
  resources: [{ id: 'kitchen', name: 'Kitchen' }, { id: 'shower', name: 'Shower Room' }],
  users: ['Alice', 'Ben']
};

test('validateBookingInput: accepts a valid one-off booking', () => {
  const result = validateBookingInput({
    resourceId: 'kitchen',
    userName: 'Alice',
    date: '2026-08-04',
    startTime: '17:00',
    endTime: '19:00',
    note: 'Cooking for friends'
  }, config);
  assert.equal(result.recurring, false);
  assert.equal(result.date, '2026-08-04');
});

test('validateBookingInput: accepts a valid recurring booking', () => {
  const result = validateBookingInput({
    resourceId: 'shower',
    userName: 'Ben',
    recurring: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '07:30'
  }, config);
  assert.equal(result.recurring, true);
  assert.deepEqual(result.daysOfWeek, [1, 2, 3, 4, 5]);
});

test('validateBookingInput: rejects unknown resourceId', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'garage', userName: 'Alice', date: '2026-08-04', startTime: '17:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects unknown userName', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Mallory', date: '2026-08-04', startTime: '17:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects endTime before or equal to startTime', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-08-04', startTime: '18:00', endTime: '17:00'
  }, config), ValidationError);
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-08-04', startTime: '18:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects malformed time strings', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-08-04', startTime: '5pm', endTime: '19:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects invalid calendar date (e.g. Feb 30)', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-02-30', startTime: '17:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects recurring booking with empty daysOfWeek', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', recurring: true, daysOfWeek: [], startTime: '17:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects recurring booking with startDate after endDate', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen',
    userName: 'Alice',
    recurring: true,
    daysOfWeek: [1],
    startTime: '17:00',
    endTime: '18:00',
    startDate: '2026-08-10',
    endDate: '2026-08-01'
  }, config), ValidationError);
});

test('validateBookingInput: rejects a one-off booking missing date', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', startTime: '17:00', endTime: '18:00'
  }, config), ValidationError);
});

test('validateBookingInput: rejects an overlong note', () => {
  assert.throws(() => validateBookingInput({
    resourceId: 'kitchen', userName: 'Alice', date: '2026-08-04', startTime: '17:00', endTime: '18:00',
    note: 'x'.repeat(501)
  }, config), ValidationError);
});
