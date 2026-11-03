const WeeklySchedule = require('../models/weeklySchedule.model');
const Appointment = require('../models/appointment.model');
const { toUtcMidnight } = require('../utils/appointmentTime');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'];

const clockToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToClock = (minutes) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

const parseCalendarDate = (date) => {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error('Invalid calendar date');
  }
  return { year, month, day };
};

const dayScheduleFor = (schedule, dateParts) => {
  const weekday = DAY_NAMES[new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)).getUTCDay()];
  return schedule?.days?.find((day) => day.dayOfWeek === weekday) || null;
};

const effectiveDuration = (schedule) => Number(schedule?.appointmentDuration) || 30;

/**
 * Expand a doctor's availability ranges into real bookable appointments.
 * A range such as 09:00–12:00 with 30 minute consultations deliberately
 * returns 09:00, 09:30, 10:00, ... rather than treating the full range as one
 * slot. This is the same schedule representation used by the doctor editor.
 */
const buildBookableSlots = (schedule, dateParts) => {
  const daySchedule = dayScheduleFor(schedule, dateParts);
  if (!daySchedule?.timeSlots?.length) return [];

  const duration = effectiveDuration(schedule);
  const slots = [];
  const seen = new Set();

  for (const range of daySchedule.timeSlots) {
    if (!range.isAvailable) continue;
    const rangeStart = clockToMinutes(range.startTime);
    const rangeEnd = clockToMinutes(range.endTime);
    if (rangeStart === null || rangeEnd === null || rangeEnd <= rangeStart) continue;

    for (let start = rangeStart; start + duration <= rangeEnd; start += duration) {
      const startTime = minutesToClock(start);
      if (seen.has(startTime)) continue;
      seen.add(startTime);
      slots.push({ startTime, endTime: minutesToClock(start + duration), duration });
    }
  }

  return slots.sort((left, right) => clockToMinutes(left.startTime) - clockToMinutes(right.startTime));
};

const appointmentIntervalForDate = (appointment, targetDate) => {
  const appointmentDate = new Date(appointment.appointmentDate);
  const targetDateMs = toUtcMidnight(targetDate).getTime();
  const appointmentDateMs = Date.UTC(
    appointmentDate.getUTCFullYear(),
    appointmentDate.getUTCMonth(),
    appointmentDate.getUTCDate()
  );
  let start = clockToMinutes(appointment.appointmentTime);
  if (start === null) return null;
  let end = clockToMinutes(appointment.appointmentEndTime);
  if (end === null || end <= start) end = start + (Number(appointment.appointmentDuration) || 30);

  // An appointment that began late on the preceding day can occupy the first
  // slots of this day. Shift its interval onto the target-day timeline.
  if (appointmentDateMs < targetDateMs) {
    start -= 1440;
    end -= 1440;
  }
  return { start, end };
};

const isSlotFree = (slot, appointments, dateParts) => {
  const slotStart = clockToMinutes(slot.startTime);
  const slotEnd = clockToMinutes(slot.endTime);
  return !appointments.some((appointment) => {
    const interval = appointmentIntervalForDate(appointment, dateParts);
    return interval && slotStart < interval.end && slotEnd > interval.start;
  });
};

/**
 * Create or update weekly schedule for a day
 * @param {string} doctorId - Doctor user ID
 * @param {Object} data - Schedule data
 * @returns {Promise<Object>} Created/updated schedule
 */
const upsertSchedule = async (doctorId, data) => {
  const { dayOfWeek, timeSlots } = data;

  let schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    schedule = await WeeklySchedule.create({
      doctorId,
      days: []
    });
  }

  // Find existing day schedule
  const dayIndex = schedule.days.findIndex(day => day.dayOfWeek === dayOfWeek);

  if (dayIndex !== -1) {
    // Update existing day
    schedule.days[dayIndex].timeSlots = timeSlots || [];
  } else {
    // Add new day
    schedule.days.push({
      dayOfWeek,
      timeSlots: timeSlots || []
    });
  }

  await schedule.save();
  return schedule;
};

/**
 * Get weekly schedule for doctor
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Weekly schedule
 */
const getSchedule = async (doctorId) => {
  let schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    // Return empty schedule with default structure
    schedule = {
      doctorId,
      appointmentDuration: 30,
      days: []
    };
  }

  return schedule;
};

/**
 * Update appointment duration
 * @param {string} doctorId - Doctor user ID
 * @param {number} duration - Appointment duration in minutes
 * @returns {Promise<Object>} Updated schedule
 */
const updateAppointmentDuration = async (doctorId, duration) => {
  let schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    schedule = await WeeklySchedule.create({
      doctorId,
      appointmentDuration: duration,
      days: []
    });
  } else {
    schedule.appointmentDuration = duration;
    await schedule.save();
  }

  return schedule;
};

/**
 * Add time slot to a specific day
 * @param {string} doctorId - Doctor user ID
 * @param {string} dayOfWeek - Day of week
 * @param {Object} timeSlot - Time slot data
 * @returns {Promise<Object>} Updated schedule
 */
const addTimeSlot = async (doctorId, dayOfWeek, timeSlot) => {
  let schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    schedule = await WeeklySchedule.create({
      doctorId,
      days: []
    });
  }

  // Find existing day schedule
  const dayIndex = schedule.days.findIndex(day => day.dayOfWeek === dayOfWeek);

  if (dayIndex !== -1) {
    // Add slot to existing day
    schedule.days[dayIndex].timeSlots.push(timeSlot);
  } else {
    // Create new day with slot
    schedule.days.push({
      dayOfWeek,
      timeSlots: [timeSlot]
    });
  }

  await schedule.save();
  return schedule;
};

/**
 * Update time slot
 * @param {string} doctorId - Doctor user ID
 * @param {string} dayOfWeek - Day of week
 * @param {string} slotId - Slot ID
 * @param {Object} updates - Time slot updates
 * @returns {Promise<Object>} Updated schedule
 */
const updateTimeSlot = async (doctorId, dayOfWeek, slotId, updates) => {
  const schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    throw new Error('Weekly schedule not found');
  }

  const dayIndex = schedule.days.findIndex(day => day.dayOfWeek === dayOfWeek);

  if (dayIndex === -1) {
    throw new Error('Day schedule not found');
  }

  const slotIndex = schedule.days[dayIndex].timeSlots.findIndex(
    slot => slot._id.toString() === slotId
  );

  if (slotIndex === -1) {
    throw new Error('Time slot not found');
  }

  // Update slot fields
  Object.assign(schedule.days[dayIndex].timeSlots[slotIndex], updates);

  await schedule.save();
  return schedule;
};

/**
 * Delete time slot
 * @param {string} doctorId - Doctor user ID
 * @param {string} dayOfWeek - Day of week
 * @param {string} slotId - Slot ID
 * @returns {Promise<Object>} Updated schedule
 */
const deleteTimeSlot = async (doctorId, dayOfWeek, slotId) => {
  const schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    throw new Error('Weekly schedule not found');
  }

  const dayIndex = schedule.days.findIndex(day => day.dayOfWeek === dayOfWeek);

  if (dayIndex === -1) {
    throw new Error('Day schedule not found');
  }

  schedule.days[dayIndex].timeSlots = schedule.days[dayIndex].timeSlots.filter(
    slot => slot._id.toString() !== slotId
  );

  await schedule.save();
  return schedule;
};

/**
 * Get available slots for a specific date
 * @param {string} doctorId - Doctor user ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Promise<Array>} Available time slots
 */
const getAvailableSlotsForDate = async (doctorId, date) => {
  const schedule = await WeeklySchedule.findOne({ doctorId });

  if (!schedule) {
    return [];
  }

  const dateParts = parseCalendarDate(date);
  const bookableSlots = buildBookableSlots(schedule, dateParts);
  if (bookableSlots.length === 0) return [];

  const previousDay = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day - 1));
  const endOfDay = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));

  // Include the previous calendar day so an overnight legacy appointment can
  // never expose an overlapping early-morning slot.
  const appointments = await Appointment.find({
    doctorId,
    appointmentDate: {
      $gte: previousDay,
      $lt: endOfDay
    },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES }
  });

  return bookableSlots.filter((slot) => isSlotFree(slot, appointments, dateParts));
};

module.exports = {
  upsertSchedule,
  getSchedule,
  updateAppointmentDuration,
  addTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getAvailableSlotsForDate,
  // Exported for appointment creation and direct unit testing. The API still
  // exposes only getAvailableSlotsForDate.
  buildBookableSlots,
  parseCalendarDate,
};

