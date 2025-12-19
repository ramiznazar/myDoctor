const Appointment = require('../models/appointment.model');
const asyncHandler = require('./asyncHandler');

/**
 * Helper function to check if appointment time has started
 * @param {Date} appointmentDate - Appointment date
 * @param {String} appointmentTime - Appointment time (HH:MM format)
 * @returns {boolean} True if appointment time has started
 */
const isAppointmentTimeStarted = (appointmentDate, appointmentTime) => {
  if (!appointmentDate || !appointmentTime) {
    return false;
  }

  // Parse appointment time (HH:MM format)
  const [hours, minutes] = appointmentTime.split(':').map(Number);
  
  // Create appointment datetime
  const appointmentDateTime = new Date(appointmentDate);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  // Get current time
  const now = new Date();
  
  // Check if current time is >= appointment time
  return now >= appointmentDateTime;
};

/**
 * Middleware to check appointment access for communication
 * Requires:
 * 1. Appointment must be CONFIRMED (doctor accepted)
 * 2. Appointment time must have started
 * 3. User must be either the doctor or patient of the appointment
 */
const requireAppointmentAccess = asyncHandler(async (req, res, next) => {
  const { appointmentId } = req.body.appointmentId ? req.body : { appointmentId: req.params.appointmentId };
  const userId = req.userId;
  const userRole = req.userRole;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required',
      errors: [{ field: 'appointmentId', message: 'Appointment ID is required' }]
    });
  }

  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      errors: []
    });
  }

  // Check if user is the doctor or patient
  const isDoctor = appointment.doctorId && appointment.doctorId.toString() === userId;
  const isPatient = appointment.patientId && appointment.patientId.toString() === userId;

  if (!isDoctor && !isPatient) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this appointment',
      errors: []
    });
  }

  // Check appointment status - must be CONFIRMED
  if (appointment.status !== 'CONFIRMED') {
    const statusMessages = {
      'PENDING': 'Appointment is pending doctor acceptance. Communication will be available after the doctor accepts the appointment.',
      'REJECTED': 'This appointment was rejected. Communication is not available.',
      'CANCELLED': 'This appointment was cancelled. Communication is not available.',
      'COMPLETED': 'This appointment has been completed. Communication is no longer available.',
      'NO_SHOW': 'This appointment was marked as no-show. Communication is not available.'
    };

    return res.status(403).json({
      success: false,
      message: statusMessages[appointment.status] || 'Communication is not available for this appointment status.',
      errors: []
    });
  }

  // Check if appointment time has started
  if (!isAppointmentTimeStarted(appointment.appointmentDate, appointment.appointmentTime)) {
    const appointmentDateTime = new Date(appointment.appointmentDate);
    const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);
    
    return res.status(403).json({
      success: false,
      message: `Communication is only available at the scheduled appointment time. Your appointment is scheduled for ${appointmentDateTime.toLocaleString()}.`,
      errors: [],
      appointmentDateTime: appointmentDateTime.toISOString()
    });
  }

  // Attach appointment to request for use in controllers
  req.appointment = appointment;
  next();
});

/**
 * Middleware to check appointment access but allow access before time (for getting session info)
 * Still requires CONFIRMED status
 */
const requireConfirmedAppointment = asyncHandler(async (req, res, next) => {
  const { appointmentId } = req.body.appointmentId ? req.body : { appointmentId: req.params.appointmentId };
  const userId = req.userId;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required',
      errors: []
    });
  }

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      errors: []
    });
  }

  const isDoctor = appointment.doctorId && appointment.doctorId.toString() === userId;
  const isPatient = appointment.patientId && appointment.patientId.toString() === userId;

  if (!isDoctor && !isPatient) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this appointment',
      errors: []
    });
  }

  if (appointment.status !== 'CONFIRMED') {
    return res.status(403).json({
      success: false,
      message: 'Appointment must be confirmed before accessing communication features.',
      errors: []
    });
  }

  req.appointment = appointment;
  next();
});

module.exports = {
  requireAppointmentAccess,
  requireConfirmedAppointment,
  isAppointmentTimeStarted
};












