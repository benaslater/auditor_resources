'use strict';

/**
 * Parses a "YYYY-MM-DD" string into a Date at UTC midnight, so day-of-week
 * and date-range math is not affected by the server's local timezone/DST.
 */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Returns an array of "YYYY-MM-DD" strings for every day in [start, end] inclusive.
 */
function dateRange(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const days = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    days.push(formatDate(d));
  }
  return days;
}

/**
 * Expands a booking into concrete occurrences ({date, startTime, endTime}) that
 * fall within [rangeStart, rangeEnd] (inclusive, "YYYY-MM-DD" strings).
 *
 * One-off bookings produce at most one occurrence.
 * Recurring bookings produce one occurrence per matching day-of-week that also
 * satisfies the booking's own startDate/endDate bounds (if set).
 */
function expandBooking(booking, rangeStart, rangeEnd) {
  if (!booking.recurring) {
    if (booking.date >= rangeStart && booking.date <= rangeEnd) {
      return [{ date: booking.date, startTime: booking.startTime, endTime: booking.endTime }];
    }
    return [];
  }

  const occurrences = [];
  const effectiveStart = booking.startDate && booking.startDate > rangeStart ? booking.startDate : rangeStart;
  const effectiveEnd = booking.endDate && booking.endDate < rangeEnd ? booking.endDate : rangeEnd;

  if (effectiveStart > effectiveEnd) {
    return occurrences;
  }

  for (const dateStr of dateRange(effectiveStart, effectiveEnd)) {
    const dayOfWeek = parseDate(dateStr).getUTCDay();
    if (booking.daysOfWeek.includes(dayOfWeek)) {
      occurrences.push({ date: dateStr, startTime: booking.startTime, endTime: booking.endTime });
    }
  }
  return occurrences;
}

module.exports = { parseDate, formatDate, addDays, dateRange, expandBooking };
