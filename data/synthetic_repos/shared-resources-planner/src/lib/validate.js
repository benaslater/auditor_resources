'use strict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

class ValidationError extends Error {}

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Validates a booking payload against the house config, and returns a
 * normalised booking object (without id) ready to be persisted.
 * Throws ValidationError with a human-readable message on any problem.
 */
function validateBookingInput(input, config) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const { resourceId, userName, note, recurring } = input;

  if (typeof resourceId !== 'string' || !config.resources.some((r) => r.id === resourceId)) {
    throw new ValidationError(`Unknown resourceId "${resourceId}".`);
  }
  if (typeof userName !== 'string' || !config.users.includes(userName)) {
    throw new ValidationError(`Unknown userName "${userName}". Check data/config.json.`);
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    throw new ValidationError('note must be a string of at most 500 characters.');
  }

  const startTime = input.startTime;
  const endTime = input.endTime;
  if (typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
    throw new ValidationError('startTime must be in HH:MM 24-hour format.');
  }
  if (typeof endTime !== 'string' || !TIME_RE.test(endTime)) {
    throw new ValidationError('endTime must be in HH:MM 24-hour format.');
  }
  if (startTime >= endTime) {
    throw new ValidationError('startTime must be earlier than endTime.');
  }

  const base = {
    resourceId,
    userName,
    note: note || '',
    startTime,
    endTime
  };

  if (recurring) {
    const daysOfWeek = input.daysOfWeek;
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0 ||
        !daysOfWeek.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      throw new ValidationError('daysOfWeek must be a non-empty array of integers 0 (Sun) to 6 (Sat).');
    }
    const startDate = input.startDate;
    const endDate = input.endDate;
    if (startDate !== undefined && startDate !== null && !isValidDate(startDate)) {
      throw new ValidationError('startDate must be a valid YYYY-MM-DD date.');
    }
    if (endDate !== undefined && endDate !== null && !isValidDate(endDate)) {
      throw new ValidationError('endDate must be a valid YYYY-MM-DD date.');
    }
    if (startDate && endDate && startDate > endDate) {
      throw new ValidationError('startDate must not be after endDate.');
    }
    return {
      ...base,
      recurring: true,
      daysOfWeek: [...new Set(daysOfWeek)].sort(),
      startDate: startDate || null,
      endDate: endDate || null
    };
  }

  const date = input.date;
  if (typeof date !== 'string' || !isValidDate(date)) {
    throw new ValidationError('date must be a valid YYYY-MM-DD date.');
  }
  return {
    ...base,
    recurring: false,
    date
  };
}

module.exports = { validateBookingInput, isValidDate, ValidationError, DATE_RE, TIME_RE };
