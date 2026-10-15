'use strict';

const express = require('express');
const crypto = require('crypto');
const { validateBookingInput, ValidationError, isValidDate } = require('../lib/validate');
const { findConflicts } = require('../lib/conflicts');
const { expandBooking } = require('../lib/recurrence');

function bookingsRouter(store, config) {
  const router = express.Router();

  // Raw, unexpanded bookings - useful for a "my bookings" management view.
  router.get('/bookings', (req, res) => {
    res.json({ bookings: store.readAll() });
  });

  // Expanded occurrences within a date range - what the calendar UI renders.
  router.get('/bookings/occurrences', (req, res) => {
    const { start, end } = req.query;
    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({ error: 'start and end query params must be valid YYYY-MM-DD dates.' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'start must not be after end.' });
    }

    const occurrences = [];
    for (const booking of store.readAll()) {
      for (const occ of expandBooking(booking, start, end)) {
        occurrences.push({
          id: booking.id,
          resourceId: booking.resourceId,
          userName: booking.userName,
          note: booking.note,
          recurring: booking.recurring,
          date: occ.date,
          startTime: occ.startTime,
          endTime: occ.endTime
        });
      }
    }
    res.json({ occurrences });
  });

  router.post('/bookings', (req, res) => {
    let normalised;
    try {
      normalised = validateBookingInput(req.body, config);
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    const existing = store.readAll();
    const conflicts = findConflicts(existing, normalised, null);

    if (conflicts.length > 0 && !req.body.force) {
      return res.status(409).json({ conflicts });
    }

    const booking = { id: crypto.randomUUID(), ...normalised };
    store.mutate((bookings) => [...bookings, booking]);
    res.status(201).json({ booking, conflicts });
  });

  router.delete('/bookings/:id', (req, res) => {
    const { id } = req.params;
    const userName = req.query.userName;
    const existing = store.readAll();
    const booking = existing.find((b) => b.id === id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (!userName || booking.userName !== userName) {
      return res.status(403).json({ error: 'Only the person who made a booking can delete it. Pass ?userName=<owner>.' });
    }

    store.mutate((bookings) => bookings.filter((b) => b.id !== id));
    res.status(204).end();
  });

  return router;
}

module.exports = { bookingsRouter };
