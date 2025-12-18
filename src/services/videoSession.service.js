const VideoSession = require('../models/videoSession.model');
const Appointment = require('../models/appointment.model');
const { isAppointmentTimeStarted } = require('../middleware/appointmentAccess');

/**
 * Start video session for appointment
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} Created video session
 */
const startSession = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Check appointment status - must be CONFIRMED
  if (appointment.status !== 'CONFIRMED') {
    const statusMessages = {
      'PENDING': 'Appointment is pending doctor acceptance. Video call will be available after the doctor accepts the appointment.',
      'REJECTED': 'This appointment was rejected. Video call is not available.',
      'CANCELLED': 'This appointment was cancelled. Video call is not available.',
      'COMPLETED': 'This appointment has been completed. Video call is no longer available.',
      'NO_SHOW': 'This appointment was marked as no-show. Video call is not available.'
    };
    throw new Error(statusMessages[appointment.status] || 'Video call is not available for this appointment status.');
  }

  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Video call is only available for online appointments');
  }

  // Check if appointment time has started
  if (!isAppointmentTimeStarted(appointment.appointmentDate, appointment.appointmentTime)) {
    const appointmentDateTime = new Date(appointment.appointmentDate);
    const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);
    throw new Error(`Video call is only available at the scheduled appointment time. Your appointment is scheduled for ${appointmentDateTime.toLocaleString()}.`);
  }

  // Check if session already exists
  let session = await VideoSession.findOne({ appointmentId });
  
  if (session) {
    // Update existing session
    session.startedAt = new Date();
    await session.save();
  } else {
    // Create new session
    const sessionId = `SESSION-${Date.now()}-${appointmentId}`;
    
    session = await VideoSession.create({
      appointmentId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      sessionId,
      startedAt: new Date()
    });

    // Link session to appointment
    appointment.videoSessionId = session._id;
    await appointment.save();
  }

  return session;
};

/**
 * End video session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session
 */
const endSession = async (sessionId) => {
  const session = await VideoSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Video session not found');
  }

  session.endedAt = new Date();
  await session.save();

  return session;
};

/**
 * Get session by appointment ID
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object>} Video session
 */
const getSessionByAppointment = async (appointmentId) => {
  const session = await VideoSession.findOne({ appointmentId })
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage');
  
  if (!session) {
    throw new Error('Video session not found');
  }

  return session;
};

module.exports = {
  startSession,
  endSession,
  getSessionByAppointment
};

