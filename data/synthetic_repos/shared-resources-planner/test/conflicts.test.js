'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findConflicts } = require('../src/lib/conflicts');

const shower7to730 = {
  id: 'a1',
  resourceId: 'shower',
  userName: 'Alice',
  recurring: true,
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '07:00',
  endTime: '07:30',
  startDate: null,
  endDate: null
};

test('findConflicts: overlapping one-off booking by a different user on the same resource/day is a conflict', () => {
  const candidate = {
    resourceId: 'shower',
    userName: 'Ben',
    recurring: false,
    date: '2026-08-04', // Tuesday
    startTime: '07:15',
    endTime: '07:45'
  };
  const conflicts = findConflicts([shower7to730], candidate);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].userName, 'Alice');
  assert.equal(conflicts[0].date, '2026-08-04');
});

test('findConflicts: adjacent (non-overlapping) times are not a conflict', () => {
  const candidate = {
    resourceId: 'shower',
    userName: 'Ben',
    recurring: false,
    date: '2026-08-04',
    startTime: '07:30',
    endTime: '08:00'
  };
  const conflicts = findConflicts([shower7to730], candidate);
  assert.equal(conflicts.length, 0);
});

test('findConflicts: different resource does not conflict', () => {
  const candidate = {
    resourceId: 'kitchen',
    userName: 'Ben',
    recurring: false,
    date: '2026-08-04',
    startTime: '07:00',
    endTime: '07:30'
  };
  const conflicts = findConflicts([shower7to730], candidate);
  assert.equal(conflicts.length, 0);
});

test('findConflicts: same user booking overlapping themselves is not a conflict', () => {
  const candidate = {
    resourceId: 'shower',
    userName: 'Alice',
    recurring: false,
    date: '2026-08-04',
    startTime: '07:00',
    endTime: '07:30'
  };
  const conflicts = findConflicts([shower7to730], candidate);
  assert.equal(conflicts.length, 0);
});

test('findConflicts: recurring vs recurring overlap produces a conflict for each matching day', () => {
  const candidate = {
    resourceId: 'shower',
    userName: 'Ben',
    recurring: true,
    daysOfWeek: [1, 2, 3], // Mon-Wed
    startTime: '07:15',
    endTime: '07:45',
    startDate: '2026-08-03',
    endDate: '2026-08-09' // limit horizon to one week for a deterministic count
  };
  const conflicts = findConflicts([shower7to730], candidate);
  assert.equal(conflicts.length, 3); // Mon, Tue, Wed
});

test('findConflicts: excludeId ignores the booking being edited', () => {
  const candidate = {
    resourceId: 'shower',
    userName: 'Alice',
    recurring: false,
    date: '2026-08-04',
    startTime: '07:00',
    endTime: '07:30'
  };
  // Even though Alice's own booking wouldn't conflict with itself anyway (same user),
  // check a different-user scenario is correctly excluded by id.
  const other = { ...shower7to730, id: 'a1', userName: 'Carla' };
  const conflictsWithout = findConflicts([other], { ...candidate, userName: 'Ben' }, 'a1');
  assert.equal(conflictsWithout.length, 0);
  const conflictsWith = findConflicts([other], { ...candidate, userName: 'Ben' }, null);
  assert.equal(conflictsWith.length, 1);
});
