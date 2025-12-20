const asyncHandler = require('../middleware/asyncHandler');
const weeklyScheduleService = require('../services/weeklySchedule.service');

/**
 * Create or update weekly schedule
 */
exports.upsertSchedule = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.upsertSchedule(req.userId, req.body);
  res.json({ success: true, message: 'Schedule updated successfully', data: result });
});

/**
 * Get weekly schedule
 */
exports.getSchedule = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.getSchedule(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update appointment duration
 */
exports.updateAppointmentDuration = asyncHandler(async (req, res) => {
  const result = await weeklyScheduleService.updateAppointmentDuration(req.userId, req.body.duration);
  res.json({ success: true, message: 'Appointment duration updated successfully', data: result });
});

/**
 * Add time slot to a day
 */
exports.addTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek } = req.params;
  const result = await weeklyScheduleService.addTimeSlot(req.userId, dayOfWeek, req.body);
  res.json({ success: true, message: 'Time slot added successfully', data: result });
});

/**
 * Update time slot
 */
exports.updateTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek, slotId } = req.params;
  const result = await weeklyScheduleService.updateTimeSlot(req.userId, dayOfWeek, slotId, req.body);
  res.json({ success: true, message: 'Time slot updated successfully', data: result });
});

/**
 * Delete time slot
 */
exports.deleteTimeSlot = asyncHandler(async (req, res) => {
  const { dayOfWeek, slotId } = req.params;
  const result = await weeklyScheduleService.deleteTimeSlot(req.userId, dayOfWeek, slotId);
  res.json({ success: true, message: 'Time slot deleted successfully', data: result });
});

/**
 * Get available slots for a date (public)
 */
exports.getAvailableSlotsForDate = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.query;
  const result = await weeklyScheduleService.getAvailableSlotsForDate(doctorId, date);
  res.json({ success: true, message: 'OK', data: result });
});


