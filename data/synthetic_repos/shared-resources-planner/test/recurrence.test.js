'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { expandBooking, dateRange } = require('../src/lib/recurrence');

test('dateRange returns inclusive list of days', () => {
  assert.deepEqual(dateRange('2026-08-03', '2026-08-05'), [
    '2026-08-03', '2026-08-04', '2026-08-05'
  ]);
});

test('dateRange handles a single day', () => {
  assert.deepEqual(dateRange('2026-08-03', '2026-08-03'), ['2026-08-03']);
});

test('expandBooking: one-off booking inside range produces exactly one occurrence', () => {
  const booking = { recurring: false, date: '2026-08-04', startTime: '17:00', endTime: '19:00' };
  const occurrences = expandBooking(booking, '2026-08-01', '2026-08-31');
  assert.deepEqual(occurrences, [{ date: '2026-08-04', startTime: '17:00', endTime: '19:00' }]);
});

test('expandBooking: one-off booking outside range produces no occurrences', () => {
  const booking = { recurring: false, date: '2026-09-01', startTime: '17:00', endTime: '19:00' };
  const occurrences = expandBooking(booking, '2026-08-01', '2026-08-31');
  assert.deepEqual(occurrences, []);
});

test('expandBooking: recurring booking produces one occurrence per matching weekday', () => {
  // 2026-08-03 is a Monday. daysOfWeek 1-5 = Mon-Fri.
  const booking = {
    recurring: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '07:30',
    startDate: null,
    endDate: null
  };
  const occurrences = expandBooking(booking, '2026-08-03', '2026-08-09'); // Mon-Sun
  assert.equal(occurrences.length, 5);
  assert.deepEqual(occurrences.map((o) => o.date), [
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'
  ]);
});

test('expandBooking: recurring booking respects its own startDate/endDate bounds', () => {
  const booking = {
    recurring: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '07:30',
    startDate: '2026-08-05',
    endDate: '2026-08-06'
  };
  const occurrences = expandBooking(booking, '2026-08-01', '2026-08-31');
  assert.deepEqual(occurrences.map((o) => o.date), ['2026-08-05', '2026-08-06']);
});

test('expandBooking: recurring booking with no matching weekday in range is empty', () => {
  const booking = {
    recurring: true,
    daysOfWeek: [0], // Sunday only
    startTime: '07:00',
    endTime: '07:30',
    startDate: null,
    endDate: null
  };
  const occurrences = expandBooking(booking, '2026-08-03', '2026-08-07'); // Mon-Fri
  assert.deepEqual(occurrences, []);
});

test('expandBooking: recurring endDate before range start yields no occurrences', () => {
  const booking = {
    recurring: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '07:30',
    startDate: null,
    endDate: '2026-07-01'
  };
  const occurrences = expandBooking(booking, '2026-08-01', '2026-08-31');
  assert.deepEqual(occurrences, []);
});
