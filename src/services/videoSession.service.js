const VideoSession = require('../models/videoSession.model');
const Appointment = require('../models/appointment.model');

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

  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Appointment is not an online booking');
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

