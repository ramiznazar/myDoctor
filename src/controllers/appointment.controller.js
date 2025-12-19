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
 * Automatically filters by doctorId for doctors and patientId for patients
 */
exports.list = asyncHandler(async (req, res) => {
  // Auto-filter by user role
  const filter = { ...req.query };
  
  if (req.userRole === 'DOCTOR') {
    // Doctors see only their appointments
    filter.doctorId = req.userId;
  } else if (req.userRole === 'PATIENT') {
    // Patients see only their appointments
    filter.patientId = req.userId;
  }
  // Admin can see all appointments (no auto-filter)
  
  const result = await appointmentService.listAppointments(filter);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get appointment by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await appointmentService.getAppointment(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Accept appointment (doctor action)
 */
exports.accept = asyncHandler(async (req, res) => {
  const result = await appointmentService.acceptAppointment(req.params.id, req.userId);
  res.json({ success: true, message: 'Appointment accepted successfully', data: result });
});

/**
 * Reject appointment (doctor action)
 */
exports.reject = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await appointmentService.rejectAppointment(req.params.id, req.userId, reason);
  res.json({ success: true, message: 'Appointment rejected successfully', data: result });
});

/**
 * Cancel appointment (patient action)
 */
exports.cancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await appointmentService.cancelAppointment(req.params.id, req.userId, reason);
  res.json({ success: true, message: 'Appointment cancelled successfully', data: result });
});

