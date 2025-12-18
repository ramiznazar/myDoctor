const asyncHandler = require('../middleware/asyncHandler');
const availabilityService = require('../services/availability.service');

/**
 * Set doctor availability
 */
exports.setAvailability = asyncHandler(async (req, res) => {
  const result = await availabilityService.setAvailability(req.userId, req.body);
  res.json({ success: true, message: 'Availability set successfully', data: result });
});

/**
 * Get doctor availability
 */
exports.getAvailability = asyncHandler(async (req, res) => {
  const result = await availabilityService.getAvailability(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get available time slots (public)
 */
exports.getAvailableSlots = asyncHandler(async (req, res) => {
  const { doctorId, date } = req.query;
  const result = await availabilityService.getAvailableSlots(doctorId, date);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Check time slot availability (public)
 */
exports.checkTimeSlot = asyncHandler(async (req, res) => {
  const { doctorId, date, timeSlot } = req.query;
  const result = await availabilityService.isTimeSlotAvailable(doctorId, date, timeSlot);
  res.json({ success: true, message: 'OK', data: { available: result } });
});












