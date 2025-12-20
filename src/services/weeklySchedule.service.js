const WeeklySchedule = require('../models/weeklySchedule.model');
const Appointment = require('../models/appointment.model');

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

  // Parse date and get day of week
  const [year, month, day] = date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[targetDate.getDay()];

  // Find day schedule
  const daySchedule = schedule.days.find(day => day.dayOfWeek === dayOfWeek);

  if (!daySchedule || !daySchedule.timeSlots || daySchedule.timeSlots.length === 0) {
    return [];
  }

  // Create date range for the entire day
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  // Get appointments for this date
  const appointments = await Appointment.find({
    doctorId,
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['PENDING', 'CONFIRMED'] }
  });

  // Extract booked time slots
  const bookedSlots = appointments.map(apt => apt.appointmentTime);

  // Filter available slots (not booked and marked as available)
  const availableSlots = daySchedule.timeSlots
    .filter(slot => {
      if (!slot.isAvailable) return false;
      
      // Check if slot is booked
      const isBooked = bookedSlots.some(bookedTime => {
        // Simple comparison - can be enhanced for slot overlap checking
        return bookedTime === slot.startTime;
      });

      return !isBooked;
    })
    .map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: schedule.appointmentDuration
    }));

  return availableSlots;
};

module.exports = {
  upsertSchedule,
  getSchedule,
  updateAppointmentDuration,
  addTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getAvailableSlotsForDate
};

