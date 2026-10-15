'use strict';

const { expandBooking, addDays, formatDate, parseDate } = require('./recurrence');

// How far ahead to check recurring-vs-recurring overlaps. 180 days comfortably
// covers "every weekday" style bookings without unbounded computation.
const HORIZON_DAYS = 180;

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function candidateHorizon(candidate) {
  const anchor = candidate.recurring ? (candidate.startDate || formatDate(new Date())) : candidate.date;
  const start = anchor;
  const end = formatDate(addDays(parseDate(anchor), HORIZON_DAYS));
  return { start, end };
}

/**
 * Finds bookings by *other* users that overlap the candidate booking on the
 * same resource. Returns an array of conflicting occurrences, each annotated
 * with the booking that produced it.
 *
 * @param {Array} allBookings - existing bookings (already saved)
 * @param {Object} candidate - a booking-shaped object being created/edited (not yet saved)
 * @param {string|null} excludeId - booking id to ignore (used when editing an existing booking)
 */
function findConflicts(allBookings, candidate, excludeId = null) {
  const { start, end } = candidateHorizon(candidate);
  const candidateOccurrences = expandBooking(candidate, start, end);
  if (candidateOccurrences.length === 0) return [];

  const conflicts = [];

  for (const other of allBookings) {
    if (other.id === excludeId) continue;
    if (other.resourceId !== candidate.resourceId) continue;
    if (other.userName === candidate.userName) continue; // same person double-booking themselves is fine

    const otherOccurrences = expandBooking(other, start, end);
    for (const occA of candidateOccurrences) {
      for (const occB of otherOccurrences) {
        if (occA.date === occB.date && timesOverlap(occA.startTime, occA.endTime, occB.startTime, occB.endTime)) {
          conflicts.push({
            bookingId: other.id,
            userName: other.userName,
            resourceId: other.resourceId,
            date: occB.date,
            startTime: occB.startTime,
            endTime: occB.endTime,
            note: other.note || ''
          });
        }
      }
    }
  }

  return conflicts;
}

module.exports = { findConflicts, timesOverlap };
