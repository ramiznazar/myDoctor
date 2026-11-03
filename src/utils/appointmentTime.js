/**
 * Appointment times are stored as a calendar date plus a local clock time.
 * The browser supplies `timezoneOffset` using the application's convention:
 * minutes east of UTC are positive (for example UTC+05:30 is 330). When an
 * IANA timezone is present it takes precedence, so daylight-saving changes are
 * calculated for the appointment date rather than for the day of booking.
 *
 * New appointments store `appointmentDate` as UTC midnight of the intended
 * calendar date. Clock values (`appointmentTime`) remain the wall-clock time
 * chosen by the user in their own timezone.
 */

const isIanaTimeZone = (timeZone) => {
  if (typeof timeZone !== 'string' || !timeZone.includes('/')) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

const getTimeZoneOffsetMinutes = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return null;
  }
};

const zonedDateTimeToUtcMs = ({ year, month, day, hour, minute }, timeZone) => {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = getTimeZoneOffsetMinutes(new Date(wallClockAsUtc), timeZone);
  if (!Number.isFinite(firstOffset)) return wallClockAsUtc;

  let utcMs = wallClockAsUtc - firstOffset * 60 * 1000;
  const correctedOffset = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
  if (Number.isFinite(correctedOffset) && correctedOffset !== firstOffset) {
    utcMs = wallClockAsUtc - correctedOffset * 60 * 1000;
  }
  return utcMs;
};

/**
 * Extract the calendar date the user intended.
 * `appointmentDate` may be a Date, an ISO string or a `YYYY-MM-DD` value.
 */
const getAppointmentDateParts = (appointmentDate, appointment = null) => {
  if (typeof appointmentDate === 'string') {
    const dateOnly = appointmentDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const probe = new Date(Date.UTC(year, month - 1, day));
      if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
        throw new Error('Invalid appointment date');
      }
      return { year, month, day };
    }
  }

  const date = appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid appointment date');

  // Before timezone was persisted, some servers saved a local midnight as a
  // UTC timestamp. Preserve the intended calendar date for those records.
  // New appointments always carry an IANA timezone and are stored at UTC
  // midnight, so they intentionally skip this compatibility adjustment.
  const storedOffset = Number(appointment?.timezoneOffset);
  const logicalDate = !isIanaTimeZone(appointment?.timezone) && Number.isFinite(storedOffset)
    ? new Date(date.getTime() + storedOffset * 60 * 1000)
    : date;

  return {
    year: logicalDate.getUTCFullYear(),
    month: logicalDate.getUTCMonth() + 1,
    day: logicalDate.getUTCDate(),
  };
};

/** Store a calendar date the same way in every server timezone. */
const toUtcMidnight = (dateParts) => new Date(Date.UTC(
  dateParts.year,
  dateParts.month - 1,
  dateParts.day,
  0,
  0,
  0,
  0
));

const parseClockTime = (value, label = 'appointment') => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid ${label} time`);
  }
  return { hour, minute };
};

const addCalendarDays = ({ year, month, day }, days) => {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const localAppointmentDateTimeToUtc = (dateParts, clock, appointment) => {
  const timeZone = isIanaTimeZone(appointment?.timezone) ? appointment.timezone : null;
  if (timeZone) {
    return new Date(zonedDateTimeToUtcMs({ ...dateParts, ...clock }, timeZone));
  }

  const storedOffset = Number(appointment?.timezoneOffset);
  const offset = Number.isFinite(storedOffset) ? storedOffset : 0;

  return new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, clock.hour, clock.minute, 0, 0) -
      offset * 60 * 1000
  );
};

const getAppointmentStart = (appointment) => {
  const dateParts = getAppointmentDateParts(appointment?.appointmentDate, appointment);
  const clock = parseClockTime(appointment?.appointmentTime);
  return localAppointmentDateTimeToUtc(dateParts, clock, appointment);
};

const computeAppointmentWindow = (appointment) => {
  const dateParts = getAppointmentDateParts(appointment?.appointmentDate, appointment);
  const startClock = parseClockTime(appointment?.appointmentTime);
  const start = localAppointmentDateTimeToUtc(dateParts, startClock, appointment);

  let end = null;
  if (appointment?.appointmentEndTime) {
    const endClock = parseClockTime(appointment.appointmentEndTime, 'appointment end');
    const startsAtOrAfterEnd = startClock.hour * 60 + startClock.minute >= endClock.hour * 60 + endClock.minute;
    const endDateParts = startsAtOrAfterEnd ? addCalendarDays(dateParts, 1) : dateParts;
    end = localAppointmentDateTimeToUtc(endDateParts, endClock, appointment);
  }

  if (!end) {
    const duration = Number(appointment?.appointmentDuration);
    end = new Date(start.getTime() + (Number.isFinite(duration) && duration > 0 ? duration : 30) * 60 * 1000);
  }
  return { start, end };
};

const calculateEndClock = (appointmentTime, durationMinutes) => {
  const { hour, minute } = parseClockTime(appointmentTime);
  const end = new Date(Date.UTC(2000, 0, 1, hour, minute, 0, 0) + Number(durationMinutes || 30) * 60 * 1000);
  return `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;
};

module.exports = {
  isIanaTimeZone,
  getTimeZoneOffsetMinutes,
  getAppointmentDateParts,
  toUtcMidnight,
  getAppointmentStart,
  computeAppointmentWindow,
  calculateEndClock,
};
