const asyncHandler = require('../middleware/asyncHandler');
const appointmentService = require('../services/appointment.service');

/**
 * Create appointment
 */
exports.create = asyncHandler(async (req, res) => {
  const appointmentData = {
    ...req.body,
    createdBy: req.userId
  };
  const result = await appointmentService.createAppointment(appointmentData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update appointment status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await appointmentService.updateAppointmentStatus(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List appointments with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await appointmentService.listAppointments(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get appointment by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await appointmentService.getAppointment(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

